import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AppConfig } from '../config/configuration';
import { DatabaseService } from '../database/database.service';
import { CategoriaVehiculo } from '../users/users.types';
import { calculateFare } from './pricing';

/** Versión de API con la que firma la llave efímera que usa el PaymentSheet de la app. */
const EPHEMERAL_KEY_API_VERSION = '2020-08-27';

@Injectable()
export class PaymentsService {
  private readonly cfg: AppConfig['payments'];
  private readonly stripe: Stripe.Stripe | null;

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('payments', { infer: true });
    this.stripe = this.cfg.stripeEnabled && this.cfg.stripeSecretKey ? new Stripe(this.cfg.stripeSecretKey) : null;
  }

  /** AC0.1: cotización con el catálogo y el precio de `config`. */
  async quote(km: number, categoria: CategoriaVehiculo) {
    const row = await this.db.queryOne<{ rendimiento_km_l: string; precio: string | null }>(
      `SELECT c.rendimiento_km_l,
              (SELECT valor FROM config WHERE clave = 'precio_litro_gasolina') AS precio
         FROM vehicle_catalogo c
        WHERE c.categoria = $1`,
      [categoria],
    );
    if (!row?.precio) throw new ServiceUnavailableException('Falta precio_litro_gasolina en config');
    const fare = calculateFare(
      km,
      Number(row.rendimiento_km_l),
      Number(row.precio),
      this.cfg.repartoPasajero,
      this.cfg.comisionMxn,
    );
    return { ...fare, categoria, moneda: 'MXN' };
  }

  /** AC1.1: datos para que la app guarde una tarjeta con el PaymentSheet. */
  async setupIntent(userId: string) {
    const stripe = this.requireStripe();
    const customerId = await this.customerFor(stripe, userId);
    const [ephemeralKey, setupIntent] = await Promise.all([
      stripe.ephemeralKeys.create({ customer: customerId }, { apiVersion: EPHEMERAL_KEY_API_VERSION }),
      stripe.setupIntents.create({ customer: customerId, usage: 'off_session', payment_method_types: ['card'] }),
    ]);
    return {
      setupIntentClientSecret: setupIntent.client_secret,
      customerId,
      ephemeralKeySecret: ephemeralKey.secret,
      publishableKey: this.cfg.stripePublishableKey,
    };
  }

  /** AC1.2: tarjetas guardadas, sin datos sensibles. */
  async methods(userId: string) {
    const stripe = this.requireStripe();
    const user = await this.findUser(userId);
    if (!user.stripe_customer_id) return { items: [] };
    const { data } = await stripe.paymentMethods.list({ customer: user.stripe_customer_id, type: 'card' });
    return {
      items: data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
      })),
    };
  }

  private async customerFor(stripe: Stripe.Stripe, userId: string): Promise<string> {
    const user = await this.findUser(userId);
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const customer = await stripe.customers.create(
      { email: user.correo, name: user.nombre, metadata: { userId } },
      { idempotencyKey: `${userId}:customer` },
    );
    // Si dos peticiones compiten, gana la primera que escribió; la idempotencia de Stripe devuelve el mismo Customer.
    const saved = await this.db.queryOne<{ stripe_customer_id: string }>(
      `UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $2) WHERE id = $1 RETURNING stripe_customer_id`,
      [userId, customer.id],
    );
    return saved?.stripe_customer_id ?? customer.id;
  }

  private async findUser(userId: string) {
    const user = await this.db.queryOne<{ correo: string; nombre: string; stripe_customer_id: string | null }>(
      'SELECT correo, nombre, stripe_customer_id FROM users WHERE id = $1',
      [userId],
    );
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  /** AC1.3: sin Stripe configurado (local), los endpoints de tarjeta responden 503. */
  private requireStripe(): Stripe.Stripe {
    if (!this.stripe) throw new ServiceUnavailableException('Pagos con Stripe deshabilitados');
    return this.stripe;
  }
}

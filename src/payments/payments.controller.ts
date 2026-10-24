import { Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuoteQueryDto } from './dto/quote.query';
import { PaymentsService } from './payments.service';

/** Spec 011. Todas las rutas requieren JWT. */
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** 200 cotización · 400 validación · 401 sin token */
  @Get('quote')
  quote(@Query() q: QuoteQueryDto) {
    return this.payments.quote(q.km, q.categoria);
  }

  /** 200 datos para el PaymentSheet · 401 · 503 Stripe deshabilitado */
  @Post('setup-intent')
  @HttpCode(200)
  setupIntent(@CurrentUser() user: JwtPayload) {
    return this.payments.setupIntent(user.sub);
  }

  /** 200 { items } · 401 · 503 Stripe deshabilitado */
  @Get('methods')
  methods(@CurrentUser() user: JwtPayload) {
    return this.payments.methods(user.sub);
  }
}

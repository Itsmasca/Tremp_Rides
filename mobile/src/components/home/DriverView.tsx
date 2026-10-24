import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PillSelector from '@/components/PillSelector';
import { calculatePrice, CATEGORY_LABEL, EFFICIENCY_KM_L, FUEL, money, VehicleCategory } from '@/constants/pricing';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { PassengerRequest, REQUESTS } from '@/data/rides';
import { useUser } from '@/store/user';

import BottomSheet from './BottomSheet';
import MapBackground from './MapBackground';

const TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM'];

export default function DriverView() {
  const user = useUser();
  // Si entró sin registro (demo), asumimos sedán
  const category: VehicleCategory = user.vehicleType ?? 'Sedan';
  const carName = user.carName ?? `${CATEGORY_LABEL[category]}`;

  const [online, setOnline] = useState(false);
  const [published, setPublished] = useState(false);
  const [time, setTime] = useState<string | null>('7:00 AM');
  const [seats, setSeats] = useState(3);
  const [requests, setRequests] = useState<PassengerRequest[]>(REQUESTS);
  const [accepted, setAccepted] = useState<PassengerRequest[]>([]);

  const priceOf = (r: PassengerRequest) => calculatePrice(r.pickupKm + r.tripKm, category);

  const accept = (r: PassengerRequest) => {
    if (accepted.length >= seats) return;
    // Al aceptar, el monto queda congelado (se guarda km, rendimiento, precio/L y resultado)
    setAccepted((a) => [...a, r]);
    setRequests((list) => list.filter((x) => x.id !== r.id));
  };
  const reject = (r: PassengerRequest) => setRequests((list) => list.filter((x) => x.id !== r.id));

  const cancelTrip = () => {
    Alert.alert(
      '¿Cancelar el viaje?',
      'Si cancelas tú, los pasajeros no pagan nada. Se les avisará de inmediato.',
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar viaje',
          style: 'destructive',
          onPress: () => {
            setPublished(false);
            setAccepted([]);
            setRequests(REQUESTS);
          },
        },
      ],
    );
  };

  const absorbedToday = accepted.reduce((sum, r) => sum + priceOf(r).driverAbsorbs, 0);
  const pins = online && published ? [...requests, ...accepted].map((r) => ({ id: r.id, coords: r.coords, title: r.name })) : [];

  return (
    <>
      <MapBackground pins={pins} />

      {!online ? (
        // Desconectado: botón grande estilo DiDi
        <View style={styles.offlineWrap}>
          <TouchableOpacity activeOpacity={0.85} style={styles.goButton} onPress={() => setOnline(true)}>
            <Text style={styles.goText}>IR</Text>
          </TouchableOpacity>
          <View style={styles.offlineBar}>
            <Text style={styles.offlineTitle}>Estás desconectado</Text>
            <Text style={styles.muted}>Conéctate para ofrecer lugares a la Anáhuac</Text>
          </View>
        </View>
      ) : (
        <BottomSheet
          footer={
            <TouchableOpacity
              style={styles.disconnect}
              onPress={() => {
                setOnline(false);
                setPublished(false);
              }}>
              <Text style={styles.disconnectText}>Desconectarse</Text>
            </TouchableOpacity>
          }>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>En línea</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.muted}>
              {carName} · {EFFICIENCY_KM_L[category]} km/L
            </Text>
          </View>

          {/* Precio de gasolina: lo fija el sistema, solo se muestra */}
          <View style={styles.fuelRow}>
            <Ionicons name="water-outline" size={18} color={Colors.primaryDark} />
            <Text style={styles.fuelText}>
              Gasolina {FUEL.name} · {money(FUEL.pricePerLiter)}/L
            </Text>
            <Text style={styles.fuelMeta}>Actualizado {FUEL.updatedAt}</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{money(absorbedToday)}</Text>
              <Text style={styles.muted}>Absorbes hoy (30%)</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {accepted.length}/{seats}
              </Text>
              <Text style={styles.muted}>Lugares</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.muted}>Calificación</Text>
            </View>
          </View>

          {!published ? (
            <>
              <Text style={styles.section}>Publica tu viaje a la Anáhuac</Text>
              <Text style={styles.label}>Hora de salida</Text>
              <PillSelector options={TIMES.map((t) => ({ label: t, value: t }))} value={time} onChange={setTime} />
              <Text style={styles.label}>Lugares disponibles</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setSeats((s) => Math.max(1, s - 1))}>
                  <Ionicons name="remove" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{seats}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => setSeats((s) => Math.min(6, s + 1))}>
                  <Ionicons name="add" size={22} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="calculator-outline" size={18} color={Colors.primaryDark} />
                <Text style={styles.infoText}>
                  El precio lo calcula el sistema con los km de cada pasajero, el rendimiento de tu{' '}
                  {CATEGORY_LABEL[category].toLowerCase()} y el precio de la gasolina. Cada pasajero paga el 70% de su
                  gasolina y tú absorbes el 30%.
                </Text>
              </View>

              <TouchableOpacity activeOpacity={0.85} style={styles.publish} onPress={() => setPublished(true)}>
                <Text style={styles.publishText}>Publicar viaje</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.tripCard}>
                <Ionicons name="navigate" size={20} color={Colors.primaryDark} />
                <Text style={styles.tripText}>
                  Sales {time} · {seats} {seats === 1 ? 'lugar' : 'lugares'}
                </Text>
                <TouchableOpacity onPress={cancelTrip}>
                  <Text style={styles.cancelLink}>Cancelar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Solicitudes ({requests.length})</Text>
              {requests.length === 0 && <Text style={styles.muted}>No hay solicitudes nuevas por ahora.</Text>}
              {requests.map((r) => {
                const b = priceOf(r);
                return (
                  <View key={r.id} style={styles.requestRow}>
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={22} color={Colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {r.name} <Text style={styles.rating}>★ {r.rating.toFixed(1)}</Text>
                      </Text>
                      <Text style={styles.muted}>
                        {r.pickup} · {r.pickupKm} km + {r.tripKm} km
                      </Text>
                      <Text style={styles.amount}>
                        Paga {money(b.passengerPays)} · absorbes {money(b.driverAbsorbs)}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(r)}>
                      <Ionicons name="close" size={20} color={Colors.danger} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.acceptBtn, accepted.length >= seats && { opacity: 0.4 }]}
                      onPress={() => accept(r)}>
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {accepted.length > 0 && (
                <>
                  <Text style={styles.section}>Pasajeros confirmados</Text>
                  {accepted.map((r) => {
                    const b = priceOf(r);
                    return (
                      <View key={r.id} style={styles.requestRow}>
                        <Ionicons name="lock-closed" size={20} color={Colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{r.name}</Text>
                          <Text style={styles.muted}>
                            {r.pickup} · {b.km} km · {b.liters.toFixed(2)} L
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.name}>{money(b.passengerPays)}</Text>
                          <Text style={styles.tiny}>congelado</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}
        </BottomSheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  offlineWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  goButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    marginBottom: -20,
    zIndex: 2,
    ...Shadow,
  },
  goText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  offlineBar: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 34,
    paddingBottom: 40,
    alignItems: 'center',
    ...Shadow,
  },
  offlineTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  tiny: { fontSize: 11, color: Colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  statusText: { fontSize: 18, fontWeight: '800', color: Colors.text },
  fuelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  fuelText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  fuelMeta: { fontSize: 11, color: Colors.primaryDark },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  section: { fontSize: 17, fontWeight: '800', color: Colors.text, marginTop: 20, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginTop: 12, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 22, fontWeight: '800', color: Colors.text, minWidth: 24, textAlign: 'center' },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 18,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  publish: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center' },
  publishText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  tripText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  cancelLink: { color: Colors.danger, fontWeight: '700' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rating: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
  amount: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark, marginTop: 2 },
  rejectBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnect: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  disconnectText: { color: Colors.textMuted, fontSize: 15, fontWeight: '700' },
});

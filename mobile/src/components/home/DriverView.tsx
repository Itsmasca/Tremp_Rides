import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PillSelector from '@/components/PillSelector';
import { calculatePrice, CATEGORY_LABEL, money, VehicleCategory } from '@/constants/pricing';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { PassengerRequest, REQUESTS, RideTime, TIMES } from '@/data/rides';
import { useShareLocation } from '@/hooks/useShareLocation';
import { useUserLocation } from '@/hooks/useUserLocation';
import { setUser, useUser } from '@/store/user';

import BottomSheet from './BottomSheet';
import MapBackground from './MapBackground';

// Un conductor ofrece como máximo 3 lugares
const MAX_SEATS = 3;

export default function DriverView() {
  const user = useUser();
  // Si entró sin registro (demo), asumimos sedán
  const category: VehicleCategory = user.vehicleType ?? 'Sedan';
  const carName = user.carName ?? `${CATEGORY_LABEL[category]}`;

  const [online, setOnline] = useState(false);
  const [published, setPublished] = useState(false);
  const [time, setTime] = useState<RideTime | null>(user.time ?? '7:00 AM');
  const [seats, setSeats] = useState(MAX_SEATS);
  const [requests, setRequests] = useState<PassengerRequest[]>(REQUESTS);
  const [accepted, setAccepted] = useState<PassengerRequest[]>([]);

  // En línea, el conductor comparte su ubicación en vivo para que sus pasajeros lo vean acercarse
  const { coords: me } = useUserLocation();
  useShareLocation(online, me);

  const priceOf = (r: PassengerRequest) => calculatePrice(r.pickupKm + r.tripKm, category);

  const accept = (r: PassengerRequest) => {
    if (accepted.length >= seats) return;
    // Al aceptar, el monto queda fijo
    setAccepted((a) => [...a, r]);
    setRequests((list) => list.filter((x) => x.id !== r.id));
  };
  const reject = (r: PassengerRequest) => setRequests((list) => list.filter((x) => x.id !== r.id));

  const cancelTrip = () => {
    Alert.alert(
      '¿Cancelar el viaje?',
      'Se avisará a los pasajeros de inmediato.',
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

  const earnedToday = accepted.reduce((sum, r) => sum + priceOf(r).passengerPays, 0);
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
            <Text style={styles.muted}>{carName}</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{money(earnedToday)}</Text>
              <Text style={styles.muted}>Recibes hoy</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{seats - accepted.length}</Text>
              <Text style={styles.muted}>{seats - accepted.length === 1 ? 'Lugar libre' : 'Lugares libres'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.muted}>Calificación</Text>
            </View>
          </View>

          {!published ? (
            <>
              <Text style={styles.section}>Publica tu viaje a la Anáhuac</Text>
              <Text style={styles.label}>¿A qué hora sales?</Text>
              <PillSelector
                options={TIMES.map((t) => ({ label: t, value: t }))}
                value={time}
                onChange={(t) => {
                  setTime(t);
                  setUser({ time: t });
                }}
              />
              <Text style={styles.label}>¿Cuántos pasajeros puedes llevar? (máximo {MAX_SEATS})</Text>
              <PillSelector
                options={[1, 2, 3].map((n) => ({ label: `${n} ${n === 1 ? 'pasajero' : 'pasajeros'}`, value: String(n) }))}
                value={String(seats)}
                onChange={(v) => setSeats(Number(v))}
              />

              <TouchableOpacity activeOpacity={0.85} style={styles.publish} onPress={() => setPublished(true)}>
                <Text style={styles.publishText}>Publicar viaje</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.tripCard}>
                <Ionicons name="navigate" size={20} color={Colors.primaryDark} />
                <Text style={styles.tripText}>
                  Sales {time} · {seats - accepted.length} de {seats} {seats === 1 ? 'lugar libre' : 'lugares libres'}
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
                        {r.pickup} · {b.km} km
                      </Text>
                      <Text style={[styles.muted, r.time === time && styles.match]}>
                        Quiere salir {r.time}
                        {r.time === time ? ' · coincide contigo' : ''}
                      </Text>
                      <Text style={styles.amount}>{money(b.passengerPays)}</Text>
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
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{r.name}</Text>
                          <Text style={styles.muted}>{r.pickup}</Text>
                        </View>
                        <Text style={styles.name}>{money(b.passengerPays)}</Text>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' },
  statusText: { fontSize: 18, fontWeight: '800', color: Colors.text },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, backgroundColor: Colors.background, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  section: { fontSize: 17, fontWeight: '800', color: Colors.text, marginTop: 20, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginTop: 12, marginBottom: 8 },
  match: { color: Colors.primaryDark, fontWeight: '600' },
  publish: { marginTop: 20, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16, alignItems: 'center' },
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

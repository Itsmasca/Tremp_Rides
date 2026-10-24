import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PillSelector from '@/components/PillSelector';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { PassengerRequest, REQUESTS } from '@/data/rides';
import { useUser } from '@/store/user';

import BottomSheet from './BottomSheet';
import MapBackground from './MapBackground';

const TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM'];
const PRICES = ['20', '25', '30', '35'];

export default function DriverView() {
  const user = useUser();
  const [online, setOnline] = useState(false);
  const [published, setPublished] = useState(false);
  const [time, setTime] = useState<string | null>('7:00 AM');
  const [price, setPrice] = useState<string | null>('25');
  const [seats, setSeats] = useState(3);
  const [requests, setRequests] = useState<PassengerRequest[]>(REQUESTS);
  const [accepted, setAccepted] = useState<PassengerRequest[]>([]);

  const accept = (r: PassengerRequest) => {
    if (accepted.length >= seats) return;
    setAccepted((a) => [...a, r]);
    setRequests((list) => list.filter((x) => x.id !== r.id));
  };
  const reject = (r: PassengerRequest) => setRequests((list) => list.filter((x) => x.id !== r.id));

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
            <Text style={styles.muted}>{user.vehicleType ?? 'Tu auto'}</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>${accepted.length * Number(price ?? 0)}</Text>
              <Text style={styles.muted}>Ganado hoy</Text>
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
              <Text style={styles.label}>Precio por lugar</Text>
              <PillSelector options={PRICES.map((p) => ({ label: `$${p}`, value: p }))} value={price} onChange={setPrice} />
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
              <TouchableOpacity activeOpacity={0.85} style={styles.publish} onPress={() => setPublished(true)}>
                <Text style={styles.publishText}>Publicar viaje</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.tripCard}>
                <Ionicons name="navigate" size={20} color={Colors.primaryDark} />
                <Text style={styles.tripText}>
                  Sales {time} · ${price} por lugar
                </Text>
                <TouchableOpacity onPress={() => setPublished(false)}>
                  <Text style={styles.edit}>Editar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Solicitudes ({requests.length})</Text>
              {requests.length === 0 && <Text style={styles.muted}>No hay solicitudes nuevas por ahora.</Text>}
              {requests.map((r) => (
                <View key={r.id} style={styles.requestRow}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={22} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {r.name} <Text style={styles.rating}>★ {r.rating.toFixed(1)}</Text>
                    </Text>
                    <Text style={styles.muted}>
                      {r.pickup} · a {r.distanceKm} km
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
              ))}

              {accepted.length > 0 && (
                <>
                  <Text style={styles.section}>Pasajeros confirmados</Text>
                  {accepted.map((r) => (
                    <View key={r.id} style={styles.requestRow}>
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      <Text style={[styles.name, { flex: 1 }]}>{r.name}</Text>
                      <Text style={styles.muted}>{r.pickup}</Text>
                    </View>
                  ))}
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
  edit: { color: Colors.primaryDark, fontWeight: '700' },
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

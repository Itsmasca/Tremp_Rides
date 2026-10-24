import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { Ride, RIDES } from '@/data/rides';
import { useUser } from '@/store/user';

import BottomSheet from './BottomSheet';
import MapBackground from './MapBackground';

type Filter = 'todos' | 'conductoras' | 'barato' | 'pronto';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Solo conductoras', value: 'conductoras' },
  { label: 'Más barato', value: 'barato' },
  { label: 'Llega antes', value: 'pronto' },
];

export default function PassengerView() {
  const user = useUser();
  const [filter, setFilter] = useState<Filter>(user.womenOnly ? 'conductoras' : 'todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requested, setRequested] = useState<Ride | null>(null);

  const rides = useMemo(() => {
    let list = [...RIDES];
    if (filter === 'conductoras') list = list.filter((r) => r.driverGender === 'mujer');
    if (filter === 'barato') list.sort((a, b) => a.price - b.price);
    if (filter === 'pronto') list.sort((a, b) => a.etaMin - b.etaMin);
    return list;
  }, [filter]);

  const selected = rides.find((r) => r.id === selectedId) ?? null;
  const pins = (requested ? [requested] : rides).map((r) => ({ id: r.id, coords: r.coords, title: r.driver }));

  return (
    <>
      <MapBackground pins={pins} selectedId={requested?.id ?? selectedId} onSelect={setSelectedId} />

      {requested ? (
        <BottomSheet
          footer={
            <TouchableOpacity style={styles.cancelButton} onPress={() => setRequested(null)}>
              <Text style={styles.cancelText}>Cancelar solicitud</Text>
            </TouchableOpacity>
          }>
          <Text style={styles.waitingTitle}>Esperando a que {requested.driver.split(' ')[0]} confirme…</Text>
          <Text style={styles.muted}>Te avisaremos en cuanto acepte tu lugar.</Text>
          <View style={styles.driverCard}>
            <View style={styles.avatarLg}>
              <Ionicons name="person" size={28} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rideName}>{requested.driver}</Text>
              <Text style={styles.muted}>{requested.car}</Text>
              <Text style={styles.rating}>★ {requested.rating.toFixed(1)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>${requested.price}</Text>
              <Text style={styles.muted}>{requested.departure}</Text>
            </View>
          </View>
        </BottomSheet>
      ) : (
        <BottomSheet
          footer={
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!selected}
              style={[styles.requestButton, !selected && styles.requestDisabled]}
              onPress={() => selected && setRequested(selected)}>
              <Text style={styles.requestText}>
                {selected ? `Pedir lugar con ${selected.driver.split(' ')[0]} · $${selected.price}` : 'Elige un ride'}
              </Text>
            </TouchableOpacity>
          }>
          {/* Origen / destino estilo Uber */}
          <View style={styles.routeBox}>
            <View style={styles.routeRow}>
              <View style={styles.dot} />
              <Text style={styles.routeText}>Tu ubicación</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={styles.square} />
              <Text style={[styles.routeText, { fontWeight: '700' }]}>Anáhuac Mayab</Text>
            </View>
          </View>

          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.chip, filter === f.value && styles.chipActive]}>
                <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {rides.map((ride) => {
            const active = ride.id === selectedId;
            return (
              <TouchableOpacity
                key={ride.id}
                activeOpacity={0.8}
                onPress={() => setSelectedId(ride.id)}
                style={[styles.rideRow, active && styles.rideRowActive]}>
                <View style={styles.avatar}>
                  <Ionicons name={ride.vehicle === 'Sedan' ? 'car-sport' : 'car'} size={24} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rideName}>
                    {ride.driver} <Text style={styles.rating}>★ {ride.rating.toFixed(1)}</Text>
                  </Text>
                  <Text style={styles.muted}>
                    {ride.origin} · sale {ride.departure}
                  </Text>
                  <Text style={styles.muted}>
                    {ride.vehicle} · {ride.seats} {ride.seats === 1 ? 'lugar' : 'lugares'} · {ride.etaMin} min
                  </Text>
                </View>
                <Text style={styles.price}>${ride.price}</Text>
              </TouchableOpacity>
            );
          })}
          {rides.length === 0 && <Text style={styles.muted}>No hay rides con este filtro.</Text>}
        </BottomSheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  routeBox: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 14,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeLine: { width: 2, height: 16, backgroundColor: Colors.border, marginLeft: 4, marginVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  square: { width: 10, height: 10, backgroundColor: Colors.text },
  routeText: { fontSize: 16, color: Colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  rideRowActive: { borderColor: Colors.primary, backgroundColor: '#F0FDFF' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  rating: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },
  muted: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  price: { fontSize: 18, fontWeight: '800', color: Colors.text },
  requestButton: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  requestDisabled: { backgroundColor: Colors.border },
  requestText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  waitingTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    marginTop: 14,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  cancelText: { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});

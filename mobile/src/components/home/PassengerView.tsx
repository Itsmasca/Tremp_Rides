import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import PriceBreakdown from '@/components/PriceBreakdown';
import { calculatePrice, money } from '@/constants/pricing';
import { Colors, Radius } from '@/constants/theme';
import { Ride, RIDES } from '@/data/rides';
import { useUser } from '@/store/user';

import BottomSheet from './BottomSheet';
import MapBackground from './MapBackground';

type Filter = 'todos' | 'conductoras' | 'barato' | 'pronto';
type RequestStatus = 'esperando' | 'aceptado';

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Solo conductoras', value: 'conductoras' },
  { label: 'Más barato', value: 'barato' },
  { label: 'Llega antes', value: 'pronto' },
];

// El precio siempre lo calcula el sistema a partir de los km del servidor
const priceOf = (r: Ride) => calculatePrice(r.pickupKm + r.tripKm, r.vehicle);

export default function PassengerView() {
  const user = useUser();
  const [filter, setFilter] = useState<Filter>(user.womenOnly ? 'conductoras' : 'todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [requested, setRequested] = useState<Ride | null>(null);
  const [status, setStatus] = useState<RequestStatus>('esperando');

  const rides = useMemo(() => {
    let list = [...RIDES];
    if (filter === 'conductoras') list = list.filter((r) => r.driverGender === 'mujer');
    if (filter === 'barato') list.sort((a, b) => priceOf(a).passengerPays - priceOf(b).passengerPays);
    if (filter === 'pronto') list.sort((a, b) => a.etaMin - b.etaMin);
    return list;
  }, [filter]);

  const selected = rides.find((r) => r.id === selectedId) ?? null;
  const pins = (requested ? [requested] : rides).map((r) => ({ id: r.id, coords: r.coords, title: r.driver }));

  const cancel = () => {
    // Regla del issue #4: antes de que el conductor arranque no se cobra nada;
    // a medio camino se cobra el 70% de la gasolina de los km ya recorridos (GPS).
    if (status === 'esperando') {
      setRequested(null);
      return;
    }
    Alert.alert(
      '¿Cancelar el viaje?',
      'El conductor ya va en camino. Se te cobrará el 70% de la gasolina de los kilómetros que ya recorrió, medidos con GPS. Si cancelas antes de que arranque, no se cobra nada.',
      [
        { text: 'Seguir con el viaje', style: 'cancel' },
        { text: 'Cancelar viaje', style: 'destructive', onPress: () => setRequested(null) },
      ],
    );
  };

  if (requested) {
    const breakdown = priceOf(requested);
    const accepted = status === 'aceptado';
    return (
      <>
        <MapBackground pins={pins} selectedId={requested.id} />
        <BottomSheet
          footer={
            <View style={{ gap: 8 }}>
              {!accepted && (
                // Solo para la demo: simula que el conductor acepta
                <TouchableOpacity style={styles.demoButton} onPress={() => setStatus('aceptado')}>
                  <Text style={styles.demoText}>Simular que el conductor acepta</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={cancel}>
                <Text style={styles.cancelText}>{accepted ? 'Cancelar viaje' : 'Cancelar solicitud'}</Text>
              </TouchableOpacity>
            </View>
          }>
          <Text style={styles.waitingTitle}>
            {accepted ? `${requested.driver.split(' ')[0]} aceptó tu lugar 🎉` : `Esperando a que ${requested.driver.split(' ')[0]} confirme…`}
          </Text>
          <Text style={styles.muted}>
            {accepted ? 'El precio ya quedó fijo. Te avisamos cuando esté cerca.' : 'El precio queda fijo en cuanto acepte.'}
          </Text>

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
              <Text style={styles.price}>{money(breakdown.passengerPays)}</Text>
              <Text style={styles.muted}>{requested.departure}</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <PriceBreakdown
              breakdown={breakdown}
              category={requested.vehicle}
              pickupKm={requested.pickupKm}
              tripKm={requested.tripKm}
              frozen={accepted}
            />
          </View>

          <View style={styles.policy}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
            <Text style={styles.policyText}>
              Si cancelas antes de que el conductor arranque, no pagas nada. Si cancela el conductor, tampoco.
            </Text>
          </View>
        </BottomSheet>
      </>
    );
  }

  return (
    <>
      <MapBackground pins={pins} selectedId={selectedId} onSelect={setSelectedId} />
      <BottomSheet
        footer={
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!selected}
            style={[styles.requestButton, !selected && styles.requestDisabled]}
            onPress={() => {
              if (!selected) return;
              setStatus('esperando');
              setRequested(selected);
            }}>
            <Text style={styles.requestText}>
              {selected
                ? `Pedir lugar con ${selected.driver.split(' ')[0]} · ${money(priceOf(selected).passengerPays)}`
                : 'Elige un ride'}
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
          const breakdown = priceOf(ride);
          return (
            <View key={ride.id}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedId(ride.id);
                  setShowBreakdown(false);
                }}
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
                    {ride.car} · {breakdown.km} km · {ride.seats} {ride.seats === 1 ? 'lugar' : 'lugares'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.price}>{money(breakdown.passengerPays)}</Text>
                  <Text style={styles.tiny}>70% gasolina</Text>
                </View>
              </TouchableOpacity>

              {active && (
                <View style={styles.breakdownWrap}>
                  <TouchableOpacity style={styles.breakdownToggle} onPress={() => setShowBreakdown((v) => !v)}>
                    <Text style={styles.breakdownToggleText}>¿Cómo se calcula?</Text>
                    <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primaryDark} />
                  </TouchableOpacity>
                  {showBreakdown && (
                    <PriceBreakdown breakdown={breakdown} category={ride.vehicle} pickupKm={ride.pickupKm} tripKm={ride.tripKm} />
                  )}
                </View>
              )}
            </View>
          );
        })}
        {rides.length === 0 && <Text style={styles.muted}>No hay rides con este filtro.</Text>}
      </BottomSheet>
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
  rideRowActive: { borderColor: Colors.primary, backgroundColor: '#F0FDFF', marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  breakdownWrap: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: Colors.primary,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    padding: 10,
    marginBottom: 6,
    gap: 8,
  },
  breakdownToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  breakdownToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
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
  tiny: { fontSize: 11, color: Colors.textMuted },
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
  policy: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12, paddingHorizontal: 4 },
  policyText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  demoButton: { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
  demoText: { color: Colors.primaryDark, fontSize: 13, fontWeight: '700' },
  cancelButton: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  cancelText: { color: Colors.danger, fontSize: 15, fontWeight: '700' },
});

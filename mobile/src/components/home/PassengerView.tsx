import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { calculatePrice, money } from '@/constants/pricing';
import { Colors, Radius } from '@/constants/theme';
import PillSelector from '@/components/PillSelector';
import { ANAHUAC, Ride, RIDES, RideTime, TIMES } from '@/data/rides';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { useUserLocation } from '@/hooks/useUserLocation';
import { setUser, useUser } from '@/store/user';
import { distanceKm, etaMinutes } from '@/utils/geo';

import BottomSheet from './BottomSheet';
import MapBackground from './MapBackground';

type RequestStatus = 'esperando' | 'aceptado';

// El precio siempre lo calcula el sistema a partir de los km del servidor
const priceOf = (r: Ride) => calculatePrice(r.pickupKm + r.tripKm, r.vehicle);

// A menos de esto (km) consideramos que el conductor ya llegó
const ARRIVED_KM = 0.08;

export default function PassengerView() {
  const user = useUser();
  const [time, setTime] = useState<RideTime | null>(user.time);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requested, setRequested] = useState<Ride | null>(null);
  const [status, setStatus] = useState<RequestStatus>('esperando');
  const { coords: me } = useUserLocation();

  // Cuando el conductor acepta, seguimos su ubicación en vivo hasta el punto de recogida
  const accepted = !!requested && status === 'aceptado';
  const { coords: driverAt, live } = useDriverLocation({
    active: accepted,
    driverId: requested?.driverId,
    start: requested?.coords ?? ANAHUAC,
    pickup: me,
  });
  // Sin GPS (solo en la demo) usamos la Anáhuac como punto de recogida
  const driverKm = driverAt ? distanceKm(driverAt, me ?? ANAHUAC) : null;
  const arrived = driverKm !== null && driverKm <= ARRIVED_KM;

  const rides = useMemo(() => {
    // "Solo conductoras" viene del registro; no es un filtro que se cambie aquí
    const list = user.womenOnly ? RIDES.filter((r) => r.driverGender === 'mujer') : [...RIDES];
    // Primero los rides que salen a la hora que eligió el pasajero
    if (time) list.sort((a, b) => Number(b.departure === time) - Number(a.departure === time));
    return list;
  }, [user.womenOnly, time]);

  const selected = rides.find((r) => r.id === selectedId) ?? null;
  // Ya aceptado: en lugar del pin fijo se ve el carrito del conductor moviéndose
  const pins = (requested ? (accepted && driverAt ? [] : [requested]) : rides).map((r) => ({ id: r.id, coords: r.coords, title: r.driver }));

  const cancel = () => {
    if (status === 'esperando') {
      setRequested(null);
      return;
    }
    Alert.alert(
      '¿Cancelar el viaje?',
      'El conductor ya va en camino. Se te cobrará una parte del trayecto recorrido.',
      [
        { text: 'Seguir con el viaje', style: 'cancel' },
        { text: 'Cancelar viaje', style: 'destructive', onPress: () => setRequested(null) },
      ],
    );
  };

  if (requested) {
    const breakdown = priceOf(requested);
    const first = requested.driver.split(' ')[0];
    let liveText = 'Te avisamos cuando esté cerca.';
    if (accepted && arrived) liveText = `${first} ya llegó a tu punto de recogida.`;
    else if (accepted && driverKm !== null) liveText = `A ${driverKm.toFixed(1)} km · llega en ~${etaMinutes(driverKm)} min`;
    else if (accepted && !live) liveText = `Esperando la ubicación de ${first}…`;
    return (
      <>
        <MapBackground pins={pins} selectedId={requested.id} driver={accepted ? driverAt : null} />
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
            {!accepted ? `Esperando a que ${first} confirme…` : arrived ? `¡${first} llegó! 🚗` : `${first} va en camino 🚗`}
          </Text>
          {accepted && live && !arrived && (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>Ubicación en tiempo real</Text>
            </View>
          )}
          <Text style={styles.muted}>{accepted ? liveText : 'Te avisamos en cuanto acepte tu lugar.'}</Text>

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

        <Text style={styles.label}>¿A qué hora quieres salir?</Text>
        <View style={styles.times}>
          <PillSelector
            options={TIMES.map((t) => ({ label: t, value: t }))}
            value={time}
            onChange={(t) => {
              setTime(t);
              setUser({ time: t });
              setSelectedId(null);
            }}
          />
        </View>

        {rides.map((ride) => {
          const active = ride.id === selectedId;
          const breakdown = priceOf(ride);
          return (
            <View key={ride.id}>
              <TouchableOpacity
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
                  <Text style={[styles.muted, time === ride.departure && styles.match]}>
                    Sale {ride.departure}
                    {time === ride.departure ? ' · coincide contigo' : ''}
                  </Text>
                  <Text style={styles.muted}>{ride.origin}</Text>
                  <Text style={styles.muted}>
                    {ride.car} · {ride.seats} {ride.seats === 1 ? 'lugar' : 'lugares'}
                  </Text>
                </View>
                <Text style={styles.price}>{money(breakdown.passengerPays)}</Text>
              </TouchableOpacity>

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
  label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  times: { marginBottom: 14 },
  match: { color: Colors.primaryDark, fontWeight: '600' },
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
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveLabel: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
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

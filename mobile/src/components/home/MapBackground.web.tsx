import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { ANAHUAC, MERIDA_REGION } from '@/data/rides';

import type { MapPin } from './MapBackground';

type Props = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  driver?: { latitude: number; longitude: number } | null;
};

// En web (vista previa) dibujamos un mapa falso; en el celular se usa MapLibre + OpenFreeMap
function toPercent(lat: number, lng: number) {
  const top = ((MERIDA_REGION.latitude + MERIDA_REGION.latitudeDelta / 2 - lat) / MERIDA_REGION.latitudeDelta) * 100;
  const left = ((lng - (MERIDA_REGION.longitude - MERIDA_REGION.longitudeDelta / 2)) / MERIDA_REGION.longitudeDelta) * 100;
  return { top: `${top}%`, left: `${left}%` } as any;
}

export default function MapBackground({ pins, selectedId, onSelect, driver }: Props) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.map]}>
      {[15, 35, 55, 75].map((p) => (
        <View key={`h${p}`} style={[styles.road, { top: `${p}%`, left: 0, right: 0, height: 6 } as any]} />
      ))}
      {[20, 45, 70].map((p) => (
        <View key={`v${p}`} style={[styles.road, { left: `${p}%`, top: 0, bottom: 0, width: 6 } as any]} />
      ))}
      <View style={[styles.pin, toPercent(ANAHUAC.latitude, ANAHUAC.longitude)]}>
        <Ionicons name="school" size={26} color={Colors.text} />
      </View>
      {pins.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.pin, toPercent(p.coords.latitude, p.coords.longitude)]}
          onPress={() => onSelect?.(p.id)}>
          <Ionicons name="location" size={p.id === selectedId ? 36 : 28} color={p.id === selectedId ? Colors.primaryDark : Colors.primary} />
        </TouchableOpacity>
      ))}
      {driver && (
        <View style={[styles.car, toPercent(driver.latitude, driver.longitude)]}>
          <Ionicons name="car" size={18} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: '#E6F2F5', overflow: 'hidden' },
  road: { position: 'absolute', backgroundColor: '#FFFFFF' },
  pin: { position: 'absolute', transform: [{ translateX: -14 }, { translateY: -28 }] },
  car: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryDark,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -17 }, { translateY: -17 }],
  },
});

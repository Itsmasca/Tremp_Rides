import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Colors } from '@/constants/theme';
import { ANAHUAC, Coords, MERIDA_REGION } from '@/data/rides';

export type MapPin = { id: string; coords: Coords; title: string };

type Props = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

// Mapa a pantalla completa detrás del panel (estilo Uber/DiDi)
export default function MapBackground({ pins, selectedId, onSelect }: Props) {
  return (
    <MapView style={StyleSheet.absoluteFill} initialRegion={MERIDA_REGION} showsUserLocation>
      <Marker coordinate={ANAHUAC} title="Anáhuac Mayab" pinColor={Colors.text} />
      {pins.map((p) => (
        <Marker
          key={p.id}
          coordinate={p.coords}
          title={p.title}
          pinColor={p.id === selectedId ? Colors.primaryDark : Colors.primary}
          onPress={() => onSelect?.(p.id)}
        />
      ))}
    </MapView>
  );
}

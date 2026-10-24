import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';

import { Colors, Shadow } from '@/constants/theme';
import { ANAHUAC, Coords, MERIDA_REGION } from '@/data/rides';
import { useUserLocation } from '@/hooks/useUserLocation';

export type MapPin = { id: string; coords: Coords; title: string };

type Props = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

// Mosaicos con datos de OpenStreetMap servidos por CARTO (estilo Voyager).
// Los servidores de OSM bloquean a las apps que les piden tiles directamente
// (error 403 "Access blocked", ver osm.wiki/Blocked); CARTO sí lo permite sin
// API key mientras se muestre la atribución.
const MAP_TILES = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

// Mapa a pantalla completa detrás del panel (estilo Uber/DiDi)
export default function MapBackground({ pins, selectedId, onSelect }: Props) {
  const mapRef = useRef<MapView>(null);
  const { coords: me } = useUserLocation();
  const centeredOnce = useRef(false);

  const centerOn = (target: Coords, delta = 0.03) => {
    mapRef.current?.animateToRegion({ ...target, latitudeDelta: delta, longitudeDelta: delta }, 600);
  };

  // La primera vez que sabemos dónde está el usuario, encuadramos su posición y la Anáhuac
  useEffect(() => {
    if (!me || centeredOnce.current) return;
    centeredOnce.current = true;
    mapRef.current?.fitToCoordinates([me, ANAHUAC], {
      edgePadding: { top: 120, right: 60, bottom: 420, left: 60 },
      animated: true,
    });
  }, [me]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={MERIDA_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}>
        <UrlTile urlTemplate={MAP_TILES} maximumZ={19} shouldReplaceMapContent />

        <Marker coordinate={ANAHUAC} title="Anáhuac Mayab" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.schoolPin}>
            <Ionicons name="school" size={18} color="#FFFFFF" />
          </View>
        </Marker>

        {pins.map((p) => {
          const active = p.id === selectedId;
          return (
            <Marker
              key={p.id}
              coordinate={p.coords}
              title={p.title}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onSelect?.(p.id)}>
              <Ionicons name="location" size={active ? 40 : 30} color={active ? Colors.primaryDark : Colors.primary} />
            </Marker>
          );
        })}
      </MapView>

      {/* Botón para volver a mi ubicación */}
      <TouchableOpacity
        style={styles.locateButton}
        activeOpacity={0.8}
        onPress={() => centerOn(me ?? ANAHUAC)}>
        <Ionicons name="locate" size={22} color={Colors.text} />
      </TouchableOpacity>

      <Text style={styles.attribution}>© OpenStreetMap contributors © CARTO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  schoolPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  locateButton: {
    position: 'absolute',
    right: 16,
    top: '36%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow,
  },
  attribution: {
    position: 'absolute',
    left: 8,
    top: '41%',
    fontSize: 10,
    color: Colors.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});

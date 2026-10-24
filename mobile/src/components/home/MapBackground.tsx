import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Shadow } from '@/constants/theme';
import { ANAHUAC, Coords } from '@/data/rides';
import { useUserLocation } from '@/hooks/useUserLocation';

import MapFrame, { MapFrameHandle } from './MapFrame';
import { MAP_HTML } from './mapHtml';

export type MapPin = { id: string; coords: Coords; title: string };

type Props = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  driver?: Coords | null; // posición en vivo del conductor (pasajero ya aceptado)
};

// Mapa a pantalla completa detrás del panel (estilo Uber/DiDi).
// Corre MapLibre + OpenFreeMap dentro de un WebView (celular) o un iframe (navegador):
// gratis y sin ninguna API key. Ver mapHtml.ts y MapFrame.
export default function MapBackground({ pins, selectedId, onSelect, driver }: Props) {
  const frameRef = useRef<MapFrameHandle>(null);
  const [ready, setReady] = useState(false);
  const { coords: me, outOfArea } = useUserLocation();
  const centeredOnce = useRef(false);

  const run = (js: string) => frameRef.current?.run(js);

  // Pines de rides / pasajeros
  useEffect(() => {
    if (ready) run(`window.trempSetPins(${JSON.stringify(pins)}, ${JSON.stringify(selectedId ?? null)})`);
  }, [ready, pins, selectedId]);

  // Punto azul con mi ubicación; la primera vez encuadra mi posición y la Anáhuac
  useEffect(() => {
    if (!ready || !me) return;
    run(`window.trempSetMe(${JSON.stringify(me)})`);
    if (!centeredOnce.current) {
      centeredOnce.current = true;
      run(`window.trempFit(${JSON.stringify([me, ANAHUAC])})`);
    }
  }, [ready, me]);

  // Carrito del conductor; la primera vez que aparece encuadra conductor + yo
  const driverShown = useRef(false);
  const meRef = useRef<Coords | null>(null);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => {
    if (!ready) return;
    run(`window.trempSetDriver(${JSON.stringify(driver ?? null)})`);
    if (!driver) {
      driverShown.current = false;
      return;
    }
    if (!driverShown.current) {
      driverShown.current = true;
      run(`window.trempFit(${JSON.stringify([driver, meRef.current ?? ANAHUAC])})`);
    }
  }, [ready, driver]);

  const onMessage = (raw: string) => {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'select') onSelect?.(msg.id);
    else if (msg.type === 'error') console.warn('[mapa]', msg.message);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapFrame ref={frameRef} html={MAP_HTML} onMessage={onMessage} />

      {/* Botón para volver a mi ubicación */}
      <TouchableOpacity
        style={styles.locateButton}
        activeOpacity={0.8}
        onPress={() => run(`window.trempCenter(${JSON.stringify(me ?? ANAHUAC)})`)}>
        <Ionicons name="locate" size={22} color={Colors.text} />
      </TouchableOpacity>

      {outOfArea && (
        <View style={styles.areaNotice}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.areaText}>Tu ubicación está fuera de Mérida. Mostramos la zona de la Anáhuac.</Text>
        </View>
      )}

      <Text style={styles.attribution}>© OpenFreeMap © OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  areaNotice: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  areaText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
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

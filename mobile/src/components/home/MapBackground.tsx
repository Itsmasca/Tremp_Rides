import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Shadow } from '@/constants/theme';
import { ANAHUAC, Coords } from '@/data/rides';
import { useUserLocation } from '@/hooks/useUserLocation';

import { MAP_HTML } from './mapHtml';

// Los tipos de react-native-webview chocan con los de React 19; lo usamos sin tipar
const MapWebView = WebView as any;

export type MapPin = { id: string; coords: Coords; title: string };

type Props = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

// Mapa a pantalla completa detrás del panel (estilo Uber/DiDi).
// Corre MapLibre + OpenFreeMap dentro de un WebView: gratis y sin ninguna API key
// (ni de Google ni de otro proveedor). Ver mapHtml.ts.
export default function MapBackground({ pins, selectedId, onSelect }: Props) {
  const webRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const { coords: me } = useUserLocation();
  const centeredOnce = useRef(false);

  const run = (js: string) => webRef.current?.injectJavaScript(`${js}; true;`);

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
      <MapWebView
        ref={webRef}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html: MAP_HTML }}
        onMessage={(e: any) => onMessage(e.nativeEvent.data)}
        javaScriptEnabled
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />

      {/* Botón para volver a mi ubicación */}
      <TouchableOpacity
        style={styles.locateButton}
        activeOpacity={0.8}
        onPress={() => run(`window.trempCenter(${JSON.stringify(me ?? ANAHUAC)})`)}>
        <Ionicons name="locate" size={22} color={Colors.text} />
      </TouchableOpacity>

      <Text style={styles.attribution}>© OpenFreeMap © OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: Colors.background },
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

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors } from '@/constants/theme';

// Los tipos de react-native-webview chocan con los de React 19; lo usamos sin tipar
const MapWebView = WebView as any;

export type MapFrameHandle = { run: (js: string) => void };
type Props = { html: string; onMessage: (raw: string) => void };

// Celular: la página del mapa corre dentro de un WebView
const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onMessage }, ref) {
  const webRef = useRef<any>(null);
  useImperativeHandle(ref, () => ({ run: (js) => webRef.current?.injectJavaScript(`${js}; true;`) }), []);

  return (
    <MapWebView
      ref={webRef}
      style={styles.web}
      originWhitelist={['*']}
      source={{ html }}
      onMessage={(e: any) => onMessage(e.nativeEvent.data)}
      javaScriptEnabled
      scrollEnabled={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
    />
  );
});

export default MapFrame;

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: Colors.background },
});

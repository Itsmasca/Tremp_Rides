import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { MapFrameHandle } from './MapFrame';

type Props = { html: string; onMessage: (raw: string) => void };

// Navegador: la misma página del mapa (MapLibre + OpenFreeMap) dentro de un iframe
const MapFrame = forwardRef<MapFrameHandle, Props>(function MapFrame({ html, onMessage }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const handler = useRef(onMessage);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useImperativeHandle(
    ref,
    () => ({
      run: (js) => {
        // srcdoc comparte el origen de la página, así que podemos llamar sus funciones
        try {
          (frame.current?.contentWindow as any)?.eval(js);
        } catch (e) {
          console.warn('[mapa]', e);
        }
      },
    }),
    [],
  );

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && typeof e.data === 'string') handler.current(e.data);
    };
    window.addEventListener('message', listen);
    // En web la página se pre-renderiza: el mapa pudo cargar antes de que React escuche
    if ((frame.current?.contentWindow as any)?.trempReady) handler.current(JSON.stringify({ type: 'ready' }));
    return () => window.removeEventListener('message', listen);
  }, []);

  return createElement('iframe', {
    ref: frame,
    srcDoc: html,
    title: 'Mapa',
    style: { border: 0, width: '100%', height: '100%', display: 'block' },
  });
});

export default MapFrame;

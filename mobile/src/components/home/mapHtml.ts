import { Colors } from '@/constants/theme';
import { ANAHUAC, MERIDA_REGION } from '@/data/rides';

// Página HTML que corre dentro del WebView del mapa.
// MapLibre GL JS (código abierto) + estilo de OpenFreeMap: mapas de OpenStreetMap
// gratis, sin API key, sin cuenta y sin límite de uso (https://openfreemap.org).
const MAPLIBRE_VERSION = '4.7.1';
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const PIN_SVG = (color: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="${color}" stroke="#fff" stroke-width="1.2" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`;

const CAR_SVG = `<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6zM6.5 16c-.8 0-1.5-.7-1.5-1.5S5.7 13 6.5 13s1.5.7 1.5 1.5S7.3 16 6.5 16zm11 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;

const SCHOOL_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3zm-7 9.2v3.6L12 20l7-4.2v-3.6L12 16l-7-3.8z"/></svg>`;

export const MAP_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${Colors.background}; }
  .maplibregl-ctrl-attrib { display: none; }
  .school { width: 34px; height: 34px; border-radius: 17px; background: ${Colors.text}; border: 2px solid #fff;
            display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(3,105,161,.35); }
  .me { width: 16px; height: 16px; border-radius: 8px; background: #2563EB; border: 3px solid #fff;
        box-shadow: 0 0 0 6px rgba(37,99,235,.2); }
  .pin { cursor: pointer; line-height: 0; }
  .car { width: 38px; height: 38px; border-radius: 19px; background: ${Colors.primaryDark}; border: 3px solid #fff;
         display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 8px rgba(8,145,178,.22); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var send = function (msg) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };
  var map = new maplibregl.Map({
    container: 'map',
    style: '${MAP_STYLE_URL}',
    center: [${MERIDA_REGION.longitude}, ${MERIDA_REGION.latitude}],
    zoom: 11.5,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();

  var el = document.createElement('div');
  el.className = 'school';
  el.innerHTML = '${SCHOOL_SVG}';
  new maplibregl.Marker({ element: el }).setLngLat([${ANAHUAC.longitude}, ${ANAHUAC.latitude}]).addTo(map);

  var pinMarkers = [];
  var meMarker = null;
  var PADDING = { top: 120, right: 60, bottom: 420, left: 60 };

  window.trempSetPins = function (pins, selectedId) {
    pinMarkers.forEach(function (m) { m.remove(); });
    pinMarkers = pins.map(function (p) {
      var active = p.id === selectedId;
      var node = document.createElement('div');
      node.className = 'pin';
      node.innerHTML = active ? '${PIN_SVG(Colors.primaryDark, 40)}' : '${PIN_SVG(Colors.primary, 30)}';
      node.addEventListener('click', function (e) { e.stopPropagation(); send({ type: 'select', id: p.id }); });
      return new maplibregl.Marker({ element: node, anchor: 'bottom' })
        .setLngLat([p.coords.longitude, p.coords.latitude]).addTo(map);
    });
  };

  window.trempSetMe = function (me) {
    if (!me) return;
    if (!meMarker) {
      var node = document.createElement('div');
      node.className = 'me';
      meMarker = new maplibregl.Marker({ element: node });
      meMarker.setLngLat([me.longitude, me.latitude]).addTo(map);
    } else {
      meMarker.setLngLat([me.longitude, me.latitude]);
    }
  };

  // Conductor en vivo: el carrito se desliza suave de la posición anterior a la nueva
  var driverMarker = null;
  var driverPos = null;
  var driverAnim = 0;
  window.trempSetDriver = function (c) {
    if (!c) {
      if (driverMarker) { driverMarker.remove(); driverMarker = null; driverPos = null; }
      return;
    }
    var to = [c.longitude, c.latitude];
    if (!driverMarker) {
      var node = document.createElement('div');
      node.className = 'car';
      node.innerHTML = '${CAR_SVG}';
      driverMarker = new maplibregl.Marker({ element: node }).setLngLat(to).addTo(map);
      driverPos = to;
      return;
    }
    var from = driverPos;
    var t0 = performance.now();
    var DURATION = 900;
    cancelAnimationFrame(driverAnim);
    var step = function (now) {
      var t = Math.min(1, (now - t0) / DURATION);
      driverPos = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
      driverMarker.setLngLat(driverPos);
      if (t < 1) driverAnim = requestAnimationFrame(step);
    };
    driverAnim = requestAnimationFrame(step);
  };

  window.trempFit = function (points) {
    var b = new maplibregl.LngLatBounds();
    points.forEach(function (c) { b.extend([c.longitude, c.latitude]); });
    map.fitBounds(b, { padding: PADDING, maxZoom: 15, duration: 800 });
  };

  window.trempCenter = function (c) {
    map.easeTo({ center: [c.longitude, c.latitude], zoom: 14, padding: PADDING, duration: 600 });
  };

  map.on('load', function () { send({ type: 'ready' }); });
  map.on('error', function (e) { send({ type: 'error', message: String((e && e.error && e.error.message) || e) }); });
</script>
</body>
</html>`;

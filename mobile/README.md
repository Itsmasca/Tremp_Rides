# Tremp 🚗

App de rutas solidarias (carpooling) para estudiantes de la Universidad Anáhuac Mayab.

## Correr la app

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go** en tu celular (misma red WiFi), o presiona `w` para abrir en el navegador.
Si algo se traba: `npx expo start -c` (limpia la caché).

## Estructura

```
src/
├── app/                 # Pantallas (Expo Router, una por archivo)
│   ├── _layout.tsx      # Stack sin header
│   ├── index.tsx        # Login
│   ├── register.tsx     # Registro dinámico
│   └── home.tsx         # Dashboard de rides
├── components/          # PrimaryButton, TextField, PillSelector
│   └── home/            # Mapa, panel inferior, vista pasajero y vista conductor
├── store/user.ts        # Estado global del usuario (rol, preferencias)
├── constants/theme.ts   # Paleta de colores, radios y sombras
└── data/rides.ts        # Datos de prueba (mock)
```

## Comandos útiles

- `npx tsc --noEmit` — revisar tipos
- `npx expo lint` — lint
- `npx expo install <paquete>` — instalar dependencias compatibles con el SDK

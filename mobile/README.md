# Tremp 🚗

App de rutas solidarias (carpooling) para estudiantes de la Universidad Anáhuac Mayab.

## Correr la app

```bash
npm install
npx expo start
```

Escanea el QR con **Expo Go** en tu celular (misma red WiFi), o presiona `w` para abrir en el navegador.
Si algo se traba: `npx expo start -c` (limpia la caché).

### En el navegador de la laptop

```bash
npx expo start --web
```

Abre http://localhost:8081. Es la misma app con el mapa real (MapLibre + OpenFreeMap en un iframe).
El backend ya acepta peticiones desde `http://localhost:8081` (`CORS_ORIGINS` en su `.env`).

## Conectar con el backend

Login y registro llaman a `POST /auth/login` y `POST /auth/register` del backend (NestJS, en la raíz del repo).
La URL base está en `src/constants/api.ts`; para cambiarla sin tocar código (el túnel de Cloudflare cambia
cada vez que se levanta) copia `.env.example` a `.env`, ajusta `EXPO_PUBLIC_API_URL` y reinicia con `npx expo start -c`.

Atajo desde la raíz del repo: `./scripts/mobile-vm.sh https://<tunel>.trycloudflare.com` verifica que el backend de la VM
responda (`/health`, `/auth/login`, CORS), escribe `mobile/.env` y arranca Expo (`--web`, `--tunnel`, `--check`, `--help`).

## Estructura

```
src/
├── app/                 # Pantallas (Expo Router, una por archivo)
│   ├── _layout.tsx      # Stack sin header
│   ├── index.tsx        # Login
│   ├── register.tsx     # Registro dinámico
│   └── home.tsx         # Dashboard de rides
├── api/                 # Cliente HTTP (http.ts) y llamadas de autenticación (auth.ts)
├── components/          # PrimaryButton, TextField, PillSelector, ErrorText
│   └── home/            # Mapa (WebView + MapLibre + OpenFreeMap, sin API key), panel, vistas pasajero/conductor
├── store/user.ts        # Estado global del usuario (sesión, rol, preferencias)
├── utils/validation.ts  # Reglas de correo @anahuac.mx y contraseña
├── constants/api.ts     # URL del backend (EXPO_PUBLIC_API_URL)
├── constants/theme.ts   # Paleta de colores, radios y sombras
├── constants/pricing.ts # Fórmula de precio (rendimiento, gasolina, 70/30)
├── hooks/useUserLocation.ts # Permiso y posición del usuario (expo-location)
└── data/rides.ts        # Datos de prueba (mock)
```

## Comandos útiles

- `npx tsc --noEmit` — revisar tipos
- `npx expo lint` — lint
- `npx expo install <paquete>` — instalar dependencias compatibles con el SDK

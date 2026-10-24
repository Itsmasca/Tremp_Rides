// URL base del backend (NestJS). El túnel de Cloudflare cambia cada vez que se
// levanta, así que se puede sobreescribir sin tocar código con la variable
// EXPO_PUBLIC_API_URL en mobile/.env (ver .env.example) y reiniciando `npx expo start -c`.
const DEFAULT_API_URL = 'https://crimes-sie-mandate-skirts.trycloudflare.com';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');

// Tiempo máximo de espera por petición
export const API_TIMEOUT_MS = 15000;

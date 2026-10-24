# 004 · Tareas

- [x] T1 App Expo en `mobile/`: login, registro y home con datos de prueba (PR #11)
- [ ] T2 UI de precios según issue #4: catálogo de coches, desglose 70/30 y cancelaciones (PR #12, abierto)
- [x] T3 Registro con `POST /auth/register` (PR #16) — *AC-I1, AC-I2, AC-I3, AC-I6, AC-I8*
- [x] T4 Login con `POST /auth/login` (PR #16) — *AC-I4*
- [ ] T4a Persistir token en SecureStore, restaurar sesión con `/auth/me` al abrir y logout que limpie — *AC-I5, AC-I7*
- [x] T4b CORS en el backend para Expo web (`CORS_ORIGINS`, métodos explícitos) — *AC-I9*. Verificado con preflight
  desde `http://localhost:8081` (permitido) y desde otro origen (sin `allow-origin`)
- [ ] T5 Conectar rides con la API (spec 006 / 010)
- [ ] T6 Subida real de foto de perfil
- [x] T7 Validar dominio `@anahuac.mx` en el formulario (login y registro, PR #16)
- [x] T8 `scripts/mobile-vm.sh` — *AC-I10*. Verificado contra el backend local: sano → listo; URL guardada
  reutilizada; host inexistente, URL que no es la API (404), sin URL, argumento inválido, CORS ausente con
  `--web`, Postgres caído y API caída → error claro y exit 1; CORS ausente sin `--web` → aviso y continúa;
  arranque real de Expo con la URL inyectada en el bundle. **No probado contra la URL real de Cloudflare**

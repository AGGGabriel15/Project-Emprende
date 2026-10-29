# Catarina Market · app móvil

App de Catarina Market para **clientes, vendedores y repartidores**, hecha con React Native y Expo (SDK 58), Expo Router y TypeScript. La administración sigue en el web: si entra un administrador, la app le indica que use el panel web.

Usa el mismo backend que el web:

- **Supabase:** datos, RLS, funciones `rpc`, Storage y Realtime, con la clave pública.
- **API del web** (`/api/mobile/*`): solo para lo que necesita secretos del servidor.
  - crear y reanudar el pago con Stripe;
  - sincronizar el pago al volver de Stripe;
  - reembolsos inmediatos;
  - fotos de evidencia firmadas.
- **Notificaciones push:**
  - la tabla `notifications` dispara el trigger `notifications_push`;
  - pg_net llama a `/api/webhooks/push`;
  - el web envía el aviso con la Expo Push API.

## Código compartido con el web

La app importa directamente los módulos puros de `../src` con el alias `@/`:

- tipos;
- estados de pedidos y envíos;
- precios y horarios;
- validaciones con zod;
- teléfonos;
- carrito;
- y las acciones con `supabase` como parámetro (`*/mutations.ts`, `*/read.ts`, `checkout/server.ts`).

El código propio de la app usa `~/`. `metro.config.js` resuelve los paquetes de esos archivos desde `mobile/node_modules`, que es lo único que instala EAS Build.

> No importes en la app nada que dependa de Next (`next/*`, `@/lib/supabase/server`, Server Actions).

## Correr la app

```bash
cd mobile
npm install
cp .env.example .env.local   # URL y clave pública de Supabase (las mismas NEXT_PUBLIC_* del web)
npm run start:go              # Expo Go: escanea el QR con la app Expo Go
```

- **Expo Go** sirve para todo, salvo las notificaciones push.
- **Push:** hace falta una build de desarrollo: `npx eas-cli@latest build --profile development --platform android`. Luego se corre con `npm start`.
- **Web:** `npx expo start --web` abre la app en el navegador. Es útil para revisar pantallas, pero no es un objetivo de la app.

## Animación de apertura

`src/components/brand/animated-splash.tsx` dibuja el isotipo oficial sobre el verde Catarina:

1. aparece el patrón;
2. se traza la C;
3. ruedan las ruedas;
4. brota la hoja;
5. sube "Catarina MARKET".

Corre en cada arranque. Al volver tras 10 minutos o más en segundo plano, corre una versión corta. Respeta "reducir movimiento" del sistema.

## Verificación

```bash
npx tsc --noEmit
npx expo lint
npm test                                  # módulos compartidos con el web
npx expo export --platform android        # que el bundle compile
```

## Configuración pendiente (una sola vez)

1. **Supabase → Authentication → URL Configuration → Redirect URLs:** agrega `catarinamarket://**` y, para Expo Go, `exp://**`. Lo necesita el inicio de sesión con Google.
2. **Cuenta de Expo** (gratis, en expo.dev):
   - `npx eas-cli@latest login`;
   - `npx eas-cli@latest init` dentro de `mobile/`, que escribe el `projectId` que usan las notificaciones push.
3. **Push en Android:** crea un proyecto de Firebase y sube la clave FCM v1 a EAS (`npx eas-cli@latest credentials`).
4. **Push en iOS:** necesita una cuenta de Apple Developer. EAS genera la clave APNs.
5. **Pagos y reembolsos:** el web debe estar desplegado con las rutas `/api/mobile/*`. La app las llama en `EXPO_PUBLIC_API_URL`.
6. **Tiendas:** Google Play y App Store, cuando quieras publicar:
   - `npx eas-cli@latest build --profile production`;
   - `npx eas-cli@latest submit`.

# Catarina Market

Marketplace multi-vendedor para los negocios de Catarina, Masaya: artesanías, plantas, flores y decoración. Cada negocio tiene su catálogo, horario, zonas de delivery y pedidos propios. El cliente arma un carrito con productos de varios negocios y paga **un pedido por negocio**.

**Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + RLS, Auth, Storage, Realtime, pg_cron), Stripe en modo test, Tailwind CSS 4, Zustand, TanStack Query, React Hook Form + Zod, Recharts, Resend, Sentry, Vitest y Playwright.

> Stripe no abre cuentas de comercio en Nicaragua. Aquí se usa en **modo test**, o con la pasarela simulada si no hay llaves. Los pagos pasan por la interfaz `PaymentProvider` (`src/features/payments/provider.ts`), así que cambiar a otra pasarela solo requiere una nueva implementación.

## Puesta en marcha

### 1. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

| Variable | Dónde se obtiene |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Misma pantalla (clave secreta, solo en el servidor) |
| `DATABASE_URL` | Supabase → Connect → Session pooler |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe en modo test (opcional; sin ellas se usa el pago simulado) |
| `RESEND_API_KEY` | Opcional; sin ella los correos solo se muestran en consola |

### 2. Base de datos

```bash
npm install
npm run db:migrate   # esquema, funciones, RLS, buckets, Realtime y cron
npm run db:seed      # 17 departamentos, 153 municipios, categorías, comisión 8 %
npm run seed:demo    # opcional: admin, cliente, 2 repartidores y 3 negocios con productos
```

Las migraciones están en `supabase/migrations/` y quedan registradas en la misma tabla que usa la CLI de Supabase. Para aplicarlas sin `DATABASE_URL`, pega cada archivo en orden en el **SQL Editor** de Supabase.

### 3. Ajustes en el panel de Supabase

1. **Auth → URL Configuration:** Site URL `http://localhost:3000` y la redirección `http://localhost:3000/auth/callback`.
2. **Auth → Providers → Google:** activa Google con el Client ID y el Secret de Google Cloud Console. En Google, la URL de redirección autorizada es `https://<proyecto>.supabase.co/auth/v1/callback`.
3. **Auth → Hooks (opcional):** el *Custom Access Token Hook* `public.custom_access_token_hook` pone el rol en el JWT. Sin el hook, los layouts consultan el rol en `profiles`.

### 4. Ejecutar

```bash
npm run dev
```

Para pagos con Stripe en modo test:

```bash
npm run stripe:listen
```

El script reenvía los eventos `checkout.session.*` (la CLI 1.5x exige `--events`). Copia el
`whsec_…` que imprime a `STRIPE_WEBHOOK_SECRET` en `.env.local` y reinicia `npm run dev`.
Aunque el webhook no esté corriendo, al volver de Stripe la app consulta la sesión y
acredita el pago. Usa la tarjeta `4242 4242 4242 4242`. Con `PAYMENTS_MODE=mock`, el checkout abre una pasarela simulada.

## Cuentas demo (`npm run seed:demo`)

Todas usan la contraseña de `SEED_DEFAULT_PASSWORD` (por defecto `Catarina2026!`).

| Rol | Correo |
| --- | --- |
| Admin | `admin@catarina.local` |
| Cliente | `cliente@catarina.local` |
| Vendedores | `maria@catarina.local` (vivero), `jose@catarina.local` (artesanías), `ana@catarina.local` (floristería, solo para llevar) |
| Repartidores | `repartidor@catarina.local` (Luis), `repartidor2@catarina.local` (Karla) |

## Reglas de negocio

Las valida el servidor en funciones de Postgres (`supabase/migrations/`). El frontend solo las muestra. El principio: **el dinero lo retiene la plataforma y solo se libera con prueba de entrega y sin reclamos.**

**Vendedores**
- **Dos niveles, misma comisión.** "Emprendedor verificado" (de casa, sin RUC) sube cédula, selfie con la cédula, fotos y ubicación GPS del lugar, y la administración debe registrar una **visita de verificación** antes de aprobarlo. "Negocio formal" sube RUC y matrícula. Formalizarse sube los límites; no baja la comisión.
- **Límites por nivel** (configurables en Admin → Configuración): el informal nuevo tiene hasta 5 pedidos en curso y C$ 20 000 al mes, que suben con historial. Los primeros 10 productos de cada negocio pasan por **Moderación**.
- La ubicación GPS y las notas de la visita van en `business_private`, no en `businesses`, porque el catálogo lee `businesses.*` públicamente.

**Pedido y logística**
- **Carrito por negocio:** un checkout corresponde a un negocio, un pedido y un pago. `create_order()` recalcula precio, stock, horario, cobertura y límites.
- **Total del pedido:** productos + envío (tarifa por zona de la plataforma, en `platform_delivery_zones`) + **tarifa de servicio**. El negocio recibe los productos menos la comisión.
- **Estados:**
  - delivery: `pending_payment` → `preparing` → `ready` → `on_the_way` → `delivered` → `completed`;
  - retiro en el local: `preparing` → `ready_for_pickup` → `delivered` → `completed`;
  - desvíos: `disputed` (reclamo), `cancelled`, `returned` y `refunded`.
- **Evidencia en cada paso:**
  - el negocio marca "listo" con una **foto** del pedido empacado;
  - el envío queda **disponible** para los repartidores en turno; el primero que lo acepta se lo lleva (hasta 2 entregas activas por repartidor). El admin puede asignar o reasignar en **Envíos**, y recibe una alerta si nadie lo toma en 15 min;
  - el repartidor marca "Llegué al negocio", registra la recolección con foto y GPS (o la rechaza si no coincide), y "Llegué donde el cliente", que avisa al cliente para que tenga su PIN;
  - la entrega solo se confirma con el **PIN de 4 dígitos** que ve el cliente (más foto y GPS), y se bloquea tras 5 intentos fallidos. El negocio no interviene en la entrega;
  - si el cliente no aparece, el repartidor registra un intento fallido; con 2, el pedido vuelve al negocio. En casos excepcionales el admin confirma "sin PIN" con motivo, y queda auditado.
- **Automático** (`pg_cron`, cada 10 min, `run_order_maintenance()`):
  - si vence el plazo de preparación (24 h): cancelación, reembolso total y falta al negocio;
  - si el cliente no retira en 7 días: reembolso menos la tarifa de servicio;
  - si pasan 48 h desde la entrega sin reclamo: el pedido queda `completed` y la venta pasa al libro contable.

**Repartidores**
- Son empleados: el admin crea sus cuentas en **Repartidores** (rol `courier`, tabla `couriers`); no hay registro público.
- Ven el teléfono, la dirección y la nota del cliente **solo mientras la entrega está activa** (`courier_delivery()`); al terminar quedan solo el nombre de pila y el municipio. Antes de aceptar ven solo el negocio y el destino (`available_shipments()`).
- El cliente ve al repartidor asignado (foto, vehículo, placa, calificación y su teléfono mientras va en ruta) y lo **califica** tras la entrega (`delivery_ratings`). Las calificaciones de 1–2 estrellas avisan al admin.

**Dinero**
- **Reembolsos en cola:** la base decide el monto y el responsable (`refunds.status = pending`). El servidor llama a la pasarela y confirma con `complete_refund()`. Los pendientes se reintentan desde Admin → Reclamos o con `GET /api/cron/refunds` y `Authorization: Bearer $CRON_SECRET`.
- **Libro contable** (`ledger_entries`): registra venta, comisión y ajustes por reclamo. Las liquidaciones suman lo disponible. El informal con menos de 10 pedidos espera 7 días extra antes de cobrar.
- **Reclamos:** el cliente tiene 48 h y debe adjuntar fotos si el producto llegó dañado, incompleto o distinto. El admin decide con la evidencia y fija monto y responsable. Si el responsable es el negocio, el reembolso se descuenta de su liquidación y suma una falta.
- **Faltas:** se registran por cancelar un pedido pagado, no preparar a tiempo, ser rechazado en la recolección o perder un reclamo. Con 3 faltas en 90 días la tienda se suspende automáticamente.
- **Ganancia:** el dashboard del admin muestra comisiones + servicio + envíos − costo de repartidores − pasarela (estimada) − reembolsos a cargo de la plataforma.

**Otros**
- **Comisión:** la regla del negocio tiene prioridad sobre la de la categoría, y esta sobre la tasa global. La tasa se congela en cada pedido.
- **Pagos y webhook:** el pago se confirma por webhook o consultando la sesión de Stripe al volver del pago. El webhook ignora eventos repetidos (`event.id`).
- **Seguridad:** RLS en todas las tablas. Los documentos y las fotos de evidencia van en buckets privados y se abren con URL firmada. Las acciones del admin quedan en `audit_logs`.

## App móvil (`mobile/`)

App en React Native + Expo para clientes, vendedores y repartidores (el administrador usa este web). Comparte con el web los módulos puros de `src/` (tipos, estados, precios, horarios, validaciones y las acciones `*/mutations.ts` y `*/read.ts`, que reciben el cliente de Supabase) y usa estas rutas del web:

- `/api/mobile/*`: pago con Stripe, sincronización, reembolsos y evidencias, con el token de la app (`Authorization: Bearer`).
- `/api/webhooks/push`: lo llama la base (trigger `notifications_push` vía pg_net) para enviar cada aviso como notificación push.

Instrucciones, animación de apertura y configuración pendiente en [`mobile/README.md`](mobile/README.md). `mobile/` está fuera del typecheck, del lint y del deploy del web (`tsconfig.json`, `eslint.config.mjs`, `.vercelignore`).

## Rutas

- **Público:** `/`, `/buscar`, `/negocios`, `/negocios/[slug]` (sello de nivel y métricas), `/productos/[id]`, `/vender`, `/terminos`, `/privacidad`
- **Repartidor:** `/repartidor` (turno, disponibles y entregas activas), `/repartidor/entrega/[id]` (paso a paso), `historial`, `perfil`
- **Cliente:** `/carrito`, `/checkout/[businessId]`, `/pedidos`, `/pedidos/[id]` (PIN, evidencia y reclamo), `/cuenta`
- **Vendedor:** `/vendedor/solicitud`, `panel` (nivel y límites), `pedidos` (foto de listo, PIN), `productos`, `categorias`, `horarios`, `delivery`, `finanzas` (libro y faltas), `reportes`, `formalizar`, `configuracion`, `perfil`
- **Admin:** `/admin/dashboard` (ganancia), `solicitudes` (visita y formalización), `moderacion`, `negocios`, `usuarios`, `pedidos`, `envios` (asignar, reasignar, confirmar sin PIN), `repartidores`, `reclamos` (reembolsos y faltas), `comisiones`, `pagos-negocios`, `categorias`, `zonas`, `configuracion`, `auditoria`, `perfil`

## Calidad

```bash
npm run lint
npm run typecheck
npm test            # reglas en TS: estados, precios/ganancia, horario, carrito, validaciones, roles, reportes
npm run test:db     # reglas en Postgres (niveles, pedidos, repartidores) contra Supabase, en una transacción que se revierte
npm run build
npm run test:e2e    # requiere seed:demo; la compra completa necesita PAYMENTS_MODE=mock
```

Para correr las E2E sin tocar el `npm run dev` del puerto 3000, usa un build de producción en otro puerto:

```bash
npm run build
PAYMENTS_MODE=mock npx next start -p 3001
E2E_PORT=3001 npm run test:e2e -- --project=desktop
```

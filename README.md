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
npm run seed:demo    # opcional: admin, cliente y 3 negocios con productos
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
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Usa la tarjeta `4242 4242 4242 4242`. Con `PAYMENTS_MODE=mock`, el checkout abre una pasarela simulada.

## Cuentas demo (`npm run seed:demo`)

Todas usan la contraseña de `SEED_DEFAULT_PASSWORD` (por defecto `Catarina2026!`).

| Rol | Correo |
| --- | --- |
| Admin | `admin@catarina.local` |
| Cliente | `cliente@catarina.local` |
| Vendedores | `maria@catarina.local` (vivero), `jose@catarina.local` (artesanías), `ana@catarina.local` (floristería, solo para llevar) |

## Reglas de negocio

Las valida el servidor en funciones de Postgres (`supabase/migrations/…_functions.sql`). El frontend solo las muestra.

- **Carrito por negocio:** un checkout corresponde a un negocio, un pedido y un pago. El precio y el stock se recalculan en `create_order()`; nunca se usa el precio que envía el navegador.
- **Servicio:** Delivery o Para llevar, según lo que active el negocio. La cobertura se valida con `can_deliver()` y `delivery_zones`: la tarifa del municipio tiene prioridad sobre la del departamento.
- **Horario:** `is_business_open()` usa la zona `America/Managua` y tiene en cuenta los cierres especiales y el botón "Cerrar ahora".
- **Comisión:** la regla del negocio tiene prioridad sobre la de la categoría, y esta sobre la tasa global de `platform_settings` (8 %). La tasa se congela en cada pedido y no se cobra sobre el envío.
- **Estados del pedido:** `pending_payment` → `preparing` (solo por webhook o pago confirmado) → `ready_for_pickup` / `on_the_way` → `completed`. El negocio o el admin pueden cancelar, siempre con motivo; la cancelación pasa a `refunded` y repone el stock.
- **Stock:** se descuenta al confirmarse el pago. Si alguien compró la última unidad antes, el pedido se cancela y se reembolsa automáticamente.
- **Pagos sin confirmar:** `pg_cron` cancela cada 5 minutos los pedidos `pending_payment` vencidos (30 minutos).
- **Webhook:** verifica la firma e ignora eventos repetidos según `event.id`.
- **Seguridad:** RLS en todas las tablas. Los documentos van en un bucket privado y se abren con URL firmada. Cada acción de admin queda en `audit_logs`.

## Rutas

- **Público:** `/`, `/buscar`, `/negocios`, `/negocios/[slug]`, `/productos/[id]`, `/vender`, `/terminos`, `/privacidad`
- **Cliente:** `/carrito`, `/checkout/[businessId]`, `/pedidos` (pestañas Pendientes, Activos e Historial), `/pedidos/[id]`, `/cuenta`
- **Vendedor:** `/vendedor/solicitud`, `/vendedor/panel`, `pedidos` (tablero en tiempo real), `productos`, `categorias`, `horarios`, `delivery`, `finanzas`, `reportes` (Excel/PDF), `configuracion`
- **Admin:** `/admin/dashboard`, `solicitudes`, `negocios`, `usuarios`, `pedidos`, `comisiones`, `pagos-negocios`, `categorias`, `zonas`, `configuracion`, `auditoria`

## Calidad

```bash
npm run lint
npm run typecheck
npm test            # reglas: transiciones, horario, comisión, cobertura, carrito, validaciones, reportes
npm run build
npm run test:e2e    # requiere seed:demo y PAYMENTS_MODE=mock
```

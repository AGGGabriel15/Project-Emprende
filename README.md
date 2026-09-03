# Emprendedores Unidos de Catarina

Marketplace académico multivendedor para artesanías, plantas y alimentos elaborados por emprendedores de Catarina, Masaya. La aplicación incluye catálogo público, carrito por vendedor, pedidos, pago de demostración o Stripe Test, correo, panel de emprendedor y administración.

## Requisitos

- Node.js 20.9 o superior (probado con Node 24)
- npm 11 o superior
- Docker Desktop con Docker Compose
- Google Chrome para las pruebas E2E

## Inicio rápido

1. Copia `.env.example` a `.env.local`. El repositorio ya incluye una configuración local ignorada por Git.
2. Levanta la base de datos:

   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

3. Instala dependencias y carga datos de demostración:

   ```bash
   npm install
   npm run seed
   ```

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

La tienda estará en `http://localhost:3000` y mongo-express en `http://localhost:8081` (`admin` / `admin_local`).

## Cuentas de demostración

Todas usan el valor de `SEED_DEFAULT_PASSWORD`:

| Rol           | Correo                   | Estado    |
| ------------- | ------------------------ | --------- |
| Administrador | `admin@catarina.local`   | Activo    |
| Cliente       | `cliente@catarina.local` | Activo    |
| Emprendedor   | `maria@catarina.local`   | Aprobado  |
| Emprendedor   | `jose@catarina.local`    | Pendiente |

El seed es idempotente: puede ejecutarse varias veces sin duplicar registros. No elimina datos creados manualmente.

## Pagos

`PAYMENTS_MODE=mock` activa una pantalla local que permite completar el flujo sin dinero ni credenciales externas. La reserva de inventario se realiza antes del pago y se convierte en venta al confirmar.

Para Stripe Test:

1. Cambia `PAYMENTS_MODE=stripe`.
2. Configura `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`.
3. Instala Stripe CLI y reenvía eventos:

   ```bash
   stripe listen --forward-to localhost:3000/api/pagos/webhook
   ```

4. Usa una tarjeta de prueba, por ejemplo `4242 4242 4242 4242`, fecha futura y cualquier CVC.

Los pagos se envían en NIO. Las sesiones expiran en 30 minutos; el webhook libera el inventario de sesiones expiradas o fallidas. Los eventos son idempotentes a nivel del estado del pedido.

## Correo SMTP

Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`. La confirmación se intenta después de acreditar el pago. Si SMTP no está configurado o falla, el pedido conserva el pago y registra `emailStatus=failed` para diagnóstico.

## Imágenes

Los emprendedores aprobados pueden subir JPG, PNG o WebP de hasta 5 MB. Los archivos se guardan en `public/uploads/products` y se excluyen de Git. Este almacenamiento está pensado exclusivamente para la entrega local.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Las pruebas E2E requieren MongoDB activo y el seed cargado. Playwright utiliza Chrome instalado en el sistema.

## Rutas principales

- Públicas: `/`, `/productos`, `/productos/[id]`, `/categorias/[slug]`
- Cliente: `/carrito`, `/checkout`, `/mis-pedidos`
- Emprendedor: `/dashboard`, `/dashboard/productos`, `/dashboard/pedidos`
- Administración: `/admin`, `/admin/usuarios`, `/admin/emprendedores`, `/admin/categorias`, `/admin/productos`
- API: `/api/registro`, `/api/productos`, `/api/categorias`, `/api/pedidos`, `/api/pagos`, `/api/reportes`

## Solución de problemas

- **No aparecen productos:** confirma `docker compose ... ps` y ejecuta `npm run seed`.
- **Error de autenticación:** revisa `NEXTAUTH_URL` y `NEXTAUTH_SECRET`, y vuelve a iniciar el servidor.
- **Pago real no actualiza el pedido:** verifica Stripe CLI, `STRIPE_WEBHOOK_SECRET` y que el evento llegue a `/api/pagos/webhook`.
- **No llegan correos:** consulta `emailStatus` y `emailError` en el pedido desde mongo-express.
- **Puerto ocupado:** cambia el mapeo en `docker/docker-compose.yml` y actualiza `MONGODB_URI` si corresponde.

## Alcance

No incluye compra como invitado, comisiones, impuestos, reembolsos, tarifas de envío, mapas, chat, cupones ni despliegue en la nube. La interfaz está en español, usa córdobas nicaragüenses y la zona horaria `America/Managua`.

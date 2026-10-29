-- Fase B · Estados nuevos (en su propia migración: un valor de enum nuevo no
-- puede usarse en la misma transacción en que se crea).
--   ready      → el negocio dejó el pedido empacado (foto) esperando a la mensajería
--   delivered  → entregado con PIN; corre la ventana de reclamo
--   disputed   → el cliente abrió un reclamo
--   returned   → la mensajería no pudo entregar y el producto volvió al negocio
alter type public.order_status add value if not exists 'ready' after 'preparing';
alter type public.order_status add value if not exists 'delivered' after 'on_the_way';
alter type public.order_status add value if not exists 'disputed' after 'delivered';
alter type public.order_status add value if not exists 'returned' after 'refunded';
alter type public.payment_status add value if not exists 'partially_refunded' after 'refunded';

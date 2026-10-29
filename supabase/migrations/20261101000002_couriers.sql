-- Repartidores propios de Catarina Market (tipo PedidosYa).
-- Reemplaza el enlace sin cuenta (/envio/<token>): el repartidor inicia sesión, acepta
-- pedidos disponibles (o el admin se los asigna), ve los datos del cliente solo mientras
-- la entrega está activa, y entrega con PIN + foto + GPS sin que intervenga el negocio.

insert into public.platform_settings (key, value) values
  ('courier_max_active', '2'),
  ('dispatch_alert_minutes', '15')
on conflict (key) do nothing;

-- Repartidores ----------------------------------------------------------------------

create table public.couriers (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  vehicle text not null default 'moto' check (vehicle in ('moto', 'bici', 'carro')),
  plate text,
  is_active boolean not null default true,
  is_online boolean not null default false,
  last_lat double precision,
  last_lng double precision,
  last_seen_at timestamptz,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger couriers_touch before update on public.couriers
  for each row execute function public.touch_updated_at();
alter table public.couriers enable row level security;
create policy "repartidor ve lo suyo" on public.couriers for select using (profile_id = auth.uid());
create policy "admin gestiona" on public.couriers for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_courier()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join couriers c on c.profile_id = p.id
    where p.id = auth.uid() and p.role = 'courier' and p.is_active and c.is_active
  );
$$;

create or replace function public.notify_couriers(p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, link)
  select c.profile_id, p_title, p_body, p_link
  from couriers c join profiles p on p.id = c.profile_id
  where c.is_active and c.is_online and p.is_active and p.role = 'courier';
$$;
revoke execute on function public.notify_couriers from public, anon, authenticated;

-- Envíos: del enlace a repartidores con cuenta --------------------------------------

drop function if exists public.courier_shipment(uuid);
drop function if exists public.courier_pickup(uuid, text, text);
drop function if exists public.courier_deliver(uuid, text, text);
drop function if exists public.courier_reject(uuid, text, text);
drop function if exists public.courier_fail(uuid, text);
drop function if exists public.assign_shipment(uuid, text, text, integer);
drop function if exists public.shipment_by_token(uuid);
drop table if exists public.shipment_links;

alter table public.shipments
  add column courier_id uuid references public.profiles (id),
  add column accepted_at timestamptz,
  add column arrived_pickup_at timestamptz,
  add column arrived_dropoff_at timestamptz,
  add column pickup_lat double precision,
  add column pickup_lng double precision,
  add column delivery_lat double precision,
  add column delivery_lng double precision,
  add column dispatch_alerted_at timestamptz,
  alter column courier_name drop not null,
  alter column status set default 'available';
alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status in ('available', 'assigned', 'at_pickup', 'picked_up', 'at_dropoff', 'delivered', 'failed', 'rejected', 'returned'));
alter table public.shipments add constraint shipments_courier_required
  check (status in ('available', 'returned') or courier_id is not null);
create index on public.shipments (courier_id, status);
create index on public.shipments (status) where status = 'available';

-- El repartidor ve sus envíos y los disponibles (sin datos personales: esos van por función).
create policy "repartidor ve los suyos" on public.shipments for select using (courier_id = auth.uid());
create policy "repartidor ve disponibles" on public.shipments for select
  using (status = 'available' and public.is_courier());

-- Si el pedido se cancela, su envío activo se cierra y se avisa al repartidor.
create or replace function public.close_shipment_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_courier uuid;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update shipments set status = 'returned'
    where order_id = new.id and status in ('available', 'assigned', 'at_pickup', 'picked_up', 'at_dropoff')
    returning courier_id into v_courier;
    if v_courier is not null and v_courier is distinct from auth.uid() then
      perform notify_user(v_courier, 'Envío cancelado',
        'El pedido ' || new.order_number || ' fue cancelado. Si ya lo recogiste, devuélvelo al negocio.', '/repartidor');
    end if;
  end if;
  return new;
end $$;
create trigger orders_close_shipment after update of status on public.orders
  for each row execute function public.close_shipment_on_cancel();

-- Al marcar listo un delivery se publica el envío para los repartidores en turno.
create or replace function public.mark_order_ready(p_order uuid, p_photo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_to order_status;
  v_name text;
  v_town text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found or not owns_business(v_order.business_id) then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status <> 'preparing' then
    raise exception 'El pedido no está en preparación.';
  end if;
  if coalesce(p_photo_path, '') not like auth.uid()::text || '/%' then
    raise exception 'Sube la foto del pedido empacado.';
  end if;
  v_to := case when v_order.service_type = 'delivery' then 'ready' else 'ready_for_pickup' end;
  update orders set status = v_to, ready_at = now(), ready_photo_path = p_photo_path where id = p_order;
  perform log_status(p_order, 'preparing', v_to, 'Empacado (con foto)');
  select trade_name into v_name from businesses where id = v_order.business_id;
  if v_to = 'ready' then
    insert into shipments (order_id, courier_cost_minor, status)
    values (p_order, v_order.courier_cost_minor, 'available')
    on conflict (order_id) do nothing;
    v_town := v_order.address_snapshot ->> 'municipality';
    perform notify_user(v_order.customer_id, 'Pedido ' || v_order.order_number,
      'Está empacado. Estamos asignando un repartidor.', '/pedidos/' || p_order);
    perform notify_couriers('Nuevo pedido disponible', v_name || ' → ' || coalesce(v_town, 'cliente'), '/repartidor');
    perform notify_admins('Listo para recolección', v_order.order_number || ' · ' || v_name, '/admin/envios');
  else
    perform notify_user(v_order.customer_id, 'Pedido ' || v_order.order_number,
      'Listo para retirar en ' || v_name || '. Muestra tu PIN al recogerlo.', '/pedidos/' || p_order);
  end if;
end $$;

-- Asignación ------------------------------------------------------------------------

create or replace function public.active_shipments_of(p_courier uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from shipments
  where courier_id = p_courier and status in ('assigned', 'at_pickup', 'picked_up', 'at_dropoff');
$$;

-- Interna: deja el envío a nombre del repartidor y avisa a cliente y negocio.
create or replace function public.give_shipment(p_shipment uuid, p_courier uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_order orders%rowtype;
begin
  select full_name into v_name from profiles where id = p_courier;
  update shipments set courier_id = p_courier, courier_name = v_name, accepted_at = now(),
    status = case when status = 'available' then 'assigned' else status end
  where id = p_shipment;
  select o.* into v_order from orders o join shipments s on s.order_id = o.id where s.id = p_shipment;
  perform notify_user(v_order.customer_id, 'Repartidor asignado',
    v_name || ' recogerá ' || v_order.order_number || ' y te lo llevará.', '/pedidos/' || v_order.id);
  perform notify_user((select owner_id from businesses where id = v_order.business_id), 'Repartidor asignado',
    v_name || ' pasará a recoger ' || v_order.order_number || '.', '/vendedor/pedidos');
end $$;
revoke execute on function public.give_shipment from public, anon, authenticated;

-- El repartidor en turno acepta un pedido disponible (el primero que llega lo toma).
create or replace function public.accept_shipment(p_shipment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype;
  v_max integer := setting_numeric('courier_max_active', 2)::integer;
begin
  if not is_courier() then
    raise exception 'Solo los repartidores aceptan pedidos.';
  end if;
  if not (select is_online from couriers where profile_id = auth.uid()) then
    raise exception 'Ponte en turno para aceptar pedidos.';
  end if;
  if active_shipments_of(auth.uid()) >= v_max then
    raise exception 'Ya tienes % entregas activas. Termina una antes de aceptar otra.', v_max;
  end if;
  select * into v_shipment from shipments where id = p_shipment for update;
  if not found or v_shipment.status <> 'available' then
    raise exception 'Otro repartidor ya tomó este pedido.';
  end if;
  perform give_shipment(p_shipment, auth.uid());
end $$;

-- Antes de recoger, el repartidor puede soltar el pedido (vuelve a disponibles).
create or replace function public.courier_release(p_shipment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype;
  v_number text;
begin
  select * into v_shipment from shipments where id = p_shipment and courier_id = auth.uid() for update;
  if not found then
    raise exception 'Envío no encontrado.';
  end if;
  if v_shipment.status not in ('assigned', 'at_pickup') then
    raise exception 'Ya recogiste el pedido: no se puede soltar.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Indica por qué lo sueltas.';
  end if;
  update shipments set status = 'available', courier_id = null, courier_name = null, accepted_at = null,
    arrived_pickup_at = null, dispatch_alerted_at = null
  where id = p_shipment;
  select order_number into v_number from orders where id = v_shipment.order_id;
  perform notify_admins('Repartidor soltó un pedido', v_number || ': ' || trim(p_reason), '/admin/envios');
  perform notify_couriers('Pedido disponible de nuevo', v_number, '/repartidor');
end $$;

-- El admin asigna o reasigna (solo antes de la recolección).
create or replace function public.assign_shipment(p_order uuid, p_courier uuid, p_cost integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_shipment shipments%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if not exists (
    select 1 from couriers c join profiles p on p.id = c.profile_id
    where c.profile_id = p_courier and c.is_active and p.is_active and p.role = 'courier'
  ) then
    raise exception 'Repartidor no válido o inactivo.';
  end if;
  select * into v_order from orders where id = p_order for update;
  if not found or v_order.service_type <> 'delivery' or v_order.status <> 'ready' then
    raise exception 'El pedido no está listo para asignar.';
  end if;
  insert into shipments (order_id, courier_cost_minor, status)
  values (p_order, coalesce(p_cost, v_order.courier_cost_minor), 'available')
  on conflict (order_id) do nothing;
  select * into v_shipment from shipments where order_id = p_order for update;
  if v_shipment.status not in ('available', 'assigned', 'at_pickup') then
    raise exception 'El envío ya está en curso.';
  end if;
  if v_shipment.courier_id = p_courier then
    raise exception 'El envío ya es de ese repartidor.';
  end if;
  if v_shipment.courier_id is not null then
    perform notify_user(v_shipment.courier_id, 'Envío reasignado',
      'La administración reasignó ' || v_order.order_number || ' a otro repartidor.', '/repartidor');
  end if;
  if p_cost is not null then
    update shipments set courier_cost_minor = p_cost where id = v_shipment.id;
    update orders set courier_cost_minor = p_cost where id = p_order;
  end if;
  perform give_shipment(v_shipment.id, p_courier);
  update shipments set status = 'assigned', arrived_pickup_at = null where id = v_shipment.id;
  perform notify_user(p_courier, 'Te asignaron un pedido', v_order.order_number, '/repartidor/entrega/' || v_shipment.id);
  perform write_audit('shipment.assign', 'order', p_order::text,
    jsonb_build_object('courier', p_courier, 'previous', v_shipment.courier_id));
end $$;

-- Turno y ubicación -------------------------------------------------------------------

create or replace function public.set_courier_online(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_courier() then
    raise exception 'Solo repartidores.';
  end if;
  update couriers set is_online = p_online,
    last_lat = coalesce(p_lat, last_lat), last_lng = coalesce(p_lng, last_lng), last_seen_at = now()
  where profile_id = auth.uid();
end $$;

-- Pasos de la entrega (cada uno valida que el envío sea del repartidor) ---------------

create or replace function public.my_shipment(p_shipment uuid)
returns public.shipments language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype;
begin
  select * into v_shipment from shipments where id = p_shipment and courier_id = auth.uid() for update;
  if not found or not is_courier() then
    raise exception 'Envío no encontrado.';
  end if;
  return v_shipment;
end $$;
revoke execute on function public.my_shipment from public, anon, authenticated;

create or replace function public.courier_arrive(p_shipment uuid, p_stage text, p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := my_shipment(p_shipment);
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = v_shipment.order_id;
  if p_stage = 'pickup' then
    if v_shipment.status <> 'assigned' then
      raise exception 'Este paso ya pasó.';
    end if;
    update shipments set status = 'at_pickup', arrived_pickup_at = now() where id = p_shipment;
    perform notify_user((select owner_id from businesses where id = v_order.business_id), 'El repartidor llegó',
      v_shipment.courier_name || ' está en tu negocio para recoger ' || v_order.order_number || '.', '/vendedor/pedidos');
  elsif p_stage = 'dropoff' then
    if v_shipment.status <> 'picked_up' then
      raise exception 'Primero registra la recolección.';
    end if;
    update shipments set status = 'at_dropoff', arrived_dropoff_at = now() where id = p_shipment;
    perform notify_user(v_order.customer_id, 'Tu repartidor llegó',
      v_shipment.courier_name || ' está afuera con ' || v_order.order_number || '. Revisa el pedido y dale tu PIN.',
      '/pedidos/' || v_order.id);
  else
    raise exception 'Paso no válido.';
  end if;
  update couriers set last_lat = coalesce(p_lat, last_lat), last_lng = coalesce(p_lng, last_lng), last_seen_at = now()
  where profile_id = auth.uid();
end $$;

create or replace function public.courier_pickup(p_shipment uuid, p_photo_path text, p_notes text,
  p_lat double precision default null, p_lng double precision default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := my_shipment(p_shipment);
  v_order orders%rowtype;
begin
  if v_shipment.status not in ('assigned', 'at_pickup') then
    raise exception 'Este envío ya fue recogido.';
  end if;
  if coalesce(p_photo_path, '') not like auth.uid()::text || '/%' then
    raise exception 'Toma la foto del paquete al recogerlo.';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  if v_order.status <> 'ready' then
    raise exception 'El pedido no está listo para recoger.';
  end if;
  update shipments set status = 'picked_up', picked_up_at = now(),
    arrived_pickup_at = coalesce(arrived_pickup_at, now()),
    pickup_photo_path = p_photo_path, pickup_notes = nullif(trim(p_notes), ''),
    pickup_lat = p_lat, pickup_lng = p_lng
  where id = p_shipment;
  update orders set status = 'on_the_way' where id = v_order.id;
  perform log_status(v_order.id, 'ready', 'on_the_way', 'Recogido por ' || v_shipment.courier_name || ' (con foto)');
  perform notify_user(v_order.customer_id, 'Pedido en camino',
    v_shipment.courier_name || ' va en camino con ' || v_order.order_number || '. Ten tu PIN a mano.', '/pedidos/' || v_order.id);
end $$;

create or replace function public.courier_reject(p_shipment uuid, p_reason text, p_photo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := my_shipment(p_shipment);
  v_order orders%rowtype;
begin
  if v_shipment.status not in ('assigned', 'at_pickup') then
    raise exception 'Solo se puede rechazar al momento de recoger.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 or coalesce(p_photo_path, '') not like auth.uid()::text || '/%' then
    raise exception 'Describe el problema y toma una foto.';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  if v_order.status <> 'ready' then
    raise exception 'El pedido no está esperando recolección.';
  end if;
  update orders set status = 'cancelled', cancelled_at = now(),
    cancel_reason = 'Rechazado en la recolección: ' || trim(p_reason)
  where id = v_order.id;
  -- El trigger de cancelación cierra el envío como devuelto; aquí queda como rechazado.
  update shipments set status = 'rejected', pickup_photo_path = p_photo_path, failure_notes = trim(p_reason)
  where id = p_shipment;
  perform restock_order(v_order.id);
  perform log_status(v_order.id, 'ready', 'cancelled', 'Rechazado por ' || v_shipment.courier_name || ': ' || trim(p_reason));
  perform queue_refund(v_order.id, v_order.total_minor, 'Producto rechazado en la recolección', 'business');
  perform add_strike(v_order.business_id, v_order.id, 'Pedido ' || v_order.order_number || ' rechazado en la recolección: ' || trim(p_reason));
  perform notify_user(v_order.customer_id, 'Pedido cancelado',
    'Al recogerlo, ' || v_order.order_number || ' no cumplía lo publicado. Te devolvemos el pago completo.', '/pedidos/' || v_order.id);
  perform notify_admins('Rechazo en recolección', v_order.order_number || ': ' || trim(p_reason), '/admin/envios');
end $$;

create or replace function public.courier_deliver(p_shipment uuid, p_pin text, p_photo_path text,
  p_lat double precision default null, p_lng double precision default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := my_shipment(p_shipment);
  v_order orders%rowtype;
  v_check text;
begin
  if v_shipment.status not in ('picked_up', 'at_dropoff') then
    raise exception 'Primero registra la recolección.';
  end if;
  if coalesce(p_photo_path, '') not like auth.uid()::text || '/%' then
    raise exception 'Toma la foto de la entrega.';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  v_check := check_order_pin(v_order.id, p_pin);
  if v_check <> 'ok' then
    return v_check;
  end if;
  update shipments set status = 'delivered', delivered_at = now(), delivery_photo_path = p_photo_path,
    arrived_dropoff_at = coalesce(arrived_dropoff_at, now()), delivery_lat = p_lat, delivery_lng = p_lng
  where id = p_shipment;
  update orders set status = 'delivered', delivered_at = now(), delivery_method = 'pin' where id = v_order.id;
  perform log_status(v_order.id, 'on_the_way', 'delivered', 'Entregado con PIN por ' || v_shipment.courier_name);
  perform notify_user(v_order.customer_id, 'Pedido entregado',
    'Confirmamos la entrega de ' || v_order.order_number || '. Califica a tu repartidor; tienes 48 h para reportar un problema.',
    '/pedidos/' || v_order.id);
  return 'ok';
end $$;

-- Intento fallido (tras llamar y esperar); al llegar al máximo, el pedido vuelve al negocio.
create or replace function public.courier_fail(p_shipment uuid, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := my_shipment(p_shipment);
  v_order orders%rowtype;
  v_attempts integer;
begin
  if v_shipment.status not in ('picked_up', 'at_dropoff') then
    raise exception 'El envío no está en ruta.';
  end if;
  if coalesce(length(trim(p_notes)), 0) < 5 then
    raise exception 'Describe qué pasó (cliente ausente, dirección errónea…).';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  v_attempts := v_shipment.attempts + 1;
  update shipments set attempts = v_attempts, status = 'picked_up', arrived_dropoff_at = null,
    failure_notes = concat_ws(E'\n', failure_notes, to_char(now() at time zone 'America/Managua', 'DD/MM HH24:MI') || ' · ' || trim(p_notes))
  where id = p_shipment;

  if v_attempts < setting_numeric('max_delivery_attempts', 2) then
    perform notify_user(v_order.customer_id, 'No pudimos entregar tu pedido',
      'Intento ' || v_attempts || ': ' || trim(p_notes) || '. Volveremos a intentarlo; revisa tu teléfono.', '/pedidos/' || v_order.id);
    perform notify_admins('Intento de entrega fallido', v_order.order_number || ': ' || trim(p_notes), '/admin/envios');
    return 'retry';
  end if;

  update shipments set status = 'returned' where id = p_shipment;
  update orders set status = 'returned', cancelled_at = now(),
    cancel_reason = 'No se pudo entregar tras ' || v_attempts || ' intentos'
  where id = v_order.id;
  perform restock_order(v_order.id);
  perform log_status(v_order.id, v_order.status, 'returned', trim(p_notes));
  -- Responsabilidad del cliente: se devuelven los productos, no el envío ni el servicio.
  perform queue_refund(v_order.id, v_order.subtotal_minor, 'Entrega fallida: se reembolsan los productos', 'customer');
  perform notify_user(v_order.customer_id, 'Pedido devuelto',
    'No pudimos entregar ' || v_order.order_number || '. Te devolvemos el valor de los productos (el envío no es reembolsable).',
    '/pedidos/' || v_order.id);
  return 'returned';
end $$;

-- Excepción auditada: el admin confirma una entrega sin PIN (cliente sin teléfono, etc.).
create or replace function public.admin_confirm_delivery(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_shipment shipments%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'Explica por qué se confirma sin PIN.';
  end if;
  select * into v_order from orders where id = p_order for update;
  select * into v_shipment from shipments where order_id = p_order for update;
  if v_order.status <> 'on_the_way' or v_shipment.status not in ('picked_up', 'at_dropoff') then
    raise exception 'El pedido no está en ruta.';
  end if;
  update shipments set status = 'delivered', delivered_at = now() where id = v_shipment.id;
  update orders set status = 'delivered', delivered_at = now(), delivery_method = 'admin' where id = p_order;
  perform log_status(p_order, 'on_the_way', 'delivered', 'Confirmado sin PIN por la administración: ' || trim(p_reason));
  perform write_audit('order.confirm_without_pin', 'order', p_order::text, jsonb_build_object('reason', trim(p_reason)));
  perform notify_user(v_order.customer_id, 'Pedido entregado',
    'Registramos la entrega de ' || v_order.order_number || '. Si no lo recibiste, repórtalo dentro de 48 h.', '/pedidos/' || p_order);
  if v_shipment.courier_id is not null then
    perform notify_user(v_shipment.courier_id, 'Entrega confirmada', v_order.order_number || ' quedó entregado.', '/repartidor');
  end if;
end $$;

-- Calificación del repartidor (la tabla va antes de las funciones que la leen).
create table public.delivery_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  courier_id uuid not null references public.profiles (id),
  customer_id uuid not null references public.profiles (id),
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);
create index on public.delivery_ratings (courier_id, created_at desc);
alter table public.delivery_ratings enable row level security;
create policy "partes ven la calificación" on public.delivery_ratings for select
  using (customer_id = auth.uid() or courier_id = auth.uid() or public.is_admin());

-- Lecturas del repartidor ---------------------------------------------------------------

-- Detalle de una entrega. Los datos del cliente solo mientras está activa.
create or replace function public.courier_delivery(p_shipment uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shipment', to_jsonb(s) - 'created_by' - 'dispatch_alerted_at',
    'active', s.status in ('assigned', 'at_pickup', 'picked_up', 'at_dropoff'),
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'status', o.status, 'ready_photo_path', o.ready_photo_path,
      'municipality', o.address_snapshot ->> 'municipality', 'department', o.address_snapshot ->> 'department',
      'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'quantity', i.quantity, 'image', i.image_url))
                  from order_items i where i.order_id = o.id)),
    'customer', case when s.status in ('assigned', 'at_pickup', 'picked_up', 'at_dropoff') then jsonb_build_object(
        'name', coalesce(o.address_snapshot ->> 'recipient_name', o.contact_name),
        'phone', coalesce(o.address_snapshot ->> 'phone', o.contact_phone),
        'address_line', o.address_snapshot ->> 'address_line',
        'note', o.customer_note)
      else jsonb_build_object('name', split_part(coalesce(o.address_snapshot ->> 'recipient_name', o.contact_name), ' ', 1)) end,
    'business', jsonb_build_object(
      'trade_name', b.trade_name, 'phone', b.phone, 'whatsapp', b.whatsapp, 'address_line', b.address_line,
      'municipality', (select name from municipalities where id = b.municipality_id),
      'latitude', bp.latitude, 'longitude', bp.longitude),
    'rating', (select jsonb_build_object('rating', r.rating, 'tags', r.tags, 'comment', r.comment)
                 from delivery_ratings r where r.order_id = o.id)
  )
  from shipments s
  join orders o on o.id = s.order_id
  join businesses b on b.id = o.business_id
  left join business_private bp on bp.business_id = b.id
  where s.id = p_shipment and (s.courier_id = auth.uid() or is_admin());
$$;

-- Pedidos disponibles: solo lo necesario para decidir (sin datos del cliente).
create or replace function public.available_shipments()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'ready_at', o.ready_at, 'order_number', o.order_number,
      'business', b.trade_name, 'business_address', b.address_line,
      'business_municipality', (select name from municipalities where id = b.municipality_id),
      'municipality', o.address_snapshot ->> 'municipality', 'department', o.address_snapshot ->> 'department',
      'items', (select coalesce(sum(i.quantity), 0) from order_items i where i.order_id = o.id))
    order by o.ready_at), '[]'::jsonb)
  from shipments s
  join orders o on o.id = s.order_id
  join businesses b on b.id = o.business_id
  where s.status = 'available' and is_courier();
$$;

-- Lista del repartidor: activas (con nombre y destino) o historial (sin datos personales).
create or replace function public.courier_deliveries(p_scope text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'status', s.status, 'order_number', o.order_number, 'business', b.trade_name,
      'municipality', o.address_snapshot ->> 'municipality',
      'customer', case when p_scope = 'active' then coalesce(o.address_snapshot ->> 'recipient_name', o.contact_name) end,
      'accepted_at', s.accepted_at, 'delivered_at', s.delivered_at, 'updated_at', s.updated_at,
      'attempts', s.attempts,
      'rating', (select r.rating from delivery_ratings r where r.order_id = o.id))
    order by coalesce(s.delivered_at, s.updated_at) desc), '[]'::jsonb)
  from shipments s
  join orders o on o.id = s.order_id
  join businesses b on b.id = o.business_id
  where s.courier_id = auth.uid()
    and case when p_scope = 'active'
          then s.status in ('assigned', 'at_pickup', 'picked_up', 'at_dropoff')
          else s.status in ('delivered', 'failed', 'rejected', 'returned') end;
$$;

-- Lo que ve el cliente (y el negocio) del repartidor de su pedido. El teléfono, solo en ruta.
create or replace function public.order_courier(p_order uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.full_name, 'avatar_url', p.avatar_url, 'vehicle', c.vehicle, 'plate', c.plate,
    'rating_avg', c.rating_avg, 'rating_count', c.rating_count, 'status', s.status,
    'phone', case when s.status in ('assigned', 'at_pickup', 'picked_up', 'at_dropoff') then p.phone end,
    'accepted_at', s.accepted_at, 'arrived_pickup_at', s.arrived_pickup_at, 'picked_up_at', s.picked_up_at,
    'arrived_dropoff_at', s.arrived_dropoff_at, 'delivered_at', s.delivered_at)
  from shipments s
  join profiles p on p.id = s.courier_id
  left join couriers c on c.profile_id = s.courier_id
  where s.order_id = p_order and can_see_order(p_order);
$$;

-- Alta de repartidores (el usuario de Auth lo crea el servidor con service role) --------

create or replace function public.admin_make_courier(p_user uuid, p_full_name text, p_phone text, p_vehicle text, p_plate text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  update profiles set role = 'courier', is_active = true, full_name = trim(p_full_name), phone = p_phone,
    accepted_terms_at = coalesce(accepted_terms_at, now())
  where id = p_user;
  if not found then
    raise exception 'Usuario no encontrado.';
  end if;
  insert into couriers (profile_id, vehicle, plate) values (p_user, p_vehicle, nullif(upper(trim(p_plate)), ''))
  on conflict (profile_id) do update set vehicle = excluded.vehicle, plate = excluded.plate, is_active = true;
  perform write_audit('courier.create', 'profile', p_user::text, jsonb_build_object('vehicle', p_vehicle));
end $$;

create or replace function public.admin_set_courier_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if not p_active and active_shipments_of(p_user) > 0 then
    raise exception 'Reasigna sus entregas activas antes de desactivarlo.';
  end if;
  update couriers set is_active = p_active, is_online = is_online and p_active where profile_id = p_user;
  update profiles set is_active = p_active where id = p_user and role = 'courier';
  perform write_audit('courier.active', 'profile', p_user::text, jsonb_build_object('active', p_active));
end $$;

-- Calificación del repartidor ---------------------------------------------------------

create or replace function public.rate_delivery(p_order uuid, p_rating integer, p_tags text[], p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_courier uuid;
begin
  select * into v_order from orders where id = p_order;
  if not found or v_order.customer_id <> auth.uid() then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status not in ('delivered', 'disputed', 'completed') then
    raise exception 'Califica cuando recibas el pedido.';
  end if;
  select courier_id into v_courier from shipments where order_id = p_order and status = 'delivered';
  if v_courier is null then
    raise exception 'Este pedido no tuvo repartidor.';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'La calificación va de 1 a 5.';
  end if;
  if exists (select 1 from unnest(coalesce(p_tags, '{}')) t
             where t not in ('Amable', 'Puntual', 'Cuidó el paquete', 'Mal trato', 'Llegó tarde', 'Paquete dañado')) then
    raise exception 'Etiqueta no válida.';
  end if;
  insert into delivery_ratings (order_id, courier_id, customer_id, rating, tags, comment)
  values (p_order, v_courier, auth.uid(), p_rating, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  on conflict (order_id) do nothing;
  if not found then
    raise exception 'Ya calificaste esta entrega.';
  end if;
  update couriers set
    rating_count = (select count(*) from delivery_ratings where courier_id = v_courier),
    rating_avg = (select round(avg(rating), 2) from delivery_ratings where courier_id = v_courier)
  where profile_id = v_courier;
  if p_rating <= 2 then
    perform notify_admins('Mala calificación de entrega',
      v_order.order_number || ': ' || p_rating || '★ ' || coalesce(nullif(trim(p_comment), ''), array_to_string(p_tags, ', ')),
      '/admin/repartidores');
  end if;
end $$;

-- Mantenimiento: avisar de envíos que nadie toma ----------------------------------------

create or replace function public.alert_stale_shipments()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with stale as (
    update shipments s set dispatch_alerted_at = now()
    where s.status = 'available' and s.dispatch_alerted_at is null
      and s.created_at < now() - make_interval(mins => setting_numeric('dispatch_alert_minutes', 15)::integer)
    returning s.order_id
  )
  select count(*) into v_count from stale;
  if v_count > 0 then
    perform notify_admins('Pedidos sin repartidor',
      v_count || ' pedido(s) llevan más de ' || setting_numeric('dispatch_alert_minutes', 15) || ' min sin que nadie los tome.',
      '/admin/envios');
  end if;
  return v_count;
end $$;
revoke execute on function public.alert_stale_shipments from public, anon, authenticated;

select cron.schedule('dispatch-alerts', '*/5 * * * *', $$select public.alert_stale_shipments()$$);

-- Permisos: estas funciones solo las llama gente con sesión (cada una valida su rol).
revoke execute on function public.accept_shipment, public.courier_release, public.assign_shipment,
  public.set_courier_online, public.courier_arrive, public.courier_pickup, public.courier_reject,
  public.courier_deliver, public.courier_fail, public.admin_confirm_delivery, public.courier_delivery,
  public.available_shipments, public.courier_deliveries, public.order_courier, public.admin_make_courier,
  public.admin_set_courier_active, public.rate_delivery
  from public, anon;
grant execute on function public.accept_shipment, public.courier_release, public.assign_shipment,
  public.set_courier_online, public.courier_arrive, public.courier_pickup, public.courier_reject,
  public.courier_deliver, public.courier_fail, public.admin_confirm_delivery, public.courier_delivery,
  public.available_shipments, public.courier_deliveries, public.order_courier, public.admin_make_courier,
  public.admin_set_courier_active, public.rate_delivery
  to authenticated;

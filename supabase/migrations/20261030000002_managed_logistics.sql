-- Fase B · Logística gestionada por Catarina Market.
-- La plataforma define tarifas por zona y contrata a la mensajería. Cada paso
-- deja evidencia: foto de "listo", foto de recolección, PIN + foto de entrega.

insert into public.platform_settings (key, value) values
  ('service_fee_minor', '1500'),
  ('ready_sla_hours', '24'),
  ('claim_window_hours', '48'),
  ('pickup_window_days', '7'),
  ('max_delivery_attempts', '2'),
  ('pin_max_attempts', '5'),
  ('claims_reserve_rate', '0.015'),
  ('gateway_fee_rate', '0.039'),
  ('informal_payout_hold_days', '7'),
  ('informal_payout_hold_orders', '10'),
  ('strikes_to_suspend', '3'),
  ('strikes_window_days', '90')
on conflict (key) do nothing;

-- Zonas y tarifas de la plataforma ----------------------------------------------

create table public.platform_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  department_id smallint not null references public.departments (id),
  municipality_id integer references public.municipalities (id),
  fee_minor integer not null check (fee_minor >= 0),            -- lo que paga el cliente
  courier_cost_minor integer not null check (courier_cost_minor >= 0), -- lo que cobra la mensajería
  estimated_days smallint not null default 1 check (estimated_days >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (department_id, municipality_id)
);

alter table public.platform_delivery_zones enable row level security;
create policy "lectura pública" on public.platform_delivery_zones for select using (is_active or public.is_admin());
create policy "admin gestiona" on public.platform_delivery_zones for all using (public.is_admin()) with check (public.is_admin());

-- Tarifas iniciales desde Catarina (editables en /admin/zonas).
insert into public.platform_delivery_zones (department_id, municipality_id, fee_minor, courier_cost_minor, estimated_days)
select m.department_id, m.id, 4000, 3000, 0 from public.municipalities m where m.name = 'Catarina'
on conflict do nothing;
insert into public.platform_delivery_zones (department_id, municipality_id, fee_minor, courier_cost_minor, estimated_days)
select d.id, null, z.fee, z.cost, z.days
  from public.departments d
  join (values ('Masaya', 7000, 5000, 0), ('Granada', 9000, 6500, 1),
               ('Carazo', 10000, 7500, 1), ('Managua', 12000, 9000, 1)) z(name, fee, cost, days)
    on d.name = z.name
on conflict do nothing;

create or replace function public.platform_zone_for(p_department smallint, p_municipality integer)
returns public.platform_delivery_zones language sql stable security definer set search_path = public as $$
  select * from platform_delivery_zones
   where is_active and department_id = p_department
     and (municipality_id = p_municipality or municipality_id is null)
   order by municipality_id nulls last
   limit 1;
$$;

create or replace function public.can_deliver(p_business uuid, p_address uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_address addresses%rowtype;
begin
  select * into v_address from addresses where id = p_address;
  if not found then
    return false;
  end if;
  return exists (select 1 from businesses where id = p_business and status = 'approved')
     and (platform_zone_for(v_address.department_id, v_address.municipality_id)).id is not null;
end $$;

-- Todos los negocios aprobados se entregan con la mensajería de la plataforma.
update public.businesses set accepts_delivery = true where not accepts_delivery;
alter table public.businesses alter column accepts_delivery set default true;

-- Pedidos: tarifa de servicio, costos y evidencia --------------------------------

alter table public.orders
  add column service_fee_minor integer not null default 0 check (service_fee_minor >= 0),
  add column courier_cost_minor integer not null default 0 check (courier_cost_minor >= 0),
  add column reserve_minor integer not null default 0 check (reserve_minor >= 0),
  add column ready_photo_path text,
  add column ready_at timestamptz,
  add column delivered_at timestamptz,
  add column delivery_method text check (delivery_method in ('pin', 'admin')),
  add column sla_due_at timestamptz;
create index on public.orders (status, sla_due_at);
create index on public.orders (status, delivered_at);

-- PIN de entrega: solo lo ve el cliente (tabla aparte: el negocio lee orders).
create table public.order_secrets (
  order_id uuid primary key references public.orders (id) on delete cascade,
  pin text not null check (pin ~ '^\d{4}$'),
  attempts smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.order_secrets enable row level security;
create policy "solo el cliente" on public.order_secrets for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

create or replace function public.create_order_secret()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into order_secrets (order_id, pin)
  values (new.id, lpad(floor(random() * 10000)::int::text, 4, '0'))
  on conflict do nothing;
  return new;
end $$;
create trigger orders_create_secret after insert on public.orders
  for each row execute function public.create_order_secret();

insert into public.order_secrets (order_id, pin)
select id, lpad(floor(random() * 10000)::int::text, 4, '0') from public.orders
on conflict do nothing;

-- Verifica el PIN sin lanzar error (un raise revertiría el contador de intentos).
create or replace function public.check_order_pin(p_order uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_secret order_secrets%rowtype;
  v_max integer := setting_numeric('pin_max_attempts', 5)::integer;
begin
  select * into v_secret from order_secrets where order_id = p_order for update;
  if not found then
    return 'invalid';
  end if;
  if v_secret.attempts >= v_max then
    return 'locked';
  end if;
  if v_secret.pin = trim(coalesce(p_pin, '')) then
    return 'ok';
  end if;
  update order_secrets set attempts = attempts + 1 where order_id = p_order;
  return case when v_secret.attempts + 1 >= v_max then 'locked' else 'wrong_pin' end;
end $$;
revoke execute on function public.check_order_pin from public, anon, authenticated;

-- Plazo para preparar: corre desde que se confirma el pago.
create or replace function public.set_order_sla()
returns trigger language plpgsql as $$
begin
  if new.status = 'preparing' and old.status = 'pending_payment' then
    new.sla_due_at := now() + make_interval(hours => public.setting_numeric('ready_sla_hours', 24)::integer);
  end if;
  return new;
end $$;
create trigger orders_set_sla before update of status on public.orders
  for each row execute function public.set_order_sla();

create or replace function public.notify_admins(p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, link)
  select id, p_title, p_body, p_link from profiles where role = 'admin' and is_active;
$$;
revoke execute on function public.notify_admins from public, anon, authenticated;

-- Crear pedido con zonas de la plataforma y tarifa de servicio ------------------

create or replace function public.create_order(
  p_business uuid,
  p_service public.service_type,
  p_address uuid,
  p_items jsonb,
  p_contact_name text,
  p_contact_phone text,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_business businesses%rowtype;
  v_address addresses%rowtype;
  v_zone platform_delivery_zones%rowtype;
  v_item jsonb;
  v_product products%rowtype;
  v_qty integer;
  v_subtotal integer := 0;
  v_fee integer := 0;
  v_courier integer := 0;
  v_service integer := setting_numeric('service_fee_minor', 1500)::integer;
  v_rate numeric;
  v_commission integer;
  v_order uuid;
  v_snapshot jsonb;
  v_minutes integer := setting_numeric('pending_payment_minutes', 30)::integer;
begin
  if v_user is null then
    raise exception 'Inicia sesión para pagar.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'El pedido tiene demasiados productos.';
  end if;
  if (select count(distinct x ->> 'product_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
    raise exception 'El carrito contiene productos duplicados.';
  end if;
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_phone), '') = '' then
    raise exception 'Indica el nombre y teléfono de contacto.';
  end if;

  select * into v_business from businesses where id = p_business;
  if not found or v_business.status <> 'approved' then
    raise exception 'Este negocio no está disponible.';
  end if;
  if not is_business_open(p_business) then
    raise exception 'El negocio está cerrado en este momento.';
  end if;

  if p_service = 'pickup' then
    if not v_business.accepts_pickup then
      raise exception 'Este negocio no ofrece retiro en su local.';
    end if;
  else
    select * into v_address from addresses where id = p_address and user_id = v_user;
    if not found then
      raise exception 'Selecciona una dirección de entrega válida.';
    end if;
    select * into v_zone from platform_zone_for(v_address.department_id, v_address.municipality_id);
    if v_zone.id is null then
      raise exception 'Aún no entregamos en tu zona. Elige retiro en el negocio.';
    end if;
    v_fee := v_zone.fee_minor;
    v_courier := v_zone.courier_cost_minor;
    v_snapshot := jsonb_build_object(
      'label', v_address.label,
      'department', (select name from departments where id = v_address.department_id),
      'municipality', (select name from municipalities where id = v_address.municipality_id),
      'department_id', v_address.department_id,
      'municipality_id', v_address.municipality_id,
      'address_line', v_address.address_line,
      'recipient_name', v_address.recipient_name,
      'phone', v_address.phone
    );
  end if;

  v_rate := commission_rate_for(p_business);

  insert into orders (
    order_number, customer_id, business_id, service_type, subtotal_minor,
    delivery_fee_minor, service_fee_minor, courier_cost_minor, commission_rate, commission_amount_minor,
    total_minor, vendor_net_minor, estimated_days, address_snapshot, contact_name, contact_phone,
    customer_note, expires_at
  ) values (
    'CM-' || to_char(now() at time zone 'America/Managua', 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5)),
    v_user, p_business, p_service, 1, v_fee, v_service, v_courier, v_rate, 0, 1, 0,
    case when p_service = 'delivery' then v_zone.estimated_days end,
    v_snapshot, trim(p_contact_name), trim(p_contact_phone), nullif(trim(p_note), ''),
    now() + make_interval(mins => v_minutes)
  ) returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Cantidad inválida.';
    end if;
    select * into v_product from products
     where id = (v_item ->> 'product_id')::uuid and business_id = p_business;
    if not found or not v_product.is_active then
      raise exception 'Un producto del carrito ya no está disponible.';
    end if;
    if v_product.stock < v_qty then
      raise exception 'No hay existencias suficientes de "%" (quedan %).', v_product.name, v_product.stock;
    end if;
    insert into order_items (order_id, product_id, product_name, image_url, unit_price_minor, quantity, subtotal_minor, note)
    values (v_order, v_product.id, v_product.name, v_product.images[1], v_product.price_minor, v_qty,
            v_product.price_minor * v_qty, nullif(trim(v_item ->> 'note'), ''));
    v_subtotal := v_subtotal + v_product.price_minor * v_qty;
  end loop;

  -- El negocio recibe los productos menos la comisión; envío y servicio son de la plataforma.
  v_commission := round(v_subtotal * v_rate);
  update orders set
    subtotal_minor = v_subtotal,
    commission_amount_minor = v_commission,
    total_minor = v_subtotal + v_fee + v_service,
    vendor_net_minor = v_subtotal - v_commission,
    reserve_minor = round(v_subtotal * setting_numeric('claims_reserve_rate', 0.015))
  where id = v_order;

  insert into order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order, null, 'pending_payment', v_user, 'Pedido creado');

  return v_order;
end $$;

-- Máquina de estados ------------------------------------------------------------

create or replace function public.can_transition(
  p_from public.order_status, p_to public.order_status, p_service public.service_type
) returns boolean language sql immutable as $$
  select case
    when p_from = 'pending_payment' then p_to in ('preparing', 'cancelled')
    when p_from = 'preparing' then
      (p_to = 'ready' and p_service = 'delivery')
      or (p_to = 'ready_for_pickup' and p_service = 'pickup')
      or p_to = 'cancelled'
    when p_from = 'ready' then p_to in ('on_the_way', 'cancelled')
    when p_from = 'ready_for_pickup' then p_to in ('delivered', 'cancelled')
    when p_from = 'on_the_way' then p_to in ('delivered', 'returned', 'cancelled')
    when p_from = 'delivered' then p_to in ('completed', 'disputed')
    when p_from = 'disputed' then p_to in ('completed', 'refunded')
    when p_from in ('cancelled', 'returned', 'completed') then p_to = 'refunded'
    else false
  end;
$$;

-- Ya no se avanza "a mano": cada paso exige su evidencia.
create or replace function public.transition_order(
  p_order uuid, p_to public.order_status, p_note text default null
) returns void language plpgsql as $$
begin
  raise exception 'Usa las acciones del tablero: cada paso requiere su evidencia (foto o PIN).';
end $$;

create or replace function public.log_status(p_order uuid, p_from public.order_status, p_to public.order_status, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order, p_from, p_to, auth.uid(), nullif(trim(p_note), ''));
$$;
revoke execute on function public.log_status from public, anon, authenticated;

create or replace function public.restock_order(p_order uuid)
returns void language sql security definer set search_path = public as $$
  update products p set stock = p.stock + i.quantity
    from order_items i where i.order_id = p_order and i.product_id = p.id;
$$;
revoke execute on function public.restock_order from public, anon, authenticated;

-- El negocio marca "listo" con la foto del pedido empacado.
create or replace function public.mark_order_ready(p_order uuid, p_photo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_to order_status;
  v_name text;
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
    perform notify_user(v_order.customer_id, 'Pedido ' || v_order.order_number,
      'Está empacado. La mensajería lo recogerá y te lo llevará.', '/pedidos/' || p_order);
    perform notify_admins('Listo para recolección', v_order.order_number || ' · ' || v_name, '/admin/envios');
  else
    perform notify_user(v_order.customer_id, 'Pedido ' || v_order.order_number,
      'Listo para retirar en ' || v_name || '. Muestra tu PIN al recogerlo.', '/pedidos/' || p_order);
  end if;
end $$;

-- Retiro en el negocio (o entrega propia de pedidos anteriores): solo con el PIN del cliente.
create or replace function public.complete_with_pin(p_order uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_check text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found or not (owns_business(v_order.business_id) or is_admin()) then
    raise exception 'Pedido no encontrado.';
  end if;
  if not (v_order.status = 'ready_for_pickup'
          or (v_order.status = 'on_the_way' and not exists (select 1 from shipments where order_id = p_order))) then
    raise exception 'Este pedido no está listo para entregar.';
  end if;
  v_check := check_order_pin(p_order, p_pin);
  if v_check <> 'ok' then
    return v_check;
  end if;
  update orders set status = 'delivered', delivered_at = now(), delivery_method = 'pin' where id = p_order;
  perform log_status(p_order, v_order.status, 'delivered', 'Entregado con PIN');
  perform notify_user(v_order.customer_id, 'Pedido entregado',
    'Confirmamos la entrega de ' || v_order.order_number || '. Tienes 48 h para reportar un problema.', '/pedidos/' || p_order);
  return 'ok';
end $$;

-- Envíos con la mensajería ------------------------------------------------------

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  courier_name text not null,
  tracking_ref text,
  courier_cost_minor integer not null default 0 check (courier_cost_minor >= 0),
  status text not null default 'assigned'
    check (status in ('assigned', 'picked_up', 'delivered', 'failed', 'rejected', 'returned')),
  attempts smallint not null default 0,
  pickup_photo_path text,
  pickup_notes text,
  picked_up_at timestamptz,
  delivery_photo_path text,
  delivered_at timestamptz,
  failure_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();
alter table public.shipments enable row level security;
create policy "partes del pedido" on public.shipments for select using (public.can_see_order(order_id));
create policy "admin gestiona" on public.shipments for all using (public.is_admin()) with check (public.is_admin());

-- El enlace del mensajero (sin cuenta) solo lo ve la administración.
create table public.shipment_links (
  shipment_id uuid primary key references public.shipments (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.shipment_links enable row level security;
create policy "solo admin" on public.shipment_links for all using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.shipments;

-- Evidencia (fotos de listo, recolección, entrega y reclamos): bucket privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-evidence', 'delivery-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "evidencia: subir a carpeta propia" on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.assign_shipment(p_order uuid, p_courier text, p_tracking text, p_cost integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_shipment uuid;
  v_token uuid;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if coalesce(length(trim(p_courier)), 0) < 2 then
    raise exception 'Indica la mensajería.';
  end if;
  select * into v_order from orders where id = p_order for update;
  if not found or v_order.service_type <> 'delivery' or v_order.status not in ('ready', 'on_the_way') then
    raise exception 'El pedido no está listo para asignar a la mensajería.';
  end if;
  insert into shipments (order_id, courier_name, tracking_ref, courier_cost_minor, created_by)
  values (p_order, trim(p_courier), nullif(trim(p_tracking), ''), coalesce(p_cost, v_order.courier_cost_minor), auth.uid())
  on conflict (order_id) do update set
    courier_name = excluded.courier_name, tracking_ref = excluded.tracking_ref,
    courier_cost_minor = excluded.courier_cost_minor
  where shipments.status = 'assigned'
  returning id into v_shipment;
  if v_shipment is null then
    raise exception 'El envío ya está en curso.';
  end if;
  update orders set courier_cost_minor = coalesce(p_cost, courier_cost_minor) where id = p_order;
  insert into shipment_links (shipment_id) values (v_shipment) on conflict do nothing;
  select token into v_token from shipment_links where shipment_id = v_shipment;
  perform write_audit('shipment.assign', 'order', p_order::text,
    jsonb_build_object('courier', p_courier, 'tracking', p_tracking, 'cost', p_cost));
  return v_token;
end $$;

-- Lo que ve el mensajero con su enlace.
create or replace function public.courier_shipment(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shipment', to_jsonb(s) - 'created_by',
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'status', o.status,
      'address', o.address_snapshot, 'contact_name', o.contact_name, 'contact_phone', o.contact_phone,
      'customer_note', o.customer_note, 'ready_photo_path', o.ready_photo_path,
      'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'quantity', i.quantity, 'image', i.image_url))
                  from order_items i where i.order_id = o.id)),
    'business', jsonb_build_object(
      'trade_name', b.trade_name, 'phone', b.phone, 'address_line', b.address_line,
      'municipality', (select name from municipalities where id = b.municipality_id),
      'latitude', bp.latitude, 'longitude', bp.longitude)
  )
  from shipment_links l
  join shipments s on s.id = l.shipment_id
  join orders o on o.id = s.order_id
  join businesses b on b.id = o.business_id
  left join business_private bp on bp.business_id = b.id
  where l.token = p_token;
$$;

create or replace function public.shipment_by_token(p_token uuid)
returns public.shipments language sql stable security definer set search_path = public as $$
  select s.* from shipment_links l join shipments s on s.id = l.shipment_id where l.token = p_token;
$$;
revoke execute on function public.shipment_by_token from public, anon, authenticated;

create or replace function public.courier_pickup(p_token uuid, p_photo_path text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := shipment_by_token(p_token);
  v_order orders%rowtype;
begin
  if v_shipment.id is null then
    raise exception 'Enlace de envío inválido.';
  end if;
  if v_shipment.status <> 'assigned' then
    raise exception 'Este envío ya fue recogido.';
  end if;
  if coalesce(p_photo_path, '') = '' then
    raise exception 'Toma la foto del paquete al recogerlo.';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  if v_order.status not in ('ready', 'on_the_way') then
    raise exception 'El pedido no está listo para recoger.';
  end if;
  update shipments set status = 'picked_up', picked_up_at = now(),
    pickup_photo_path = p_photo_path, pickup_notes = nullif(trim(p_notes), '')
  where id = v_shipment.id;
  if v_order.status = 'ready' then
    update orders set status = 'on_the_way' where id = v_order.id;
    perform log_status(v_order.id, 'ready', 'on_the_way', 'Recogido por ' || v_shipment.courier_name || ' (con foto)');
  end if;
  perform notify_user(v_order.customer_id, 'Pedido en camino',
    v_order.order_number || ' va en camino con ' || v_shipment.courier_name || '. Ten tu PIN a mano.', '/pedidos/' || v_order.id);
end $$;

create or replace function public.courier_deliver(p_token uuid, p_pin text, p_photo_path text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := shipment_by_token(p_token);
  v_order orders%rowtype;
  v_check text;
begin
  if v_shipment.id is null then
    raise exception 'Enlace de envío inválido.';
  end if;
  if v_shipment.status <> 'picked_up' then
    raise exception 'Primero registra la recolección.';
  end if;
  if coalesce(p_photo_path, '') = '' then
    raise exception 'Toma la foto de la entrega.';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  v_check := check_order_pin(v_order.id, p_pin);
  if v_check <> 'ok' then
    return v_check;
  end if;
  update shipments set status = 'delivered', delivered_at = now(), delivery_photo_path = p_photo_path
  where id = v_shipment.id;
  update orders set status = 'delivered', delivered_at = now(), delivery_method = 'pin' where id = v_order.id;
  perform log_status(v_order.id, 'on_the_way', 'delivered', 'Entregado con PIN por ' || v_shipment.courier_name);
  perform notify_user(v_order.customer_id, 'Pedido entregado',
    'Confirmamos la entrega de ' || v_order.order_number || '. Tienes 48 h para reportar un problema.', '/pedidos/' || v_order.id);
  return 'ok';
end $$;

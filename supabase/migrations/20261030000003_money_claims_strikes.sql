-- Fases C, D y E · Dinero retenido, libro contable, reembolsos en cola,
-- reclamos con evidencia, faltas con suspensión automática y transparencia.

-- Reembolsos en cola ------------------------------------------------------------
-- La base decide cuánto y por qué; el servidor llama a la pasarela y confirma.

alter table public.refunds
  alter column status set default 'pending',
  add column responsible text check (responsible in ('business', 'platform', 'courier', 'customer')),
  add column processed_at timestamptz,
  add column error text;
alter table public.refunds drop constraint if exists refunds_status_check;
alter table public.refunds add constraint refunds_status_check check (status in ('pending', 'processed', 'failed'));
update public.refunds set processed_at = created_at where status = 'processed' and processed_at is null;
create index on public.refunds (status) where status <> 'processed';

create or replace function public.refundable_minor(p_order uuid)
returns integer language sql stable security definer set search_path = public as $$
  select o.total_minor - coalesce((select sum(amount_minor) from refunds
                                    where order_id = o.id and status in ('pending', 'processed')), 0)
    from orders o where o.id = p_order;
$$;

create or replace function public.queue_refund(p_order uuid, p_amount integer, p_reason text, p_responsible text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_amount integer;
  v_refund uuid;
begin
  select * into v_order from orders where id = p_order;
  if not found or v_order.payment_status not in ('paid', 'partially_refunded') then
    return null;
  end if;
  v_amount := least(p_amount, refundable_minor(p_order));
  if v_amount <= 0 then
    return null;
  end if;
  insert into refunds (order_id, payment_id, amount_minor, reason, responsible, status)
  values (p_order, (select id from payments where order_id = p_order order by created_at desc limit 1),
          v_amount, p_reason, p_responsible, 'pending')
  returning id into v_refund;
  return v_refund;
end $$;
revoke execute on function public.queue_refund from public, anon, authenticated;

-- Lo llama el servidor tras reembolsar en la pasarela.
create or replace function public.complete_refund(p_refund uuid, p_provider_ref text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_refund refunds%rowtype;
  v_order orders%rowtype;
  v_refunded integer;
begin
  select * into v_refund from refunds where id = p_refund for update;
  if not found or v_refund.status = 'processed' then
    return;
  end if;
  if p_error is not null then
    update refunds set status = 'failed', error = p_error where id = p_refund;
    return;
  end if;
  update refunds set status = 'processed', provider_ref = p_provider_ref, processed_at = now(), error = null
  where id = p_refund;
  select * into v_order from orders where id = v_refund.order_id for update;
  select coalesce(sum(amount_minor), 0) into v_refunded from refunds
   where order_id = v_order.id and status = 'processed';
  if v_refunded >= v_order.total_minor then
    update orders set payment_status = 'refunded',
      status = case when status in ('cancelled', 'returned', 'disputed', 'completed') then 'refunded' else status end
    where id = v_order.id;
    if v_order.status in ('cancelled', 'returned', 'disputed', 'completed') then
      perform log_status(v_order.id, v_order.status, 'refunded', 'Reembolso procesado');
    end if;
  else
    update orders set payment_status = 'partially_refunded' where id = v_order.id;
  end if;
  perform notify_user(v_order.customer_id, 'Reembolso procesado',
    'Devolvimos C$ ' || to_char(v_refund.amount_minor / 100.0, 'FM999G999D00') || ' del pedido ' || v_order.order_number || '.',
    '/pedidos/' || v_order.id);
end $$;
revoke execute on function public.complete_refund from public, anon, authenticated;

-- Faltas (strikes) ----------------------------------------------------------------

create table public.strikes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  reason text not null,
  created_by uuid references public.profiles (id),
  voided_at timestamptz,
  voided_reason text,
  created_at timestamptz not null default now()
);
create index on public.strikes (business_id, created_at desc);
alter table public.strikes enable row level security;
create policy "dueño o admin" on public.strikes for select using (public.can_manage_business(business_id));

create or replace function public.add_strike(p_business uuid, p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_owner uuid;
  v_status business_status;
begin
  insert into strikes (business_id, order_id, reason, created_by) values (p_business, p_order, p_reason, auth.uid());
  select owner_id, status into v_owner, v_status from businesses where id = p_business;
  select count(*) into v_count from strikes
   where business_id = p_business and voided_at is null
     and created_at > now() - make_interval(days => setting_numeric('strikes_window_days', 90)::integer);
  perform notify_user(v_owner, 'Falta registrada', p_reason || ' (' || v_count || ' en los últimos 90 días).', '/vendedor/finanzas');
  if v_count >= setting_numeric('strikes_to_suspend', 3) and v_status = 'approved' then
    update businesses set status = 'suspended' where id = p_business;
    perform notify_user(v_owner, 'Negocio suspendido',
      'Acumulaste ' || v_count || ' faltas. Tu tienda no aparece en el catálogo hasta que la administración la revise.', '/vendedor/panel');
    perform notify_admins('Negocio suspendido automáticamente', v_count || ' faltas en 90 días.', '/admin/negocios');
    perform write_audit('business.auto_suspend', 'business', p_business::text, jsonb_build_object('strikes', v_count));
  end if;
end $$;
revoke execute on function public.add_strike from public, anon, authenticated;

create or replace function public.void_strike(p_strike uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Indica por qué se anula la falta.';
  end if;
  update strikes set voided_at = now(), voided_reason = trim(p_reason) where id = p_strike and voided_at is null;
  perform write_audit('strike.void', 'strike', p_strike::text, jsonb_build_object('reason', p_reason));
end $$;

-- Libro contable del negocio ----------------------------------------------------

create table public.ledger_entries (
  id bigserial primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  payout_id uuid references public.payouts (id) on delete set null,
  kind text not null check (kind in ('sale', 'commission', 'adjustment')),
  amount_minor integer not null,
  description text not null,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.ledger_entries (business_id, payout_id, available_at);
alter table public.ledger_entries enable row level security;
create policy "dueño o admin" on public.ledger_entries for select using (public.can_manage_business(business_id));

alter table public.payouts add column adjustments_minor integer not null default 0;

-- Cierra un pedido entregado: pasa a completed y acredita al negocio.
-- Los emprendedores con pocos pedidos esperan días extra antes de cobrar.
create or replace function public.finalize_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_business businesses%rowtype;
  v_completed integer;
  v_available timestamptz := now();
begin
  select * into v_order from orders where id = p_order for update;
  if not found or v_order.status not in ('delivered', 'disputed') then
    return;
  end if;
  select * into v_business from businesses where id = v_order.business_id;
  select count(*) into v_completed from orders where business_id = v_business.id and status = 'completed';
  if v_business.tier = 'informal' and v_completed < setting_numeric('informal_payout_hold_orders', 10) then
    v_available := now() + make_interval(days => setting_numeric('informal_payout_hold_days', 7)::integer);
  end if;

  update orders set status = 'completed', completed_at = now() where id = p_order;
  perform log_status(p_order, v_order.status, 'completed', 'Cerrado: pago liberado al negocio');
  -- vendor_net + comisión = productos (y el envío en pedidos del modelo anterior).
  insert into ledger_entries (business_id, order_id, kind, amount_minor, description, available_at) values
    (v_business.id, p_order, 'sale', v_order.vendor_net_minor + v_order.commission_amount_minor,
     'Venta ' || v_order.order_number, v_available),
    (v_business.id, p_order, 'commission', -v_order.commission_amount_minor,
     'Comisión ' || to_char(v_order.commission_rate * 100, 'FM990D##') || ' % · ' || v_order.order_number, v_available);
end $$;
revoke execute on function public.finalize_order from public, anon, authenticated;

create or replace function public.generate_payouts(p_start date, p_end date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_payout uuid;
  v_count integer := 0;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if p_end < p_start then
    raise exception 'Rango de fechas inválido.';
  end if;
  for v_row in
    select business_id,
           count(distinct order_id) filter (where kind = 'sale') as orders,
           coalesce(sum(amount_minor) filter (where kind = 'sale'), 0) as gross,
           coalesce(-sum(amount_minor) filter (where kind = 'commission'), 0) as commission,
           coalesce(sum(amount_minor) filter (where kind = 'adjustment'), 0) as adjustments,
           sum(amount_minor) as net
      from ledger_entries
     where payout_id is null
       and (available_at at time zone 'America/Managua')::date <= p_end
     group by business_id
    having sum(amount_minor) > 0
  loop
    insert into payouts (business_id, period_start, period_end, orders_count, gross_minor,
                         commission_minor, delivery_minor, adjustments_minor, net_minor)
    values (v_row.business_id, p_start, p_end, v_row.orders, v_row.gross, v_row.commission, 0,
            v_row.adjustments, v_row.net)
    on conflict (business_id, period_start, period_end) do nothing
    returning id into v_payout;
    if v_payout is not null then
      update ledger_entries set payout_id = v_payout
       where business_id = v_row.business_id and payout_id is null
         and (available_at at time zone 'America/Managua')::date <= p_end;
      v_count := v_count + 1;
    end if;
  end loop;
  perform write_audit('payout.generate', 'payout', null,
    jsonb_build_object('start', p_start, 'end', p_end, 'count', v_count));
  return v_count;
end $$;

-- Cancelaciones y fallas ----------------------------------------------------------

-- Negocio o admin cancelan con motivo. Si cancela el negocio, es una falta.
-- Devuelve true si quedó un reembolso en cola.
create or replace function public.cancel_order(p_order uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_admin boolean := is_admin();
  v_refund uuid;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Indica el motivo de la cancelación.';
  end if;
  select * into v_order from orders where id = p_order for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;
  if not (owns_business(v_order.business_id) or v_admin) then
    raise exception 'Solo el negocio o un administrador pueden cancelar.';
  end if;
  if v_order.status not in ('preparing', 'ready', 'ready_for_pickup')
     and not (v_admin and v_order.status = 'on_the_way') then
    raise exception 'Este pedido ya no se puede cancelar.';
  end if;

  perform restock_order(p_order);
  update orders set status = 'cancelled', cancel_reason = trim(p_reason), cancelled_at = now() where id = p_order;
  update shipments set status = 'returned' where order_id = p_order and status in ('assigned', 'picked_up');
  perform log_status(p_order, v_order.status, 'cancelled', trim(p_reason));
  perform notify_user(v_order.customer_id, 'Pedido cancelado',
    'El pedido ' || v_order.order_number || ' fue cancelado: ' || trim(p_reason) || '. Te devolvemos el pago completo.',
    '/pedidos/' || p_order);
  v_refund := queue_refund(p_order, v_order.total_minor, trim(p_reason), case when v_admin then 'platform' else 'business' end);
  if v_admin then
    perform write_audit('order.cancel', 'order', p_order::text, jsonb_build_object('reason', p_reason));
  else
    perform add_strike(v_order.business_id, p_order, 'Canceló el pedido ' || v_order.order_number || ': ' || trim(p_reason));
  end if;
  return v_refund is not null;
end $$;

-- El mensajero rechaza en la recolección (no coincide o viene dañado).
create or replace function public.courier_reject(p_token uuid, p_reason text, p_photo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := shipment_by_token(p_token);
  v_order orders%rowtype;
begin
  if v_shipment.id is null then
    raise exception 'Enlace de envío inválido.';
  end if;
  if v_shipment.status <> 'assigned' then
    raise exception 'Solo se puede rechazar al momento de recoger.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 or coalesce(p_photo_path, '') = '' then
    raise exception 'Describe el problema y toma una foto.';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  if v_order.status <> 'ready' then
    raise exception 'El pedido no está esperando recolección.';
  end if;
  update shipments set status = 'rejected', pickup_photo_path = p_photo_path, failure_notes = trim(p_reason)
  where id = v_shipment.id;
  update orders set status = 'cancelled', cancelled_at = now(),
    cancel_reason = 'Rechazado en la recolección: ' || trim(p_reason)
  where id = v_order.id;
  perform restock_order(v_order.id);
  perform log_status(v_order.id, 'ready', 'cancelled', 'Rechazado por ' || v_shipment.courier_name || ': ' || trim(p_reason));
  perform queue_refund(v_order.id, v_order.total_minor, 'Producto rechazado en la recolección', 'business');
  perform add_strike(v_order.business_id, v_order.id, 'Pedido ' || v_order.order_number || ' rechazado en la recolección: ' || trim(p_reason));
  perform notify_user(v_order.customer_id, 'Pedido cancelado',
    'Al recogerlo, ' || v_order.order_number || ' no cumplía lo publicado. Te devolvemos el pago completo.', '/pedidos/' || v_order.id);
  perform notify_admins('Rechazo en recolección', v_order.order_number || ': ' || trim(p_reason), '/admin/envios');
end $$;

-- Intento de entrega fallido; al llegar al máximo, el pedido vuelve al negocio.
create or replace function public.courier_fail(p_token uuid, p_notes text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_shipment shipments%rowtype := shipment_by_token(p_token);
  v_order orders%rowtype;
  v_attempts integer;
begin
  if v_shipment.id is null then
    raise exception 'Enlace de envío inválido.';
  end if;
  if v_shipment.status <> 'picked_up' then
    raise exception 'El envío no está en ruta.';
  end if;
  if coalesce(length(trim(p_notes)), 0) < 5 then
    raise exception 'Describe qué pasó (cliente ausente, dirección errónea…).';
  end if;
  select * into v_order from orders where id = v_shipment.order_id for update;
  v_attempts := v_shipment.attempts + 1;
  update shipments set attempts = v_attempts,
    failure_notes = concat_ws(E'\n', failure_notes, to_char(now() at time zone 'America/Managua', 'DD/MM HH24:MI') || ' · ' || trim(p_notes))
  where id = v_shipment.id;

  if v_attempts < setting_numeric('max_delivery_attempts', 2) then
    perform notify_user(v_order.customer_id, 'No pudimos entregar tu pedido',
      'Intento ' || v_attempts || ': ' || trim(p_notes) || '. Volveremos a intentarlo; revisa tu teléfono.', '/pedidos/' || v_order.id);
    perform notify_admins('Intento de entrega fallido', v_order.order_number || ': ' || trim(p_notes), '/admin/envios');
    return 'retry';
  end if;

  update shipments set status = 'returned' where id = v_shipment.id;
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

-- Mantenimiento automático (cron) -------------------------------------------------

create or replace function public.run_order_maintenance()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_sla integer := 0;
  v_pickups integer := 0;
  v_closed integer := 0;
begin
  -- 1. El negocio no preparó a tiempo: cancelación, reembolso total y falta.
  for v_order in select * from orders where status = 'preparing' and sla_due_at < now() for update skip locked loop
    perform restock_order(v_order.id);
    update orders set status = 'cancelled', cancelled_at = now(),
      cancel_reason = 'El negocio no preparó el pedido a tiempo' where id = v_order.id;
    perform log_status(v_order.id, 'preparing', 'cancelled', 'Venció el plazo de preparación');
    perform queue_refund(v_order.id, v_order.total_minor, 'El negocio no preparó el pedido a tiempo', 'business');
    perform add_strike(v_order.business_id, v_order.id, 'No preparó ' || v_order.order_number || ' dentro del plazo');
    perform notify_user(v_order.customer_id, 'Pedido cancelado',
      'El negocio no preparó ' || v_order.order_number || ' a tiempo. Te devolvemos el pago completo.', '/pedidos/' || v_order.id);
    v_sla := v_sla + 1;
  end loop;

  -- 2. El cliente no retiró en el negocio: se devuelve todo menos la tarifa de servicio.
  for v_order in select * from orders
    where status = 'ready_for_pickup'
      and ready_at < now() - make_interval(days => setting_numeric('pickup_window_days', 7)::integer)
    for update skip locked loop
    perform restock_order(v_order.id);
    update orders set status = 'cancelled', cancelled_at = now(),
      cancel_reason = 'No se retiró a tiempo' where id = v_order.id;
    perform log_status(v_order.id, 'ready_for_pickup', 'cancelled', 'Venció el plazo para retirar');
    perform queue_refund(v_order.id, v_order.total_minor - v_order.service_fee_minor,
      'No se retiró a tiempo (la tarifa de servicio no es reembolsable)', 'customer');
    perform notify_user(v_order.customer_id, 'Pedido cancelado',
      'No retiraste ' || v_order.order_number || ' a tiempo. Te devolvemos el pago menos la tarifa de servicio.', '/pedidos/' || v_order.id);
    v_pickups := v_pickups + 1;
  end loop;

  -- 3. Pasó la ventana de reclamo sin reclamos: se libera el pago al negocio.
  for v_order in select * from orders
    where status = 'delivered'
      and delivered_at < now() - make_interval(hours => setting_numeric('claim_window_hours', 48)::integer)
    for update skip locked loop
    perform finalize_order(v_order.id);
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('sla_cancelled', v_sla, 'pickups_expired', v_pickups, 'completed', v_closed);
end $$;
revoke execute on function public.run_order_maintenance from public, anon, authenticated;

select cron.schedule('order-maintenance', '*/10 * * * *', $$select public.run_order_maintenance()$$);

-- Reclamos ------------------------------------------------------------------------

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid not null references public.profiles (id),
  reason text not null check (reason in ('not_received', 'damaged', 'wrong_item', 'missing_items', 'other')),
  description text not null,
  photo_paths text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'approved', 'rejected')),
  flags text[] not null default '{}',
  refund_minor integer,
  responsible text check (responsible in ('business', 'platform', 'courier', 'customer')),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index claims_one_open on public.claims (order_id) where status = 'open';
create index on public.claims (status, created_at);
alter table public.claims enable row level security;
create policy "partes del pedido" on public.claims for select using (public.can_see_order(order_id));

create or replace function public.open_claim(p_order uuid, p_reason text, p_description text, p_photos text[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_flags text[] := '{}';
  v_rejected integer;
  v_claim uuid;
  v_owner uuid;
  v_photo text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found or v_order.customer_id <> auth.uid() then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'Solo puedes reportar un problema de un pedido entregado.';
  end if;
  if v_order.delivered_at < now() - make_interval(hours => setting_numeric('claim_window_hours', 48)::integer) then
    raise exception 'Pasó el plazo de 48 horas para reportar problemas.';
  end if;
  if coalesce(length(trim(p_description)), 0) < 10 then
    raise exception 'Cuéntanos qué pasó (mínimo 10 caracteres).';
  end if;
  if p_reason in ('damaged', 'wrong_item', 'missing_items') and coalesce(array_length(p_photos, 1), 0) = 0 then
    raise exception 'Adjunta al menos una foto del problema.';
  end if;
  foreach v_photo in array coalesce(p_photos, '{}') loop
    if v_photo not like auth.uid()::text || '/%' then
      raise exception 'Foto inválida.';
    end if;
  end loop;

  if p_reason = 'not_received' and v_order.delivery_method = 'pin' then
    v_flags := v_flags || 'La entrega se confirmó con el PIN del cliente';
  end if;
  select count(*) into v_rejected from claims where customer_id = auth.uid() and status = 'rejected';
  if v_rejected >= 2 then
    v_flags := v_flags || ('El cliente tiene ' || v_rejected || ' reclamos rechazados');
  end if;

  insert into claims (order_id, customer_id, reason, description, photo_paths, flags)
  values (p_order, auth.uid(), p_reason, trim(p_description), coalesce(p_photos, '{}'), v_flags)
  returning id into v_claim;
  update orders set status = 'disputed' where id = p_order;
  perform log_status(p_order, 'delivered', 'disputed', 'Reclamo del cliente');
  select owner_id into v_owner from businesses where id = v_order.business_id;
  perform notify_user(v_owner, 'Reclamo en ' || v_order.order_number,
    'El cliente reportó un problema. La administración lo revisará con la evidencia.', '/vendedor/pedidos');
  perform notify_admins('Nuevo reclamo', v_order.order_number, '/admin/reclamos');
  return v_claim;
end $$;

-- La administración resuelve con la evidencia (fotos de listo, recolección y entrega).
create or replace function public.resolve_claim(
  p_claim uuid, p_approve boolean, p_refund_minor integer, p_responsible text, p_note text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_order orders%rowtype;
  v_refund uuid;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if coalesce(length(trim(p_note)), 0) < 5 then
    raise exception 'Explica la decisión al cliente y al negocio.';
  end if;
  select * into v_claim from claims where id = p_claim for update;
  if not found or v_claim.status <> 'open' then
    raise exception 'El reclamo no está abierto.';
  end if;
  select * into v_order from orders where id = v_claim.order_id for update;

  if p_approve then
    if p_refund_minor is null or p_refund_minor <= 0 or p_refund_minor > refundable_minor(v_order.id) then
      raise exception 'Monto de reembolso inválido (máximo C$ %).', refundable_minor(v_order.id) / 100.0;
    end if;
    if p_responsible not in ('business', 'platform', 'courier') then
      raise exception 'Indica quién es responsable.';
    end if;
  end if;

  update claims set
    status = case when p_approve then 'approved' else 'rejected' end,
    refund_minor = case when p_approve then p_refund_minor end,
    responsible = case when p_approve then p_responsible else 'customer' end,
    resolution_note = trim(p_note), resolved_by = auth.uid(), resolved_at = now()
  where id = p_claim;

  -- Se cierra el pedido (acredita venta y comisión) y luego se aplica el ajuste.
  perform finalize_order(v_order.id);
  if p_approve then
    v_refund := queue_refund(v_order.id, p_refund_minor, 'Reclamo aprobado: ' || trim(p_note), p_responsible);
    if p_responsible = 'business' then
      insert into ledger_entries (business_id, order_id, kind, amount_minor, description)
      values (v_order.business_id, v_order.id, 'adjustment',
              -least(p_refund_minor, v_order.vendor_net_minor), 'Reclamo aprobado · ' || v_order.order_number);
      perform add_strike(v_order.business_id, v_order.id, 'Reclamo aprobado en ' || v_order.order_number || ': ' || trim(p_note));
    end if;
  end if;
  perform notify_user(v_order.customer_id,
    case when p_approve then 'Reclamo aprobado' else 'Reclamo rechazado' end,
    trim(p_note), '/pedidos/' || v_order.id);
  perform write_audit(case when p_approve then 'claim.approved' else 'claim.rejected' end, 'claim', p_claim::text,
    jsonb_build_object('refund', p_refund_minor, 'responsible', p_responsible, 'note', p_note));
  return v_refund is not null;
end $$;

-- Transparencia -----------------------------------------------------------------

create or replace function public.business_public_stats(p_business uuid)
returns table (completed_orders integer, on_time_rate numeric, member_since timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from orders where business_id = p_business and status = 'completed'),
    (select case when count(*) = 0 then null
                 else round(count(*) filter (where ready_at <= sla_due_at)::numeric / count(*), 3) end
       from orders where business_id = p_business and ready_at is not null and sla_due_at is not null),
    (select approved_at from businesses where id = p_business and status = 'approved');
$$;

-- Ganancia de la plataforma en un período (estimación: la pasarela se aproxima con gateway_fee_rate).
create or replace function public.platform_profit(p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  with paid as (
    select * from orders
     where paid_at is not null
       and (paid_at at time zone 'America/Managua')::date between p_start and p_end
  ), refunds_p as (
    select r.* from refunds r join paid p on p.id = r.order_id where r.status in ('pending', 'processed')
  )
  select jsonb_build_object(
    'orders', (select count(*) from paid),
    'gmv', (select coalesce(sum(total_minor), 0) from paid),
    'commission', (select coalesce(sum(commission_amount_minor), 0) from paid where status = 'completed'),
    'service_fees', (select coalesce(sum(service_fee_minor), 0) from paid where status in ('completed', 'returned', 'delivered', 'disputed')
                      or (status in ('cancelled', 'refunded') and cancel_reason = 'No se retiró a tiempo')),
    'delivery_fees', (select coalesce(sum(delivery_fee_minor), 0) from paid where status in ('completed', 'returned', 'delivered', 'disputed')),
    'courier_costs', (select coalesce(sum(s.courier_cost_minor), 0) from shipments s join paid p on p.id = s.order_id
                       where s.status in ('picked_up', 'delivered', 'returned', 'rejected')),
    'gateway_fees', (select round(coalesce(sum(total_minor), 0) * setting_numeric('gateway_fee_rate', 0.039)) from paid),
    'reserve', (select coalesce(sum(reserve_minor), 0) from paid where status = 'completed'),
    'platform_refunds', (select coalesce(sum(amount_minor), 0) from refunds_p where responsible in ('platform', 'courier')),
    'refunds_total', (select coalesce(sum(amount_minor), 0) from refunds_p)
  ) into v_result;
  return v_result || jsonb_build_object('net',
    (v_result ->> 'commission')::bigint + (v_result ->> 'service_fees')::bigint
    + (v_result ->> 'delivery_fees')::bigint - (v_result ->> 'courier_costs')::bigint
    - (v_result ->> 'gateway_fees')::bigint - (v_result ->> 'platform_refunds')::bigint);
end $$;

-- Versión de los términos aceptada por cada vendedor.
alter table public.businesses add column accepted_terms_version text;
insert into public.platform_settings (key, value) values ('terms_version', '"2026-10"') on conflict (key) do nothing;

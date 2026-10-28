-- Catarina Market · reglas de negocio en Postgres
-- Las funciones SECURITY DEFINER validan permisos ellas mismas; las que solo
-- debe llamar el servidor (webhooks, cron) se revocan a anon y authenticated.

-- Roles ----------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and is_active
  );
$$;

create or replace function public.owns_business(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = p_business and owner_id = auth.uid());
$$;

-- Llamadas hechas desde funciones SECURITY DEFINER o con la service role.
create or replace function public.is_privileged_session()
returns boolean language sql stable as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

-- Perfil automático al registrarse. El rol siempre inicia como customer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, avatar_url, phone, accepted_terms_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    case when (new.raw_user_meta_data ->> 'accepted_terms') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie cambia su propio rol ni el estado de su negocio sin pasar por el admin.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not public.is_privileged_session() and not public.is_admin() then
    raise exception 'No tienes permiso para cambiar el rol o el estado de la cuenta.';
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.protect_business_status()
returns trigger language plpgsql as $$
begin
  if public.is_privileged_session() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.rejection_reason := null;
    new.submitted_at := null;
    new.approved_at := null;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.approved_at is distinct from old.approved_at
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'El estado del negocio solo lo cambia la administración.';
  end if;
  return new;
end $$;

create trigger businesses_protect_status before insert or update on public.businesses
  for each row execute function public.protect_business_status();

-- Rol en el JWT (custom access token hook). Activar en Auth → Hooks.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  v_role public.user_role;
  v_claims jsonb := event -> 'claims';
begin
  select role into v_role from public.profiles where id = (event ->> 'user_id')::uuid;
  v_claims := jsonb_set(v_claims, '{user_role}', to_jsonb(coalesce(v_role, 'customer')::text));
  return jsonb_set(event, '{claims}', v_claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on table public.profiles to supabase_auth_admin;

-- Utilidades -----------------------------------------------------------------

create or replace function public.setting_numeric(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from platform_settings where key = p_key), p_default);
$$;

create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, link) values (p_user, p_title, p_body, p_link);
$$;
revoke execute on function public.notify_user from anon, authenticated, public;

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'));
$$;
revoke execute on function public.write_audit from anon, authenticated, public;

-- Horario (America/Managua) -------------------------------------------------

create or replace function public.is_business_open(p_business uuid, p_at timestamptz default now())
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_local timestamp := p_at at time zone 'America/Managua';
  v_override boolean;
  v_hours business_hours%rowtype;
begin
  select is_open_override into v_override from businesses where id = p_business;
  if v_override is not null then
    return v_override;
  end if;
  if exists (select 1 from business_closures where business_id = p_business and date = v_local::date) then
    return false;
  end if;
  select * into v_hours from business_hours
   where business_id = p_business and day_of_week = extract(dow from v_local)::smallint;
  if not found or v_hours.is_closed then
    return false;
  end if;
  if v_hours.closes_at > v_hours.opens_at then
    return v_local::time >= v_hours.opens_at and v_local::time < v_hours.closes_at;
  end if;
  -- Horario que cruza la medianoche.
  return v_local::time >= v_hours.opens_at or v_local::time < v_hours.closes_at;
end $$;

-- Cobertura y tarifa de delivery --------------------------------------------

create or replace function public.delivery_zone_for(p_business uuid, p_department smallint, p_municipality integer)
returns public.delivery_zones language sql stable security definer set search_path = public as $$
  select * from delivery_zones
   where business_id = p_business
     and department_id = p_department
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
  return exists (select 1 from businesses where id = p_business and accepts_delivery)
     and (delivery_zone_for(p_business, v_address.department_id, v_address.municipality_id)).id is not null;
end $$;

-- Comisión: regla del negocio > regla de la categoría > valor global ---------

create or replace function public.commission_rate_for(p_business uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rate from commission_rules
      where business_id = p_business
        and valid_from <= current_date and (valid_to is null or valid_to >= current_date)
      order by valid_from desc limit 1),
    (select r.rate from commission_rules r join businesses b on b.category_id = r.category_id
      where b.id = p_business
        and r.valid_from <= current_date and (r.valid_to is null or r.valid_to >= current_date)
      order by r.valid_from desc limit 1),
    setting_numeric('commission_rate', 0.08)
  );
$$;

-- Crear pedido (transaccional) ----------------------------------------------
-- p_items: [{"product_id": uuid, "quantity": int, "note": text}]
-- Recalcula precios desde la base, valida horario, cobertura y stock, y
-- congela la comisión. El stock se descuenta al confirmar el pago.

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
  v_zone delivery_zones%rowtype;
  v_item jsonb;
  v_product products%rowtype;
  v_qty integer;
  v_subtotal integer := 0;
  v_fee integer := 0;
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
      raise exception 'Este negocio no ofrece Para llevar.';
    end if;
  else
    if not v_business.accepts_delivery then
      raise exception 'Este negocio no ofrece Delivery.';
    end if;
    select * into v_address from addresses where id = p_address and user_id = v_user;
    if not found then
      raise exception 'Selecciona una dirección de entrega válida.';
    end if;
    select * into v_zone from delivery_zone_for(p_business, v_address.department_id, v_address.municipality_id);
    if v_zone.id is null then
      raise exception 'El negocio no envía a tu zona. Elige Para llevar.';
    end if;
    v_fee := v_zone.fee_minor;
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
    delivery_fee_minor, commission_rate, commission_amount_minor, total_minor,
    vendor_net_minor, estimated_days, address_snapshot, contact_name, contact_phone,
    customer_note, expires_at
  ) values (
    'CM-' || to_char(now() at time zone 'America/Managua', 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 5)),
    v_user, p_business, p_service, 1, v_fee, v_rate, 0, 1, 0,
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

  v_commission := round(v_subtotal * v_rate);
  update orders set
    subtotal_minor = v_subtotal,
    commission_amount_minor = v_commission,
    total_minor = v_subtotal + v_fee,
    vendor_net_minor = v_subtotal - v_commission + v_fee
  where id = v_order;

  insert into order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order, null, 'pending_payment', v_user, 'Pedido creado');

  return v_order;
end $$;

-- Confirmar pago (solo servidor) ---------------------------------------------
-- Devuelve 'confirmed', 'already' o 'refund_required' (sin stock o pedido vencido).

create or replace function public.confirm_order_payment(
  p_order uuid, p_provider text, p_ref text, p_amount integer
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
  v_owner uuid;
  v_missing text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;
  if v_order.payment_status in ('paid', 'refunded') then
    return 'already';
  end if;

  insert into payments (order_id, provider, provider_ref, amount_minor)
  values (p_order, p_provider, p_ref, p_amount);

  if v_order.status <> 'pending_payment' then
    update orders set payment_status = 'paid', paid_at = now() where id = p_order;
    return 'refund_required';
  end if;

  -- Bloquea los productos en orden estable para evitar interbloqueos.
  perform 1 from products p join order_items i on i.product_id = p.id
   where i.order_id = p_order order by p.id for update of p;

  select i.product_name into v_missing
    from order_items i left join products p on p.id = i.product_id
   where i.order_id = p_order and (p.id is null or p.stock < i.quantity)
   limit 1;

  if v_missing is not null then
    update orders set
      status = 'cancelled', payment_status = 'paid', paid_at = now(), cancelled_at = now(),
      cancel_reason = 'Sin existencias de ' || v_missing || ' al confirmar el pago'
    where id = p_order;
    insert into order_status_history (order_id, from_status, to_status, note)
    values (p_order, 'pending_payment', 'cancelled', 'Sin existencias al confirmar el pago');
    return 'refund_required';
  end if;

  for v_item in select * from order_items where order_id = p_order loop
    update products set stock = stock - v_item.quantity where id = v_item.product_id;
  end loop;

  update orders set
    status = 'preparing', payment_status = 'paid', paid_at = now(),
    payment_provider = p_provider,
    stripe_payment_intent_id = case when p_provider = 'stripe' then p_ref else stripe_payment_intent_id end
  where id = p_order;

  insert into order_status_history (order_id, from_status, to_status, note)
  values (p_order, 'pending_payment', 'preparing', 'Pago confirmado');

  select owner_id into v_owner from businesses where id = v_order.business_id;
  perform notify_user(v_owner, 'Nuevo pedido ' || v_order.order_number,
    'Tienes un pedido nuevo en preparación.', '/vendedor/pedidos');
  perform notify_user(v_order.customer_id, 'Pago confirmado',
    'Tu pedido ' || v_order.order_number || ' ya está en preparación.', '/pedidos/' || p_order);
  return 'confirmed';
end $$;
revoke execute on function public.confirm_order_payment from anon, authenticated, public;

-- Registrar reembolso (solo servidor, después de llamar al proveedor) --------

create or replace function public.record_refund(
  p_order uuid, p_reason text, p_provider_ref text, p_processed_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_payment uuid;
begin
  select * into v_order from orders where id = p_order for update;
  if not found or v_order.payment_status <> 'paid' or v_order.status <> 'cancelled' then
    return;
  end if;
  select id into v_payment from payments where order_id = p_order order by created_at desc limit 1;
  insert into refunds (order_id, payment_id, amount_minor, reason, provider_ref, processed_by)
  values (p_order, v_payment, v_order.total_minor, p_reason, p_provider_ref, p_processed_by);
  update orders set status = 'refunded', payment_status = 'refunded' where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order, 'cancelled', 'refunded', p_processed_by, 'Reembolso procesado');
  perform notify_user(v_order.customer_id, 'Reembolso procesado',
    'Devolvimos el pago del pedido ' || v_order.order_number || '.', '/pedidos/' || p_order);
end $$;
revoke execute on function public.record_refund from anon, authenticated, public;

-- Transiciones de estado -----------------------------------------------------

create or replace function public.can_transition(
  p_from public.order_status, p_to public.order_status, p_service public.service_type
) returns boolean language sql immutable as $$
  select case
    when p_from = 'pending_payment' then p_to in ('preparing', 'cancelled')
    when p_from = 'preparing' then
      (p_to = 'ready_for_pickup' and p_service = 'pickup')
      or (p_to = 'on_the_way' and p_service = 'delivery')
      or p_to = 'cancelled'
    when p_from in ('ready_for_pickup', 'on_the_way') then p_to in ('completed', 'cancelled')
    when p_from = 'cancelled' then p_to = 'refunded'
    else false
  end;
$$;

create or replace function public.transition_order(
  p_order uuid, p_to public.order_status, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_label text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;
  if not (owns_business(v_order.business_id) or is_admin()) then
    raise exception 'No puedes modificar este pedido.';
  end if;
  if p_to not in ('ready_for_pickup', 'on_the_way', 'completed') then
    raise exception 'Usa la opción Cancelar para anular un pedido.';
  end if;
  if not can_transition(v_order.status, p_to, v_order.service_type) then
    raise exception 'Ese cambio de estado no está permitido.';
  end if;

  update orders set status = p_to,
    completed_at = case when p_to = 'completed' then now() else completed_at end
  where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order, v_order.status, p_to, auth.uid(), nullif(trim(p_note), ''));

  v_label := case p_to
    when 'ready_for_pickup' then 'está listo para retirar'
    when 'on_the_way' then 'va en camino'
    else 'fue completado' end;
  perform notify_user(v_order.customer_id, 'Pedido ' || v_order.order_number,
    'Tu pedido ' || v_label || '.', '/pedidos/' || p_order);
end $$;

-- Cancelar (negocio o admin, siempre con motivo). Repone stock.
-- Devuelve true si el pedido estaba pagado y requiere reembolso.
create or replace function public.cancel_order(p_order uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
begin
  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Indica el motivo de la cancelación.';
  end if;
  select * into v_order from orders where id = p_order for update;
  if not found then
    raise exception 'Pedido no encontrado.';
  end if;
  if not (owns_business(v_order.business_id) or is_admin()) then
    raise exception 'Solo el negocio o un administrador pueden cancelar.';
  end if;
  if v_order.status not in ('preparing', 'ready_for_pickup', 'on_the_way') then
    raise exception 'Este pedido ya no se puede cancelar.';
  end if;

  for v_item in select * from order_items where order_id = p_order and product_id is not null loop
    update products set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;

  update orders set status = 'cancelled', cancel_reason = trim(p_reason), cancelled_at = now()
  where id = p_order;
  insert into order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order, v_order.status, 'cancelled', auth.uid(), trim(p_reason));
  perform notify_user(v_order.customer_id, 'Pedido cancelado',
    'El pedido ' || v_order.order_number || ' fue cancelado: ' || trim(p_reason), '/pedidos/' || p_order);
  if is_admin() then
    perform write_audit('order.cancel', 'order', p_order::text, jsonb_build_object('reason', p_reason));
  end if;
  return v_order.payment_status = 'paid';
end $$;

-- Vencer pedidos sin pago (cron) ---------------------------------------------

create or replace function public.expire_pending_orders(p_order uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  with expired as (
    update orders set
      status = 'cancelled', payment_status = 'expired', cancelled_at = now(),
      cancel_reason = 'Pago no confirmado a tiempo'
    where status = 'pending_payment'
      and (
        (p_order is null and expires_at < now())
        or (p_order is not null and id = p_order)
      )
    returning id
  )
  insert into order_status_history (order_id, from_status, to_status, note)
  select id, 'pending_payment', 'cancelled', 'Pago no confirmado a tiempo' from expired;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.expire_pending_orders from anon, authenticated, public;

-- Solicitudes de negocio -----------------------------------------------------

create or replace function public.submit_business_application(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business businesses%rowtype;
  v_docs integer;
begin
  select * into v_business from businesses where id = p_business for update;
  if not found or v_business.owner_id <> auth.uid() then
    raise exception 'Negocio no encontrado.';
  end if;
  if v_business.status not in ('draft', 'rejected') then
    raise exception 'La solicitud ya fue enviada.';
  end if;
  if v_business.ruc is null or v_business.legal_name is null or v_business.category_id is null
     or v_business.department_id is null or v_business.municipality_id is null
     or v_business.address_line is null or v_business.phone is null then
    raise exception 'Completa todos los datos del negocio.';
  end if;
  if v_business.accepted_terms_at is null then
    raise exception 'Debes aceptar los términos y la comisión.';
  end if;
  if not exists (select 1 from business_bank_accounts where business_id = p_business) then
    raise exception 'Agrega la cuenta bancaria para liquidaciones.';
  end if;
  select count(*) into v_docs from business_documents
   where business_id = p_business and doc_type in ('ruc', 'cedula_front', 'cedula_back', 'municipal_license');
  if v_docs < 4 then
    raise exception 'Sube los cuatro documentos requeridos.';
  end if;

  update businesses set status = 'pending', submitted_at = now(), rejection_reason = null
  where id = p_business;
  insert into business_applications (business_id) values (p_business);
end $$;

create or replace function public.review_business_application(
  p_business uuid, p_decision text, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_business businesses%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decisión inválida.';
  end if;
  if p_decision = 'rejected' and coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Indica el motivo del rechazo.';
  end if;
  select * into v_business from businesses where id = p_business for update;
  if not found or v_business.status <> 'pending' then
    raise exception 'La solicitud no está pendiente.';
  end if;

  update businesses set
    status = p_decision::business_status,
    rejection_reason = case when p_decision = 'rejected' then trim(p_reason) end,
    approved_at = case when p_decision = 'approved' then now() else approved_at end
  where id = p_business;

  update business_applications set
    reviewed_by = auth.uid(), reviewed_at = now(), decision = p_decision,
    rejection_reason = case when p_decision = 'rejected' then trim(p_reason) end
  where id = (select id from business_applications where business_id = p_business order by submitted_at desc limit 1);

  update business_documents set status = case when p_decision = 'approved' then 'accepted' else status end
  where business_id = p_business;

  if p_decision = 'approved' then
    update profiles set role = 'vendor' where id = v_business.owner_id and role = 'customer';
    insert into business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
    select p_business, d, '08:00', '17:00', d = 0 from generate_series(0, 6) d
    on conflict do nothing;
    perform notify_user(v_business.owner_id, '¡Tu negocio fue aprobado!',
      v_business.trade_name || ' ya puede publicar productos.', '/vendedor/panel');
  else
    perform notify_user(v_business.owner_id, 'Solicitud rechazada',
      'Motivo: ' || trim(p_reason) || '. Corrige y vuelve a enviar.', '/vendedor/solicitud');
  end if;

  perform write_audit('business.' || p_decision, 'business', p_business::text,
    jsonb_build_object('reason', p_reason, 'trade_name', v_business.trade_name));
end $$;

create or replace function public.set_business_suspended(p_business uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business businesses%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  select * into v_business from businesses where id = p_business for update;
  if not found then
    raise exception 'Negocio no encontrado.';
  end if;
  if p_suspended and v_business.status <> 'approved' then
    raise exception 'Solo se suspenden negocios aprobados.';
  end if;
  if not p_suspended and v_business.status <> 'suspended' then
    raise exception 'El negocio no está suspendido.';
  end if;
  update businesses set status = case when p_suspended then 'suspended' else 'approved' end::business_status
  where id = p_business;
  perform notify_user(v_business.owner_id,
    case when p_suspended then 'Negocio suspendido' else 'Negocio reactivado' end,
    coalesce(p_reason, ''), '/vendedor/panel');
  perform write_audit(case when p_suspended then 'business.suspend' else 'business.reactivate' end,
    'business', p_business::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_update_user(p_user uuid, p_role public.user_role, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes modificar tu propia cuenta.';
  end if;
  update profiles set role = p_role, is_active = p_active where id = p_user;
  perform write_audit('user.update', 'profile', p_user::text,
    jsonb_build_object('role', p_role, 'active', p_active));
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  insert into platform_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform write_audit('setting.update', 'setting', p_key, jsonb_build_object('value', p_value));
end $$;

create or replace function public.admin_log(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  perform write_audit(p_action, p_entity, p_entity_id, p_details);
end $$;

-- Liquidaciones --------------------------------------------------------------

create or replace function public.generate_payouts(p_start date, p_end date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if p_end < p_start then
    raise exception 'Rango de fechas inválido.';
  end if;
  insert into payouts (business_id, period_start, period_end, orders_count, gross_minor,
                       commission_minor, delivery_minor, net_minor)
  select business_id, p_start, p_end, count(*), sum(subtotal_minor),
         sum(commission_amount_minor), sum(delivery_fee_minor), sum(vendor_net_minor)
    from orders
   where status = 'completed'
     and (completed_at at time zone 'America/Managua')::date between p_start and p_end
   group by business_id
  on conflict (business_id, period_start, period_end) do nothing;
  get diagnostics v_count = row_count;
  perform write_audit('payout.generate', 'payout', null,
    jsonb_build_object('start', p_start, 'end', p_end, 'count', v_count));
  return v_count;
end $$;

create or replace function public.mark_payout_paid(p_payout uuid, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_owner uuid;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  update payouts set status = 'paid', paid_at = now(), reference = nullif(trim(p_reference), '')
   where id = p_payout and status = 'pending'
  returning business_id into v_business;
  if v_business is null then
    raise exception 'La liquidación no está pendiente.';
  end if;
  select owner_id into v_owner from businesses where id = v_business;
  perform notify_user(v_owner, 'Liquidación pagada', 'Transferimos tu liquidación.', '/vendedor/finanzas');
  perform write_audit('payout.paid', 'payout', p_payout::text, jsonb_build_object('reference', p_reference));
end $$;

-- Reseñas --------------------------------------------------------------------

create or replace function public.refresh_business_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update businesses set
    rating_avg = coalesce((select avg(rating) from reviews where business_id = new.business_id), 0),
    rating_count = (select count(*) from reviews where business_id = new.business_id)
  where id = new.business_id;
  return new;
end $$;

create trigger reviews_refresh_rating after insert or update on public.reviews
  for each row execute function public.refresh_business_rating();

create or replace function public.can_review(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders where id = p_order and customer_id = auth.uid() and status = 'completed'
  );
$$;

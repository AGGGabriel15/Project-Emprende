-- Fase A · Niveles de vendedor y verificación.
-- "Emprendedor verificado" (informal, sin RUC) y "Negocio formal" (RUC + matrícula).
-- Misma comisión; el formal tiene más límites. El informal exige selfie con cédula,
-- fotos del lugar, ubicación y visita de verificación antes de aprobarse.

create type public.business_tier as enum ('informal', 'formal');

alter table public.businesses
  add column tier public.business_tier not null default 'formal',
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180),
  add column declaration_accepted_at timestamptz,
  add column verification_visit_at timestamptz,
  add column verification_visit_by uuid references public.profiles (id),
  add column verification_visit_notes text,
  add column upgrade_requested_at timestamptz;

alter table public.business_documents drop constraint business_documents_doc_type_check;
alter table public.business_documents add constraint business_documents_doc_type_check
  check (doc_type in ('ruc', 'cedula_front', 'cedula_back', 'municipal_license',
                      'selfie_cedula', 'place_photo_1', 'place_photo_2', 'other'));

-- Moderación del primer catálogo ----------------------------------------------

alter table public.products
  add column review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column review_note text;
create index on public.products (review_status) where review_status <> 'approved';

insert into public.platform_settings (key, value) values
  ('first_products_review', '10'),
  ('informal_max_active_orders', '5'),
  ('informal_monthly_cap_minor', '2000000'),
  ('informal_trusted_after_orders', '20'),
  ('informal_trusted_max_active_orders', '15'),
  ('informal_trusted_monthly_cap_minor', '5000000'),
  ('formal_max_active_orders', '30')
on conflict (key) do nothing;

-- Protecciones: nivel, visita y moderación solo los cambia la administración ----

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
    new.verification_visit_at := null;
    new.verification_visit_by := null;
    new.verification_visit_notes := null;
    new.upgrade_requested_at := null;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.approved_at is distinct from old.approved_at
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.verification_visit_at is distinct from old.verification_visit_at
     or new.verification_visit_by is distinct from old.verification_visit_by
     or new.verification_visit_notes is distinct from old.verification_visit_notes
     or new.upgrade_requested_at is distinct from old.upgrade_requested_at then
    raise exception 'El estado del negocio solo lo cambia la administración.';
  end if;
  -- El nivel se elige en la solicitud; ya aprobado, pasar a formal lo aprueba el admin.
  if new.tier is distinct from old.tier and old.status not in ('draft', 'rejected') then
    raise exception 'Para cambiar de nivel solicita la formalización desde tu panel.';
  end if;
  -- Un negocio aprobado no puede cambiar sus datos legales ni su ubicación verificada.
  if old.status in ('approved', 'suspended', 'pending')
     and (new.ruc is distinct from old.ruc
          or new.legal_name is distinct from old.legal_name
          or new.municipal_license is distinct from old.municipal_license
          or new.latitude is distinct from old.latitude
          or new.longitude is distinct from old.longitude) then
    raise exception 'Los datos verificados solo los cambia la administración.';
  end if;
  return new;
end $$;

-- Productos: los primeros N de cada negocio quedan "en revisión".
-- Sin SECURITY DEFINER: así detecta si quien escribe es el vendedor o una función privilegiada.
create or replace function public.protect_product_review()
returns trigger language plpgsql as $$
declare
  v_limit integer := public.setting_numeric('first_products_review', 10)::integer;
begin
  if public.is_privileged_session() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.review_note := null;
    new.review_status := case
      when (select count(*) from public.products where business_id = new.business_id and review_status = 'approved') < v_limit
        then 'pending' else 'approved' end;
    return new;
  end if;
  if new.review_status is distinct from old.review_status or new.review_note is distinct from old.review_note then
    raise exception 'La revisión del producto la hace la administración.';
  end if;
  -- Un producto rechazado vuelve a revisión cuando el vendedor lo corrige.
  if old.review_status = 'rejected'
     and (new.name, new.description, new.images, new.price_minor)
         is distinct from (old.name, old.description, old.images, old.price_minor) then
    new.review_status := 'pending';
    new.review_note := null;
  end if;
  return new;
end $$;

create trigger products_protect_review before insert or update on public.products
  for each row execute function public.protect_product_review();

-- Catálogo público: solo productos aprobados.
drop policy "lectura" on public.products;
create policy "lectura" on public.products for select
  using ((is_active and review_status = 'approved' and business_visible(business_id))
         or can_manage_business(business_id));

-- Límites por nivel -----------------------------------------------------------

create or replace function public.business_limits(p_business uuid)
returns table (max_active integer, monthly_cap_minor bigint, active_orders integer, month_sales_minor bigint, completed_orders integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tier business_tier;
  v_completed integer;
begin
  select tier into v_tier from businesses where id = p_business;
  select count(*) into v_completed from orders where business_id = p_business and status = 'completed';
  completed_orders := v_completed;

  if v_tier = 'formal' then
    max_active := setting_numeric('formal_max_active_orders', 30)::integer;
    monthly_cap_minor := null;
  elsif v_completed >= setting_numeric('informal_trusted_after_orders', 20) then
    max_active := setting_numeric('informal_trusted_max_active_orders', 15)::integer;
    monthly_cap_minor := setting_numeric('informal_trusted_monthly_cap_minor', 5000000)::bigint;
  else
    max_active := setting_numeric('informal_max_active_orders', 5)::integer;
    monthly_cap_minor := setting_numeric('informal_monthly_cap_minor', 2000000)::bigint;
  end if;

  select count(*) into active_orders from orders
   where business_id = p_business
     and (status in ('preparing', 'ready_for_pickup', 'on_the_way')
          or (status = 'pending_payment' and expires_at > now()));

  select coalesce(sum(subtotal_minor), 0) into month_sales_minor from orders
   where business_id = p_business
     and status not in ('cancelled', 'refunded')
     and (status <> 'pending_payment' or expires_at > now())
     and created_at >= date_trunc('month', now() at time zone 'America/Managua') at time zone 'America/Managua';
  return next;
end $$;

-- Se valida al cerrar el pedido (subtotal ya calculado) dentro de create_order.
create or replace function public.enforce_business_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limits record;
begin
  if new.status <> 'pending_payment' or new.subtotal_minor is not distinct from old.subtotal_minor then
    return new;
  end if;
  select * into v_limits from business_limits(new.business_id);
  -- El pedido actual ya cuenta como activo y en las ventas del mes.
  if v_limits.active_orders > v_limits.max_active then
    raise exception 'Este negocio tiene muchos pedidos en curso. Intenta más tarde.';
  end if;
  if v_limits.monthly_cap_minor is not null and v_limits.month_sales_minor > v_limits.monthly_cap_minor then
    raise exception 'Este negocio alcanzó su límite de ventas del mes.';
  end if;
  return new;
end $$;

create trigger orders_business_limits after update of subtotal_minor on public.orders
  for each row execute function public.enforce_business_limits();

-- Productos en revisión no se pueden comprar.
create or replace function public.ensure_product_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null
     and exists (select 1 from products where id = new.product_id and review_status <> 'approved') then
    raise exception 'Un producto del carrito aún no está disponible.';
  end if;
  return new;
end $$;

create trigger order_items_product_approved before insert on public.order_items
  for each row execute function public.ensure_product_approved();

-- Solicitud según el nivel ----------------------------------------------------

create or replace function public.submit_business_application(p_business uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business businesses%rowtype;
  v_required text[];
  v_missing integer;
begin
  select * into v_business from businesses where id = p_business for update;
  if not found or v_business.owner_id <> auth.uid() then
    raise exception 'Negocio no encontrado.';
  end if;
  if v_business.status not in ('draft', 'rejected') then
    raise exception 'La solicitud ya fue enviada.';
  end if;
  if v_business.legal_name is null or v_business.category_id is null
     or v_business.department_id is null or v_business.municipality_id is null
     or v_business.address_line is null or v_business.phone is null then
    raise exception 'Completa todos los datos del negocio.';
  end if;
  if v_business.tier = 'formal' and (v_business.ruc is null or v_business.municipal_license is null) then
    raise exception 'Ingresa el RUC y la matrícula de la Alcaldía.';
  end if;
  if v_business.tier = 'informal' and (v_business.latitude is null or v_business.longitude is null) then
    raise exception 'Marca la ubicación de tu negocio.';
  end if;
  if v_business.accepted_terms_at is null or v_business.declaration_accepted_at is null then
    raise exception 'Debes aceptar los términos, la comisión y la declaración jurada.';
  end if;
  if not exists (select 1 from business_bank_accounts where business_id = p_business) then
    raise exception 'Agrega la cuenta para liquidaciones.';
  end if;

  v_required := case v_business.tier
    when 'formal' then array['ruc', 'cedula_front', 'cedula_back', 'municipal_license']
    else array['cedula_front', 'cedula_back', 'selfie_cedula', 'place_photo_1', 'place_photo_2']
  end;
  select count(*) into v_missing from unnest(v_required) t(doc)
   where not exists (select 1 from business_documents where business_id = p_business and doc_type = t.doc);
  if v_missing > 0 then
    raise exception 'Sube todos los documentos requeridos.';
  end if;

  update businesses set status = 'pending', submitted_at = now(), rejection_reason = null
  where id = p_business;
  insert into business_applications (business_id) values (p_business);
end $$;

-- Visita de verificación (obligatoria para informales).
create or replace function public.record_verification_visit(p_business uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if coalesce(length(trim(p_notes)), 0) < 10 then
    raise exception 'Describe lo verificado en la visita (mínimo 10 caracteres).';
  end if;
  update businesses set
    verification_visit_at = now(), verification_visit_by = auth.uid(), verification_visit_notes = trim(p_notes)
  where id = p_business;
  if not found then
    raise exception 'Negocio no encontrado.';
  end if;
  perform write_audit('business.visit', 'business', p_business::text, jsonb_build_object('notes', trim(p_notes)));
end $$;

-- Documentos: se editan mientras la solicitud es borrador o fue rechazada. Ya
-- aprobado, un informal solo puede subir RUC y matrícula para formalizarse.
create or replace function public.protect_business_documents()
returns trigger language plpgsql as $$
declare
  v_business record;
begin
  if public.is_privileged_session() or public.is_admin() then
    return coalesce(new, old);
  end if;
  select status, tier into v_business from public.businesses
   where id = coalesce(new.business_id, old.business_id);
  if v_business.status in ('draft', 'rejected') then
    if tg_op <> 'DELETE' then new.status := 'pending'; end if;
    return coalesce(new, old);
  end if;
  if tg_op <> 'DELETE' and v_business.status = 'approved' and v_business.tier = 'informal'
     and new.doc_type in ('ruc', 'municipal_license') then
    new.status := 'pending';
    return new;
  end if;
  raise exception 'Los documentos verificados no se pueden cambiar.';
end $$;

create trigger business_documents_protect before insert or update or delete on public.business_documents
  for each row execute function public.protect_business_documents();

-- La aprobación de un informal exige la visita registrada.
create or replace function public.require_visit_for_informal()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and old.status = 'pending'
     and new.tier = 'informal' and new.verification_visit_at is null then
    raise exception 'Registra la visita de verificación antes de aprobar a un emprendedor informal.';
  end if;
  return new;
end $$;

create trigger businesses_require_visit before update of status on public.businesses
  for each row execute function public.require_visit_for_informal();

-- Formalización: el informal aprobado pide pasar a formal ----------------------

-- El RUC se valida en el servidor (rucSchema); aquí se guarda junto con la solicitud.
create or replace function public.request_formal_upgrade(
  p_business uuid, p_person_type text, p_ruc text, p_tax_regime text, p_license text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_business businesses%rowtype;
begin
  select * into v_business from businesses where id = p_business for update;
  if not found or v_business.owner_id <> auth.uid() then
    raise exception 'Negocio no encontrado.';
  end if;
  if v_business.status <> 'approved' then
    raise exception 'Tu negocio debe estar aprobado para formalizarse.';
  end if;
  if v_business.tier = 'formal' then
    raise exception 'Tu negocio ya es formal.';
  end if;
  if coalesce(trim(p_ruc), '') = '' or coalesce(trim(p_license), '') = '' then
    raise exception 'Ingresa el RUC y la matrícula de la Alcaldía.';
  end if;
  if (select count(*) from business_documents
       where business_id = p_business and doc_type in ('ruc', 'municipal_license')) < 2 then
    raise exception 'Sube la constancia de RUC y la matrícula.';
  end if;
  update businesses set
    person_type = p_person_type, ruc = trim(p_ruc), tax_regime = p_tax_regime,
    municipal_license = trim(p_license), upgrade_requested_at = now()
  where id = p_business;
  perform write_audit('business.upgrade_requested', 'business', p_business::text, '{}'::jsonb);
end $$;

create or replace function public.review_formal_upgrade(p_business uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_business businesses%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  select * into v_business from businesses where id = p_business for update;
  if not found or v_business.upgrade_requested_at is null then
    raise exception 'No hay una solicitud de formalización pendiente.';
  end if;
  if not p_approve and coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Indica el motivo del rechazo.';
  end if;
  update businesses set
    tier = case when p_approve then 'formal'::business_tier else tier end,
    upgrade_requested_at = null
  where id = p_business;
  perform notify_user(v_business.owner_id,
    case when p_approve then '¡Ya eres Negocio formal!' else 'Formalización rechazada' end,
    case when p_approve then 'Tus límites de pedidos aumentaron.' else 'Motivo: ' || trim(p_reason) end,
    '/vendedor/formalizar');
  perform write_audit(case when p_approve then 'business.upgrade_approved' else 'business.upgrade_rejected' end,
    'business', p_business::text, jsonb_build_object('reason', p_reason));
end $$;

-- Moderación de productos.
create or replace function public.review_product(p_product uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_product products%rowtype;
  v_owner uuid;
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if not p_approve and coalesce(length(trim(p_note)), 0) < 5 then
    raise exception 'Indica qué debe corregir el vendedor.';
  end if;
  update products set
    review_status = case when p_approve then 'approved' else 'rejected' end,
    review_note = case when p_approve then null else trim(p_note) end
  where id = p_product
  returning * into v_product;
  if not found then
    raise exception 'Producto no encontrado.';
  end if;
  select owner_id into v_owner from businesses where id = v_product.business_id;
  perform notify_user(v_owner,
    case when p_approve then 'Producto publicado' else 'Producto con observaciones' end,
    v_product.name || case when p_approve then ' ya está visible en tu tienda.' else ': ' || trim(p_note) end,
    '/vendedor/productos/' || v_product.id);
  perform write_audit(case when p_approve then 'product.approved' else 'product.rejected' end,
    'product', p_product::text, jsonb_build_object('note', p_note, 'name', v_product.name));
end $$;

-- La ubicación GPS (a menudo una casa) y las notas de la visita no deben salir
-- con el catálogo público (que lee businesses.*). Pasan a una tabla privada,
-- como business_bank_accounts: solo el dueño y la administración la leen.

create table public.business_private (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  visit_by uuid references public.profiles (id),
  visit_notes text,
  updated_at timestamptz not null default now()
);

insert into public.business_private (business_id, latitude, longitude, visit_by, visit_notes)
select id, latitude, longitude, verification_visit_by, verification_visit_notes
  from public.businesses
 where latitude is not null or verification_visit_notes is not null;

alter table public.business_private enable row level security;
create policy "dueño o admin lee" on public.business_private for select
  using (public.can_manage_business(business_id));
create policy "dueño o admin escribe" on public.business_private for all
  using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- El dueño solo fija su ubicación mientras la solicitud es editable; la visita es del admin.
create or replace function public.protect_business_private()
returns trigger language plpgsql as $$
declare
  v_status public.business_status;
begin
  if public.is_privileged_session() or public.is_admin() then
    return new;
  end if;
  select status into v_status from public.businesses where id = new.business_id;
  if v_status not in ('draft', 'rejected') then
    raise exception 'Los datos verificados solo los cambia la administración.';
  end if;
  if tg_op = 'INSERT' then
    new.visit_by := null;
    new.visit_notes := null;
  elsif new.visit_by is distinct from old.visit_by or new.visit_notes is distinct from old.visit_notes then
    raise exception 'La visita la registra la administración.';
  end if;
  return new;
end $$;

create trigger business_private_protect before insert or update on public.business_private
  for each row execute function public.protect_business_private();

-- businesses conserva solo la fecha de la visita (pública: "verificado el …").
alter table public.businesses
  drop column latitude,
  drop column longitude,
  drop column verification_visit_by,
  drop column verification_visit_notes;

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
    new.upgrade_requested_at := null;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.approved_at is distinct from old.approved_at
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.verification_visit_at is distinct from old.verification_visit_at
     or new.upgrade_requested_at is distinct from old.upgrade_requested_at then
    raise exception 'El estado del negocio solo lo cambia la administración.';
  end if;
  if new.tier is distinct from old.tier and old.status not in ('draft', 'rejected') then
    raise exception 'Para cambiar de nivel solicita la formalización desde tu panel.';
  end if;
  if old.status in ('approved', 'suspended', 'pending')
     and (new.ruc is distinct from old.ruc
          or new.legal_name is distinct from old.legal_name
          or new.municipal_license is distinct from old.municipal_license) then
    raise exception 'Los datos verificados solo los cambia la administración.';
  end if;
  return new;
end $$;

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
  if v_business.tier = 'informal' and not exists (
       select 1 from business_private
        where business_id = p_business and latitude is not null and longitude is not null) then
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

create or replace function public.record_verification_visit(p_business uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo administradores.';
  end if;
  if coalesce(length(trim(p_notes)), 0) < 10 then
    raise exception 'Describe lo verificado en la visita (mínimo 10 caracteres).';
  end if;
  update businesses set verification_visit_at = now() where id = p_business;
  if not found then
    raise exception 'Negocio no encontrado.';
  end if;
  insert into business_private (business_id, visit_by, visit_notes)
  values (p_business, auth.uid(), trim(p_notes))
  on conflict (business_id) do update
    set visit_by = excluded.visit_by, visit_notes = excluded.visit_notes, updated_at = now();
  perform write_audit('business.visit', 'business', p_business::text, jsonb_build_object('notes', trim(p_notes)));
end $$;

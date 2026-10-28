-- Solo los clientes compran; fotos de perfil; teléfonos en E.164.

-- Vendedores y administradores no pueden crear pedidos ----------------------

create or replace function public.ensure_customer_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.customer_id and role <> 'customer') then
    raise exception 'Las cuentas de vendedor o administrador no pueden comprar.';
  end if;
  return new;
end $$;

create trigger orders_customer_only before insert on public.orders
  for each row execute function public.ensure_customer_order();

-- Fotos de perfil: avatars/<user_id>/<archivo> ------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatares públicos" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "subir avatar propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Teléfonos: los números de 8 dígitos guardados antes pasan a +505XXXXXXXX ---

create or replace function pg_temp.e164(value text) returns text language sql immutable as $$
  select case
    when regexp_replace(coalesce(value, ''), '\D', '', 'g') ~ '^[2578]\d{7}$'
      then '+505' || regexp_replace(value, '\D', '', 'g')
    when regexp_replace(coalesce(value, ''), '\D', '', 'g') ~ '^505[2578]\d{7}$'
      then '+' || regexp_replace(value, '\D', '', 'g')
    else value
  end
$$;

update public.profiles set phone = pg_temp.e164(phone) where phone is distinct from pg_temp.e164(phone);
update public.addresses set phone = pg_temp.e164(phone) where phone is distinct from pg_temp.e164(phone);
update public.businesses set phone = pg_temp.e164(phone), whatsapp = pg_temp.e164(whatsapp)
  where phone is distinct from pg_temp.e164(phone) or whatsapp is distinct from pg_temp.e164(whatsapp);
update public.orders set contact_phone = pg_temp.e164(contact_phone)
  where contact_phone is distinct from pg_temp.e164(contact_phone);
update public.orders
  set address_snapshot = jsonb_set(address_snapshot, '{phone}', to_jsonb(pg_temp.e164(address_snapshot ->> 'phone')))
  where address_snapshot ? 'phone'
    and address_snapshot ->> 'phone' is distinct from pg_temp.e164(address_snapshot ->> 'phone');
update public.platform_settings
  set value = to_jsonb(pg_temp.e164(value #>> '{}'))
  where key = 'support_whatsapp' and jsonb_typeof(value) = 'string';

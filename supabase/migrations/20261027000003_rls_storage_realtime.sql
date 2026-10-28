-- Catarina Market · Row Level Security, Storage, Realtime y cron

do $$
declare t text;
begin
  foreach t in array array[
    'departments', 'municipalities', 'profiles', 'addresses', 'platform_categories',
    'businesses', 'business_bank_accounts', 'business_documents', 'business_applications',
    'business_hours', 'business_closures', 'delivery_zones', 'product_categories', 'products',
    'carts', 'cart_items', 'orders', 'order_items', 'order_status_history', 'payments',
    'refunds', 'processed_webhook_events', 'commission_rules', 'payouts', 'reviews',
    'notifications', 'audit_logs', 'platform_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Visibilidad de un negocio: aprobado, propio o admin.
create or replace function public.business_visible(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from businesses
     where id = p_business
       and (status = 'approved' or owner_id = auth.uid() or is_admin())
  );
$$;

create or replace function public.can_manage_business(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owns_business(p_business) or is_admin();
$$;

create or replace function public.can_see_order(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
     where o.id = p_order
       and (o.customer_id = auth.uid() or owns_business(o.business_id) or is_admin())
  );
$$;

-- Catálogos públicos ---------------------------------------------------------

create policy "lectura pública" on public.departments for select using (true);
create policy "lectura pública" on public.municipalities for select using (true);
create policy "lectura pública" on public.platform_categories for select using (true);
create policy "admin gestiona" on public.platform_categories for all
  using (is_admin()) with check (is_admin());
create policy "lectura pública" on public.platform_settings for select using (true);

-- Perfiles -------------------------------------------------------------------

create policy "ver propio o admin" on public.profiles for select
  using (id = auth.uid() or is_admin());
create policy "editar propio" on public.profiles for update
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
create policy "hook lee perfiles" on public.profiles for select to supabase_auth_admin using (true);

create policy "propias" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin lee" on public.addresses for select using (is_admin());

-- Negocios -------------------------------------------------------------------

create policy "visibles" on public.businesses for select
  using (status = 'approved' or owner_id = auth.uid() or is_admin());
create policy "crear propio" on public.businesses for insert
  with check (owner_id = auth.uid());
create policy "editar propio o admin" on public.businesses for update
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());

create policy "dueño o admin" on public.business_bank_accounts for all
  using (can_manage_business(business_id)) with check (owns_business(business_id));
create policy "dueño o admin" on public.business_documents for all
  using (can_manage_business(business_id)) with check (owns_business(business_id));
create policy "dueño o admin" on public.business_applications for select
  using (can_manage_business(business_id));

create policy "lectura" on public.business_hours for select using (business_visible(business_id));
create policy "gestión" on public.business_hours for all
  using (can_manage_business(business_id)) with check (can_manage_business(business_id));
create policy "lectura" on public.business_closures for select using (business_visible(business_id));
create policy "gestión" on public.business_closures for all
  using (can_manage_business(business_id)) with check (can_manage_business(business_id));
create policy "lectura" on public.delivery_zones for select using (business_visible(business_id));
create policy "gestión" on public.delivery_zones for all
  using (can_manage_business(business_id)) with check (can_manage_business(business_id));

-- Catálogo -------------------------------------------------------------------

create policy "lectura" on public.product_categories for select using (business_visible(business_id));
create policy "gestión" on public.product_categories for all
  using (can_manage_business(business_id)) with check (can_manage_business(business_id));

create policy "lectura" on public.products for select
  using ((is_active and business_visible(business_id)) or can_manage_business(business_id));
create policy "gestión" on public.products for all
  using (can_manage_business(business_id)) with check (can_manage_business(business_id));

-- Carrito --------------------------------------------------------------------

create policy "propios" on public.carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propios" on public.cart_items for all
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));

-- Pedidos (las escrituras pasan por funciones) -------------------------------

create policy "participantes" on public.orders for select
  using (customer_id = auth.uid() or owns_business(business_id) or is_admin());
create policy "participantes" on public.order_items for select using (can_see_order(order_id));
create policy "participantes" on public.order_status_history for select using (can_see_order(order_id));
create policy "participantes" on public.payments for select using (can_see_order(order_id));
create policy "participantes" on public.refunds for select using (can_see_order(order_id));

-- Finanzas -------------------------------------------------------------------

create policy "admin gestiona" on public.commission_rules for all
  using (is_admin()) with check (is_admin());
create policy "negocio lee las suyas" on public.commission_rules for select
  using (business_id is not null and owns_business(business_id));
create policy "admin gestiona" on public.payouts for all using (is_admin()) with check (is_admin());
create policy "negocio lee las suyas" on public.payouts for select using (owns_business(business_id));

-- Otros ----------------------------------------------------------------------

create policy "lectura pública" on public.reviews for select using (true);
create policy "cliente reseña pedido completado" on public.reviews for insert
  with check (customer_id = auth.uid() and can_review(order_id)
              and business_id = (select business_id from orders where id = order_id));

create policy "propias" on public.notifications for select using (user_id = auth.uid());
create policy "marcar leídas" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "admin lee" on public.audit_logs for select using (is_admin());

-- Storage --------------------------------------------------------------------
-- Rutas: <user_id>/<archivo>. Fotos públicas; documentos privados (URLs firmadas).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('business-media', 'business-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('business-documents', 'business-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "fotos públicas" on storage.objects for select
  using (bucket_id in ('product-images', 'business-media'));
create policy "subir a carpeta propia" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('product-images', 'business-media', 'business-documents')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "editar carpeta propia" on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar carpeta propia" on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);
create policy "documentos: dueño o admin" on storage.objects for select to authenticated
  using (
    bucket_id = 'business-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Realtime -------------------------------------------------------------------

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.notifications;

-- Cron: vencer pedidos sin pago cada 5 minutos -------------------------------

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule(
  'expire-pending-orders',
  '*/5 * * * *',
  $$select public.expire_pending_orders()$$
);

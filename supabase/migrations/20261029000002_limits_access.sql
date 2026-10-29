-- business_limits expone conteos de cualquier negocio: solo la usan funciones
-- internas. El vendedor consulta los suyos con my_business_limits().
revoke execute on function public.business_limits(uuid) from public, anon, authenticated;

create or replace function public.my_business_limits()
returns table (tier public.business_tier, max_active integer, monthly_cap_minor bigint,
               active_orders integer, month_sales_minor bigint, completed_orders integer)
language sql stable security definer set search_path = public as $$
  select b.tier, l.max_active, l.monthly_cap_minor, l.active_orders, l.month_sales_minor, l.completed_orders
    from businesses b, business_limits(b.id) l
   where b.owner_id = auth.uid();
$$;

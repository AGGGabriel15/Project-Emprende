-- Autor de cada reseña: nombre corto (nombre + inicial del apellido) y foto.
-- profiles no es público, así que se expone solo esto y solo para quienes reseñaron.
create or replace function public.review_authors(p_ids uuid[])
returns table (id uuid, name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         trim(split_part(trim(p.full_name), ' ', 1) || ' ' ||
              coalesce(nullif(left(split_part(trim(p.full_name), ' ', 2), 1), '') || '.', '')) as name,
         p.avatar_url
  from public.profiles p
  where p.id = any (p_ids)
    and exists (select 1 from public.reviews r where r.customer_id = p.id);
$$;

revoke all on function public.review_authors(uuid[]) from public;
grant execute on function public.review_authors(uuid[]) to anon, authenticated;

-- Endurecimiento de seguridad (auditoría basada en OWASP Juice Shop).
-- 1. Un token copiado deja de servir en cuanto se cierra la sesión.
-- 2. Límite de intentos fallidos de inicio de sesión (fuerza bruta).
-- 3. Dos funciones que daban datos de otros con solo conocer un id.
-- 4. search_path fijo en las funciones que señala el linter de Supabase.

-- 1. Sesiones cerradas ------------------------------------------------------------
-- Supabase firma tokens de 1 hora y la API los aceptaba hasta que vencían, aunque
-- la sesión ya se hubiera cerrado. Cada token lleva su session_id: si esa sesión
-- ya no existe en auth.sessions (cerrar sesión la borra), se rechaza.

create or replace function public.session_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'session_id', '') = ''
      or exists (
        select 1 from auth.sessions
         where id = (auth.jwt() ->> 'session_id')::uuid
           and (not_after is null or not_after > now())
      );
$$;

-- PostgREST la ejecuta antes de cada petición a /rest/v1 (tablas y rpc).
create or replace function public.check_request()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.session_active() then
    raise sqlstate 'PGRST' using
      message = json_build_object('code', 'session_revoked', 'message', 'Tu sesión se cerró. Inicia sesión de nuevo.')::text,
      detail = json_build_object('status', 401, 'headers', json_build_object())::text;
  end if;
end $$;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

-- Storage no pasa por PostgREST: la misma regla como política restrictiva.
create policy "sesión activa" on storage.objects as restrictive for all to authenticated
  using (public.session_active()) with check (public.session_active());

-- 2. Intentos de inicio de sesión -------------------------------------------------
-- Fuera de la API pública: solo el servidor (service_role) la consulta.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.login_attempts (
  email text not null,
  ip text not null,
  failed_at timestamptz not null default now()
);
create index login_attempts_email_idx on private.login_attempts (email, failed_at desc);
create index login_attempts_ip_idx on private.login_attempts (ip, failed_at desc);

-- Segundos que faltan para volver a intentar (0 = puede intentar). En 15 minutos:
-- 5 fallos del mismo correo desde la misma IP, 10 del mismo correo o 20 de la misma IP.
create or replace function public.login_wait_seconds(p_email text, p_ip text)
returns integer language sql stable security definer set search_path = public as $$
  with recent as (
    select email, ip, failed_at from private.login_attempts
     where failed_at > now() - interval '15 minutes'
       and (email = lower(trim(p_email)) or ip = coalesce(p_ip, ''))
  ), blocked as (
    select max(failed_at) as last_failed from recent
    having count(*) filter (where email = lower(trim(p_email)) and ip = coalesce(p_ip, '')) >= 5
        or count(*) filter (where email = lower(trim(p_email))) >= 10
        or count(*) filter (where ip = coalesce(p_ip, '')) >= 20
  )
  select coalesce(
    (select greatest(1, ceil(extract(epoch from last_failed + interval '15 minutes' - now())))::integer from blocked),
    0
  );
$$;

-- Un acierto borra los fallos de ese correo; un fallo se anota.
create or replace function public.record_login_attempt(p_email text, p_ip text, p_success boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_success then
    delete from private.login_attempts where email = lower(trim(p_email));
  else
    insert into private.login_attempts (email, ip) values (lower(trim(p_email)), coalesce(p_ip, ''));
  end if;
  delete from private.login_attempts where failed_at < now() - interval '1 day';
end $$;

revoke execute on function public.login_wait_seconds(text, text) from public, anon, authenticated;
revoke execute on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_wait_seconds(text, text) to service_role;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;

-- 3. Solo para uso interno (las llaman otras funciones) -----------------------------
-- Con el id de un pedido o de un repartidor devolvían montos o su carga de trabajo.

revoke execute on function public.refundable_minor(uuid) from public, anon, authenticated;
revoke execute on function public.active_shipments_of(uuid) from public, anon, authenticated;

-- 4. search_path fijo -------------------------------------------------------------

alter function public.custom_access_token_hook(jsonb) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.is_privileged_session() set search_path = public;
alter function public.protect_profile_role() set search_path = public;
alter function public.can_transition(public.order_status, public.order_status, public.service_type) set search_path = public;
alter function public.transition_order(uuid, public.order_status, text) set search_path = public;
alter function public.protect_product_review() set search_path = public;
alter function public.protect_business_private() set search_path = public;
alter function public.protect_business_documents() set search_path = public;
alter function public.require_visit_for_informal() set search_path = public;
alter function public.protect_business_status() set search_path = public;
alter function public.set_order_sla() set search_path = public;

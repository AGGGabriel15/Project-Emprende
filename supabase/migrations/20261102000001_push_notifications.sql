-- Notificaciones push de la app móvil (Expo).
-- Cada aviso que ya genera la base (notify_user / notify_couriers) también llega
-- al celular: al insertar en notifications, pg_net llama a /api/webhooks/push con
-- el id; el servidor busca los tokens del usuario y lo envía por la Expo Push API.
-- Sin secreto compartido: el endpoint solo acepta avisos recientes y no enviados
-- (pushed_at), y lo marca como enviado antes de mandarlo.

create extension if not exists pg_net;

-- Tokens de Expo de cada dispositivo ------------------------------------------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens (user_id);

-- Solo se tocan con las funciones de abajo (un dispositivo puede cambiar de cuenta).
alter table public.push_tokens enable row level security;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión.';
  end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[.+\]$' then
    raise exception 'Token de notificaciones no válido.';
  end if;
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Envío ------------------------------------------------------------------------

alter table public.notifications add column if not exists pushed_at timestamptz;

insert into public.platform_settings (key, value)
values ('push_webhook_url', to_jsonb('https://catarina-market.vercel.app/api/webhooks/push'::text))
on conflict (key) do nothing;

create or replace function public.push_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text;
begin
  if not exists (select 1 from push_tokens where user_id = new.user_id) then
    return new;
  end if;
  select value #>> '{}' into v_url from platform_settings where key = 'push_webhook_url';
  if coalesce(v_url, '') = '' then
    return new;
  end if;
  -- pg_net encola la llamada: no bloquea ni puede deshacer el aviso.
  begin
    perform net.http_post(url := v_url, body := jsonb_build_object('id', new.id));
  exception when others then
    raise warning 'push_notification: %', sqlerrm;
  end;
  return new;
end $$;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.push_notification();

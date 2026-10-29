-- open_claim: text[] || text es ambiguo; se usa array_append.

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
    v_flags := array_append(v_flags, 'La entrega se confirmó con el PIN del cliente');
  end if;
  select count(*) into v_rejected from claims where customer_id = auth.uid() and status = 'rejected';
  if v_rejected >= 2 then
    v_flags := array_append(v_flags, 'El cliente tiene ' || v_rejected || ' reclamos rechazados');
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

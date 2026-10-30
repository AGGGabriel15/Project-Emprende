-- Reembolsos: nunca más de lo cobrado.
-- Hasta ahora Stripe no cobraba la tarifa de servicio (ya corregido en el web),
-- así que hay pagos menores que orders.total_minor. El servidor limita cada
-- reembolso a lo cobrado y complete_refund cierra el pedido al devolver todo lo pagado.

create or replace function public.complete_refund(p_refund uuid, p_provider_ref text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_refund refunds%rowtype;
  v_order orders%rowtype;
  v_refunded integer;
  v_paid integer;
begin
  select * into v_refund from refunds where id = p_refund for update;
  if not found or v_refund.status = 'processed' then
    return;
  end if;
  if p_error is not null then
    update refunds set status = 'failed', error = p_error where id = p_refund;
    return;
  end if;
  update refunds set status = 'processed', provider_ref = p_provider_ref, processed_at = now(), error = null
  where id = p_refund;
  select * into v_order from orders where id = v_refund.order_id for update;
  select coalesce(sum(amount_minor), 0) into v_refunded from refunds
   where order_id = v_order.id and status = 'processed';
  -- Se compara con lo realmente cobrado (puede ser menor que el total si la
  -- pasarela cobró de menos), así un reembolso de todo lo pagado cierra el pedido.
  select sum(amount_minor) into v_paid from payments where order_id = v_order.id;
  if v_refunded >= least(v_order.total_minor, coalesce(v_paid, v_order.total_minor)) then
    update orders set payment_status = 'refunded',
      status = case when status in ('cancelled', 'returned', 'disputed', 'completed') then 'refunded' else status end
    where id = v_order.id;
    if v_order.status in ('cancelled', 'returned', 'disputed', 'completed') then
      perform log_status(v_order.id, v_order.status, 'refunded', 'Reembolso procesado');
    end if;
  else
    update orders set payment_status = 'partially_refunded' where id = v_order.id;
  end if;
  perform notify_user(v_order.customer_id, 'Reembolso procesado',
    'Devolvimos C$ ' || to_char(v_refund.amount_minor / 100.0, 'FM999G999D00') || ' del pedido ' || v_order.order_number || '.',
    '/pedidos/' || v_order.id);
end $$;

-- Errores ya guardados en inglés por la pasarela.
update public.refunds
   set error = 'El monto a devolver supera lo que se cobró en la tarjeta.'
 where status = 'failed' and error ilike '%greater than%amount%';

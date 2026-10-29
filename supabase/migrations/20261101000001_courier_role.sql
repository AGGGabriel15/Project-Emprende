-- Rol de repartidor (empleado de Catarina Market). Va en su propia migración:
-- un valor nuevo de enum no se puede usar en la misma transacción que lo agrega.
alter type public.user_role add value if not exists 'courier';

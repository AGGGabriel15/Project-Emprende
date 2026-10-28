-- Catarina Market · esquema base
-- Montos en centavos (enteros). Tasas como numeric(5,4): 0.0800 = 8 %.

create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'vendor', 'admin');
create type public.business_status as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');
create type public.order_status as enum (
  'pending_payment', 'preparing', 'ready_for_pickup', 'on_the_way',
  'completed', 'cancelled', 'refunded'
);
create type public.payment_status as enum ('pending', 'paid', 'failed', 'expired', 'refunded');
create type public.service_type as enum ('delivery', 'pickup');

-- Catálogo geográfico --------------------------------------------------------

create table public.departments (
  id smallint primary key,
  name text not null unique
);

create table public.municipalities (
  id integer primary key,
  department_id smallint not null references public.departments (id),
  name text not null,
  unique (department_id, name)
);
create index on public.municipalities (department_id);

-- Usuarios -------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text,
  cedula text,
  avatar_url text,
  role public.user_role not null default 'customer',
  department_id smallint references public.departments (id),
  municipality_id integer references public.municipalities (id),
  is_active boolean not null default true,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Casa',
  department_id smallint not null references public.departments (id),
  municipality_id integer not null references public.municipalities (id),
  address_line text not null,
  recipient_name text not null,
  phone text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.addresses (user_id);

-- Categorías globales --------------------------------------------------------

create table public.platform_categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  icon text not null default 'package',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

-- Negocios -------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete restrict,
  slug text not null unique,
  trade_name text not null,
  legal_name text,
  person_type text check (person_type in ('natural', 'juridica')),
  ruc text,
  tax_regime text check (tax_regime in ('cuota_fija', 'regimen_general')),
  municipal_license text,
  category_id integer references public.platform_categories (id),
  description text not null default '',
  logo_url text,
  cover_url text,
  phone text,
  whatsapp text,
  department_id smallint references public.departments (id),
  municipality_id integer references public.municipalities (id),
  address_line text,
  status public.business_status not null default 'draft',
  rejection_reason text,
  accepts_delivery boolean not null default false,
  accepts_pickup boolean not null default true,
  -- null = sigue el horario; false = "Cerrar ahora"; true = abierto forzado
  is_open_override boolean,
  accepted_terms_at timestamptz,
  accepted_commission_rate numeric(5, 4),
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.businesses (status);
create index on public.businesses (category_id);

-- Datos bancarios separados para que nunca se expongan con el catálogo público.
create table public.business_bank_accounts (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  bank_name text not null,
  account_type text not null check (account_type in ('ahorro', 'corriente')),
  currency text not null check (currency in ('NIO', 'USD')),
  account_number text not null,
  account_holder text not null,
  updated_at timestamptz not null default now()
);

create table public.business_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  doc_type text not null check (doc_type in ('ruc', 'cedula_front', 'cedula_back', 'municipal_license', 'other')),
  file_path text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (business_id, doc_type)
);

create table public.business_applications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  decision text check (decision in ('approved', 'rejected')),
  rejection_reason text
);
create index on public.business_applications (business_id, submitted_at desc);

create table public.business_hours (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null default '08:00',
  closes_at time not null default '17:00',
  is_closed boolean not null default false,
  primary key (business_id, day_of_week)
);

create table public.business_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  date date not null,
  reason text not null default '',
  unique (business_id, date)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  department_id smallint not null references public.departments (id),
  municipality_id integer references public.municipalities (id),
  fee_minor integer not null check (fee_minor >= 0),
  estimated_days smallint not null default 1 check (estimated_days >= 0),
  unique nulls not distinct (business_id, department_id, municipality_id)
);
create index on public.delivery_zones (business_id);

-- Catálogo -------------------------------------------------------------------

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  unique (business_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  name text not null,
  slug text not null,
  description text not null default '',
  material text,
  dimensions text,
  weight_grams integer check (weight_grams >= 0),
  price_minor integer not null check (price_minor > 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);
create index on public.products (business_id, is_active);
create index products_search_idx on public.products
  using gin (to_tsvector('spanish', name || ' ' || description));

-- Carrito --------------------------------------------------------------------

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create table public.cart_items (
  cart_id uuid not null references public.carts (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  note text,
  primary key (cart_id, product_id)
);

-- Pedidos --------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles (id),
  business_id uuid not null references public.businesses (id),
  service_type public.service_type not null,
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  subtotal_minor integer not null check (subtotal_minor > 0),
  delivery_fee_minor integer not null default 0 check (delivery_fee_minor >= 0),
  commission_rate numeric(5, 4) not null,
  commission_amount_minor integer not null,
  total_minor integer not null,
  vendor_net_minor integer not null,
  estimated_days smallint,
  address_snapshot jsonb,
  contact_name text not null,
  contact_phone text not null,
  customer_note text,
  payment_provider text,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  cancel_reason text,
  expires_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (business_id, status, created_at desc);
create index on public.orders (customer_id, created_at desc);
create index on public.orders (status, expires_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  image_url text,
  unit_price_minor integer not null,
  quantity integer not null check (quantity > 0),
  subtotal_minor integer not null,
  note text
);
create index on public.order_items (order_id);
create index on public.order_items (product_id);

create table public.order_status_history (
  id bigserial primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index on public.order_status_history (order_id, created_at);

-- Pagos ----------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_ref text,
  amount_minor integer not null,
  status text not null default 'succeeded',
  created_at timestamptz not null default now()
);
create index on public.payments (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_id uuid references public.payments (id),
  amount_minor integer not null,
  status text not null default 'processed',
  reason text not null,
  provider_ref text,
  processed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.refunds (order_id);

create table public.processed_webhook_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

-- Finanzas -------------------------------------------------------------------

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  category_id integer references public.platform_categories (id) on delete cascade,
  rate numeric(5, 4) not null check (rate >= 0 and rate < 1),
  valid_from date not null default current_date,
  valid_to date,
  note text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(business_id, category_id) = 1)
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  orders_count integer not null,
  gross_minor integer not null,
  commission_minor integer not null,
  delivery_minor integer not null,
  net_minor integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, period_start, period_end)
);

-- Otros ----------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index on public.reviews (business_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- updated_at automático ------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger businesses_touch before update on public.businesses
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

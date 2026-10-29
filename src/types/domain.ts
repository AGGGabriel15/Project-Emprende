// Tipos de las tablas de Supabase (ver supabase/migrations).
// Montos en centavos; tasas como fracción (0.08 = 8 %).

export type Role = "customer" | "vendor" | "admin" | "courier";
export type BusinessStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";
export type OrderStatus =
  | "pending_payment"
  | "preparing"
  | "ready"
  | "ready_for_pickup"
  | "on_the_way"
  | "delivered"
  | "disputed"
  | "completed"
  | "cancelled"
  | "refunded"
  | "returned";
export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "partially_refunded";
export type ServiceType = "delivery" | "pickup";

export type Department = { id: number; name: string };
export type Municipality = { id: number; department_id: number; name: string };

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  cedula: string | null;
  avatar_url: string | null;
  role: Role;
  department_id: number | null;
  municipality_id: number | null;
  is_active: boolean;
  accepted_terms_at: string | null;
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string;
  department_id: number;
  municipality_id: number;
  address_line: string;
  recipient_name: string;
  phone: string;
  is_default: boolean;
};

export type PlatformCategory = {
  id: number;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
};

export type BusinessTier = "informal" | "formal";

export type Business = {
  id: string;
  tier: BusinessTier;
  declaration_accepted_at: string | null;
  verification_visit_at: string | null;
  upgrade_requested_at: string | null;
  owner_id: string;
  slug: string;
  trade_name: string;
  legal_name: string | null;
  person_type: "natural" | "juridica" | null;
  ruc: string | null;
  tax_regime: "cuota_fija" | "regimen_general" | null;
  municipal_license: string | null;
  category_id: number | null;
  description: string;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  department_id: number | null;
  municipality_id: number | null;
  address_line: string | null;
  status: BusinessStatus;
  rejection_reason: string | null;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  is_open_override: boolean | null;
  accepted_terms_at: string | null;
  accepted_terms_version: string | null;
  accepted_commission_rate: number | null;
  rating_avg: number;
  rating_count: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
};

/** Datos privados del negocio (solo dueño y admin): ubicación GPS y notas de la visita. */
export type BusinessPrivate = {
  business_id: string;
  latitude: number | null;
  longitude: number | null;
  visit_notes: string | null;
};

export type BankAccount = {
  business_id: string;
  bank_name: string;
  account_type: "ahorro" | "corriente";
  currency: "NIO" | "USD";
  account_number: string;
  account_holder: string;
};

export type DocumentType =
  | "ruc"
  | "cedula_front"
  | "cedula_back"
  | "municipal_license"
  | "selfie_cedula"
  | "place_photo_1"
  | "place_photo_2"
  | "other";

export type BusinessDocument = {
  id: string;
  business_id: string;
  doc_type: DocumentType;
  file_path: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export type BusinessHour = {
  business_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
  is_closed: boolean;
};

export type BusinessClosure = {
  id: string;
  business_id: string;
  date: string;
  reason: string;
};

export type DeliveryZone = {
  id: string;
  business_id: string;
  department_id: number;
  municipality_id: number | null;
  fee_minor: number;
  estimated_days: number;
};

/** Tarifa de envío de la plataforma por zona (el costo del repartidor va aparte). */
export type PlatformZone = {
  id: string;
  department_id: number;
  municipality_id: number | null;
  fee_minor: number;
  courier_cost_minor: number;
  estimated_days: number;
  is_active: boolean;
};

export type ShipmentStatus =
  | "available"
  | "assigned"
  | "at_pickup"
  | "picked_up"
  | "at_dropoff"
  | "delivered"
  | "failed"
  | "rejected"
  | "returned";

export type Vehicle = "moto" | "bici" | "carro";

export type Courier = {
  profile_id: string;
  vehicle: Vehicle;
  plate: string | null;
  is_active: boolean;
  is_online: boolean;
  last_seen_at: string | null;
  rating_avg: number;
  rating_count: number;
};

/** Lo que el cliente y el negocio ven del repartidor de un pedido (order_courier). */
export type OrderCourier = {
  name: string;
  avatar_url: string | null;
  vehicle: Vehicle | null;
  plate: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  status: ShipmentStatus;
  phone: string | null;
  accepted_at: string | null;
  arrived_pickup_at: string | null;
  picked_up_at: string | null;
  arrived_dropoff_at: string | null;
  delivered_at: string | null;
};

export type Shipment = {
  id: string;
  order_id: string;
  courier_id: string | null;
  courier_name: string | null;
  tracking_ref: string | null;
  courier_cost_minor: number;
  status: ShipmentStatus;
  accepted_at: string | null;
  arrived_pickup_at: string | null;
  arrived_dropoff_at: string | null;
  attempts: number;
  pickup_photo_path: string | null;
  pickup_notes: string | null;
  picked_up_at: string | null;
  delivery_photo_path: string | null;
  delivered_at: string | null;
  failure_notes: string | null;
  created_at: string;
};

export type ClaimReason = "not_received" | "damaged" | "wrong_item" | "missing_items" | "other";

export type Claim = {
  id: string;
  order_id: string;
  customer_id: string;
  reason: ClaimReason;
  description: string;
  photo_paths: string[];
  status: "open" | "approved" | "rejected";
  flags: string[];
  refund_minor: number | null;
  responsible: "business" | "platform" | "courier" | "customer" | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type Strike = {
  id: string;
  business_id: string;
  order_id: string | null;
  reason: string;
  voided_at: string | null;
  voided_reason: string | null;
  created_at: string;
};

export type LedgerEntry = {
  id: number;
  business_id: string;
  order_id: string | null;
  payout_id: string | null;
  kind: "sale" | "commission" | "adjustment";
  amount_minor: number;
  description: string;
  available_at: string;
  created_at: string;
};

export type ProductCategory = {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
};

export type Product = {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  material: string | null;
  dimensions: string | null;
  weight_grams: number | null;
  price_minor: number;
  stock: number;
  is_active: boolean;
  images: string[];
  review_status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

export type AddressSnapshot = {
  label: string;
  department: string;
  municipality: string;
  department_id: number;
  municipality_id: number;
  address_line: string;
  recipient_name: string;
  phone: string;
};

export type Order = {
  id: string;
  order_number: string;
  customer_id: string;
  business_id: string;
  service_type: ServiceType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_minor: number;
  delivery_fee_minor: number;
  commission_rate: number;
  commission_amount_minor: number;
  total_minor: number;
  vendor_net_minor: number;
  estimated_days: number | null;
  address_snapshot: AddressSnapshot | null;
  contact_name: string;
  contact_phone: string;
  customer_note: string | null;
  payment_provider: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  cancel_reason: string | null;
  expires_at: string | null;
  paid_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  service_fee_minor: number;
  courier_cost_minor: number;
  reserve_minor: number;
  ready_photo_path: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  delivery_method: "pin" | "admin" | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  image_url: string | null;
  unit_price_minor: number;
  quantity: number;
  subtotal_minor: number;
  note: string | null;
};

export type OrderStatusHistory = {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
};

export type CommissionRule = {
  id: string;
  business_id: string | null;
  category_id: number | null;
  rate: number;
  valid_from: string;
  valid_to: string | null;
  note: string | null;
};

export type Payout = {
  id: string;
  business_id: string;
  period_start: string;
  period_end: string;
  orders_count: number;
  gross_minor: number;
  commission_minor: number;
  delivery_minor: number;
  adjustments_minor: number;
  net_minor: number;
  status: "pending" | "paid";
  reference: string | null;
  paid_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  order_id: string;
  business_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author?: { name: string; avatar_url: string | null } | null;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

/** Resultado estándar de las Server Actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

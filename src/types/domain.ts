export type Role = "cliente" | "emprendedor" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired";
export type FulfillmentMethod = "pickup" | "delivery";
export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
export type ApiFailure = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type ProductView = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  stock: number;
  images: string[];
  category: { id: string; name: string; slug: string };
  entrepreneur: { id: string; businessName: string };
};

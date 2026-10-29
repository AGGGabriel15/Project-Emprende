/** Cotización del pedido (la comparten el web y la app móvil). */

export type QuoteLine = {
  productId: string;
  name: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  stock: number;
  available: boolean;
  priceChanged: boolean;
  issue?: string;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  estimatedDays: number | null;
  total: number;
  open: boolean;
  openDetail?: string;
  canDeliver: boolean;
  issues: string[];
};

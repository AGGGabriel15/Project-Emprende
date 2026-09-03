import { Schema, model, models, type Model, type Types } from "mongoose";
import type {
  FulfillmentMethod,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";

export interface IOrderItem {
  product: Types.ObjectId;
  category: Types.ObjectId;
  categoryName: string;
  name: string;
  image?: string;
  unitPriceMinor: number;
  quantity: number;
  subtotalMinor: number;
}

export interface IOrder {
  _id: Types.ObjectId;
  orderNumber: string;
  customer: Types.ObjectId;
  entrepreneur: Types.ObjectId;
  items: IOrderItem[];
  subtotalMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  contactName: string;
  phone: string;
  fulfillmentMethod: FulfillmentMethod;
  deliveryAddress?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stockReserved: boolean;
  reservationExpiresAt?: Date;
  emailStatus: "pending" | "sent" | "failed";
  emailError?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categoryName: { type: String, required: true },
    name: { type: String, required: true },
    image: String,
    unitPriceMinor: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1 },
    subtotalMinor: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entrepreneur: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
      required: true,
      index: true,
    },
    items: { type: [orderItemSchema], required: true },
    subtotalMinor: { type: Number, required: true, min: 1 },
    deliveryMinor: { type: Number, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 1 },
    contactName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    fulfillmentMethod: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },
    deliveryAddress: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "paid",
        "preparing",
        "ready_for_pickup",
        "out_for_delivery",
        "completed",
        "cancelled",
      ],
      default: "pending_payment",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
      index: true,
    },
    stripeSessionId: { type: String, sparse: true, unique: true },
    stripePaymentIntentId: String,
    stockReserved: { type: Boolean, default: false },
    reservationExpiresAt: Date,
    emailStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    emailError: String,
    paidAt: Date,
  },
  { timestamps: true },
);

export const Order =
  (models.Order as Model<IOrder> | undefined) ??
  model<IOrder>("Order", orderSchema);

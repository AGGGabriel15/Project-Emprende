import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IProduct {
  _id: Types.ObjectId;
  entrepreneur: Types.ObjectId;
  category: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  priceMinor: number;
  stock: number;
  images: string[];
  active: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    entrepreneur: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
      required: true,
      index: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 1500 },
    priceMinor: { type: Number, required: true, min: 1 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String, trim: true }],
    active: { type: Boolean, default: true, index: true },
    deletedAt: Date,
  },
  { timestamps: true },
);

productSchema.index({ entrepreneur: 1, slug: 1 }, { unique: true });
productSchema.index({ name: "text", description: "text" });

export const Product =
  (models.Product as Model<IProduct> | undefined) ??
  model<IProduct>("Product", productSchema);

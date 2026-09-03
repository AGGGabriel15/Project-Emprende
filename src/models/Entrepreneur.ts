import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IEntrepreneur {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  businessName: string;
  description: string;
  phone: string;
  address: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const entrepreneurSchema = new Schema<IEntrepreneur>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 800 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    address: { type: String, required: true, trim: true, maxlength: 250 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

export const Entrepreneur =
  (models.Entrepreneur as Model<IEntrepreneur> | undefined) ??
  model<IEntrepreneur>("Entrepreneur", entrepreneurSchema);

import { Schema, model, models, type Model, type Types } from "mongoose";

export interface ICategory {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Category =
  (models.Category as Model<ICategory> | undefined) ??
  model<ICategory>("Category", categorySchema);

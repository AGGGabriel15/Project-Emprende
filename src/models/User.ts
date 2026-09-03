import { Schema, model, models, type Model, type Types } from "mongoose";
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: "cliente" | "emprendedor" | "admin";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["cliente", "emprendedor", "admin"],
      default: "cliente",
      required: true,
    },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

export const User =
  (models.User as Model<IUser> | undefined) ?? model<IUser>("User", userSchema);

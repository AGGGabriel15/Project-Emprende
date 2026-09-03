import { isValidObjectId } from "mongoose";
import { apiError, ApiError, ok } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { entrepreneurForUser } from "@/lib/entrepreneur";
import { serializeProduct } from "@/lib/serializers";
import { requireUser } from "@/lib/session";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { productSchema } from "@/validations/product";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  try {
    const { id } = await params;
    if (!isValidObjectId(id))
      throw new ApiError(404, "NOT_FOUND", "Producto no encontrado.");
    await connectDB();
    const product = await Product.findOne({
      _id: id,
      active: true,
      deletedAt: { $exists: false },
    })
      .populate("category", "name slug")
      .populate("entrepreneur", "businessName address")
      .lean();
    if (!product)
      throw new ApiError(404, "NOT_FOUND", "Producto no encontrado.");
    return ok(serializeProduct(product as never));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await requireUser(["emprendedor", "admin"]);
    const input = productSchema.partial().parse(await request.json());
    const product = await Product.findById(id);
    if (!product || product.deletedAt)
      throw new ApiError(404, "NOT_FOUND", "Producto no encontrado.");
    if (user.role === "emprendedor") {
      const entrepreneur = await entrepreneurForUser(user._id.toString(), true);
      if (!product.entrepreneur.equals(entrepreneur._id)) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Este producto pertenece a otro emprendedor.",
        );
      }
    }
    if (input.categoryId) {
      const category = await Category.findOne({
        _id: input.categoryId,
        active: true,
      });
      if (!category)
        throw new ApiError(422, "INVALID_CATEGORY", "Categoría inválida.");
      product.category = category._id;
    }
    if (input.name !== undefined) product.name = input.name;
    if (input.description !== undefined)
      product.description = input.description;
    if (input.price !== undefined)
      product.priceMinor = Math.round(input.price * 100);
    if (input.stock !== undefined) product.stock = input.stock;
    if (input.images !== undefined) product.images = input.images;
    if (input.active !== undefined) product.active = input.active;
    await product.save();
    await product.populate(["category", "entrepreneur"]);
    return ok(serializeProduct(product.toObject() as never));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  try {
    const { id } = await params;
    const user = await requireUser(["emprendedor", "admin"]);
    const product = await Product.findById(id);
    if (!product || product.deletedAt)
      throw new ApiError(404, "NOT_FOUND", "Producto no encontrado.");
    if (user.role === "emprendedor") {
      const entrepreneur = await entrepreneurForUser(user._id.toString(), true);
      if (!product.entrepreneur.equals(entrepreneur._id)) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Este producto pertenece a otro emprendedor.",
        );
      }
    }
    product.active = false;
    product.deletedAt = new Date();
    await product.save();
    return ok({ id, deleted: true });
  } catch (error) {
    return apiError(error);
  }
}

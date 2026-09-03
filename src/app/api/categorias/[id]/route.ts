import { z } from "zod";
import { apiError, ApiError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ name: z.string().trim().min(2).max(80) });

export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await params;
    const { name } = schema.parse(await request.json());
    const category = await Category.findById(id);
    if (!category)
      throw new ApiError(404, "NOT_FOUND", "Categoría no encontrada.");
    category.name = name;
    category.slug = slugify(name);
    await category.save();
    return ok({ id, name: category.name, slug: category.slug });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, { params }: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await params;
    if (await Product.exists({ category: id })) {
      throw new ApiError(
        409,
        "CATEGORY_IN_USE",
        "No se puede eliminar una categoría utilizada.",
      );
    }
    const category = await Category.findByIdAndUpdate(
      id,
      { active: false },
      { returnDocument: "after" },
    );
    if (!category)
      throw new ApiError(404, "NOT_FOUND", "Categoría no encontrada.");
    return ok({ id, deleted: true });
  } catch (error) {
    return apiError(error);
  }
}

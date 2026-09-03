import { z } from "zod";
import { apiError, ApiError, created, ok } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { Category } from "@/models/Category";

const schema = z.object({ name: z.string().trim().min(2).max(80) });

export async function GET() {
  try {
    await connectDB();
    const categories = await Category.find({ active: true })
      .sort({ name: 1 })
      .lean();
    return ok(
      categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser(["admin"]);
    const input = schema.parse(await request.json());
    const slug = slugify(input.name);
    if (await Category.exists({ slug })) {
      throw new ApiError(
        409,
        "CATEGORY_EXISTS",
        "Ya existe una categoría con ese nombre.",
      );
    }
    const category = await Category.create({ name: input.name, slug });
    return created({ id: category._id.toString(), name: category.name, slug });
  } catch (error) {
    return apiError(error);
  }
}

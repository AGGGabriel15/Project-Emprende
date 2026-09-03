import { apiError, ApiError, created, ok } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { entrepreneurForUser } from "@/lib/entrepreneur";
import { serializeProduct } from "@/lib/serializers";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { productSchema } from "@/validations/product";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  try {
    await connectDB();
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(48, Math.max(1, Number(params.get("limit")) || 12));
    const mine = params.get("mine") === "1";
    const filter: Record<string, unknown> = {
      active: true,
      deletedAt: { $exists: false },
    };

    if (mine) {
      const user = await requireUser(["emprendedor"]);
      const entrepreneur = await entrepreneurForUser(user._id.toString());
      filter.entrepreneur = entrepreneur._id;
      delete filter.active;
    }
    const search = params.get("q")?.trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: regex }, { description: regex }];
    }
    const categorySlug = params.get("categoria");
    if (categorySlug) {
      const category = await Category.findOne({
        slug: categorySlug,
        active: true,
      }).select("_id");
      if (!category) return ok([], { status: 200 });
      filter.category = category._id;
    }
    const entrepreneurId = params.get("emprendedor");
    if (entrepreneurId) filter.entrepreneur = entrepreneurId;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("category", "name slug")
        .populate("entrepreneur", "businessName")
        .lean(),
      Product.countDocuments(filter),
    ]);
    return Response.json({
      data: items.map((item) => serializeProduct(item as never)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["emprendedor"]);
    const entrepreneur = await entrepreneurForUser(user._id.toString(), true);
    const input = productSchema.parse(await request.json());
    const category = await Category.findOne({
      _id: input.categoryId,
      active: true,
    });
    if (!category)
      throw new ApiError(
        422,
        "INVALID_CATEGORY",
        "La categoría no está disponible.",
      );
    const baseSlug = slugify(input.name);
    const exists = await Product.exists({
      entrepreneur: entrepreneur._id,
      slug: baseSlug,
    });
    const product = await Product.create({
      entrepreneur: entrepreneur._id,
      category: category._id,
      name: input.name,
      slug: exists
        ? `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
        : baseSlug,
      description: input.description,
      priceMinor: Math.round(input.price * 100),
      stock: input.stock,
      images: input.images,
      active: input.active ?? true,
    });
    await product.populate(["category", "entrepreneur"]);
    return created(serializeProduct(product.toObject() as never));
  } catch (error) {
    return apiError(error);
  }
}

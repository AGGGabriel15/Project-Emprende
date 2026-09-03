import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { apiError, ApiError, created } from "@/lib/api-response";
import { entrepreneurForUser } from "@/lib/entrepreneur";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const user = await requireUser(["emprendedor"]);
    await entrepreneurForUser(user._id.toString(), true);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(422, "FILE_REQUIRED", "Selecciona una imagen.");
    }
    const extension = mimeExtensions[file.type];
    if (!extension) {
      throw new ApiError(
        415,
        "INVALID_FILE_TYPE",
        "Solo se permiten JPG, PNG y WebP.",
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ApiError(
        413,
        "FILE_TOO_LARGE",
        "La imagen no puede superar 5 MB.",
      );
    }
    const uploadRoot = path.resolve(
      process.cwd(),
      "public",
      "uploads",
      "products",
    );
    await mkdir(uploadRoot, { recursive: true });
    const filename = `${crypto.randomUUID()}.${extension}`;
    const target = path.resolve(uploadRoot, filename);
    if (!target.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new ApiError(400, "INVALID_PATH", "Ruta de archivo inválida.");
    }
    await writeFile(target, Buffer.from(await file.arrayBuffer()), {
      flag: "wx",
    });
    return created({ url: `/uploads/products/${filename}` });
  } catch (error) {
    return apiError(error);
  }
}

import { z } from "zod";
import { apiError, ApiError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/session";
import { User } from "@/models/User";

const schema = z.object({ active: z.boolean() });
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const admin = await requireUser(["admin"]);
    const { id } = await params;
    const { active } = schema.parse(await request.json());
    if (admin._id.toString() === id && !active) {
      throw new ApiError(
        409,
        "SELF_DEACTIVATION",
        "No puedes desactivar tu propia cuenta.",
      );
    }
    const user = await User.findByIdAndUpdate(
      id,
      { active },
      { returnDocument: "after" },
    );
    if (!user) throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado.");
    return ok({ id, active: user.active });
  } catch (error) {
    return apiError(error);
  }
}

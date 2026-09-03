import { ApiError } from "@/lib/api-response";
import { Entrepreneur } from "@/models/Entrepreneur";

export async function entrepreneurForUser(userId: string, approved = false) {
  const entrepreneur = await Entrepreneur.findOne({ user: userId });
  if (!entrepreneur) {
    throw new ApiError(
      404,
      "PROFILE_NOT_FOUND",
      "No se encontró el perfil emprendedor.",
    );
  }
  if (approved && entrepreneur.status !== "approved") {
    throw new ApiError(
      403,
      "ENTREPRENEUR_NOT_APPROVED",
      "Tu perfil debe ser aprobado antes de publicar productos.",
    );
  }
  return entrepreneur;
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ApiError } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import type { Role } from "@/types/domain";

export async function requireUser(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ApiError(401, "UNAUTHORIZED", "Debes iniciar sesión.");
  }
  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user?.active) {
    throw new ApiError(401, "INACTIVE_USER", "La cuenta está inactiva.");
  }
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "No tienes permiso para realizar esta acción.",
    );
  }
  return user;
}

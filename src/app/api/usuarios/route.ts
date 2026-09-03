import { apiError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/session";
import { User } from "@/models/User";

export async function GET() {
  try {
    await requireUser(["admin"]);
    const users = await User.find().sort({ createdAt: -1 }).lean();
    return ok(
      users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

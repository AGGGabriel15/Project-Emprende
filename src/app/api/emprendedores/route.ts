import { apiError, ok } from "@/lib/api-response";
import { entrepreneurForUser } from "@/lib/entrepreneur";
import { requireUser } from "@/lib/session";
import { Entrepreneur } from "@/models/Entrepreneur";
import type { ApprovalStatus } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const user = await requireUser(["emprendedor", "admin"]);
    if (user.role === "emprendedor") {
      const profile = await entrepreneurForUser(user._id.toString());
      return ok({
        id: profile._id.toString(),
        businessName: profile.businessName,
        description: profile.description,
        phone: profile.phone,
        address: profile.address,
        status: profile.status,
        rejectionReason: profile.rejectionReason,
      });
    }
    const requestedStatus = new URL(request.url).searchParams.get("status");
    const validStatuses: ApprovalStatus[] = ["pending", "approved", "rejected"];
    const status = validStatuses.find((value) => value === requestedStatus);
    const filter: { status?: ApprovalStatus } = status ? { status } : {};
    const profiles = await Entrepreneur.find(filter)
      .populate("user", "name email active")
      .sort({ createdAt: -1 })
      .lean();
    return ok(
      profiles.map((profile) => ({
        id: profile._id.toString(),
        businessName: profile.businessName,
        description: profile.description,
        phone: profile.phone,
        address: profile.address,
        status: profile.status,
        rejectionReason: profile.rejectionReason,
        user: profile.user,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}

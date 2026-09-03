import { z } from "zod";
import { apiError, ApiError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/session";
import { Entrepreneur } from "@/models/Entrepreneur";

const schema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "rejected" && !data.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Indica el motivo.",
      });
    }
  });

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireUser(["admin"]);
    const { id } = await params;
    const input = schema.parse(await request.json());
    const update =
      input.status === "approved"
        ? { $set: { status: "approved" }, $unset: { rejectionReason: 1 } }
        : {
            $set: {
              status: "rejected",
              rejectionReason: input.rejectionReason,
            },
          };
    const profile = await Entrepreneur.findByIdAndUpdate(id, update, {
      returnDocument: "after",
    });
    if (!profile)
      throw new ApiError(404, "NOT_FOUND", "Emprendedor no encontrado.");
    return ok({
      id,
      status: profile.status,
      rejectionReason: profile.rejectionReason,
    });
  } catch (error) {
    return apiError(error);
  }
}

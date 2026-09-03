import { hash } from "bcryptjs";
import { apiError, ApiError, created } from "@/lib/api-response";
import { connectDB } from "@/lib/db";
import { Entrepreneur } from "@/models/Entrepreneur";
import { User } from "@/models/User";
import { registerSchema } from "@/validations/auth";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    await connectDB();
    const email = input.email.toLowerCase();
    if (await User.exists({ email })) {
      throw new ApiError(
        409,
        "EMAIL_EXISTS",
        "Ya existe una cuenta con ese correo.",
      );
    }
    const user = await User.create({
      name: input.name,
      email,
      passwordHash: await hash(input.password, 12),
      role: input.role,
    });
    try {
      if (input.role === "emprendedor") {
        await Entrepreneur.create({
          user: user._id,
          businessName: input.businessName,
          description: input.description,
          phone: input.phone,
          address: input.address,
        });
      }
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
    return created({ id: user._id.toString(), role: user.role });
  } catch (error) {
    return apiError(error);
  }
}

import { NextResponse } from "next/server";
import { emailStatus, emailTakenMessage } from "@/features/auth/email-status";
import { jsonBody } from "@/lib/mobile-api";
import { emailSchema } from "@/lib/validations/auth";

/** ¿El correo ya tiene cuenta? Lo consulta el registro de la app mientras se escribe. */
export async function POST(request: Request) {
  const parsed = emailSchema.safeParse((await jsonBody(request)).email);
  if (!parsed.success) return NextResponse.json({ ok: true, data: { status: "invalid", message: null } });
  const status = await emailStatus(parsed.data);
  return NextResponse.json({ ok: true, data: { status: status.status, message: emailTakenMessage(status) } });
}

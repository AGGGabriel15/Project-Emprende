import type { ZodError } from "zod";
import type { ActionResult } from "@/types/domain";
import { errorMessage } from "@/lib/utils";

export function success<T>(data: T): ActionResult<T>;
export function success(): ActionResult;
export function success<T>(data?: T) {
  return { ok: true, data } as ActionResult<T>;
}

export function failure(error: unknown, fallback?: string): ActionResult<never> {
  return { ok: false, error: errorMessage(error, fallback) };
}

export function invalid(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0]?.message ?? "Revisa los datos.";
  return { ok: false, error: first, fieldErrors };
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

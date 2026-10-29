import type { Href } from 'expo-router';
import type { ZodError } from 'zod';

/** Primer error de cada campo de un esquema zod, por nombre de campo. */
export function fieldErrors(error: ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Ruta interna segura para volver tras el login (igual que safeNext del web). */
export function safeNext(next: unknown): Href {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? (next as Href) : '/';
}

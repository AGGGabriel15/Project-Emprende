import type { Href } from 'expo-router';
import { useState } from 'react';
import type { ZodError, ZodType } from 'zod';

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

/**
 * Validación en vivo: cada campo muestra su error al salir de él (onBlur) y,
 * desde ahí, mientras se escribe; al pulsar el botón se muestran todos.
 */
export function useLiveValidation<T>(schema: ZodType<T>, values: unknown) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const parsed = schema.safeParse(values);
  const all = parsed.success ? {} : fieldErrors(parsed.error);
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(all)) if (submitted || touched[key]) errors[key] = message;
  return {
    errors,
    /** Para onBlur de un campo. */
    touch: (field: string) => () => setTouched((current) => (current[field] ? current : { ...current, [field]: true })),
    /** Al enviar: muestra todos los errores y devuelve el resultado de zod. */
    validate: () => {
      setSubmitted(true);
      return parsed;
    },
  };
}

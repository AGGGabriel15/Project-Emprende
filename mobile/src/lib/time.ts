/** Hora actual en ms. Función de módulo para no llamar Date.now() dentro del render (regla de pureza). */
export function nowMs() {
  return Date.now();
}

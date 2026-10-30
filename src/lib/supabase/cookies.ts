/**
 * Cookies de sesión: HttpOnly (el JavaScript de la página no puede leerlas, así
 * un XSS no roba el refresh token), Secure en producción y SameSite=Lax.
 * El navegador pide un token corto al servidor (browserSession) cuando lo necesita.
 */
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

const { clientIp, signInWithGuard, tooManyAttemptsMessage } = await import("./login-guard");

function authClient(error: { code: string } | null) {
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { session: error ? null : {} }, error });
  return { client: { auth: { signInWithPassword } } as never, signInWithPassword };
}

const credentials = { email: "ana@example.com", password: "Incorrecta1" };

describe("límite de intentos de inicio de sesión", () => {
  beforeEach(() => rpc.mockReset());

  it("toma la IP del visitante del primer x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "190.0.0.7, 10.0.0.1" }))).toBe("190.0.0.7");
    expect(clientIp(new Headers({ "x-real-ip": "190.0.0.8" }))).toBe("190.0.0.8");
    expect(clientIp(new Headers())).toBe("");
  });

  it("explica cuánto esperar en minutos", () => {
    expect(tooManyAttemptsMessage(30)).toBe("Demasiados intentos fallidos. Espera 1 minuto e inténtalo de nuevo.");
    expect(tooManyAttemptsMessage(840)).toMatch(/Espera 14 minutos/);
  });

  it("bloqueado: no consulta la contraseña", async () => {
    rpc.mockResolvedValueOnce({ data: 600 });
    const { client, signInWithPassword } = authClient(null);
    const attempt = await signInWithGuard(client, credentials, "190.0.0.7");
    expect(attempt).toEqual({ blocked: tooManyAttemptsMessage(600) });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("anota el fallo y borra los fallos al acertar", async () => {
    rpc.mockResolvedValue({ data: 0 });
    await signInWithGuard(authClient({ code: "invalid_credentials" }).client, credentials, "190.0.0.7");
    expect(rpc).toHaveBeenLastCalledWith("record_login_attempt", { p_email: credentials.email, p_ip: "190.0.0.7", p_success: false });
    await signInWithGuard(authClient(null).client, credentials, "190.0.0.7");
    expect(rpc).toHaveBeenLastCalledWith("record_login_attempt", { p_email: credentials.email, p_ip: "190.0.0.7", p_success: true });
  });
});

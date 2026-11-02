import { beforeEach, describe, expect, it, vi } from "vitest";

const profile = { data: null as { id: string } | null };
const user = { data: { user: null as unknown } };
const eq = vi.fn(() => ({ maybeSingle: async () => profile }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq }) }),
    auth: { admin: { getUserById: async () => user } },
  }),
}));

const { emailStatus, emailTakenMessage } = await import("./email-status");

describe("estado del correo en el registro", () => {
  beforeEach(() => {
    profile.data = null;
    user.data.user = null;
    eq.mockClear();
  });

  it("busca el correo normalizado y lo da por disponible si no existe", async () => {
    expect(await emailStatus("  Ana@Example.com ")).toEqual({ status: "available" });
    expect(eq).toHaveBeenCalledWith("email", "ana@example.com");
  });

  it("distingue cuentas sin confirmar, con contraseña y con Google", async () => {
    profile.data = { id: "u1" };
    user.data.user = { email_confirmed_at: null, identities: [{ provider: "email" }] };
    expect(await emailStatus("ana@example.com")).toEqual({ status: "unconfirmed" });

    user.data.user = { email_confirmed_at: "2026-11-01", identities: [{ provider: "email" }] };
    const registered = await emailStatus("ana@example.com");
    expect(registered).toEqual({ status: "registered", provider: "email" });
    expect(emailTakenMessage(registered)).toMatch(/recupera tu contraseña/);

    user.data.user = { email_confirmed_at: "2026-11-01", identities: [{ provider: "google" }] };
    expect(emailTakenMessage(await emailStatus("ana@example.com"))).toMatch(/Continuar con Google/);
  });
});

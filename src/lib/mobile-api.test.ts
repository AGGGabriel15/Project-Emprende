import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getUser } })),
}));

const { appReturnBase } = await import("./mobile-api");
const { authFromRequest } = await import("./supabase/bearer");
const { GET: returnToApp } = await import("@/app/api/mobile/return/route");

const ORDER = "6f1c2a43-8b7d-4e21-9a0b-3c4d5e6f7a8b";

describe("API de la app móvil", () => {
  beforeEach(() => getUser.mockReset());

  it("sin token no hay sesión", async () => {
    expect(await authFromRequest(new Request("https://x.test"))).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("valida el token con Supabase", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    const session = await authFromRequest(new Request("https://x.test", { headers: { Authorization: "Bearer abc" } }));
    expect(getUser).toHaveBeenCalledWith("abc");
    expect(session?.user.id).toBe("u1");

    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await authFromRequest(new Request("https://x.test", { headers: { Authorization: "Bearer vencido" } }))).toBeNull();
  });

  it("solo vuelve al esquema de la app o a Expo Go", () => {
    expect(appReturnBase("catarinamarket://")).toBe("catarinamarket://");
    expect(appReturnBase("exp://192.168.1.20:8081/--/")).toBe("exp://192.168.1.20:8081/--/");
    expect(appReturnBase("https://evil.example/")).toBe("catarinamarket://");
    expect(appReturnBase("javascript:alert(1)")).toBe("catarinamarket://");
    expect(appReturnBase(undefined)).toBe("catarinamarket://");
  });

  it("Stripe vuelve al pedido dentro de la app", async () => {
    const ok = await returnToApp(new Request(`https://x.test/api/mobile/return?pedido=${ORDER}&estado=exito&session_id=cs_1`));
    expect(ok.status).toBe(302);
    expect(ok.headers.get("location")).toBe(`catarinamarket://pedidos/${ORDER}?pago=exito`);

    const dev = await returnToApp(
      new Request(`https://x.test/api/mobile/return?pedido=${ORDER}&estado=cancelado&app=${encodeURIComponent("exp://10.0.0.5:8081/--/")}`),
    );
    expect(dev.headers.get("location")).toBe(`exp://10.0.0.5:8081/--/pedidos/${ORDER}?pago=cancelado`);

    const bad = await returnToApp(new Request("https://x.test/api/mobile/return?pedido=../admin&estado=exito"));
    expect(bad.headers.get("location")).toBe("catarinamarket://pedidos");
  });
});

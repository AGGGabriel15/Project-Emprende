import { describe, expect, it } from "vitest";
import { buildPushMessages, staleTokens } from "./push";

describe("notificaciones push (Expo)", () => {
  it("arma un mensaje por dispositivo con el enlace del aviso", () => {
    const messages = buildPushMessages(["ExponentPushToken[a]", "ExponentPushToken[b]"], {
      title: "Nuevo pedido",
      body: "CM-1 · 2 productos",
      link: "/vendedor/pedidos",
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "Nuevo pedido", channelId: "pedidos", data: { link: "/vendedor/pedidos" } });
  });

  it("descarta solo los dispositivos desinstalados", () => {
    const tokens = ["t1", "t2", "t3"];
    const stale = staleTokens(tokens, [
      { status: "ok", id: "1" },
      { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "y", details: { error: "MessageRateExceeded" } },
    ]);
    expect(stale).toEqual(["t2"]);
  });
});

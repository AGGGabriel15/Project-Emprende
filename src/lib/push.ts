/** Mensajes para la Expo Push API (https://exp.host/--/api/v2/push/send). */

export type PushNotification = { title: string; body: string; link: string | null };

export type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

export function buildPushMessages(tokens: string[], notification: PushNotification) {
  return tokens.map((to) => ({
    to,
    title: notification.title,
    body: notification.body,
    sound: "default",
    priority: "high",
    channelId: "pedidos",
    data: { link: notification.link },
  }));
}

/** Tokens que Expo reporta como desinstalados o inválidos (se borran). */
export function staleTokens(tokens: string[], tickets: ExpoTicket[]) {
  return tokens.filter((_, i) => {
    const ticket = tickets[i];
    return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered";
  });
}

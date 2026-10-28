import { Resend } from "resend";
import { appUrl } from "@/lib/actions";
import { formatMoney } from "@/lib/utils";

let resend: Resend | undefined;

/** Envía con Resend; sin RESEND_API_KEY solo registra en consola (modo demo). */
export async function sendEmail(to: string | null | undefined, subject: string, html: string) {
  if (!to) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:demo] → ${to} · ${subject}`);
    return;
  }
  resend ??= new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Catarina Market <onboarding@resend.dev>",
    to,
    subject,
    html: layout(subject, html),
  });
  if (error) console.error("[email]", error);
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4ec;font-family:Arial,sans-serif;color:#1d3a2f">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-family:Georgia,serif;font-size:20px;font-weight:bold;margin:0 0 24px">Catarina <span style="color:#c8812d">Market</span></p>
    <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e3e6dc">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">${escape(title)}</h1>
      ${body}
    </div>
    <p style="font-size:12px;color:#6b7a72;margin-top:20px">Catarina, Masaya, Nicaragua</p>
  </div></body></html>`;
}

export function button(href: string, label: string) {
  return `<p style="margin:24px 0 0"><a href="${appUrl()}${href}" style="background:#2c6b51;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escape(label)}</a></p>`;
}

export function escape(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function orderSummaryHtml(order: {
  order_number: string;
  subtotal_minor: number;
  delivery_fee_minor: number;
  total_minor: number;
  items: { product_name: string; quantity: number; subtotal_minor: number }[];
}) {
  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0">${item.quantity} × ${escape(item.product_name)}</td><td style="text-align:right">${formatMoney(item.subtotal_minor)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;font-size:14px;border-collapse:collapse">${rows}
    <tr><td style="padding-top:12px;border-top:1px solid #eee">Subtotal</td><td style="text-align:right;padding-top:12px;border-top:1px solid #eee">${formatMoney(order.subtotal_minor)}</td></tr>
    ${order.delivery_fee_minor ? `<tr><td>Delivery</td><td style="text-align:right">${formatMoney(order.delivery_fee_minor)}</td></tr>` : ""}
    <tr><td style="font-weight:bold;padding-top:6px">Total</td><td style="text-align:right;font-weight:bold;padding-top:6px">${formatMoney(order.total_minor)}</td></tr>
  </table>`;
}

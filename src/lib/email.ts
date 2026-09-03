import nodemailer from "nodemailer";
import { formatMoney } from "@/lib/utils";
import { Order } from "@/models/Order";
import { User } from "@/models/User";

function transport() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error("SMTP no configurado");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendOrderConfirmation(orderId: string) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, emailStatus: { $ne: "sent" } },
    { emailStatus: "pending", $unset: { emailError: 1 } },
    { returnDocument: "after" },
  );
  if (!order) return;
  const customer = await User.findById(order.customer);
  if (!customer) return;
  try {
    await transport().sendMail({
      from: process.env.SMTP_FROM,
      to: customer.email,
      subject: `Pedido ${order.orderNumber} confirmado`,
      text: `Hola ${customer.name}. Confirmamos tu pago por ${formatMoney(order.totalMinor)}. Estado: pagado.`,
      html: `<h1>¡Gracias por tu compra!</h1><p>Tu pedido <strong>${order.orderNumber}</strong> fue pagado por <strong>${formatMoney(order.totalMinor)}</strong>.</p>`,
    });
    await Order.updateOne(
      { _id: order._id },
      { emailStatus: "sent", $unset: { emailError: 1 } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error SMTP";
    await Order.updateOne(
      { _id: order._id },
      { emailStatus: "failed", emailError: message.slice(0, 500) },
    );
  }
}

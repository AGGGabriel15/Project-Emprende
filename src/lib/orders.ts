import { ApiError } from "@/lib/api-response";
import { Order, type IOrder } from "@/models/Order";
import { Product, type IProduct } from "@/models/Product";
import { Category } from "@/models/Category";

type CheckoutItem = { productId: string; quantity: number };

function orderNumber() {
  return `EUC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
}

export async function reserveAndCreateOrder(input: {
  customerId: string;
  items: CheckoutItem[];
  contactName: string;
  phone: string;
  fulfillmentMethod: "pickup" | "delivery";
  deliveryAddress?: string;
}) {
  const ids = [...new Set(input.items.map((item) => item.productId))];
  if (ids.length !== input.items.length) {
    throw new ApiError(
      422,
      "DUPLICATE_ITEMS",
      "El carrito contiene productos duplicados.",
    );
  }
  const products = await Product.find({
    _id: { $in: ids },
    active: true,
    deletedAt: { $exists: false },
  });
  if (products.length !== ids.length) {
    throw new ApiError(
      409,
      "PRODUCT_UNAVAILABLE",
      "Uno de los productos ya no está disponible.",
    );
  }
  const entrepreneurIds = new Set(
    products.map((product) => product.entrepreneur.toString()),
  );
  if (entrepreneurIds.size !== 1) {
    throw new ApiError(
      422,
      "MULTIPLE_SELLERS",
      "Solo puedes comprar a un emprendedor por pedido.",
    );
  }

  const categories = await Category.find({
    _id: { $in: products.map((product) => product.category) },
  }).lean();
  const categoryNames = new Map(
    categories.map((category) => [category._id.toString(), category.name]),
  );

  const byId = new Map(
    products.map((product) => [product._id.toString(), product]),
  );
  const reserved: Array<{ product: IProduct; quantity: number }> = [];
  try {
    for (const item of input.items) {
      const product = byId.get(item.productId)!;
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: item.quantity }, active: true },
        { $inc: { stock: -item.quantity } },
        { returnDocument: "after" },
      );
      if (!updated) {
        throw new ApiError(
          409,
          "INSUFFICIENT_STOCK",
          `No hay existencias suficientes de ${product.name}.`,
        );
      }
      reserved.push({ product, quantity: item.quantity });
    }
    const orderItems = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      return {
        product: product._id,
        category: product.category,
        categoryName:
          categoryNames.get(product.category.toString()) ?? "Sin categoría",
        name: product.name,
        image: product.images[0],
        unitPriceMinor: product.priceMinor,
        quantity: item.quantity,
        subtotalMinor: product.priceMinor * item.quantity,
      };
    });
    const subtotalMinor = orderItems.reduce(
      (sum, item) => sum + item.subtotalMinor,
      0,
    );
    return await Order.create({
      orderNumber: orderNumber(),
      customer: input.customerId,
      entrepreneur: products[0].entrepreneur,
      items: orderItems,
      subtotalMinor,
      deliveryMinor: 0,
      totalMinor: subtotalMinor,
      contactName: input.contactName,
      phone: input.phone,
      fulfillmentMethod: input.fulfillmentMethod,
      deliveryAddress: input.deliveryAddress,
      stockReserved: true,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  } catch (error) {
    await Promise.all(
      reserved.map(({ product, quantity }) =>
        Product.updateOne({ _id: product._id }, { $inc: { stock: quantity } }),
      ),
    );
    throw error;
  }
}

export async function releaseOrderStock(order: IOrder) {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, stockReserved: true },
    { stockReserved: false },
    { returnDocument: "after" },
  );
  if (!claimed) return false;
  await Promise.all(
    claimed.items.map((item) =>
      Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
      ),
    ),
  );
  return true;
}

export async function releaseExpiredReservations() {
  const expired = await Order.find({
    paymentStatus: "pending",
    stockReserved: true,
    reservationExpiresAt: { $lt: new Date() },
  }).limit(100);
  for (const order of expired) {
    if (await releaseOrderStock(order)) {
      await Order.updateOne(
        { _id: order._id, paymentStatus: "pending" },
        { paymentStatus: "expired", status: "cancelled" },
      );
    }
  }
}

export async function markOrderPaid(orderId: string, paymentIntentId?: string) {
  return Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: "pending" },
    {
      paymentStatus: "paid",
      status: "paid",
      paidAt: new Date(),
      stockReserved: false,
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
    { returnDocument: "after" },
  );
}

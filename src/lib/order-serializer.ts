import type { IOrder } from "@/models/Order";
import type { Types } from "mongoose";

type PopulatedOrder = Omit<IOrder, "customer" | "entrepreneur"> & {
  customer:
    | Types.ObjectId
    | { _id: { toString(): string }; name: string; email: string };
  entrepreneur:
    | Types.ObjectId
    | {
        _id: { toString(): string };
        businessName: string;
        address: string;
        phone: string;
      };
};

export function serializeOrder(order: PopulatedOrder) {
  const customer = order.customer;
  const entrepreneur = order.entrepreneur;
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    customer:
      customer && "name" in customer
        ? {
            id: customer._id.toString(),
            name: customer.name,
            email: customer.email,
          }
        : undefined,
    entrepreneur:
      entrepreneur && "businessName" in entrepreneur
        ? {
            id: entrepreneur._id.toString(),
            businessName: entrepreneur.businessName,
            address: entrepreneur.address,
            phone: entrepreneur.phone,
          }
        : undefined,
    items: order.items.map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      image: item.image,
      categoryName: item.categoryName,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      subtotalMinor: item.subtotalMinor,
    })),
    subtotalMinor: order.subtotalMinor,
    deliveryMinor: order.deliveryMinor,
    totalMinor: order.totalMinor,
    contactName: order.contactName,
    phone: order.phone,
    fulfillmentMethod: order.fulfillmentMethod,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    paymentStatus: order.paymentStatus,
    emailStatus: order.emailStatus,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  };
}

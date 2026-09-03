import { apiError, ok } from "@/lib/api-response";
import { requireUser } from "@/lib/session";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { User } from "@/models/User";

export async function GET() {
  try {
    await requireUser(["admin"]);
    const [summary, byDay, byCategory, byEntrepreneur, users, products] =
      await Promise.all([
        Order.aggregate([
          { $match: { paymentStatus: "paid" } },
          {
            $group: {
              _id: null,
              salesMinor: { $sum: "$totalMinor" },
              orders: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          { $match: { paymentStatus: "paid" } },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$paidAt",
                  timezone: "America/Managua",
                },
              },
              salesMinor: { $sum: "$totalMinor" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Order.aggregate([
          { $match: { paymentStatus: "paid" } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.categoryName",
              salesMinor: { $sum: "$items.subtotalMinor" },
            },
          },
          { $sort: { salesMinor: -1 } },
        ]),
        Order.aggregate([
          { $match: { paymentStatus: "paid" } },
          {
            $group: {
              _id: "$entrepreneur",
              salesMinor: { $sum: "$totalMinor" },
              orders: { $sum: 1 },
            },
          },
          {
            $lookup: {
              from: "entrepreneurs",
              localField: "_id",
              foreignField: "_id",
              as: "seller",
            },
          },
          { $unwind: "$seller" },
          {
            $project: {
              name: "$seller.businessName",
              salesMinor: 1,
              orders: 1,
            },
          },
          { $sort: { salesMinor: -1 } },
        ]),
        User.countDocuments(),
        Product.countDocuments({ deletedAt: { $exists: false } }),
      ]);
    const totals = summary[0] ?? { salesMinor: 0, orders: 0 };
    return ok({
      summary: {
        salesMinor: totals.salesMinor,
        orders: totals.orders,
        averageTicketMinor: totals.orders
          ? Math.round(totals.salesMinor / totals.orders)
          : 0,
        users,
        products,
      },
      byDay: byDay.map((row) => ({
        date: row._id,
        salesMinor: row.salesMinor,
        orders: row.orders,
      })),
      byCategory: byCategory.map((row) => ({
        name: row._id,
        salesMinor: row.salesMinor,
      })),
      byEntrepreneur: byEntrepreneur.map((row) => ({
        name: row.name,
        salesMinor: row.salesMinor,
        orders: row.orders,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

import { loadEnvConfig } from "@next/env";
import { hash } from "bcryptjs";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

async function seed() {
  const password = process.env.SEED_DEFAULT_PASSWORD;
  const uri = process.env.MONGODB_URI;
  if (!password || password.length < 8)
    throw new Error("Define SEED_DEFAULT_PASSWORD con al menos 8 caracteres.");
  if (!uri) throw new Error("Define MONGODB_URI.");
  await mongoose.connect(uri);
  const { User } = await import("../src/models/User");
  const { Entrepreneur } = await import("../src/models/Entrepreneur");
  const { Category } = await import("../src/models/Category");
  const { Product } = await import("../src/models/Product");
  const { Order } = await import("../src/models/Order");
  const passwordHash = await hash(password, 12);

  const users = await Promise.all(
    [
      {
        name: "Ana Administradora",
        email: "admin@catarina.local",
        role: "admin",
      },
      {
        name: "Carlos Cliente",
        email: "cliente@catarina.local",
        role: "cliente",
      },
      {
        name: "María López",
        email: "maria@catarina.local",
        role: "emprendedor",
      },
      { name: "José Pérez", email: "jose@catarina.local", role: "emprendedor" },
    ].map((user) =>
      User.findOneAndUpdate(
        { email: user.email },
        {
          $set: { name: user.name, role: user.role, active: true },
          $setOnInsert: { passwordHash },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ),
    ),
  );
  const [, customer, maria, jose] = users;
  const approved = await Entrepreneur.findOneAndUpdate(
    { user: maria._id },
    {
      businessName: "Manos de Catarina",
      description:
        "Artesanías, plantas y productos creados por familias de Catarina.",
      phone: "8888-1001",
      address: "Parque Central, Catarina",
      status: "approved",
      $unset: { rejectionReason: 1 },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  await Entrepreneur.findOneAndUpdate(
    { user: jose._id },
    {
      businessName: "Dulces El Mirador",
      description: "Dulces tradicionales preparados en pequeños lotes.",
      phone: "8888-1002",
      address: "Del Mirador 2 cuadras al norte",
      status: "pending",
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  const categoryData = [
    { name: "Artesanías", slug: "artesanias" },
    { name: "Plantas", slug: "plantas" },
    { name: "Comida", slug: "comida" },
  ];
  const categories = await Promise.all(
    categoryData.map((category) =>
      Category.findOneAndUpdate(
        { slug: category.slug },
        { ...category, active: true },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ),
    ),
  );
  const categoryMap = new Map(
    categories.map((category) => [category.slug, category]),
  );
  const products = await Promise.all(
    [
      {
        name: "Canasta tejida tradicional",
        slug: "canasta-tejida-tradicional",
        description:
          "Canasta tejida a mano con fibras naturales, ideal para decorar o guardar tus objetos favoritos.",
        priceMinor: 85000,
        stock: 8,
        image: "/demo/artesania.svg",
        category: "artesanias",
      },
      {
        name: "Suculenta en maceta artesanal",
        slug: "suculenta-maceta-artesanal",
        description:
          "Suculenta de vivero local en una maceta pintada a mano, lista para alegrar cualquier espacio.",
        priceMinor: 27500,
        stock: 15,
        image: "/demo/planta.svg",
        category: "plantas",
      },
      {
        name: "Cajeta tradicional",
        slug: "cajeta-tradicional",
        description:
          "Dulce artesanal elaborado con receta familiar y productos seleccionados de nuestra comunidad.",
        priceMinor: 18000,
        stock: 20,
        image: "/demo/comida.svg",
        category: "comida",
      },
    ].map((product) =>
      Product.findOneAndUpdate(
        { entrepreneur: approved._id, slug: product.slug },
        {
          entrepreneur: approved._id,
          category: categoryMap.get(product.category)!._id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          priceMinor: product.priceMinor,
          stock: product.stock,
          images: [product.image],
          active: true,
          $unset: { deletedAt: 1 },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ),
    ),
  );
  const sample = products[0];
  await Order.findOneAndUpdate(
    { orderNumber: "EUC-DEMO-001" },
    {
      orderNumber: "EUC-DEMO-001",
      customer: customer._id,
      entrepreneur: approved._id,
      items: [
        {
          product: sample._id,
          category: sample.category,
          categoryName: "Artesanías",
          name: sample.name,
          image: sample.images[0],
          unitPriceMinor: sample.priceMinor,
          quantity: 1,
          subtotalMinor: sample.priceMinor,
        },
      ],
      subtotalMinor: sample.priceMinor,
      deliveryMinor: 0,
      totalMinor: sample.priceMinor,
      contactName: customer.name,
      phone: "8888-2001",
      fulfillmentMethod: "pickup",
      status: "paid",
      paymentStatus: "paid",
      stockReserved: false,
      emailStatus: "sent",
      paidAt: new Date(),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  console.log("Seed completado.");
  console.log(
    "Usuarios: admin@catarina.local, cliente@catarina.local, maria@catarina.local, jose@catarina.local",
  );
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

/**
 * Datos de demostración (idempotente): admin, cliente y 3 negocios aprobados
 * con horarios, zonas de delivery, categorías y productos.
 *
 *   npm run seed:demo
 *
 * Requiere las migraciones y supabase/seed.sql aplicados.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const password = process.env.SEED_DEFAULT_PASSWORD || "Catarina2026!";
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// Masaya = 11; Catarina = 84, Masaya (municipio) = 87; Managua = 10; Granada = 6.
const CATARINA = { department_id: 11, municipality_id: 84 };

async function ensureUser(email: string, fullName: string, role: "customer" | "vendor" | "admin" | "courier", phone: string) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, accepted_terms: true },
    });
    if (error) throw error;
    user = data.user;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, role, phone: `+505${phone}`, ...CATARINA, accepted_terms_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
  return user.id;
}

// Repartidores (empleados): correo, nombre, teléfono y placa.
const COURIERS = [
  ["repartidor@catarina.local", "Luis Repartidor", "88883001", "M 123-456"],
  ["repartidor2@catarina.local", "Karla Repartidora", "88883002", "M 654-321"],
] as const;

type DemoBusiness = {
  owner: { email: string; name: string; phone: string };
  slug: string;
  tradeName: string;
  category: string;
  description: string;
  delivery: boolean;
  zones: { department_id: number; municipality_id: number | null; fee: number; days: number }[];
  categories: { name: string; products: { name: string; description: string; price: number; stock: number; material?: string; dimensions?: string; weight?: number }[] }[];
};

const BUSINESSES: DemoBusiness[] = [
  {
    owner: { email: "maria@catarina.local", name: "María Gutiérrez", phone: "88882001" },
    slug: "vivero-los-helechos",
    tradeName: "Vivero Los Helechos",
    category: "plantas",
    description: "Vivero familiar frente al mirador de Catarina desde 1998. Helechos, suculentas, orquídeas y maceteras de barro hechas a mano.",
    delivery: true,
    zones: [
      { department_id: 11, municipality_id: null, fee: 60, days: 0 },
      { department_id: 11, municipality_id: 84, fee: 30, days: 0 },
      { department_id: 10, municipality_id: null, fee: 120, days: 1 },
      { department_id: 6, municipality_id: null, fee: 100, days: 1 },
    ],
    categories: [
      {
        name: "Helechos",
        products: [
          { name: "Helecho Boston colgante", description: "Helecho frondoso en canasta colgante de fibra, ideal para corredores con sombra.", price: 350, stock: 12, dimensions: "40 cm de diámetro" },
          { name: "Helecho cuerno de alce", description: "Montado en tabla de madera, para colgar en pared. Bajo mantenimiento.", price: 480, stock: 4 },
        ],
      },
      {
        name: "Suculentas",
        products: [
          { name: "Trío de suculentas en barro", description: "Tres suculentas variadas en macetas de barro pintadas a mano.", price: 280, stock: 20, material: "Barro cocido" },
          { name: "Cactus San Pedro", description: "Cactus columnar de 30 cm, resistente al sol directo.", price: 220, stock: 2 },
        ],
      },
      {
        name: "Maceteras",
        products: [
          { name: "Macetera de barro grande", description: "Macetera artesanal con drenaje, acabado natural.", price: 400, stock: 8, material: "Barro", dimensions: "35 × 30 cm", weight: 4200 },
        ],
      },
    ],
  },
  {
    owner: { email: "jose@catarina.local", name: "José Martínez", phone: "88882002" },
    slug: "artesanias-el-mirador",
    tradeName: "Artesanías El Mirador",
    category: "artesanias",
    description: "Cerámica, alcancías y hamacas tejidas por artesanos de Catarina y San Juan de Oriente.",
    delivery: true,
    zones: [
      { department_id: 11, municipality_id: null, fee: 70, days: 1 },
      { department_id: 10, municipality_id: null, fee: 150, days: 2 },
    ],
    categories: [
      {
        name: "Alcancías",
        products: [
          { name: "Alcancía de cerdito pintada", description: "Alcancía de barro con motivos florales, pintada a mano.", price: 180, stock: 25, material: "Barro", dimensions: "15 × 12 cm" },
          { name: "Alcancía gallina", description: "Alcancía tradicional en forma de gallina, colores vivos.", price: 220, stock: 0, material: "Barro" },
        ],
      },
      {
        name: "Jarrones",
        products: [
          { name: "Jarrón precolombino", description: "Réplica de diseño precolombino, técnica de San Juan de Oriente.", price: 950, stock: 5, material: "Cerámica", dimensions: "30 cm de alto", weight: 1800 },
        ],
      },
      {
        name: "Hamacas",
        products: [
          { name: "Hamaca matrimonial de algodón", description: "Tejida a mano, colores tierra, incluye cuerdas.", price: 1800, stock: 3, material: "Algodón" },
        ],
      },
    ],
  },
  {
    owner: { email: "ana@catarina.local", name: "Ana Rodríguez", phone: "88882003" },
    slug: "floristeria-la-laguna",
    tradeName: "Floristería La Laguna",
    category: "flores",
    description: "Arreglos florales con flores de los viveros de Catarina. Solo para llevar.",
    delivery: false,
    zones: [],
    categories: [
      {
        name: "Arreglos",
        products: [
          { name: "Ramo de girasoles", description: "Doce girasoles frescos envueltos en papel kraft.", price: 450, stock: 10 },
          { name: "Orquídea en maceta", description: "Orquídea phalaenopsis en maceta de cerámica blanca.", price: 750, stock: 6 },
        ],
      },
    ],
  },
];

async function main() {
  if (!url || !serviceKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  const { data: categories } = await supabase.from("platform_categories").select("id, slug");
  if (!categories?.length) throw new Error("Primero aplica supabase/seed.sql (npm run db:seed).");

  await ensureUser("admin@catarina.local", "Administración Catarina", "admin", "88880000");
  await ensureUser("cliente@catarina.local", "Carlos Cliente", "customer", "88881000");
  for (const [email, name, phone, plate] of COURIERS) {
    const id = await ensureUser(email, name, "courier", phone);
    const { error } = await supabase.from("couriers").upsert({ profile_id: id, vehicle: "moto", plate }, { onConflict: "profile_id" });
    if (error) throw error;
  }

  for (const demo of BUSINESSES) {
    const ownerId = await ensureUser(demo.owner.email, demo.owner.name, "vendor", demo.owner.phone);
    const categoryId = categories.find((c) => c.slug === demo.category)!.id;
    const { data: business, error } = await supabase
      .from("businesses")
      .upsert(
        {
          owner_id: ownerId,
          slug: demo.slug,
          trade_name: demo.tradeName,
          legal_name: demo.owner.name,
          person_type: "natural",
          ruc: `J031000000000${BUSINESSES.indexOf(demo) + 1}`,
          tax_regime: "cuota_fija",
          municipal_license: `MC-${2026}-${100 + BUSINESSES.indexOf(demo)}`,
          category_id: categoryId,
          description: demo.description,
          phone: `+505${demo.owner.phone}`,
          whatsapp: `+505${demo.owner.phone}`,
          ...CATARINA,
          address_line: "Del mirador de Catarina 2 c. al este",
          status: "approved",
          accepts_delivery: demo.delivery,
          accepts_pickup: true,
          accepted_terms_at: new Date().toISOString(),
          accepted_commission_rate: 0.08,
          submitted_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    const businessId = business.id as string;

    await supabase.from("business_hours").upsert(
      [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        business_id: businessId,
        day_of_week: d,
        opens_at: d === 0 ? "09:00" : "07:00",
        closes_at: d === 0 ? "14:00" : "20:00",
        is_closed: false,
      })),
    );
    await supabase.from("business_bank_accounts").upsert({
      business_id: businessId,
      bank_name: "BANPRO",
      account_type: "ahorro",
      currency: "NIO",
      account_number: `1000${demo.owner.phone}`,
      account_holder: demo.owner.name,
    });
    await supabase.from("delivery_zones").delete().eq("business_id", businessId);
    if (demo.zones.length) {
      await supabase.from("delivery_zones").insert(
        demo.zones.map((z) => ({
          business_id: businessId,
          department_id: z.department_id,
          municipality_id: z.municipality_id,
          fee_minor: z.fee * 100,
          estimated_days: z.days,
        })),
      );
    }

    for (const [index, category] of demo.categories.entries()) {
      const { data: cat } = await supabase
        .from("product_categories")
        .upsert({ business_id: businessId, name: category.name, sort_order: index }, { onConflict: "business_id,name" })
        .select("id")
        .single();
      for (const p of category.products) {
        const slug = p.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await supabase.from("products").upsert(
          {
            business_id: businessId,
            category_id: cat?.id,
            name: p.name,
            slug,
            description: p.description,
            material: p.material ?? null,
            dimensions: p.dimensions ?? null,
            weight_grams: p.weight ?? null,
            price_minor: p.price * 100,
            stock: p.stock,
            is_active: true,
          },
          { onConflict: "business_id,slug" },
        );
      }
    }
    console.log(`✓ ${demo.tradeName}`);
  }
  console.log(`\nCuentas demo (contraseña: ${password}):`);
  console.log("  admin@catarina.local · cliente@catarina.local · maria@ / jose@ / ana@catarina.local");
  console.log("  repartidor@catarina.local · repartidor2@catarina.local");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

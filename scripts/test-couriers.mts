// Pruebas del rol repartidor contra la base real, dentro de una transacción que se
// revierte al final: aceptación, límites, privacidad, reasignación y calificación.
import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let fails = 0;

async function as(user: string | null | "service", sql: string, params: unknown[] = []) {
  await c.query("reset role");
  if (user === "service") return c.query(sql, params);
  if (user) {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
  } else {
    await c.query("set local role anon");
    await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
  }
  return c.query(sql, params);
}
async function ok(name: string, fn: () => Promise<unknown>) {
  await c.query("savepoint s");
  try {
    await fn();
    console.log("✓", name);
    await c.query("release savepoint s");
  } catch (e) {
    fails++;
    console.log("✗", name, "→", (e as Error).message);
    await c.query("rollback to savepoint s");
  }
}
async function bad(name: string, fn: () => Promise<unknown>, match: string) {
  await c.query("savepoint s");
  try {
    await fn();
    fails++;
    console.log("✗", name, "→ no falló");
    await c.query("release savepoint s");
  } catch (e) {
    const m = (e as Error).message;
    const pass = m.includes(match);
    if (!pass) fails++;
    console.log(pass ? "✓" : "✗", name, "→", m);
    await c.query("rollback to savepoint s");
  }
}
function expect(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
const one = async (user: string | null | "service", sql: string, params: unknown[] = []) => (await as(user, sql, params)).rows[0];

await c.query("begin");
const ids = Object.fromEntries(
  (
    await c.query(
      "select email, id from profiles where email in ('cliente@catarina.local','admin@catarina.local','maria@catarina.local','repartidor@catarina.local','repartidor2@catarina.local')",
    )
  ).rows.map((r) => [r.email.split("@")[0], r.id]),
);
const { cliente: buyer, admin, maria: vendor, repartidor: rider, repartidor2: rider2 } = ids;
const viv = (await c.query("select id from businesses where slug = 'vivero-los-helechos'")).rows[0].id;
await c.query("update businesses set is_open_override = true, status = 'approved' where id = $1", [viv]);
await c.query("update strikes set voided_at = now() where business_id = $1", [viv]);
await c.query("update products set stock = 50 where business_id = $1", [viv]);
await c.query("update platform_settings set value = '2' where key = 'courier_max_active'");
const product = (await c.query("select id from products where business_id = $1 and is_active and review_status = 'approved' limit 1", [viv])).rows[0];
const address = (
  await c.query(
    "insert into addresses (user_id, label, department_id, municipality_id, address_line, recipient_name, phone) values ($1, 'Casa', 11, 87, 'Del parque 1 c. al norte', 'Carlos Pérez', '+50588881000') returning id",
    [buyer],
  )
).rows[0].id;
const items = JSON.stringify([{ product_id: product.id, quantity: 1 }]);

async function readyOrder() {
  const r = await one(buyer, "select create_order($1, 'delivery', $2, $3::jsonb, 'Carlos', '+50588881000') id", [viv, address, items]);
  const o = await one("service", "select * from orders where id = $1", [r.id]);
  await as("service", "select confirm_order_payment($1, 'mock', 'pi_test', $2)", [o.id, o.total_minor]);
  await as(vendor, "select mark_order_ready($1, $2)", [o.id, `${vendor}/ready/${o.id}.webp`]);
  const s = await one("service", "select id from shipments where order_id = $1", [o.id]);
  return { order: o.id as string, ship: s.id as string };
}
const shipment = (id: string) => one("service", "select * from shipments where id = $1", [id]);
const pinOf = async (id: string) => (await one("service", "select pin from order_secrets where order_id = $1", [id])).pin as string;

await bad(
  "fuera de turno no acepta",
  async () => {
    const { ship } = await readyOrder();
    await as(rider, "select set_courier_online(false)");
    await as(rider, "select accept_shipment($1)", [ship]);
  },
  "Ponte en turno",
);
await ok("en turno ve los disponibles, sin datos del cliente", async () => {
  await readyOrder();
  await as(rider, "select set_courier_online(true, 11.91, -86.07)");
  const list = (await one(rider, "select available_shipments() j")).j as unknown[];
  expect(list.length >= 1, "sin disponibles");
  const text = JSON.stringify(list);
  expect(!text.includes("88881000") && !text.includes("Del parque"), "muestra datos del cliente");
});
await ok("clientes y negocios no ven la lista de disponibles", async () => {
  const a = (await one(buyer, "select available_shipments() j")).j;
  const b = (await one(vendor, "select available_shipments() j")).j;
  expect(a.length === 0 && b.length === 0, `${a.length}/${b.length}`);
});

let first = { order: "", ship: "" };
await ok("dos repartidores aceptan el mismo pedido: solo gana el primero", async () => {
  first = await readyOrder();
  await as(rider2, "select set_courier_online(true)");
  await as(rider, "select accept_shipment($1)", [first.ship]);
  await c.query("savepoint inner_s");
  let lost = "";
  try {
    await as(rider2, "select accept_shipment($1)", [first.ship]);
  } catch (e) {
    lost = (e as Error).message;
  }
  await c.query("rollback to savepoint inner_s");
  expect(lost.includes("Otro repartidor"), "el segundo no falló: " + lost);
  expect((await shipment(first.ship)).courier_id === rider, "dueño incorrecto");
});
await ok("otro repartidor no ve los datos de una entrega ajena", async () => {
  const r = await one(rider2, "select courier_delivery($1) j", [first.ship]);
  expect(r.j === null, "vio la entrega ajena");
});
await bad(
  "otro repartidor no puede recoger una entrega ajena",
  () => as(rider2, "select courier_pickup($1, $2, null)", [first.ship, `${rider2}/p.webp`]),
  "Envío no encontrado",
);
await bad(
  "respeta el límite de entregas activas",
  async () => {
    const second = await readyOrder();
    await as(rider, "select accept_shipment($1)", [second.ship]);
    const third = await readyOrder();
    await as(rider, "select accept_shipment($1)", [third.ship]);
  },
  "entregas activas",
);
await ok("suelta un pedido antes de recogerlo → vuelve a disponibles", async () => {
  const x = await readyOrder();
  await as(rider2, "select accept_shipment($1)", [x.ship]);
  await as(rider2, "select courier_release($1, 'Se me pinchó la llanta')", [x.ship]);
  const s = await shipment(x.ship);
  expect(s.status === "available" && s.courier_id === null, s.status);
});
await bad("solo el admin reasigna", () => as(vendor, "select assign_shipment($1, $2)", [first.order, rider2]), "Solo administradores");
await ok("el admin reasigna antes de la recolección y avisa al anterior", async () => {
  await as(admin, "select assign_shipment($1, $2)", [first.order, rider2]);
  const s = await shipment(first.ship);
  const n = await one("service", "select count(*)::int n from notifications where user_id = $1 and title = 'Envío reasignado'", [rider]);
  expect(s.courier_id === rider2 && s.status === "assigned" && n.n >= 1, JSON.stringify({ s: s.courier_id, n: n.n }));
});
await ok("el cliente ve a su repartidor (con teléfono mientras va en ruta)", async () => {
  const r = (await one(buyer, "select order_courier($1) j", [first.order])).j;
  const other = (await one(vendor, "select order_courier($1) j", [first.order])).j;
  expect(r.name === "Karla Repartidora" && r.phone && r.plate, JSON.stringify(r));
  expect(other !== null, "el negocio no ve al repartidor");
});
await bad("no se califica antes de la entrega", () => as(buyer, "select rate_delivery($1, 5, '{}', null)", [first.order]), "Califica cuando");
await ok("entrega con PIN y el cliente califica → promedio actualizado", async () => {
  await as(rider2, "select courier_pickup($1, $2, null)", [first.ship, `${rider2}/p.webp`]);
  const r = (await one(rider2, "select courier_deliver($1, $2, $3) r", [first.ship, await pinOf(first.order), `${rider2}/d.webp`])).r;
  expect(r === "ok", "entrega " + r);
  await as(buyer, "select rate_delivery($1, 4, '{Amable,Puntual}', 'Muy bien')", [first.order]);
  const cr = await one("service", "select rating_count, rating_avg from couriers where profile_id = $1", [rider2]);
  expect(cr.rating_count >= 1 && Number(cr.rating_avg) > 0, JSON.stringify(cr));
  const after = (await one(buyer, "select order_courier($1) j", [first.order])).j;
  expect(!after.phone, "sigue mostrando el teléfono");
});
await bad("no se califica dos veces", () => as(buyer, "select rate_delivery($1, 1, '{}', null)", [first.order]), "Ya calificaste");
await bad(
  "etiquetas fuera de la lista",
  async () => {
    await as("service", "delete from delivery_ratings where order_id = $1", [first.order]);
    await as(buyer, "select rate_delivery($1, 3, '{Hackeo}', null)", [first.order]);
  },
  "Etiqueta",
);
await ok("admin confirma sin PIN, con motivo y auditado", async () => {
  const x = await readyOrder();
  await as(admin, "select assign_shipment($1, $2)", [x.order, rider2]);
  await as(rider2, "select courier_pickup($1, $2, null)", [x.ship, `${rider2}/p.webp`]);
  await as(admin, "select admin_confirm_delivery($1, 'Cliente sin batería, confirmó por llamada al admin')", [x.order]);
  const o = await one("service", "select status, delivery_method from orders where id = $1", [x.order]);
  const a = await one("service", "select count(*)::int n from audit_logs where action = 'order.confirm_without_pin' and entity_id = $1", [x.order]);
  expect(o.status === "delivered" && o.delivery_method === "admin" && a.n === 1, JSON.stringify(o));
});
await ok("cancelar un pedido cierra su envío y avisa al repartidor", async () => {
  const x = await readyOrder();
  await as(rider2, "select accept_shipment($1)", [x.ship]);
  await as(vendor, "select cancel_order($1, 'Se nos acabó el producto')", [x.order]);
  const s = await shipment(x.ship);
  const n = await one("service", "select count(*)::int n from notifications where user_id = $1 and title = 'Envío cancelado'", [rider2]);
  expect(s.status === "returned" && n.n >= 1, s.status);
});
await ok("alerta de envíos que nadie toma (cron)", async () => {
  const x = await readyOrder();
  await as("service", "update shipments set created_at = now() - interval '1 hour' where id = $1", [x.ship]);
  const n = (await one("service", "select alert_stale_shipments() n")).n;
  expect(n >= 1 && (await shipment(x.ship)).dispatch_alerted_at !== null, "sin alerta");
});
await bad(
  "no se desactiva a un repartidor con entregas activas",
  async () => {
    const x = await readyOrder();
    await as(rider, "select accept_shipment($1)", [x.ship]);
    await as(admin, "select admin_set_courier_active($1, false)", [rider]);
  },
  "Reasigna",
);

await c.query("rollback");
await c.end();
console.log(fails ? `\n${fails} FALLAS` : "\nTodo OK (cambios revertidos)");
process.exit(fails ? 1 : 0);

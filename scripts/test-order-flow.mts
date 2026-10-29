// Pruebas del flujo de pedidos (fases B–E) contra la base real, dentro de una
// transacción que se revierte al final: no deja datos.
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
function expect(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
const one = async (user: string | null | "service", sql: string, params: unknown[] = []) => (await as(user, sql, params)).rows[0];

await c.query("begin");
const ids = Object.fromEntries(
  (await c.query("select email, id from profiles where email in ('cliente@catarina.local','admin@catarina.local','maria@catarina.local','repartidor@catarina.local')")).rows.map(
    (r) => [r.email.split("@")[0], r.id],
  ),
);
const { cliente: buyer, admin, maria: vendor, repartidor: rider } = ids;
await as(rider, "select set_courier_online(true)");
await c.query("reset role");
const viv = (await c.query("select id from businesses where slug = 'vivero-los-helechos'")).rows[0].id;
await c.query("update businesses set is_open_override = true, accepts_pickup = true, status = 'approved' where id = $1", [viv]);
await c.query("update strikes set voided_at = now() where business_id = $1", [viv]);
await c.query("update products set stock = 50 where business_id = $1", [viv]);
const product = (await c.query("select id, price_minor from products where business_id = $1 and is_active and review_status = 'approved' limit 1", [viv])).rows[0];
const address = (
  await c.query(
    "insert into addresses (user_id, label, department_id, municipality_id, address_line, recipient_name, phone) values ($1, 'Casa', 11, 87, 'Del parque 1 c. al norte', 'Carlos', '+50588881000') returning id",
    [buyer],
  )
).rows[0].id;
const items = JSON.stringify([{ product_id: product.id, quantity: 2 }]);

async function newOrder(service: "delivery" | "pickup") {
  const r = await one(buyer, "select create_order($1, $2, $3, $4::jsonb, 'Carlos', '+50588881000') id", [viv, service, service === "delivery" ? address : null, items]);
  const o = await one("service", "select * from orders where id = $1", [r.id]);
  await as("service", "select confirm_order_payment($1, 'mock', 'pi_test', $2)", [o.id, o.total_minor]);
  return o.id as string;
}
const order = (id: string) => one("service", "select * from orders where id = $1", [id]);
const pinOf = async (id: string) => (await one("service", "select pin from order_secrets where order_id = $1", [id])).pin as string;

// --- Delivery completo -----------------------------------------------------------
let d1 = "";
await ok("crea pedido con envío de la plataforma y tarifa de servicio", async () => {
  d1 = await newOrder("delivery");
  const o = await order(d1);
  const sub = product.price_minor * 2;
  expect(o.status === "preparing", "estado " + o.status);
  expect(o.service_fee_minor === 1500, "servicio " + o.service_fee_minor);
  expect(o.delivery_fee_minor === 7000 && o.courier_cost_minor === 5000, `envío ${o.delivery_fee_minor}/${o.courier_cost_minor}`);
  expect(o.total_minor === sub + 7000 + 1500, "total " + o.total_minor);
  expect(o.vendor_net_minor === sub - o.commission_amount_minor, "neto incluye envío");
  expect(o.sla_due_at !== null, "sin plazo de preparación");
});
await ok("solo el cliente ve su PIN", async () => {
  const mine = await as(buyer, "select pin from order_secrets where order_id = $1", [d1]);
  const theirs = await as(vendor, "select pin from order_secrets where order_id = $1", [d1]);
  expect(mine.rowCount === 1 && theirs.rowCount === 0, `cliente ${mine.rowCount} / vendedor ${theirs.rowCount}`);
});
await bad("no se avanza sin evidencia", () => as(vendor, "select transition_order($1, 'ready')", [d1]), "evidencia");
await bad("listo exige foto", () => as(vendor, "select mark_order_ready($1, '')", [d1]), "foto");
await ok("el negocio marca listo con foto", async () => {
  await as(vendor, "select mark_order_ready($1, $2)", [d1, `${vendor}/ready/x.webp`]);
  expect((await order(d1)).status === "ready", "no quedó ready");
});
await bad("el negocio no entrega un delivery con PIN", async () => as(vendor, "select complete_with_pin($1, $2)", [d1, await pinOf(d1)]), "no está listo");
const shipOf = async (id: string) => (await one("service", "select * from shipments where order_id = $1", [id])) as { id: string; status: string; courier_id: string | null };
let ship = "";
await ok("al marcar listo se publica el envío para los repartidores", async () => {
  const s = await shipOf(d1);
  ship = s.id;
  expect(s.status === "available" && s.courier_id === null, "envío " + JSON.stringify(s));
});
await bad("el negocio no acepta envíos", () => as(vendor, "select accept_shipment($1)", [ship]), "Solo los repartidores");
await ok("el repartidor acepta el pedido disponible", async () => {
  await as(rider, "select accept_shipment($1)", [ship]);
  const s = await shipOf(d1);
  expect(s.status === "assigned" && s.courier_id === rider, "envío " + s.status);
});
await ok("ve los datos del cliente mientras la entrega está activa", async () => {
  const r = (await one(rider, "select courier_delivery($1) j", [ship])).j;
  expect(r.active && r.customer.phone === "+50588881000" && r.customer.address_line, "datos " + JSON.stringify(r?.customer));
});
await bad("no entrega antes de recoger", () => as(rider, "select courier_deliver($1, '0000', $2)", [ship, `${rider}/d.webp`]), "recolección");
await bad("recoger exige foto propia", () => as(rider, "select courier_pickup($1, 'otro/p.webp', null)", [ship]), "foto");
await ok("llega al negocio y recoge con foto → en camino", async () => {
  await as(rider, "select courier_arrive($1, 'pickup', 12.0, -86.0)", [ship]);
  await as(rider, "select courier_pickup($1, $2, 'Todo bien', 12.0, -86.0)", [ship, `${rider}/pickup.webp`]);
  expect((await order(d1)).status === "on_the_way", "no quedó en camino");
});
await ok("llega donde el cliente → se le avisa", async () => {
  await as(rider, "select courier_arrive($1, 'dropoff', null, null)", [ship]);
  const n = await one("service", "select count(*)::int n from notifications where user_id = $1 and title = 'Tu repartidor llegó'", [buyer]);
  expect((await shipOf(d1)).status === "at_dropoff" && n.n >= 1, "sin aviso");
});
await ok("PIN incorrecto no entrega", async () => {
  const wrong = (await pinOf(d1)) === "0000" ? "1111" : "0000";
  const r = await one(rider, "select courier_deliver($1, $2, $3) r", [ship, wrong, `${rider}/d.webp`]);
  expect(r.r === "wrong_pin" && (await order(d1)).status === "on_the_way", "resultado " + r.r);
});
await ok("PIN correcto + foto → entregado por el repartidor, sin el negocio", async () => {
  const r = await one(rider, "select courier_deliver($1, $2, $3) r", [ship, await pinOf(d1), `${rider}/d.webp`]);
  const o = await order(d1);
  expect(r.r === "ok" && o.status === "delivered" && o.delivery_method === "pin", "resultado " + r.r);
});
await ok("al terminar se ocultan teléfono y dirección", async () => {
  const r = (await one(rider, "select courier_delivery($1) j", [ship])).j;
  expect(!r.active && !r.customer.phone && !r.customer.address_line, JSON.stringify(r.customer));
});

// --- Reclamo -------------------------------------------------------------------
let claim = "";
await bad("reclamo con daño exige foto", () => as(buyer, "select open_claim($1, 'damaged', 'Llegó roto el macetero', '{}')", [d1]), "foto");
await ok("cliente reclama 'no lo recibí' → marcado porque hubo PIN", async () => {
  claim = (await one(buyer, "select open_claim($1, 'not_received', 'No me llegó nada a la casa', '{}') id", [d1])).id;
  const cl = await one("service", "select flags from claims where id = $1", [claim]);
  expect(cl.flags.some((f: string) => f.includes("PIN")), "sin alerta de PIN");
  expect((await order(d1)).status === "disputed", "no quedó en reclamo");
});
await ok("admin aprueba 50 % a cargo del negocio → ajuste, falta y reembolso en cola", async () => {
  const o = await order(d1);
  const half = Math.round(o.subtotal_minor / 2);
  await as(admin, "select resolve_claim($1, true, $2, 'business', 'Fotos muestran la maceta rota')", [claim, half]);
  const after = await order(d1);
  const ledger = (await as("service", "select kind, amount_minor from ledger_entries where order_id = $1 order by id", [d1])).rows;
  const refunds = (await as("service", "select amount_minor, status from refunds where order_id = $1", [d1])).rows;
  const strikes = await one("service", "select count(*)::int n from strikes where business_id = $1 and voided_at is null", [viv]);
  expect(after.status === "completed", "estado " + after.status);
  expect(ledger.map((l) => l.kind).join() === "sale,commission,adjustment", "libro " + JSON.stringify(ledger));
  expect(ledger[2].amount_minor === -half, "ajuste " + ledger[2].amount_minor);
  expect(refunds.length === 1 && refunds[0].status === "pending" && refunds[0].amount_minor === half, "reembolso " + JSON.stringify(refunds));
  expect(strikes.n === 1, "faltas " + strikes.n);
});
await ok("el servidor procesa el reembolso → parcialmente reembolsado", async () => {
  const r = await one("service", "select id from refunds where order_id = $1", [d1]);
  await as("service", "select complete_refund($1, 're_test')", [r.id]);
  expect((await order(d1)).payment_status === "partially_refunded", "pago no parcial");
});

// --- Retiro en el negocio -------------------------------------------------------
let p1 = "";
await ok("retiro: listo con foto → listo para retirar", async () => {
  p1 = await newOrder("pickup");
  await as(vendor, "select mark_order_ready($1, $2)", [p1, `${vendor}/ready/p.webp`]);
  const o = await order(p1);
  expect(o.status === "ready_for_pickup" && o.delivery_fee_minor === 0, "estado " + o.status);
});
await ok("PIN equivocado 5 veces → bloqueado", async () => {
  const wrong = (await pinOf(p1)) === "9999" ? "8888" : "9999";
  let last = "";
  for (let i = 0; i < 5; i++) last = (await one(vendor, "select complete_with_pin($1, $2) r", [p1, wrong])).r;
  const right = (await one(vendor, "select complete_with_pin($1, $2) r", [p1, await pinOf(p1)])).r;
  expect(last === "locked" && right === "locked", `${last} / ${right}`);
});

let p2 = "";
await ok("retiro con PIN correcto → entregado", async () => {
  p2 = await newOrder("pickup");
  await as(vendor, "select mark_order_ready($1, $2)", [p2, `${vendor}/ready/p2.webp`]);
  const r = (await one(vendor, "select complete_with_pin($1, $2) r", [p2, await pinOf(p2)])).r;
  expect(r === "ok" && (await order(p2)).status === "delivered", "resultado " + r);
});

// --- Fallas y cierre automático ------------------------------------------------
async function riderTakes(id: string) {
  const sid = (await shipOf(id)).id;
  await as(rider, "select accept_shipment($1)", [sid]);
  return sid;
}
await ok("entrega fallida 2 veces → devuelto, reembolso solo de productos", async () => {
  const d2 = await newOrder("delivery");
  await as(vendor, "select mark_order_ready($1, $2)", [d2, `${vendor}/ready/d2.webp`]);
  const t = await riderTakes(d2);
  await as(rider, "select courier_pickup($1, $2, null)", [t, `${rider}/p.webp`]);
  const first = (await one(rider, "select courier_fail($1, 'Nadie en casa') r", [t])).r;
  const second = (await one(rider, "select courier_fail($1, 'Teléfono apagado') r", [t])).r;
  const o = await order(d2);
  const r = await one("service", "select amount_minor, responsible from refunds where order_id = $1", [d2]);
  expect(first === "retry" && second === "returned" && o.status === "returned", `${first}/${second}/${o.status}`);
  expect(r.amount_minor === o.subtotal_minor && r.responsible === "customer", "reembolso " + JSON.stringify(r));
});
await ok("repartidor rechaza en la recolección → cancelado, reembolso total y falta", async () => {
  const d3 = await newOrder("delivery");
  await as(vendor, "select mark_order_ready($1, $2)", [d3, `${vendor}/ready/d3.webp`]);
  const t = await riderTakes(d3);
  await as(rider, "select courier_reject($1, 'La planta está seca, no coincide con la foto', $2)", [t, `${rider}/r.webp`]);
  const o = await order(d3);
  const r = await one("service", "select amount_minor from refunds where order_id = $1", [d3]);
  const s = await one("service", "select count(*)::int n from strikes where business_id = $1 and voided_at is null", [viv]);
  expect(o.status === "cancelled" && r.amount_minor === o.total_minor && s.n === 2, `${o.status}/${r.amount_minor}/${s.n}`);
  expect((await shipOf(d3)).status === "rejected", "envío no quedó rechazado");
});
await ok("ventana de reclamo vencida → completado y acreditado (cron)", async () => {
  await as("service", "update orders set delivered_at = now() - interval '49 hours' where id = $1", [p2]);
  const r = (await one("service", "select run_order_maintenance() r")).r;
  const ledger = await one("service", "select count(*)::int n from ledger_entries where order_id = $1", [p2]);
  expect(r.completed >= 1 && (await order(p2)).status === "completed" && ledger.n === 2, JSON.stringify(r));
});
await ok("vence el plazo de preparación → cancelado, falta y suspensión automática (3 faltas)", async () => {
  const late = await newOrder("delivery");
  await as("service", "update orders set sla_due_at = now() - interval '1 minute' where id = $1", [late]);
  await as("service", "select run_order_maintenance()");
  const o = await order(late);
  const b = await one("service", "select status from businesses where id = $1", [viv]);
  expect(o.status === "cancelled", "estado " + o.status);
  expect(b.status === "suspended", "negocio " + b.status);
});
await ok("el vendedor ve sus faltas y su libro; otro usuario no", async () => {
  const mine = await one(vendor, "select count(*)::int n from strikes where business_id = $1", [viv]);
  const other = await one(buyer, "select count(*)::int n from ledger_entries where business_id = $1", [viv]);
  expect(mine.n >= 3 && other.n === 0, `${mine.n}/${other.n}`);
});
await ok("liquidación usa el libro (venta − comisión − ajustes)", async () => {
  await as("service", "update ledger_entries set available_at = now() - interval '1 day' where business_id = $1", [viv]);
  const expected = await one("service", "select sum(amount_minor)::int n from ledger_entries where business_id = $1 and payout_id is null", [viv]);
  await as(admin, "select generate_payouts(current_date - 30, current_date)");
  const p = await one("service", "select net_minor, adjustments_minor from payouts where business_id = $1 and period_end = current_date", [viv]);
  expect(p && p.net_minor === expected.n && p.adjustments_minor < 0, JSON.stringify({ p, expected }));
});
await ok("ganancia de la plataforma", async () => {
  const r = (await one(admin, "select platform_profit(current_date - 1, current_date) r")).r;
  console.log("   ", r);
  expect(r.orders >= 5 && "net" in r, "sin datos");
});
await ok("estadísticas públicas del negocio", async () => {
  const r = await one(null, "select * from business_public_stats($1)", [viv]);
  expect(r.completed_orders >= 1, JSON.stringify(r));
});

await c.query("rollback");
await c.end();
console.log(fails ? `\n${fails} FALLAS` : "\nTodo OK (cambios revertidos)");
process.exit(fails ? 1 : 0);

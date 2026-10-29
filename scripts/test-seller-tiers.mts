import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let fails = 0;
const ids = Object.fromEntries((await c.query("select email, id from profiles where email in ('cliente@catarina.local','admin@catarina.local')")).rows.map((r) => [r.email.split("@")[0], r.id]));
async function as(user: string | null, sql: string, params: unknown[] = []) {
  await c.query("reset role");
  if (user) {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
  } else {
    await c.query("set local role anon");
    await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)");
  }
  return c.query(sql, params);
}
async function expectOk(name: string, fn: () => Promise<unknown>) {
  await c.query("savepoint s");
  try { await fn(); console.log("✓", name); await c.query("release savepoint s"); }
  catch (e) { fails++; console.log("✗", name, "→", (e as Error).message); await c.query("rollback to savepoint s"); }
}
async function expectFail(name: string, fn: () => Promise<unknown>, match: string) {
  await c.query("savepoint s");
  try { await fn(); fails++; console.log("✗", name, "→ no falló"); await c.query("release savepoint s"); }
  catch (e) { const m = (e as Error).message; const ok = m.includes(match); if (!ok) fails++; console.log(ok ? "✓" : "✗", name, "→", m); await c.query("rollback to savepoint s"); }
}
await c.query("begin");
const cli = ids.cliente, adm = ids.admin;
let biz = "";
await expectOk("cliente crea negocio informal", async () => {
  const r = await as(cli, "insert into businesses (owner_id, slug, trade_name, tier, verification_visit_at) values ($1, 'prueba-informal-x', 'Vivero Prueba', 'informal', now()) returning id, status, verification_visit_at", [cli]);
  biz = r.rows[0].id;
  if (r.rows[0].verification_visit_at !== null) throw new Error("se coló la visita");
});
await expectFail("no puede marcarse la visita", () => as(cli, "update businesses set verification_visit_at = now() where id = $1", [biz]), "administración");
await expectOk("completa datos del local", () => as(cli, "update businesses set legal_name='María Prueba', category_id=(select min(id) from platform_categories), department_id=11, municipality_id=84, address_line='Del mirador 2c al sur', phone='+50588887777', accepted_terms_at=now(), declaration_accepted_at=now() where id=$1", [biz]));
await expectFail("enviar sin ubicación", async () => {
  await as(cli, "insert into business_documents (business_id, doc_type, file_path) select $1, d, $2 || '/docs/' || d from unnest(array['cedula_front','cedula_back','selfie_cedula','place_photo_1','place_photo_2']) d", [biz, cli]);
  await as(cli, "insert into business_bank_accounts (business_id, bank_name, account_type, currency, account_number, account_holder) values ($1,'BANPRO','ahorro','NIO','123456789','María Prueba')", [biz]);
  await as(cli, "select submit_business_application($1)", [biz]);
}, "ubicación");
await expectOk("guarda su ubicación privada", () => as(cli, "insert into business_private (business_id, latitude, longitude, visit_notes) values ($1, 11.91, -86.07, 'yo mismo')", [biz]));
await expectOk("no puede escribir notas de visita", async () => {
  const r = await as(cli, "select visit_notes from business_private where business_id=$1", [biz]);
  if (r.rows[0].visit_notes !== null) throw new Error("se coló la nota");
});
await expectOk("el público no ve la ubicación", async () => {
  const r = await as(null, "select count(*)::int n from business_private where business_id=$1", [biz]);
  if (r.rows[0].n !== 0) throw new Error("visible");
});
await expectOk("cuenta bancaria", () => as(cli, "insert into business_bank_accounts (business_id, bank_name, account_type, currency, account_number, account_holder) values ($1,'BANPRO','ahorro','NIO','123456789','María Prueba')", [biz]));
await expectFail("enviar sin documentos", () => as(cli, "select submit_business_application($1)", [biz]), "documentos");
await expectOk("sube documentos de informal", () => as(cli, "insert into business_documents (business_id, doc_type, file_path) select $1, d, $2 || '/docs/' || d from unnest(array['cedula_front','cedula_back','selfie_cedula','place_photo_1','place_photo_2']) d", [biz, cli]));
await expectOk("envía la solicitud", () => as(cli, "select submit_business_application($1)", [biz]));
await expectFail("no cambia documentos en revisión", () => as(cli, "update business_documents set file_path = file_path || 'x' where business_id = $1", [biz]), "no se pueden cambiar");
await expectFail("admin no aprueba sin visita", () => as(adm, "select review_business_application($1, 'approved')", [biz]), "visita");
await expectFail("cliente no registra visita", () => as(cli, "select record_verification_visit($1, 'visité el lugar y todo bien')", [biz]), "Solo administradores");
await expectOk("admin registra visita", () => as(adm, "select record_verification_visit($1, 'Lugar existe, plantas coinciden con fotos')", [biz]));
await expectOk("admin aprueba", () => as(adm, "select review_business_application($1, 'approved')", [biz]));
await expectFail("vendedor no cambia su nivel", () => as(cli, "update businesses set tier='formal' where id=$1", [biz]), "formalización");
await expectFail("vendedor no mueve su ubicación verificada", () => as(cli, "update business_private set latitude = 12 where business_id=$1", [biz]), "administración");
await expectFail("vendedor no cambia el RUC directo", () => as(cli, "update businesses set ruc='J0310000000009' where id=$1", [biz]), "administración");
await expectFail("no reemplaza su cédula aprobada", () => as(cli, "insert into business_documents (business_id, doc_type, file_path) values ($1,'cedula_front',$2) on conflict (business_id, doc_type) do update set file_path = excluded.file_path", [biz, cli + "/x"]), "no se pueden cambiar");
await expectOk("sube RUC y matrícula para formalizar", () => as(cli, "insert into business_documents (business_id, doc_type, file_path) values ($1,'ruc',$2),($1,'municipal_license',$2)", [biz, cli + "/docs/r"]));
await expectOk("solicita formalización", () => as(cli, "select request_formal_upgrade($1,'natural','J0310000000009','cuota_fija','MC-1')", [biz]));
await expectOk("admin aprueba formalización", async () => {
  await as(adm, "select review_formal_upgrade($1, true)", [biz]);
  const r = await as(adm, "select tier from businesses where id=$1", [biz]);
  if (r.rows[0].tier !== "formal") throw new Error("no cambió a formal");
});
let prod = "";
await expectOk("producto nuevo queda en revisión", async () => {
  const r = await as(cli, "insert into products (business_id, name, slug, price_minor, stock, review_status) values ($1,'Helecho prueba','helecho-prueba',15000,5,'approved') returning id, review_status", [biz]);
  prod = r.rows[0].id;
  if (r.rows[0].review_status !== "pending") throw new Error("quedó " + r.rows[0].review_status);
});
await expectOk("el público no ve el producto en revisión", async () => {
  const r = await as(null, "select count(*)::int n from products where id=$1", [prod]);
  if (r.rows[0].n !== 0) throw new Error("visible");
});
await expectFail("vendedor no se autoaprueba", () => as(cli, "update products set review_status='approved' where id=$1", [prod]), "administración");
await expectOk("admin aprueba el producto y se ve", async () => {
  await as(adm, "select review_product($1, true)", [prod]);
  const r = await as(null, "select count(*)::int n from products where id=$1", [prod]);
  if (r.rows[0].n !== 1) throw new Error("no visible");
});
await expectOk("límites por nivel", async () => {
  const r = await as(cli, "select * from my_business_limits()");
  console.log("   ", r.rows[0]);
  if (r.rows[0].max_active !== 30) throw new Error("formal debería tener 30");
});
const viv = (await c.query("select id from businesses where slug='vivero-los-helechos'")).rows[0].id;
const vp = (await c.query("select id from products where business_id=$1 and is_active and stock>0 and review_status='approved' limit 1", [viv])).rows[0].id;
await c.query("reset role");
await c.query("update businesses set is_open_override = true where id=$1", [viv]);
const buyer = (await c.query("select id from profiles where role='customer' and id <> $1 and phone is not null limit 1", [cli])).rows[0].id;
const order = (items: string) => as(buyer, "select create_order($1, 'pickup', null, $2::jsonb, 'Carlos', '+50588881000')", [viv, items]);
await expectOk("pedido normal dentro del límite", () => order(JSON.stringify([{ product_id: vp, quantity: 1 }])));
await c.query("reset role");
await c.query("update platform_settings set value='0' where key='formal_max_active_orders'");
await expectFail("límite de pedidos activos", () => order(JSON.stringify([{ product_id: vp, quantity: 1 }])), "muchos pedidos");
await c.query("reset role");
await c.query("update platform_settings set value='30' where key='formal_max_active_orders'");
await c.query("update products set review_status='pending' where id=$1", [vp]);
await expectFail("no se compra un producto en revisión", () => order(JSON.stringify([{ product_id: vp, quantity: 1 }])), "no está disponible");
await c.query("rollback");
await c.end();
console.log(fails ? `\n${fails} FALLAS` : "\nTodo OK (cambios revertidos)");
process.exit(fails ? 1 : 0);

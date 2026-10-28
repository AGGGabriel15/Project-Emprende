/**
 * Aplica supabase/migrations/*.sql y supabase/seed.sql contra DATABASE_URL.
 * Registra cada migración en supabase_migrations.schema_migrations, la misma
 * tabla que usa la CLI de Supabase, así `supabase db push` no las repite.
 *
 *   npm run db:migrate   # migraciones pendientes
 *   npm run db:seed      # datos base (idempotente)
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const root = path.resolve(__dirname, "..", "supabase");

async function main() {
  const command = process.argv[2] ?? "migrate";
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Falta DATABASE_URL en .env.local (Supabase → Project Settings → Database → Connection string, modo Session).",
    );
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    if (command === "migrate") await migrate(client);
    else if (command === "seed") await seed(client);
    else throw new Error(`Comando desconocido: ${command}`);
  } finally {
    await client.end();
  }
}

async function migrate(client: Client) {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );
  `);
  const { rows } = await client.query<{ version: string }>(
    "select version from supabase_migrations.schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.version));
  const files = readdirSync(path.join(root, "migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    const sql = readFileSync(path.join(root, "migrations", file), "utf8");
    process.stdout.write(`→ ${file} … `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
        [version, rest.join("_"), [sql]],
      );
      await client.query("commit");
      console.log("ok");
    } catch (error) {
      await client.query("rollback");
      console.log("error");
      throw error;
    }
  }
  console.log("Migraciones al día.");
}

async function seed(client: Client) {
  const sql = readFileSync(path.join(root, "seed.sql"), "utf8");
  await client.query(sql);
  console.log("Seed aplicado.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

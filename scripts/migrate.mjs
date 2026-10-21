// Applique db/schema.sql sur DATABASE_URL (instructions idempotentes).
import { readFileSync, existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL manquant"); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await pool.query(sql);
const { rows } = await pool.query("select table_name from information_schema.tables where table_schema='public' order by 1");
console.log("Tables :", rows.map(r => r.table_name).join(", "));
await pool.end();

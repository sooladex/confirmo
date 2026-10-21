import "server-only";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import path from "node:path";

type Row = Record<string, any>;
type Runner = (text: string, params?: unknown[]) => Promise<Row[]>;

let runner: Promise<Runner> | null = null;

/**
 * DATABASE_URL=postgresql://…  → Neon (HTTP, adapté au serverless Vercel)
 * DATABASE_URL=pglite:./.pglite → Postgres embarqué, pour les tests locaux uniquement
 */
async function makeRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");

  if (url.startsWith("pglite:")) {
    const mod = "@electric-sql/pglite";
    const { PGlite } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ mod);
    const db = new PGlite(url.slice("pglite:".length) || undefined);
    await db.exec(readFileSync(path.join(process.cwd(), "db/schema.sql"), "utf8"));
    return async (text, params = []) => (await db.query(text, params)).rows as Row[];
  }

  const sql = neon(url);
  return async (text, params = []) => (await sql.query(text, params)) as Row[];
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!runner) runner = makeRunner();
  return (await (await runner)(text, params)) as T[];
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}

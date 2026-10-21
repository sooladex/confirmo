import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { bad, body, sameOrigin } from "@/lib/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const b = await body<{ email?: string; password?: string; shop?: string }>(req);
  const email = String(b?.email ?? "").trim().toLowerCase();
  const password = String(b?.password ?? "");
  const shop = String(b?.shop ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Adresse e-mail invalide.");
  if (password.length < 8) return bad("Le mot de passe doit contenir au moins 8 caractères.");
  if (!shop) return bad("Indiquez le nom de votre boutique.");

  const hash = await bcrypt.hash(password, 10);
  const user = await one<{ id: string }>(
    `with u as (insert into users (email, password_hash) values ($1, $2) on conflict (email) do nothing returning id),
          s as (insert into shops (user_id, name, webhook_token) select id, $3, $4 from u returning id)
     select u.id from u, s`,
    [email, hash, shop, randomBytes(18).toString("base64url")],
  );
  if (!user) return bad("Un compte existe déjà avec cette adresse. Connectez-vous.", 409);
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}

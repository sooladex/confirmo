import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { bad, body, sameOrigin } from "@/lib/http";

// Hash factice pour garder un temps de réponse constant quand l'e-mail n'existe pas.
const DUMMY = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.6kzvYQbYdYc7sQe8n5Fh8oA5Zl1u";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const b = await body<{ email?: string; password?: string }>(req);
  const email = String(b?.email ?? "").trim().toLowerCase();
  const password = String(b?.password ?? "");
  const user = await one<{ id: string; password_hash: string }>(
    "select id, password_hash from users where email = $1", [email]);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY);
  if (!user || !ok) return bad("E-mail ou mot de passe incorrect.", 401);
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}

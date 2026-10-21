import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { q } from "@/lib/db";
import { bad, sameOrigin } from "@/lib/http";

/** Génère une nouvelle adresse de réception ; l'ancienne cesse de fonctionner. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const token = randomBytes(18).toString("base64url");
  await q("update shops set webhook_token = $2 where id = $1", [s.shop.id, token]);
  return NextResponse.json({ webhook_token: token });
}

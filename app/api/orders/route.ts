import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { cleanIncoming } from "@/lib/domain";
import { bad, body, sameOrigin } from "@/lib/http";
import { insertOrders } from "@/lib/orders";

/** Ajout manuel d'une commande. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const o = cleanIncoming((await body(req)) ?? {});
  if (!o) return bad("Indiquez au moins un nom ou un téléphone.");
  const n = await insertOrders(s.shop.id, [o], "manuel");
  return NextResponse.json({ inserted: n });
}

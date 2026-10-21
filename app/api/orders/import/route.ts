import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { cleanIncoming, type IncomingOrder } from "@/lib/domain";
import { bad, body, sameOrigin } from "@/lib/http";
import { insertOrders } from "@/lib/orders";

/** Import d'un lot de lignes déjà analysées par le navigateur (CSV). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const b = await body<{ rows?: unknown[] }>(req);
  if (!Array.isArray(b?.rows)) return bad("Aucune ligne reçue.");
  if (b.rows.length > 2000) return bad("2 000 lignes maximum par import. Découpez le fichier.");
  const rows = b.rows.map((r) => cleanIncoming((r ?? {}) as any)).filter(Boolean) as IncomingOrder[];
  const n = await insertOrders(s.shop.id, rows, "import");
  return NextResponse.json({ inserted: n, skipped: b.rows.length - n });
}

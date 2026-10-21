import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { q } from "@/lib/db";
import { bad, sameOrigin } from "@/lib/http";

/** Passe toutes les commandes confirmées en « expédiée ». */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const r = await q<{ n: number }>(
    `with u as (update orders set status = 'expediee', updated_at = now() where shop_id = $1 and status = 'confirmee' returning id),
          e as (insert into order_events (order_id, status) select id, 'expediee' from u returning 1)
     select count(*)::int as n from u`,
    [s.shop.id],
  );
  return NextResponse.json({ shipped: r[0]?.n ?? 0 });
}

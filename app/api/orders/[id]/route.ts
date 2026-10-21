import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { NEXT, STATUSES, type Status } from "@/lib/domain";
import { bad, body, sameOrigin } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

/** Changement de statut, limité aux transitions autorisées. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!UUID.test(id)) return bad("Commande introuvable.", 404);
  const b = await body<{ status?: string }>(req);
  const to = b?.status as Status;
  if (!to || !(to in STATUSES)) return bad("Statut inconnu.");
  const cur = await one<{ status: Status }>("select status from orders where id = $1 and shop_id = $2", [id, s.shop.id]);
  if (!cur) return bad("Commande introuvable.", 404);
  if (!NEXT[cur.status].includes(to)) return bad(`Impossible de passer de « ${STATUSES[cur.status].label} » à « ${STATUSES[to].label} ».`, 409);
  await q(
    `with u as (update orders set status = $3, updated_at = now() where id = $1 and shop_id = $2 and status = $4 returning id)
     insert into order_events (order_id, status) select id, $3 from u`,
    [id, s.shop.id, to, cur.status],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!UUID.test(id)) return bad("Commande introuvable.", 404);
  await q("delete from orders where id = $1 and shop_id = $2", [id, s.shop.id]);
  return NextResponse.json({ ok: true });
}

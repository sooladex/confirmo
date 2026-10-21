import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { q } from "@/lib/db";
import { bad, sameOrigin } from "@/lib/http";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("Entrée introuvable.", 404);
  await q("delete from blacklist where id = $1 and shop_id = $2", [id, s.shop.id]);
  return NextResponse.json({ ok: true });
}

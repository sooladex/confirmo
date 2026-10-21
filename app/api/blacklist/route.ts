import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { q } from "@/lib/db";
import { normPhone } from "@/lib/domain";
import { bad, body, sameOrigin } from "@/lib/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const b = await body<{ phone?: string; note?: string }>(req);
  const p = normPhone(b?.phone);
  if (!/^212\d{9}$/.test(p)) return bad("Numéro invalide : utilisez le format 06XXXXXXXX.");
  await q(
    `insert into blacklist (shop_id, phone_norm, note) values ($1, $2, $3)
     on conflict (shop_id, phone_norm) do update set note = excluded.note`,
    [s.shop.id, p, String(b?.note ?? "").trim().slice(0, 200)],
  );
  return NextResponse.json({ ok: true });
}

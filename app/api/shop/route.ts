import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { q } from "@/lib/db";
import { bad, body, sameOrigin } from "@/lib/http";

const int = (v: unknown, max = 100000) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return bad("Origine refusée", 403);
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const b = (await body<any>(req)) ?? {};
  const name = String(b.name ?? s.shop.name).trim().slice(0, 80);
  const vals = [b.ship_fee, b.return_fee, b.ad_cost, b.high_amount].map((v, i) =>
    int(v ?? [s.shop.ship_fee, s.shop.return_fee, s.shop.ad_cost, s.shop.high_amount][i]));
  if (!name) return bad("Le nom de la boutique est obligatoire.");
  if (vals.some((v) => v === null)) return bad("Les montants doivent être des nombres positifs.");
  const cities = String(b.risky_cities ?? s.shop.risky_cities).slice(0, 500);
  await q(
    `update shops set name=$2, ship_fee=$3, return_fee=$4, ad_cost=$5, high_amount=$6, risky_cities=$7 where id=$1`,
    [s.shop.id, name, ...vals, cities],
  );
  return NextResponse.json({ ok: true });
}

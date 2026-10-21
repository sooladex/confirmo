import { NextResponse } from "next/server";
import { requireApi } from "@/lib/auth";
import { q } from "@/lib/db";
import { loadOrders } from "@/lib/orders";

export async function GET() {
  const s = await requireApi();
  if (s instanceof NextResponse) return s;
  const [orders, blacklist] = await Promise.all([
    loadOrders(s.shop.id),
    q("select id, phone_norm, note from blacklist where shop_id = $1 order by created_at desc", [s.shop.id]),
  ]);
  return NextResponse.json({ email: s.email, shop: s.shop, orders, blacklist });
}

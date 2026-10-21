import "server-only";
import { q } from "./db";
import { normPhone, type IncomingOrder, type Order } from "./domain";

/**
 * Insère des commandes pour une boutique en une seule requête :
 * réserve un bloc de références (CM-1001…), insère les lignes, crée l'événement « nouvelle ».
 * Les commandes dont l'external_id existe déjà sont ignorées (webhooks rejoués).
 */
export async function insertOrders(shopId: string, rows: IncomingOrder[], source: string): Promise<number> {
  if (!rows.length) return 0;
  const data = JSON.stringify(
    rows.map((r) => ({ ...r, phone_norm: normPhone(r.phone), external_id: r.external_id ?? null })),
  );
  const res = await q<{ n: number }>(
    `with seq as (
       update shops set order_seq = order_seq + $3 where id = $1 returning order_seq - $3 as base
     ),
     src as (
       select x.*, row_number() over () as rn
         from jsonb_to_recordset($2::jsonb) as x(name text, phone text, phone_norm text, city text, address text, product text, amount int, external_id text)
         where x.external_id is null
            or not exists (select 1 from orders o where o.shop_id = $1 and o.external_id = x.external_id)
     ),
     ins as (
       insert into orders (shop_id, ref, name, phone, phone_norm, city, address, product, amount, source, external_id)
       select $1, 'CM-' || (seq.base + src.rn), src.name, src.phone, src.phone_norm, src.city, src.address, src.product, src.amount, $4, src.external_id
         from src, seq
       on conflict do nothing
       returning id
     ),
     ev as (insert into order_events (order_id, status) select id, 'nouvelle' from ins returning 1)
     select count(*)::int as n from ins`,
    [shopId, data, rows.length, source],
  );
  return res[0]?.n ?? 0;
}

export async function loadOrders(shopId: string): Promise<Order[]> {
  const rows = await q<any>(
    `select o.id, o.ref, o.name, o.phone, o.phone_norm, o.city, o.address, o.product, o.amount, o.status, o.source,
            o.created_at,
            coalesce((select json_agg(json_build_object('status', e.status, 'at', e.created_at) order by e.created_at)
                        from order_events e where e.order_id = o.id), '[]'::json) as events
       from orders o where o.shop_id = $1
      order by o.created_at desc
      limit 3000`,
    [shopId],
  );
  return rows.map((r) => ({
    ...r,
    created_at: new Date(r.created_at).toISOString(),
    events: (typeof r.events === "string" ? JSON.parse(r.events) : r.events).map((e: any) => ({
      status: e.status,
      at: new Date(e.at).toISOString(),
    })),
  }));
}

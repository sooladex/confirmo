import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { cleanIncoming, type IncomingOrder } from "@/lib/domain";
import { insertOrders } from "@/lib/orders";

/**
 * Adresse de réception des commandes d'une boutique (publique, protégée par le jeton secret).
 * Accepte :
 *  - JSON simple : { name, phone, city, address, product, amount, id? } ou un tableau de ces objets ;
 *  - une commande Shopify (webhook « Order creation ») ;
 *  - un formulaire HTML (application/x-www-form-urlencoded) avec les mêmes champs, par ex. une landing page.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const s = (v: unknown) => (v == null ? "" : String(v)).trim();

function fromShopify(o: any): IncomingOrder | null {
  const a = o.shipping_address ?? o.billing_address ?? {};
  const name = s(a.name) || [s(a.first_name), s(a.last_name)].filter(Boolean).join(" ") ||
    [s(o.customer?.first_name), s(o.customer?.last_name)].filter(Boolean).join(" ");
  const items = Array.isArray(o.line_items) ? o.line_items : [];
  return cleanIncoming({
    name,
    phone: s(a.phone) || s(o.phone) || s(o.customer?.phone),
    city: s(a.city),
    address: [s(a.address1), s(a.address2)].filter(Boolean).join(", "),
    product: items.map((i: any) => `${s(i.title || i.name)}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(" + "),
    amount: o.total_price ?? o.current_total_price,
    external_id: o.id != null ? `shopify:${o.id}` : null,
  });
}

function fromGeneric(o: any): IncomingOrder | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = k.split(".").reduce((x: any, p) => (x == null ? x : x[p]), o);
      if (v != null && s(v)) return s(v);
    }
    return "";
  };
  return cleanIncoming({
    name: pick("name", "nom", "full_name", "fullname", "customer.full_name", "customer.name", "client"),
    phone: pick("phone", "telephone", "téléphone", "tel", "mobile", "customer.phone"),
    city: pick("city", "ville", "shipping.city", "address.city", "customer.city"),
    address: pick("address", "adresse", "address1", "shipping.address", "address.line1", "customer.address"),
    product: pick("product", "produit", "article", "item", "product_name"),
    amount: pick("amount", "montant", "total", "price", "prix"),
    external_id: pick("id", "order_id", "reference") || null,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.json({ error: "Adresse inconnue" }, { status: 404, headers: CORS });
  if (Number(req.headers.get("content-length") ?? 0) > 200_000)
    return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413, headers: CORS });

  const shop = await one<{ id: string }>("select id from shops where webhook_token = $1", [token]);
  if (!shop) return NextResponse.json({ error: "Adresse inconnue" }, { status: 404, headers: CORS });

  const type = req.headers.get("content-type") ?? "";
  const isForm = type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data");
  let payload: any;
  try {
    payload = isForm ? Object.fromEntries((await req.formData()).entries()) : await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible : envoyez du JSON ou un formulaire" }, { status: 400, headers: CORS });
  }

  const list: any[] = Array.isArray(payload) ? payload.slice(0, 200) : [payload];
  const isShopify = !!req.headers.get("x-shopify-topic");
  const rows = list
    .map((o) => (o && typeof o === "object" ? (isShopify || o.line_items ? fromShopify(o) : fromGeneric(o)) : null))
    .filter(Boolean) as IncomingOrder[];
  if (!rows.length) return NextResponse.json({ error: "Aucune commande reconnue (nom ou téléphone requis)" }, { status: 422, headers: CORS });

  const source = isShopify ? "shopify" : isForm ? "formulaire" : "api";
  const inserted = await insertOrders(shop.id, rows, source);

  if (isForm && (req.headers.get("accept") ?? "").includes("text/html")) {
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commande reçue</title><body style="font-family:system-ui;max-width:32rem;margin:15vh auto;padding:0 16px;text-align:center"><h1>Merci, votre commande est enregistrée.</h1><p>Nous vous contactons sur WhatsApp pour la confirmer.</p></body>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } },
    );
  }
  return NextResponse.json({ received: rows.length, inserted }, { status: 201, headers: CORS });
}

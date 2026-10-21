// Logique métier partagée entre le serveur et le navigateur.

export const STATUSES = {
  nouvelle: { label: "Nouvelle", color: "var(--info)" },
  envoye: { label: "Message envoyé", color: "var(--teal)" },
  confirmee: { label: "Confirmée", color: "var(--ok)" },
  injoignable: { label: "Injoignable", color: "var(--warn)" },
  annulee: { label: "Annulée", color: "var(--muted)" },
  expediee: { label: "Expédiée", color: "var(--info)" },
  livree: { label: "Livrée", color: "var(--ok)" },
  retournee: { label: "Retournée", color: "var(--bad)" },
} as const;

export type Status = keyof typeof STATUSES;
export const STATUS_KEYS = Object.keys(STATUSES) as Status[];

/** Transitions autorisées depuis chaque statut. */
export const NEXT: Record<Status, Status[]> = {
  nouvelle: ["envoye", "confirmee", "annulee"],
  envoye: ["confirmee", "injoignable", "annulee"],
  injoignable: ["envoye", "confirmee", "annulee"],
  confirmee: ["expediee", "annulee"],
  expediee: ["livree", "retournee"],
  annulee: ["nouvelle"],
  livree: [],
  retournee: [],
};

export type Order = {
  id: string;
  ref: string;
  name: string;
  phone: string;
  phone_norm: string;
  city: string;
  address: string;
  product: string;
  amount: number;
  status: Status;
  source: string;
  created_at: string;
  events: { status: Status; at: string }[];
};

export type Shop = {
  id: string;
  name: string;
  ship_fee: number;
  return_fee: number;
  ad_cost: number;
  high_amount: number;
  risky_cities: string;
  webhook_token: string;
};

export type BlacklistEntry = { id: string; phone_norm: string; note: string };

/** Normalise un numéro marocain en 2126XXXXXXXX / 2127XXXXXXXX. */
export function normPhone(p: unknown): string {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "212" + d.slice(1);
  if (d.length === 9 && /^[67]/.test(d)) d = "212" + d;
  return d;
}
export const validPhone = (p: unknown) => /^212[67]\d{8}$/.test(normPhone(p));
export function prettyPhone(p: string): string {
  const d = normPhone(p);
  return /^212\d{9}$/.test(d)
    ? "0" + d.slice(3).replace(/(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, "$1$2 $3 $4 $5")
    : p;
}

export type Risk = { score: number; reasons: [string, number][] };
const H = 3600e3;

export function computeRisk(o: Order, all: Order[], blacklist: Set<string>, shop: Shop): Risk {
  const r: [string, number][] = [];
  const ph = o.phone_norm;
  if (blacklist.has(ph)) r.push(["Numéro dans la liste noire", 60]);
  if (!validPhone(o.phone)) r.push(["Numéro marocain invalide", 30]);
  const t = Date.parse(o.created_at);
  const same = all.filter((x) => x.id !== o.id && x.phone_norm === ph);
  const past = same.filter((x) => x.status === "retournee" || x.status === "annulee").length;
  if (past) r.push([`${past} refus ou annulation${past > 1 ? "s" : ""} précédent${past > 1 ? "s" : ""}`, Math.min(50, past * 25)]);
  const a = (o.address || "").trim();
  if (a.length < 15 || !/\d/.test(a)) r.push(["Adresse trop vague", 15]);
  if (same.some((x) => Math.abs(Date.parse(x.created_at) - t) < 24 * H && !["retournee", "annulee", "livree"].includes(x.status)))
    r.push(["Autre commande du même numéro en 24 h", 20]);
  if (o.amount >= shop.high_amount) r.push(["Montant élevé", 10]);
  // Heure du Maroc (UTC+1, sans heure d'été depuis 2018 hors Ramadan)
  const h = new Date(t + H).getUTCHours();
  if (h < 6) r.push(["Commande passée entre minuit et 6 h", 10]);
  const cities = shop.risky_cities.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (cities.includes((o.city || "").trim().toLowerCase())) r.push(["Ville à fort taux de retour", 10]);
  return { score: Math.min(100, r.reduce((s, x) => s + x[1], 0)), reasons: r };
}

export const riskLevel = (s: number) => (s >= 60 ? "high" : s >= 30 ? "mid" : "low");

/** Champs d'une commande entrante, quelle que soit la source. */
export type IncomingOrder = {
  name: string;
  phone: string;
  city: string;
  address: string;
  product: string;
  amount: number;
  external_id?: string | null;
};

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function cleanIncoming(x: Partial<Record<keyof IncomingOrder, unknown>>): IncomingOrder | null {
  const name = clip(x.name, 120);
  const phone = clip(x.phone, 40);
  if (!name && !phone) return null;
  const amountRaw = String(x.amount ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  return {
    name: name || "Sans nom",
    phone,
    city: clip(x.city, 80),
    address: clip(x.address, 300),
    product: clip(x.product, 200) || "—",
    amount: Math.max(0, Math.round(parseFloat(amountRaw) || 0)),
    external_id: x.external_id ? clip(x.external_id, 120) : null,
  };
}

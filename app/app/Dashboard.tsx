"use client";
import "./dashboard.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NEXT, STATUSES, STATUS_KEYS, computeRisk, normPhone, prettyPhone, riskLevel, validPhone,
  type BlacklistEntry, type Order, type Risk, type Shop, type Status,
} from "@/lib/domain";

type State = { email: string; shop: Shop; orders: Order[]; blacklist: BlacklistEntry[] };
type Tab = "orders" | "add" | "export" | "blacklist" | "auto" | "settings";

const fmt = (n: number) => new Intl.NumberFormat("fr-MA").format(Math.round(n));
const dt = (s: string) => new Date(s).toLocaleString("fr-MA", { dateStyle: "short", timeStyle: "short" });
const LEVEL = {
  high: { label: "Élevé", color: "var(--bad)" },
  mid: { label: "Moyen", color: "var(--warn)" },
  low: { label: "Faible", color: "var(--ok)" },
};

async function api(path: string, method = "GET", data?: unknown) {
  const res = await fetch(path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = "/login"; throw new Error(j.error); }
  if (!res.ok) throw new Error(j.error || "Une erreur est survenue. Réessayez.");
  return j;
}

export default function Dashboard() {
  const [st, setSt] = useState<State | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState<Tab>("orders");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);

  const reload = useCallback(async () => {
    try { setSt(await api("/api/state")); setLoadErr(""); }
    catch (e: any) { setLoadErr(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  /** Exécute une action serveur puis recharge l'état. */
  const act = useCallback(async (fn: () => Promise<any>, ok?: string | ((r: any) => string)) => {
    try {
      const r = await fn();
      await reload();
      if (ok) toast(typeof ok === "function" ? ok(r) : ok);
      return r;
    } catch (e: any) { toast(e.message); return null; }
  }, [reload, toast]);

  const blSet = useMemo(() => new Set(st?.blacklist.map((b) => b.phone_norm)), [st]);
  const risks = useMemo(() => {
    const m = new Map<string, Risk>();
    if (st) for (const o of st.orders) m.set(o.id, computeRisk(o, st.orders, blSet, st.shop));
    return m;
  }, [st, blSet]);

  if (!st) {
    return (
      <>
        <TopBar />
        <p className="loading">{loadErr ? <>{loadErr} <button className="btn" onClick={reload}>Réessayer</button></> : "Chargement de vos commandes…"}</p>
      </>
    );
  }

  const open = st.orders.find((o) => o.id === openId) ?? null;

  return (
    <>
      <TopBar shop={st.shop.name} email={st.email} />
      <div className="wrap">
        <Kpis st={st} risks={risks} />
        <nav className="tabs" role="tablist">
          {([
            ["orders", "Commandes"], ["add", "Ajouter / importer"], ["export", "Export livreur"],
            ["blacklist", "Liste noire"], ["auto", "Réception automatique"], ["settings", "Réglages"],
          ] as [Tab, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>

        {tab === "orders" && <Orders st={st} risks={risks} onOpen={setOpenId} goAdd={() => setTab("add")} />}
        {tab === "add" && <AddOrders act={act} done={() => setTab("orders")} />}
        {tab === "export" && <Export st={st} act={act} toast={toast} />}
        {tab === "blacklist" && <Blacklist st={st} act={act} />}
        {tab === "auto" && <Auto st={st} act={act} toast={toast} />}
        {tab === "settings" && <Settings st={st} act={act} />}
      </div>

      {open && (
        <Drawer o={open} st={st} risk={risks.get(open.id)!} blacklisted={blSet.has(open.phone_norm)}
          act={act} toast={toast} close={() => setOpenId(null)} />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

function TopBar({ shop, email }: { shop?: string; email?: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <header className="topbar">
      <div className="topbar-in">
        <a href="/app" className="brand"><span className="brand-mark" aria-hidden="true" />Confirmo</a>
        {shop && (
          <div className="who">
            <span><strong>{shop}</strong> · {email}</span>
            <button className="btn" onClick={logout}>Se déconnecter</button>
          </div>
        )}
      </div>
    </header>
  );
}

function Kpis({ st, risks }: { st: State; risks: Map<string, Risk> }) {
  const O = st.orders;
  const c = (k: Status) => O.filter((o) => o.status === k).length;
  const processed = O.filter((o) => !["nouvelle", "envoye"].includes(o.status)).length;
  const confirmed = (["confirmee", "expediee", "livree", "retournee"] as Status[]).reduce((s, k) => s + c(k), 0);
  const liv = c("livree"), ret = c("retournee");
  const shipped = liv + ret + c("expediee");
  const { ship_fee, return_fee, ad_cost } = st.shop;
  const lost = ret * (ship_fee + return_fee + ad_cost);
  const spend = O.length * ad_cost + shipped * ship_fee + ret * return_fee;
  const pending = O.filter((o) => ["nouvelle", "envoye"].includes(o.status) && (risks.get(o.id)?.score ?? 0) >= 60).length;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) + " %" : "—");
  const keys = STATUS_KEYS.filter((k) => c(k));
  const tiles: [string, string | number, string, boolean?][] = [
    ["Commandes", O.length, `${c("nouvelle") + c("envoye")} à confirmer`],
    ["Taux de confirmation", pct(confirmed, processed), `${confirmed} sur ${processed} traitées`],
    ["Taux de livraison", pct(liv, liv + ret), `${liv} livrées, ${ret} retournées`],
    ["Coût par commande livrée", liv ? `${fmt(spend / liv)} DH` : "—", "pub + livraison + retours"],
    ["Perdu sur les retours", `${fmt(lost)} DH`, "pub et frais des colis refusés"],
    ["À risque élevé", pending, "à vérifier avant expédition", pending > 0],
  ];
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div className="kpis">
        {tiles.map(([l, v, s, alert]) => (
          <div key={l} className={`kpi${alert ? " alert" : ""}`}>
            <span className="lab">{l}</span><span className="val">{v}</span><span className="sub">{s}</span>
          </div>
        ))}
      </div>
      {O.length > 0 && (
        <div className="card">
          <strong>Répartition des commandes</strong>
          <div className="funnel">
            {keys.map((k) => <span key={k} style={{ flex: c(k), background: STATUSES[k].color }} title={`${STATUSES[k].label} : ${c(k)}`} />)}
          </div>
          <div className="legend">
            {keys.map((k) => <span key={k}><i style={{ background: STATUSES[k].color }} />{STATUSES[k].label} <span className="mono">{c(k)}</span></span>)}
          </div>
        </div>
      )}
    </section>
  );
}

const FILTERS: Record<string, [string, (o: Order, r: Risk) => boolean]> = {
  todo: ["À confirmer", (o) => ["nouvelle", "envoye", "injoignable"].includes(o.status)],
  all: ["Toutes", () => true],
  risk: ["Risque élevé", (o, r) => r.score >= 60 && !["livree", "retournee", "annulee"].includes(o.status)],
  ...Object.fromEntries(STATUS_KEYS.map((k) => [k, [STATUSES[k].label, (o: Order) => o.status === k]])),
};

function Orders({ st, risks, onOpen, goAdd }: { st: State; risks: Map<string, Risk>; onOpen: (id: string) => void; goAdd: () => void }) {
  const [filter, setFilter] = useState("todo");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("risk");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return st.orders
      .filter((o) => FILTERS[filter][1](o, risks.get(o.id)!))
      .filter((o) => !needle || [o.name, o.phone, o.phone_norm, o.city, o.ref, o.product].join(" ").toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === "risk" ? risks.get(b.id)!.score - risks.get(a.id)!.score
        : sort === "date" ? Date.parse(b.created_at) - Date.parse(a.created_at)
        : b.amount - a.amount);
  }, [st, risks, filter, q, sort]);

  if (!st.orders.length) {
    return (
      <div className="card empty">
        <h2>Aucune commande pour l'instant</h2>
        <p className="hint">Ajoutez une commande à la main, importez un fichier CSV de votre boutique, ou branchez la réception automatique.</p>
        <button className="btn primary" onClick={goAdd}>Ajouter des commandes</button>
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="toolbar">
        {Object.entries(FILTERS).map(([k, [l, f]]) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {l}<b>{st.orders.filter((o) => f(o, risks.get(o.id)!)).length}</b>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <input id="q" className="search" type="search" placeholder="Rechercher un nom, un téléphone, une ville…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select id="sort" className="btn" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="risk">Trier par risque</option><option value="date">Plus récentes</option><option value="amount">Montant</option>
        </select>
      </div>
      <div className="tablebox">
        <table>
          <thead><tr><th>Réf.</th><th>Client</th><th>Ville</th><th>Produit</th><th className="num">Montant</th><th>Risque</th><th>Statut</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((o) => {
              const r = risks.get(o.id)!, lv = riskLevel(r.score);
              return (
                <tr key={o.id} className={`row r-${lv}`} tabIndex={0} onClick={() => onOpen(o.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(o.id); } }}>
                  <td className="mono">{o.ref}<br /><span className="src">{o.source}</span></td>
                  <td><strong>{o.name}</strong><br /><span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>{prettyPhone(o.phone)}</span></td>
                  <td>{o.city}</td><td>{o.product}</td>
                  <td className="num">{fmt(o.amount)} DH</td>
                  <td><span className="score"><span className="meter"><span style={{ width: `${r.score}%`, background: LEVEL[lv].color }} /></span>{r.score}</span></td>
                  <td><span className="pill" style={{ color: STATUSES[o.status].color }}>{STATUSES[o.status].label}</span></td>
                </tr>
              );
            }) : <tr><td colSpan={7} className="empty">Aucune commande dans cette vue.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function waMessage(o: Order, shop: string, lang: "dar" | "fr") {
  const first = o.name.split(" ")[0], amt = fmt(o.amount);
  return lang === "dar"
    ? `Salam ${first} 👋\nM3ak ${shop}. Tlbti "${o.product}" b ${amt} DH, ghadi nwslouh l ${o.city} (${o.address}).\nKhlass 3nd l'livraison.\n\nJawb b:\n1 ✅ bach tconfirmi\n2 ✏️ bach tbeddel chi haja\n3 ❌ bach tlghi\n\nChoukran!`
    : `Bonjour ${first} 👋\nIci ${shop}. Vous avez commandé « ${o.product} » pour ${amt} DH, livraison à ${o.city} (${o.address}).\nPaiement à la livraison.\n\nRépondez :\n1 ✅ pour confirmer\n2 ✏️ pour modifier\n3 ❌ pour annuler\n\nMerci !`;
}

async function copy(text: string, toast: (m: string) => void, ok: string) {
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch { toast("Copie refusée : sélectionnez le texte et copiez-le."); }
}

type Act = (fn: () => Promise<any>, ok?: string | ((r: any) => string)) => Promise<any>;

function Drawer({ o, st, risk, blacklisted, act, toast, close }: {
  o: Order; st: State; risk: Risk; blacklisted: boolean; act: Act; toast: (m: string) => void; close: () => void;
}) {
  const [lang, setLang] = useState<"dar" | "fr">("dar");
  const [armed, setArmed] = useState(false);
  const lv = riskLevel(risk.score);
  const msg = waMessage(o, st.shop.name, lang);
  const wa = validPhone(o.phone) ? `https://wa.me/${o.phone_norm}?text=${encodeURIComponent(msg)}` : null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [close]);

  const setStatus = (s: Status) => act(() => api(`/api/orders/${o.id}`, "PATCH", { status: s }), `Statut : ${STATUSES[s].label}`);

  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label={`Commande ${o.ref}`}>
        <div className="dhead">
          <div>
            <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{o.ref} · {dt(o.created_at)} · {o.source}</span>
            <h2 style={{ fontSize: 24 }}>{o.name}</h2>
            <span className="pill" style={{ color: STATUSES[o.status].color }}>{STATUSES[o.status].label}</span>
          </div>
          <button className="x" onClick={close} aria-label="Fermer">×</button>
        </div>
        <dl>
          <dt>Téléphone</dt><dd className="mono">{prettyPhone(o.phone)}</dd>
          <dt>Ville</dt><dd>{o.city || "—"}</dd>
          <dt>Adresse</dt><dd>{o.address || "—"}</dd>
          <dt>Produit</dt><dd>{o.product}</dd>
          <dt>Montant COD</dt><dd className="mono">{fmt(o.amount)} DH</dd>
        </dl>
        <div className="sec">
          <h3>Risque : <span style={{ color: LEVEL[lv].color }}>{LEVEL[lv].label} · {risk.score}/100</span></h3>
          {risk.reasons.length
            ? <ul className="reasons">{risk.reasons.map(([l, p]) => <li key={l}><span>{l}</span><b>+{p}</b></li>)}</ul>
            : <p className="hint">Aucun signal d'alerte sur cette commande.</p>}
          {lv === "high" && <p className="hint">Conseil : appelez ce client avant d'expédier, ou demandez une avance sur les frais de livraison.</p>}
        </div>
        <div className="sec">
          <h3>Message de confirmation WhatsApp</h3>
          <div className="seg">
            <button aria-pressed={lang === "dar"} onClick={() => setLang("dar")}>Darija</button>
            <button aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>Français</button>
          </div>
          <div className="msg">{msg}</div>
          <div className="actions">
            {wa
              ? <a className="btn wa" href={wa} target="_blank" rel="noopener noreferrer"
                  onClick={() => { if (o.status === "nouvelle" || o.status === "injoignable") setStatus("envoye"); }}>Ouvrir dans WhatsApp</a>
              : <span className="hint">Numéro invalide : corrigez-le avant d'envoyer.</span>}
            <button className="btn" onClick={() => copy(msg, toast, "Message copié")}>Copier le message</button>
          </div>
          {wa && <p className="hint">Ouvrir WhatsApp passe la commande en « Message envoyé ». Notez ensuite la réponse du client ci-dessous.</p>}
        </div>
        <div className="sec">
          <h3>Changer le statut</h3>
          <div className="actions">
            {NEXT[o.status].length
              ? NEXT[o.status].map((s) => <button key={s} className={`btn${s === "confirmee" ? " primary" : ""}`} onClick={() => setStatus(s)}>{STATUSES[s].label}</button>)
              : <span className="hint">Commande clôturée.</span>}
          </div>
        </div>
        <div className="sec">
          <h3>Client</h3>
          <div className="actions">
            {blacklisted
              ? <button className="btn" onClick={() => {
                  const e = st.blacklist.find((b) => b.phone_norm === o.phone_norm);
                  if (e) act(() => api(`/api/blacklist/${e.id}`, "DELETE"), "Retiré de la liste noire");
                }}>Retirer de la liste noire</button>
              : <button className="btn danger" disabled={!/^212\d{9}$/.test(o.phone_norm)}
                  onClick={() => act(() => api("/api/blacklist", "POST", { phone: o.phone_norm, note: `Ajouté depuis ${o.ref}` }), "Ajouté à la liste noire")}>
                  Ajouter à la liste noire</button>}
            <button className="btn danger" onClick={async () => {
              if (!armed) return setArmed(true);
              const r = await act(() => api(`/api/orders/${o.id}`, "DELETE"), "Commande supprimée");
              if (r) close();
            }}>{armed ? "Confirmer la suppression" : "Supprimer la commande"}</button>
          </div>
        </div>
        <div className="sec">
          <h3>Historique</h3>
          <div className="hist">{[...o.events].reverse().map((e, i) => <span key={i}>{dt(e.at)} · {STATUSES[e.status]?.label ?? e.status}</span>)}</div>
        </div>
      </aside>
    </>
  );
}

/* ——— Ajout manuel et import CSV ——— */

function parseCSV(txt: string): string[][] {
  txt = txt.replace(/^\uFEFF/, "").trim();
  if (!txt) return [];
  const first = txt.split("\n")[0];
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (inQ) {
      if (ch === '"' && txt[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && txt[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const ALIASES: Record<string, string[]> = {
  name: ["nom", "nom complet", "shipping name", "full name", "destinataire", "client", "customer", "name"],
  phone: ["telephone", "téléphone", "tel", "gsm", "mobile", "numero", "numéro", "shipping phone", "phone"],
  city: ["ville", "city", "shipping city"],
  address: ["adresse", "address", "adresse de livraison", "shipping address1", "shipping street"],
  product: ["produit", "product", "article", "item", "lineitem name"],
  amount: ["montant", "prix", "total", "amount", "price", "cod"],
  external_id: ["id", "commande", "order", "name commande", "numéro de commande", "order id"],
};

const SAMPLE = `nom;telephone;ville;adresse;produit;montant
Yassine Alaoui;0661234567;Rabat;Hay Riad, rue 12, immeuble 4 appt 9;Montre connectée;349
Salma Idrissi;0712345678;Fès;Saiss;Sac à main cuir;290`;

function AddOrders({ act, done }: { act: Act; done: () => void }) {
  const [csv, setCsv] = useState(SAMPLE);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function importCsv(text: string) {
    const rows = parseCSV(text);
    if (rows.length < 2) return setMsg("Aucune ligne trouvée. La première ligne doit contenir les noms de colonnes.");
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const idx: Record<string, number> = {};
    for (const [k, al] of Object.entries(ALIASES)) {
      const hit = al.find((a) => head.includes(a));
      idx[k] = hit ? head.indexOf(hit) : -1;
    }
    const missing = (["name", "phone"] as const).filter((k) => idx[k] < 0).map((k) => ({ name: "nom", phone: "telephone" })[k]);
    if (missing.length) return setMsg(`Colonnes manquantes : ${missing.join(", ")}.`);
    const data = rows.slice(1).map((r) => Object.fromEntries(Object.entries(idx).filter(([, i]) => i >= 0).map(([k, i]) => [k, r[i] ?? ""])));
    setBusy(true);
    const r = await act(() => api("/api/orders/import", "POST", { rows: data }), (r) => `${r.inserted} commande(s) importée(s)`);
    setBusy(false);
    if (r) { setMsg(`${r.inserted} commande(s) importée(s)${r.skipped ? `, ${r.skipped} ignorée(s) (vides ou déjà importées)` : ""}.`); if (r.inserted) done(); }
  }

  async function addOne(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const r = await act(() => api("/api/orders", "POST", data), "Commande ajoutée");
    if (r) { form.reset(); done(); }
  }

  return (
    <section className="grid2">
      <form className="card" onSubmit={addOne}>
        <h2>Ajouter une commande</h2>
        <label className="field">Nom du client<input id="m_name" name="name" required /></label>
        <label className="field">Téléphone<input id="m_phone" name="phone" required inputMode="tel" placeholder="06 12 34 56 78" /></label>
        <label className="field">Ville<input id="m_city" name="city" /></label>
        <label className="field">Adresse<input id="m_address" name="address" /></label>
        <label className="field">Produit<input id="m_product" name="product" /></label>
        <label className="field">Montant à encaisser (DH)<input id="m_amount" name="amount" type="number" min={0} /></label>
        <button className="btn primary">Ajouter</button>
      </form>
      <div className="card">
        <h2>Importer un fichier CSV</h2>
        <p className="hint">Collez un export YouCan, Shopify ou Google Sheets. Colonnes reconnues : <span className="mono">nom, telephone, ville, adresse, produit, montant</span> (et leurs équivalents anglais). Séparateur virgule ou point-virgule. Une colonne <span className="mono">id</span> évite les doublons si vous importez deux fois le même fichier.</p>
        <textarea id="csv" className="input" value={csv} onChange={(e) => setCsv(e.target.value)} aria-label="Contenu CSV" />
        <div className="actions">
          <button className="btn primary" disabled={busy} onClick={() => importCsv(csv)}>{busy ? "Import…" : "Importer"}</button>
          <label className="btn">Choisir un fichier .csv
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const rd = new FileReader();
              rd.onload = () => { const t = String(rd.result); setCsv(t); importCsv(t); };
              rd.readAsText(f);
            }} />
          </label>
        </div>
        {msg && <p className="hint" role="status">{msg}</p>}
      </div>
    </section>
  );
}

/* ——— Export livreur ——— */

const csvCell = (v: unknown) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function Export({ st, act, toast }: { st: State; act: Act; toast: (m: string) => void }) {
  const [courier, setCourier] = useState("Amana");
  const list = st.orders.filter((o) => o.status === "confirmee");
  const head = ["Reference", "Destinataire", "Telephone", "Ville", "Adresse", "Produit", "Montant_COD_DH", "Livreur"];
  const text = list.length
    ? [head.join(";"), ...list.map((o) => [o.ref, o.name, /^212\d{9}$/.test(o.phone_norm) ? "0" + o.phone_norm.slice(3) : o.phone, o.city, o.address, o.product, o.amount, courier].map(csvCell).join(";"))].join("\n")
    : "Aucune commande confirmée pour l'instant.";
  return (
    <section className="card">
      <h2>Bordereau pour le livreur</h2>
      <p className="hint">Toutes les commandes au statut <strong>Confirmée</strong> ({list.length}). Copiez le CSV et collez-le dans l'outil d'import de votre société de livraison ou dans Excel, puis marquez-les comme expédiées.</p>
      <label className="field" style={{ maxWidth: 260 }}>Société de livraison
        <select id="courier" value={courier} onChange={(e) => setCourier(e.target.value)}>
          {["Amana", "Ozon Express", "Sendit", "Cathedis", "Autre"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <textarea id="csvOut" className="input" readOnly value={text} aria-label="CSV à copier" />
      <div className="actions">
        <button className="btn primary" disabled={!list.length} onClick={() => copy(text, toast, "CSV copié")}>Copier le CSV</button>
        <button className="btn" disabled={!list.length}
          onClick={() => act(() => api("/api/orders/ship", "POST"), (r) => `${r.shipped} commande(s) marquée(s) expédiée(s)`)}>
          Marquer comme expédiées</button>
      </div>
    </section>
  );
}

/* ——— Liste noire ——— */

function Blacklist({ st, act }: { st: State; act: Act }) {
  const repeat = useMemo(() => {
    const counts = new Map<string, { n: number; name: string }>();
    for (const o of st.orders) if (o.status === "retournee" || o.status === "annulee") {
      const c = counts.get(o.phone_norm) ?? { n: 0, name: o.name };
      c.n++; counts.set(o.phone_norm, c);
    }
    const bl = new Set(st.blacklist.map((b) => b.phone_norm));
    return [...counts].filter(([p, c]) => c.n >= 2 && !bl.has(p) && /^212\d{9}$/.test(p));
  }, [st]);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const r = await act(() => api("/api/blacklist", "POST", Object.fromEntries(new FormData(form).entries())), "Ajouté à la liste noire");
    if (r) form.reset();
  }

  return (
    <section className="grid2">
      <div className="card">
        <h2>Liste noire</h2>
        <p className="hint">Un numéro de cette liste ajoute 60 points de risque à toute commande. Gardez-y uniquement des clients qui ont refusé des colis chez vous.</p>
        <form className="toolbar" onSubmit={add}>
          <input id="bl_phone" name="phone" className="search" placeholder="06 12 34 56 78" inputMode="tel" required />
          <input id="bl_note" name="note" className="search" placeholder="Motif (ex. 3 refus)" />
          <button className="btn primary">Ajouter</button>
        </form>
        <div>
          {st.blacklist.length ? st.blacklist.map((b) => (
            <div className="bl" key={b.id}>
              <span><span className="mono">{prettyPhone(b.phone_norm)}</span><br /><span className="hint">{b.note}</span></span>
              <button className="btn" onClick={() => act(() => api(`/api/blacklist/${b.id}`, "DELETE"), "Retiré de la liste noire")}>Retirer</button>
            </div>
          )) : <p className="hint">Liste vide.</p>}
        </div>
      </div>
      <div className="card">
        <h2>Clients à refus répétés</h2>
        <p className="hint">Numéros avec au moins 2 retours ou annulations chez vous, pas encore dans la liste noire.</p>
        {repeat.length ? repeat.map(([p, c]) => (
          <div className="bl" key={p}>
            <span><span className="mono">{prettyPhone(p)}</span><br /><span className="hint">{c.n} refus ou annulations · {c.name}</span></span>
            <button className="btn danger" onClick={() => act(() => api("/api/blacklist", "POST", { phone: p, note: `${c.n} refus/annulations` }), "Ajouté à la liste noire")}>Ajouter</button>
          </div>
        )) : <p className="hint">Aucun client à refus répétés hors liste noire.</p>}
      </div>
    </section>
  );
}

/* ——— Réception automatique ——— */

function Auto({ st, act, toast }: { st: State; act: Act; toast: (m: string) => void }) {
  const [origin, setOrigin] = useState("");
  const [armed, setArmed] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/api/hooks/${st.shop.webhook_token}`;
  const curl = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Imane Bennani","phone":"0661234578","city":"Casablanca",
       "address":"Maarif, rue 18, 3e étage","product":"Robe caftan","amount":420}'`;
  const form = `<form method="POST" action="${url}">
  <input name="name" placeholder="Nom complet" required>
  <input name="phone" placeholder="Téléphone" required>
  <input name="city" placeholder="Ville">
  <input name="address" placeholder="Adresse">
  <input type="hidden" name="product" value="Robe caftan">
  <input type="hidden" name="amount" value="420">
  <button>Commander, paiement à la livraison</button>
</form>`;
  return (
    <section className="panel">
      <div className="card">
        <h2>Votre adresse de réception</h2>
        <p className="hint">Toute commande envoyée à cette adresse arrive directement dans Confirmo, avec son score de risque. Gardez-la secrète : quiconque la connaît peut créer des commandes.</p>
        <div className="url">
          <code>{url}</code>
          <button className="btn" onClick={() => copy(url, toast, "Adresse copiée")}>Copier</button>
          <button className="btn danger" onClick={async () => {
            if (!armed) return setArmed(true);
            await act(() => api("/api/shop/token", "POST"), "Nouvelle adresse créée. L'ancienne ne fonctionne plus.");
            setArmed(false);
          }}>{armed ? "Confirmer : changer l'adresse" : "Changer l'adresse"}</button>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>Shopify</h2>
          <p className="hint">Dans Shopify : Paramètres → Notifications → Webhooks → Créer un webhook. Événement « Création de commande », format JSON, URL : votre adresse ci-dessus.</p>
        </div>
        <div className="card">
          <h2>Landing page ou formulaire</h2>
          <p className="hint">Collez ce formulaire dans votre page de vente (YouCan, WordPress, page HTML). Chaque envoi crée une commande et affiche une page de remerciement.</p>
          <pre className="code">{form}</pre>
          <button className="btn" onClick={() => copy(form, toast, "Formulaire copié")}>Copier le formulaire</button>
        </div>
        <div className="card">
          <h2>Autre outil (Make, Zapier, n8n, code)</h2>
          <p className="hint">Envoyez un POST JSON avec les champs <span className="mono">name, phone, city, address, product, amount</span> et, si vous l'avez, <span className="mono">id</span> pour éviter les doublons.</p>
          <pre className="code">{curl}</pre>
        </div>
      </div>
    </section>
  );
}

/* ——— Réglages ——— */

function Settings({ st, act }: { st: State; act: Act }) {
  const s = st.shop;
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget).entries());
    await act(() => api("/api/shop", "PATCH", d), "Réglages enregistrés");
  }
  return (
    <form className="card" onSubmit={save} key={JSON.stringify(s)}>
      <h2>Réglages de la boutique</h2>
      <div className="grid2">
        <label className="field">Nom de la boutique (signe les messages WhatsApp)<input id="s_name" name="name" defaultValue={s.name} required /></label>
        <label className="field">Frais de livraison par colis (DH)<input id="s_ship" name="ship_fee" type="number" min={0} defaultValue={s.ship_fee} /></label>
        <label className="field">Frais de retour par colis (DH)<input id="s_ret" name="return_fee" type="number" min={0} defaultValue={s.return_fee} /></label>
        <label className="field">Coût pub moyen par commande (DH)<input id="s_ad" name="ad_cost" type="number" min={0} defaultValue={s.ad_cost} /></label>
        <label className="field">Montant considéré comme élevé (DH)<input id="s_high" name="high_amount" type="number" min={0} defaultValue={s.high_amount} /></label>
        <label className="field">Villes à fort taux de retour (séparées par des virgules)<input id="s_cities" name="risky_cities" defaultValue={s.risky_cities} /></label>
      </div>
      <div className="actions"><button className="btn primary">Enregistrer</button></div>
    </form>
  );
}

import Link from "next/link";
import { getSession } from "@/lib/auth";
import Stage from "./Stage";
import "./landing.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession().catch(() => null);

  return (
    <div className="lp">
      <nav className="lp-nav">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true" />Confirmo</Link>
        <div className="links">
          {session ? (
            <Link className="btn primary" href="/app">Ouvrir mon tableau de bord</Link>
          ) : (
            <>
              <Link className="btn" href="/login">Se connecter</Link>
              <Link className="btn primary" href="/signup">Créer un compte</Link>
            </>
          )}
        </div>
      </nav>

      <header className="hero">
        <div>
          <span className="eyebrow reveal">Paiement à la livraison · Maroc</span>
          <h1 className="reveal d1">Expédiez les colis qui seront <em>vraiment payés</em>.</h1>
          <p className="lede reveal d2">
            Confirmo confirme chaque commande sur WhatsApp en darija ou en français, signale les commandes à risque avant
            l'expédition et vous montre ce que les retours vous coûtent.
          </p>
          <div className="cta reveal d3">
            <Link className="btn primary lg" href={session ? "/app" : "/signup"}>{session ? "Voir mes commandes" : "Commencer gratuitement"}</Link>
            <a className="btn lg" href="#comment">Comment ça marche</a>
          </div>
        </div>
        <Stage />
      </header>

      <section className="band" id="comment">
        <div className="band-in">
          <h2>De la commande au colis livré, sans appeler chaque client.</h2>
          <ol className="steps">
            <li><h3>La commande arrive</h3><p>Depuis Shopify, votre formulaire de landing page, un import CSV ou à la main.</p></li>
            <li><h3>Elle reçoit un score</h3><p>Numéro invalide, refus passés, adresse vague, doublon, liste noire : chaque signal est expliqué.</p></li>
            <li><h3>Le client confirme</h3><p>Un clic ouvre WhatsApp avec le message prêt. Le client répond 1, 2 ou 3.</p></li>
            <li><h3>Le livreur récupère</h3><p>Les commandes confirmées partent en CSV pour Amana, Ozon, Sendit ou Cathedis.</p></li>
          </ol>
        </div>
      </section>

      <section>
        <div className="sec-in">
          <h2>Ce que vous suivez enfin</h2>
          <div className="feats">
            <div className="feat"><span className="tag">Rentabilité</span><h3>Coût par commande livrée</h3><p>Pub, livraison et retours ramenés aux colis réellement encaissés, pas aux commandes reçues.</p></div>
            <div className="feat"><span className="tag">Risque</span><h3>Score de 0 à 100</h3><p>Les commandes à risque élevé remontent en tête de liste, avec la raison de chaque point.</p></div>
            <div className="feat"><span className="tag">Clients</span><h3>Liste noire</h3><p>Les numéros qui refusent plusieurs colis sont repérés et signalés sur chaque nouvelle commande.</p></div>
            <div className="feat"><span className="tag">Compte</span><h3>Accessible partout</h3><p>Vos commandes sont enregistrées sur votre compte, sur ordinateur comme sur téléphone.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="sec-in final">
          <h2>Moins de colis qui reviennent, dès cette semaine.</h2>
          <p>Créez votre compte, importez vos commandes en cours et confirmez les premières en quelques minutes.</p>
          <Link className="btn primary lg" href={session ? "/app" : "/signup"}>{session ? "Ouvrir Confirmo" : "Créer mon compte"}</Link>
        </div>
      </section>

      <footer className="foot"><div className="sec-in"><span>Confirmo</span><span>Fait au Maroc pour les vendeurs en paiement à la livraison.</span></div></footer>
    </div>
  );
}

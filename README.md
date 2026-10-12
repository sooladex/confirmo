# Confirmo V2

SaaS anti-retours pour les vendeurs en paiement à la livraison (Maroc).

- Comptes vendeurs (e-mail + mot de passe), une boutique par compte
- Commandes enregistrées en base Neon : ajout manuel, import CSV, réception automatique (Shopify, formulaire de landing page, API JSON)
- Score de risque expliqué (liste noire, refus passés, numéro invalide, adresse vague, doublon 24 h, montant, heure, ville)
- Message WhatsApp de confirmation en darija ou en français, statuts avec historique
- Liste noire, export CSV livreur (Amana, Ozon, Sendit, Cathedis), indicateurs de rentabilité

Stack : Next.js 16, PostgreSQL Neon (driver HTTP serverless), sessions JWT en cookie httpOnly, bcrypt.

## Variables d'environnement

| Nom | Valeur |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Neon du projet **confirmo** (console Neon → Connect) |
| `AUTH_SECRET` | Chaîne aléatoire de 32 caractères minimum (`openssl rand -hex 32`) |

## Base de données

Le schéma est dans `db/schema.sql` (déjà appliqué sur le projet Neon « confirmo »).
Pour une nouvelle base : `npm run db:migrate` avec `DATABASE_URL` défini.

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis remplir les deux valeurs
npm run dev
```

Pour tester sans Neon : `DATABASE_URL=pglite:./.pglite` (Postgres embarqué, développement uniquement).

## Réception automatique

Chaque boutique a une adresse secrète `POST /api/hooks/<jeton>` (onglet « Réception automatique »).
Elle accepte un JSON `{ name, phone, city, address, product, amount, id? }`, un tableau de ces objets,
une commande Shopify (webhook « Création de commande ») ou un formulaire HTML.
Le champ `id` évite les doublons si la même commande est renvoyée.

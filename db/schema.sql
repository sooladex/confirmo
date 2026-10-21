CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  ship_fee integer NOT NULL DEFAULT 35,
  return_fee integer NOT NULL DEFAULT 20,
  ad_cost integer NOT NULL DEFAULT 45,
  high_amount integer NOT NULL DEFAULT 600,
  risky_cities text NOT NULL DEFAULT 'Oujda, Nador, Laâyoune',
  webhook_token text NOT NULL UNIQUE,
  order_seq integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ref text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  phone_norm text NOT NULL,
  city text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  product text NOT NULL DEFAULT '',
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'nouvelle'
    CHECK (status IN ('nouvelle','envoye','confirmee','injoignable','annulee','expediee','livree','retournee')),
  source text NOT NULL DEFAULT 'manuel',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, ref)
);
CREATE INDEX IF NOT EXISTS orders_shop_created ON orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_shop_phone ON orders (shop_id, phone_norm);
CREATE UNIQUE INDEX IF NOT EXISTS orders_shop_external ON orders (shop_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_events (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order ON order_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  phone_norm text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, phone_norm)
);

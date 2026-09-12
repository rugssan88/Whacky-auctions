CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  auction_id TEXT UNIQUE NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  hammer_price_cents BIGINT NOT NULL CHECK (hammer_price_cents >= 0),
  buyer_premium_cents BIGINT NOT NULL DEFAULT 0 CHECK (buyer_premium_cents >= 0),
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','pending','paid','refunded','void')),
  payment_gateway TEXT,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status,created_at DESC);

INSERT INTO app_settings(key,value) VALUES
  ('dealer_registration_confirmed','false'::jsonb),
  ('dealer_registration_number','""'::jsonb),
  ('dealer_registration_expiry','""'::jsonb)
ON CONFLICT (key) DO NOTHING;

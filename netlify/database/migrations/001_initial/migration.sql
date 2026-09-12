CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  mobile TEXT,
  id_number TEXT,
  date_of_birth DATE,
  physical_address TEXT,
  role TEXT NOT NULL DEFAULT 'bidder' CHECK (role IN ('bidder','admin')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_terms_at TIMESTAMPTZ NOT NULL,
  accepted_privacy_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_exp_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_settings(key,value) VALUES
  ('trading_enabled','false'::jsonb),
  ('payment_gateway_enabled','false'::jsonb),
  ('business_name','"Whacky Auctions PTY LTD"'::jsonb),
  ('support_email','"rugs.san88@gmail.com"'::jsonb),
  ('soft_close_seconds','120'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS auctions (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL,
  condition_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','closed','unsold','cancelled')),
  start_at TIMESTAMPTZ NOT NULL,
  scheduled_end_at TIMESTAMPTZ NOT NULL,
  current_end_at TIMESTAMPTZ NOT NULL,
  soft_close_seconds INTEGER NOT NULL DEFAULT 120 CHECK (soft_close_seconds BETWEEN 30 AND 900),
  opening_bid_cents BIGINT NOT NULL CHECK (opening_bid_cents >= 0),
  bid_increment_cents BIGINT NOT NULL CHECK (bid_increment_cents > 0),
  reserve_price_cents BIGINT,
  reserve_disclosed BOOLEAN NOT NULL DEFAULT TRUE,
  buyer_premium_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  vat_note TEXT NOT NULL DEFAULT 'VAT treatment as displayed for this lot.',
  payment_deadline_hours INTEGER NOT NULL DEFAULT 24,
  inspection_note TEXT NOT NULL DEFAULT 'Inspection details as displayed for this lot.',
  collection_note TEXT NOT NULL DEFAULT 'Collection or delivery arrangements as displayed for this lot.',
  storage_fee_note TEXT NOT NULL DEFAULT 'Storage charges may apply after the collection deadline where lawfully disclosed.',
  auctioneer_name TEXT,
  rules_published_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auctions_status_idx ON auctions(status);
CREATE INDEX IF NOT EXISTS auctions_end_idx ON auctions(current_end_at);

CREATE TABLE IF NOT EXISTS auction_images (
  id TEXT PRIMARY KEY,
  auction_id TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  blob_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auction_images_auction_idx ON auction_images(auction_id,sort_order);

CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  auction_id TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retracted_at TIMESTAMPTZ,
  retraction_reason TEXT
);
CREATE INDEX IF NOT EXISTS bids_auction_idx ON bids(auction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bids_user_idx ON bids(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auction_id TEXT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,auction_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  auction_id TEXT REFERENCES auctions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);

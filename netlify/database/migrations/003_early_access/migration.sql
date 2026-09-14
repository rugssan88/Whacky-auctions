CREATE TABLE IF NOT EXISTS early_access_signups (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT NOT NULL,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_privacy_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS early_access_created_idx
  ON early_access_signups(created_at DESC);

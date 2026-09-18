ALTER TABLE early_access_signups
  ADD COLUMN IF NOT EXISTS account_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS account_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS early_access_claimed_user_idx
  ON early_access_signups(claimed_user_id);

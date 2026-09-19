CREATE TABLE IF NOT EXISTS transactional_emails (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  event_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE(template,event_key)
);

CREATE INDEX IF NOT EXISTS transactional_emails_recipient_idx
  ON transactional_emails(recipient,created_at DESC);

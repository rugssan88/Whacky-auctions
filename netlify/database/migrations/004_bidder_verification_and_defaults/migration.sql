CREATE TABLE IF NOT EXISTS bidder_verification_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL DEFAULT 1000 CHECK (amount_cents = 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  payment_reference TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bidder_verification_user_idx ON bidder_verification_payments(user_id,created_at DESC);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS defaulted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS default_fee_cents BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS relisted_auction_id TEXT REFERENCES auctions(id);
UPDATE orders SET due_at=created_at+INTERVAL '2 hours' WHERE due_at IS NULL AND status IN ('unpaid','pending');
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('unpaid','pending','paid','refunded','void','defaulted'));

UPDATE auctions SET payment_deadline_hours=2 WHERE status='draft' AND payment_deadline_hours=24;

ALTER TABLE early_access_signups ADD COLUMN IF NOT EXISTS promo_code TEXT;

CREATE INDEX IF NOT EXISTS early_access_promo_code_idx
  ON early_access_signups ((UPPER(promo_code)))
  WHERE promo_code IS NOT NULL;

ALTER TABLE bidder_verification_payments
  DROP CONSTRAINT IF EXISTS bidder_verification_payments_amount_cents_check;

ALTER TABLE bidder_verification_payments
  ADD CONSTRAINT bidder_verification_payments_amount_cents_check
  CHECK (amount_cents IN (500, 1000));

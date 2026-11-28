-- Assembly is charged by the server, and vendor earnings are paid out in batches.

ALTER TABLE order_lines ADD COLUMN assembly_qty INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders      ADD COLUMN assembly_kobo INTEGER NOT NULL DEFAULT 0;

CREATE TABLE payouts (
  id              TEXT PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,              -- PAY-1001 …
  vendor_id       TEXT NOT NULL REFERENCES users(id),
  amount_kobo     INTEGER NOT NULL CHECK (amount_kobo > 0),
  status          TEXT NOT NULL CHECK (status IN ('pending','paid','cancelled')),
  -- where the money went: copied at the time, so a later change of bank details can't rewrite history
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  transfer_ref    TEXT,                              -- the bank / Paystack transfer reference, once paid
  note            TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL,
  paid_at         TEXT
);
CREATE INDEX payouts_vendor ON payouts(vendor_id, created_at);

-- A vendor order can be in at most one payout (so nobody is ever paid twice for the same delivery).
ALTER TABLE vendor_orders ADD COLUMN payout_id TEXT REFERENCES payouts(id);
CREATE INDEX vendor_orders_payout ON vendor_orders(payout_id);

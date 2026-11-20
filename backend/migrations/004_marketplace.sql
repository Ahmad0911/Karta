-- Full product listings, and one fulfilment record per vendor inside each paid order.

ALTER TABLE listings ADD COLUMN sku                 TEXT;
ALTER TABLE listings ADD COLUMN category_id         TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN room                TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN description         TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN material            TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN dimensions          TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN colors              TEXT NOT NULL DEFAULT '[]';
ALTER TABLE listings ADD COLUMN original_price_kobo INTEGER;
ALTER TABLE listings ADD COLUMN delivery_min_days   INTEGER NOT NULL DEFAULT 3;
ALTER TABLE listings ADD COLUMN delivery_max_days   INTEGER NOT NULL DEFAULT 7;
ALTER TABLE listings ADD COLUMN assembly_available  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE listings ADD COLUMN images              TEXT NOT NULL DEFAULT '[]';
-- "in review" is status='draft' with submitted_at set (the status CHECK can't be widened in place).
ALTER TABLE listings ADD COLUMN submitted_at        TEXT;
ALTER TABLE listings ADD COLUMN moderation_note     TEXT;
ALTER TABLE listings ADD COLUMN created_at          TEXT;

CREATE INDEX listings_vendor ON listings(vendor_id);
CREATE INDEX listings_live ON listings(status, category_id, room);

CREATE TABLE vendor_orders (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id),
  vendor_id        TEXT NOT NULL REFERENCES users(id),
  number           TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL CHECK (status IN ('new','confirmed','packing','ready_for_pickup','with_logistics','delivered','cancelled')),
  subtotal_kobo    INTEGER NOT NULL,
  commission_kobo  INTEGER NOT NULL,
  net_kobo         INTEGER NOT NULL,
  cancel_reason    TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  delivered_at     TEXT,
  UNIQUE (order_id, vendor_id)
);
CREATE INDEX vendor_orders_vendor ON vendor_orders(vendor_id, created_at);

CREATE TABLE vendor_order_events (
  id               TEXT PRIMARY KEY,
  vendor_order_id  TEXT NOT NULL REFERENCES vendor_orders(id),
  status           TEXT NOT NULL,
  at               TEXT NOT NULL,
  by_user_id       TEXT,
  note             TEXT
);
CREATE INDEX vendor_order_events_vo ON vendor_order_events(vendor_order_id, at);

-- Custom requests brokered by Karta, and the chat between Karta and each customer / vendor.
-- Customers and vendors never share a conversation.

CREATE TABLE custom_requests (
  id               TEXT PRIMARY KEY,
  number           TEXT NOT NULL UNIQUE,
  customer_id      TEXT NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL CHECK (status IN ('open','claimed','accepted','ordered','closed','removed')),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  styles           TEXT NOT NULL DEFAULT '[]',
  dimensions       TEXT,
  images           TEXT NOT NULL DEFAULT '[]',
  city             TEXT NOT NULL,
  state            TEXT NOT NULL,
  budget_min_kobo  INTEGER,
  budget_max_kobo  INTEGER,
  -- the offer Karta passed on (set by staff only)
  offer_vendor_id  TEXT REFERENCES users(id),
  offer_price_kobo INTEGER,
  offer_days       INTEGER,
  offer_note       TEXT,
  offer_at         TEXT,
  offer_expires_at TEXT,
  declined_by      TEXT NOT NULL DEFAULT '[]',     -- vendor ids the customer turned down
  listing_id       TEXT REFERENCES listings(id),   -- private listing created on accept
  removed_reason   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX requests_customer ON custom_requests(customer_id, created_at);

CREATE TABLE request_events (
  id          TEXT PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES custom_requests(id),
  at          TEXT NOT NULL,
  by_role     TEXT NOT NULL CHECK (by_role IN ('customer','admin','system')),
  action      TEXT NOT NULL,
  note        TEXT
);

-- A listing made for one customer can be bought by nobody else.
ALTER TABLE listings ADD COLUMN reserved_for TEXT REFERENCES users(id);

CREATE TABLE conversations (
  id              TEXT PRIMARY KEY,
  number          TEXT NOT NULL UNIQUE,
  requester_id    TEXT NOT NULL REFERENCES users(id),
  requester_role  TEXT NOT NULL CHECK (requester_role IN ('customer','vendor')),
  request_id      TEXT REFERENCES custom_requests(id),
  order_id        TEXT REFERENCES orders(id),
  subject         TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('order','payment','delivery','return','account','vendor','request','other')),
  status          TEXT NOT NULL CHECK (status IN ('open','pending','resolved','closed')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX conversations_requester ON conversations(requester_id, updated_at);

CREATE TABLE conversation_messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id),
  sender           TEXT NOT NULL CHECK (sender IN ('requester','staff')),
  author_id        TEXT NOT NULL REFERENCES users(id),
  author_name      TEXT NOT NULL,
  body             TEXT NOT NULL,
  internal         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX conversation_messages_conv ON conversation_messages(conversation_id, created_at);

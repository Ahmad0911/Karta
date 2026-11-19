-- Karta API · Phase 1 schema (trust core).
-- Portable SQL: ids are UUID text, times are ISO-8601 text (or epoch-ms integers
-- where noted), flags are 0/1. Moves to PostgreSQL with type changes only.

CREATE TABLE users (
  id                   TEXT PRIMARY KEY,
  email                TEXT NOT NULL UNIQUE,                 -- always lower-case
  name                 TEXT NOT NULL,
  phone                TEXT,
  phone_norm           TEXT,                                 -- 234XXXXXXXXXX
  role                 TEXT NOT NULL CHECK (role IN ('customer','vendor','logistics','admin','super_admin')),
  password_hash        TEXT,                                 -- NULL once an account is deleted
  must_change_password INTEGER NOT NULL DEFAULT 0,
  business_name        TEXT,
  email_verified_at    TEXT,
  phone_verified_at    TEXT,
  disabled_at          TEXT,
  deleted_at           TEXT,
  created_by           TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX idx_users_phone_norm ON users(phone_norm);
CREATE INDEX idx_users_role ON users(role);

-- One family per sign-in. Refresh tokens rotate inside a family; replaying an
-- old token revokes the whole family (stolen-token detection).
CREATE TABLE session_families (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  revoked_at     TEXT,
  revoked_reason TEXT
);
CREATE INDEX idx_families_user ON session_families(user_id);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES session_families(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,                          -- sha256 of the refresh token; the token itself is never stored
  created_at  TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,                              -- epoch ms
  rotated_at  TEXT,
  user_agent  TEXT,
  ip          TEXT
);
CREATE INDEX idx_sessions_family ON sessions(family_id);

CREATE TABLE login_attempts (
  email        TEXT PRIMARY KEY,                             -- tracked for unknown emails too, so lockouts reveal nothing
  failures     INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,                                      -- epoch ms
  updated_at   INTEGER NOT NULL
);

CREATE TABLE verification_codes (
  id          TEXT PRIMARY KEY,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify_email','verify_phone','reset_password')),
  target      TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id),
  code_hash   TEXT NOT NULL,
  salt        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,                              -- epoch ms
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,                              -- epoch ms
  consumed_at INTEGER
);
CREATE INDEX idx_codes_lookup ON verification_codes(purpose, target, created_at);

-- Append-only: the DATABASE refuses edits and deletes, not just the app.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  actor_id    TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  meta        TEXT,
  ip          TEXT,
  request_id  TEXT
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

-- Vendor verification ---------------------------------------------------------
CREATE TABLE vendor_applications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE REFERENCES users(id),
  status          TEXT NOT NULL CHECK (status IN ('draft','under_review','changes_requested','approved','rejected','suspended')),
  business        TEXT NOT NULL,                             -- JSON
  contact         TEXT NOT NULL,                             -- JSON
  payout          TEXT NOT NULL,                             -- JSON
  agreed_terms    INTEGER NOT NULL DEFAULT 0,
  trust_score     INTEGER NOT NULL DEFAULT 0,
  review_note     TEXT,
  -- denormalised for duplicate / fraud checks
  business_name_lc TEXT,
  phone_norm      TEXT,
  bank_name       TEXT,
  bank_account    TEXT,
  submitted_at    TEXT,
  decided_at      TEXT,
  decided_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_vapps_status ON vendor_applications(status);
CREATE INDEX idx_vapps_phone ON vendor_applications(phone_norm);
CREATE INDEX idx_vapps_bank ON vendor_applications(bank_name, bank_account);

CREATE TABLE vendor_documents (
  id             TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES vendor_applications(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('government_id','business_registration','proof_of_address','workshop_photo')),
  file_name      TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  size_kb        INTEGER NOT NULL,
  uploaded_at    TEXT NOT NULL,
  UNIQUE (application_id, kind)
);

CREATE TABLE vendor_application_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES vendor_applications(id) ON DELETE CASCADE,
  at             TEXT NOT NULL,
  by_user        TEXT NOT NULL REFERENCES users(id),
  action         TEXT NOT NULL,
  note           TEXT
);

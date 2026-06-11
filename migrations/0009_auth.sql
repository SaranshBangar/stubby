-- Accounts auth: email+password and Google sign-in, layered on top of the
-- existing owner_token model so work syncs across devices.
--
-- ★ HOW SYNC WORKS (the bridge, not a rewrite):
--   Every resource table is still scoped by owner_token (mocks, monitors,
--   webhooks, ...). A user record simply OWNS one canonical owner_token. On
--   login from any device the server hands that token back; the client stores
--   it in localStorage and every existing API call (x-owner-token) now reads
--   the same rows -> cross-device sync, zero changes to resource routes.
--
--   Anonymous use is unchanged: no row here means "just a localStorage token".
--   On register we ADOPT the device's current anonymous token as the canonical
--   one, so pre-signup work is preserved.
--
--   Pro/Stripe is untouched: `accounts` stays keyed by owner_token, so when a
--   user's canonical token has an active `accounts` row they're Pro on every
--   device automatically.

-- ── users ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- uuid
  email         TEXT NOT NULL UNIQUE,        -- lowercased, trimmed
  -- PBKDF2 string `pbkdf2$<iters>$<saltB64url>$<hashB64url>`. NULL for
  -- Google-only accounts that have never set a password.
  password_hash TEXT,
  -- Google's stable subject id (`sub`). NULL for password-only accounts.
  google_sub    TEXT UNIQUE,
  -- THE canonical token that scopes all of this user's resources. UNIQUE so
  -- one token maps to at most one account.
  owner_token   TEXT NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL,            -- epoch ms
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_users_google ON users (google_sub);
CREATE INDEX idx_users_owner ON users (owner_token);

-- ── sessions ─────────────────────────────────────────────────────────
-- Opaque session tokens (httpOnly cookie). We store ONLY the SHA-256 of the
-- token, never the token itself, so a DB leak can't be replayed.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,              -- sha256(token), hex
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL               -- epoch ms; rejected once past
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

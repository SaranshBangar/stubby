-- Stubby initial schema (D1 / SQLite).
-- All timestamps are epoch MILLISECONDS stored as INTEGER (edge-friendly,
-- timezone-free). Booleans are INTEGER 0/1.

-- ── mocks ────────────────────────────────────────────────────────────
-- A stored HTTP response served at /m/<slug>. Owned by an anonymous
-- owner_token (localStorage identity) or a Pro account's token.
CREATE TABLE mocks (
  id           TEXT PRIMARY KEY,            -- uuid
  owner_token  TEXT NOT NULL,               -- anon localStorage identity
  slug         TEXT NOT NULL UNIQUE,        -- public URL path: /m/<slug>
  status_code  INTEGER NOT NULL DEFAULT 200,
  headers_json TEXT NOT NULL DEFAULT '{}',  -- JSON object of custom headers
  body_json    TEXT NOT NULL DEFAULT '{}',  -- raw response body (JSON string)
  delay_ms     INTEGER NOT NULL DEFAULT 0,  -- artificial delay before responding
  created_at   INTEGER NOT NULL,            -- epoch ms
  expires_at   INTEGER                      -- NULL = persistent (Pro); free = +7d
);
CREATE INDEX idx_mocks_owner ON mocks (owner_token);
CREATE INDEX idx_mocks_expires ON mocks (expires_at);

-- ── monitors ─────────────────────────────────────────────────────────
-- An uptime check job. The single cron pings target_url every
-- interval_minutes and emails alert_email on up->down / down->up.
CREATE TABLE monitors (
  id               TEXT PRIMARY KEY,
  owner_token      TEXT NOT NULL,
  target_url       TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL,        -- 1 / 5 / 15 / 30 / 60
  last_checked_at  INTEGER,                 -- epoch ms; NULL = never checked
  last_status      INTEGER,                 -- last HTTP status (NULL on timeout)
  is_up            INTEGER NOT NULL DEFAULT 1,  -- bool; current up/down state
  alert_email      TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER                  -- NULL = persistent (Pro)
);
CREATE INDEX idx_monitors_owner ON monitors (owner_token);
-- Drives the "due" query in the cron loop.
CREATE INDEX idx_monitors_due ON monitors (last_checked_at);

-- ── checks ───────────────────────────────────────────────────────────
-- History of individual pings. Pruned to the newest ~50 per monitor by
-- the cron loop to keep D1 small.
CREATE TABLE checks (
  id               TEXT PRIMARY KEY,
  monitor_id       TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at       INTEGER NOT NULL,
  status_code      INTEGER,                 -- NULL on timeout / network error
  response_time_ms INTEGER,
  ok               INTEGER NOT NULL         -- bool; 2xx within timeout
);
CREATE INDEX idx_checks_monitor ON checks (monitor_id, checked_at DESC);

-- SSL certificate expiry monitoring. HTTPS monitors get a TLS inspection
-- alongside each uptime check; we track expiry/issuer on the monitor row,
-- keep a history in ssl_events, and alert at 30/14/7 days + on invalid.
-- Timestamps are epoch ms, booleans 0/1 (house convention).

ALTER TABLE monitors ADD COLUMN ssl_expiry_date INTEGER;       -- epoch ms; NULL = not HTTPS / not yet checked
ALTER TABLE monitors ADD COLUMN ssl_last_checked_at INTEGER;   -- epoch ms
ALTER TABLE monitors ADD COLUMN ssl_issuer TEXT;
ALTER TABLE monitors ADD COLUMN ssl_days_remaining INTEGER;    -- recomputed each check
ALTER TABLE monitors ADD COLUMN ssl_alert_sent_30 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monitors ADD COLUMN ssl_alert_sent_14 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monitors ADD COLUMN ssl_alert_sent_7 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE monitors ADD COLUMN ssl_invalid_alerted INTEGER NOT NULL DEFAULT 0;

-- ── ssl_events ───────────────────────────────────────────────────────
-- History of TLS inspections. Pruned to the newest ~30 per monitor by the
-- cron (same pattern as `checks`).
CREATE TABLE ssl_events (
  id             TEXT PRIMARY KEY,
  monitor_id     TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at     INTEGER NOT NULL,
  days_remaining INTEGER,
  issuer         TEXT,
  valid          INTEGER NOT NULL,          -- bool; chain valid + not expired
  error          TEXT                       -- NULL if healthy
);
CREATE INDEX idx_ssl_events_monitor ON ssl_events (monitor_id, checked_at DESC);

-- Webhook Inspector: capture any request sent to /w/<slug> and show it in
-- the UI. Mirror image of mocks — store the incoming request instead of
-- serving a stored response. Timestamps are epoch ms, booleans 0/1.

-- ── webhook_endpoints ────────────────────────────────────────────────
-- The id IS the public slug used in the URL: /w/<id>.
CREATE TABLE webhook_endpoints (
  id           TEXT PRIMARY KEY,            -- short random slug (see lib/slug)
  owner_token  TEXT NOT NULL,               -- same anon identity as mocks/monitors
  label        TEXT NOT NULL DEFAULT '',    -- user-defined name
  created_at   INTEGER NOT NULL,            -- epoch ms
  expires_at   INTEGER                      -- NULL = persistent (Pro); free = +7d
);
CREATE INDEX idx_webhook_endpoints_owner ON webhook_endpoints (owner_token);
CREATE INDEX idx_webhook_endpoints_expires ON webhook_endpoints (expires_at);

-- ── webhook_requests ─────────────────────────────────────────────────
-- One row per captured request. Pruned per-endpoint to the tier's limit
-- by the single cron (plus a safety cap at capture time).
CREATE TABLE webhook_requests (
  id           TEXT PRIMARY KEY,            -- uuid
  endpoint_id  TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  received_at  INTEGER NOT NULL,            -- epoch ms
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,               -- sub-path after the slug ("/" = root)
  query_json   TEXT NOT NULL DEFAULT '{}',  -- query params as JSON object
  headers_json TEXT NOT NULL DEFAULT '{}',  -- all request headers as JSON object
  body_raw     TEXT NOT NULL DEFAULT '',    -- raw body, truncated to 100KB
  body_size    INTEGER NOT NULL DEFAULT 0,  -- byte size before truncation
  content_type TEXT,                        -- shortcut from headers for display
  ip_address   TEXT                         -- sender IP
);
CREATE INDEX idx_webhook_requests_endpoint
  ON webhook_requests (endpoint_id, received_at DESC);

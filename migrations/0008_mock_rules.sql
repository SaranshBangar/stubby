-- Conditional mock responses: ordered rules evaluated against the incoming
-- request at /m/<slug>. First match wins; no match falls back to the mock's
-- default response. Template variables resolve in both paths at serve time.

CREATE TABLE mock_rules (
  id               TEXT PRIMARY KEY,        -- uuid
  mock_id          TEXT NOT NULL REFERENCES mocks(id) ON DELETE CASCADE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  condition_type   TEXT NOT NULL,           -- 'query_param' | 'header' | 'body_field' | 'method'
  condition_key    TEXT NOT NULL DEFAULT '',-- param/header name or dot-path ('' for method)
  condition_op     TEXT NOT NULL,           -- 'equals' | 'contains' | 'exists' | 'not_exists'
  condition_value  TEXT,                    -- ignored for exists/not_exists
  response_status  INTEGER NOT NULL DEFAULT 200,
  response_body    TEXT NOT NULL DEFAULT '{}',  -- may contain template variables
  response_headers TEXT NOT NULL DEFAULT '{}'   -- JSON object
);
CREATE INDEX idx_mock_rules_mock ON mock_rules (mock_id, sort_order);

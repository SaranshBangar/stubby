-- Public status pages: a user-published page at /status/<slug> showing the
-- live state + uptime history of selected monitors. No auth on the public
-- read path; the builder APIs are owner_token-scoped as usual.

CREATE TABLE status_pages (
  id              TEXT PRIMARY KEY,           -- uuid
  owner_token     TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,       -- public URL: /status/<slug>
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,           -- epoch ms
  show_powered_by INTEGER NOT NULL DEFAULT 1  -- bool; Pro may hide
);
CREATE INDEX idx_status_pages_owner ON status_pages (owner_token);

-- Join table: which monitors appear on which page, with a public-facing
-- label override and explicit ordering.
CREATE TABLE status_page_monitors (
  page_id       TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  monitor_id    TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  display_label TEXT,                         -- NULL = show the target URL
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, monitor_id)
);
CREATE INDEX idx_status_page_monitors_page ON status_page_monitors (page_id, sort_order);

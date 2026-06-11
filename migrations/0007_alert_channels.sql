-- Multi-channel alerts: Slack / Discord / generic webhook destinations in
-- addition to the monitor's alert email. Channels are owned by a token and
-- linked to monitors via a join table.

CREATE TABLE alert_channels (
  id           TEXT PRIMARY KEY,             -- uuid
  owner_token  TEXT NOT NULL,
  type         TEXT NOT NULL,                -- 'slack' | 'discord' | 'webhook'
  label        TEXT NOT NULL,                -- e.g. "Team Slack #alerts"
  url          TEXT NOT NULL,                -- incoming webhook URL
  created_at   INTEGER NOT NULL              -- epoch ms
);
CREATE INDEX idx_alert_channels_owner ON alert_channels (owner_token);

CREATE TABLE monitor_alert_channels (
  monitor_id   TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  channel_id   TEXT NOT NULL REFERENCES alert_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (monitor_id, channel_id)
);
CREATE INDEX idx_monitor_alert_channels_channel ON monitor_alert_channels (channel_id);

-- Delivery attempts (success + failure) for observability. Pruned to the
-- newest rows per channel by the single cron.
CREATE TABLE alert_delivery_log (
  id           TEXT PRIMARY KEY,
  channel_id   TEXT NOT NULL REFERENCES alert_channels(id) ON DELETE CASCADE,
  monitor_id   TEXT,                         -- NULL for test messages
  attempted_at INTEGER NOT NULL,             -- epoch ms
  success      INTEGER NOT NULL,             -- bool
  error        TEXT                          -- NULL on success
);
CREATE INDEX idx_alert_delivery_log_channel ON alert_delivery_log (channel_id, attempted_at DESC);

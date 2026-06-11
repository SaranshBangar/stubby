// Shared row/DTO shapes used across API + UI.

export interface MockRow {
  id: string;
  owner_token: string;
  slug: string;
  status_code: number;
  headers_json: string;
  body_json: string;
  delay_ms: number;
  created_at: number;
  expires_at: number | null;
}

export interface MonitorRow {
  id: string;
  owner_token: string;
  target_url: string;
  interval_minutes: number;
  last_checked_at: number | null;
  last_status: number | null;
  is_up: number; // 0/1
  alert_email: string;
  created_at: number;
  expires_at: number | null;
  // SSL certificate tracking (NULL until the first HTTPS check).
  ssl_expiry_date: number | null;
  ssl_last_checked_at: number | null;
  ssl_issuer: string | null;
  ssl_days_remaining: number | null;
  ssl_alert_sent_30: number; // 0/1
  ssl_alert_sent_14: number; // 0/1
  ssl_alert_sent_7: number; // 0/1
  ssl_invalid_alerted: number; // 0/1
  // Keyword / content check (assertion on the response body).
  keyword_check_enabled: number; // 0/1
  keyword_check_string: string | null;
  keyword_check_mode: KeywordCheckMode | null;
  keyword_check_failed_at: number | null;
}

export type KeywordCheckMode = "must_contain" | "must_not_contain";

export interface SslEventRow {
  id: string;
  monitor_id: string;
  checked_at: number;
  days_remaining: number | null;
  issuer: string | null;
  valid: number; // 0/1
  error: string | null;
}

export interface CheckRow {
  id: string;
  monitor_id: string;
  checked_at: number;
  status_code: number | null;
  response_time_ms: number | null;
  ok: number; // 0/1
  failure_reason: string | null;
}

export interface StatusPageRow {
  id: string;
  owner_token: string;
  slug: string;
  title: string;
  description: string;
  created_at: number;
  show_powered_by: number; // 0/1
}

export interface StatusPageMonitorRow {
  page_id: string;
  monitor_id: string;
  display_label: string | null;
  sort_order: number;
}

export interface WebhookEndpointRow {
  id: string; // also the public slug: /w/<id>
  owner_token: string;
  label: string;
  created_at: number;
  expires_at: number | null;
}

export interface WebhookRequestRow {
  id: string;
  endpoint_id: string;
  received_at: number;
  method: string;
  path: string;
  query_json: string;
  headers_json: string;
  body_raw: string;
  body_size: number;
  content_type: string | null;
  ip_address: string | null;
}

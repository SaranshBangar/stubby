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
}

export interface CheckRow {
  id: string;
  monitor_id: string;
  checked_at: number;
  status_code: number | null;
  response_time_ms: number | null;
  ok: number; // 0/1
}

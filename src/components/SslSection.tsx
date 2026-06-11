"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MonitorRow, SslEventRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

/**
 * Small SSL status badge for the monitor list. Green when the cert has
 * plenty of runway, amber when renewal is due, red when critical/invalid.
 */
export function SslBadge({ m }: { m: MonitorRow }) {
  if (!m.target_url.startsWith("https://")) return null;
  const days = m.ssl_days_remaining;

  if (days == null) {
    if (m.ssl_last_checked_at == null) return null; // not yet inspected
    return <Badge variant="down">SSL error</Badge>;
  }
  if (days <= 7) {
    return <Badge variant="down">SSL {days < 0 ? "expired" : `${days}d`}</Badge>;
  }
  if (days <= 30) return <Badge variant="pending">SSL {days}d</Badge>;
  return <Badge variant="up">SSL {days}d</Badge>;
}

/**
 * "SSL Certificate" detail section: expiry, issuer, days remaining, and the
 * recent inspection history from ssl_events.
 */
export function SslSection({ m }: { m: MonitorRow }) {
  const [events, setEvents] = useState<SslEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ events: SslEventRow[] }>(`/api/monitors/${m.id}/ssl-events`)
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [m.id, m.ssl_last_checked_at]);

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <h4 className="font-mono text-[11px] uppercase tracking-wider text-t3">
        SSL Certificate
      </h4>

      {m.ssl_last_checked_at == null ? (
        <p className="text-xs text-muted-foreground">
          Not inspected yet — the certificate is checked alongside each uptime
          check.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-t3">Expires</dt>
            <dd className="font-mono text-t1">
              {m.ssl_expiry_date != null
                ? new Date(m.ssl_expiry_date).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-t3">Days remaining</dt>
            <dd className="font-mono text-t1">{m.ssl_days_remaining ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-t3">Issuer</dt>
            <dd className="truncate font-mono text-t1" title={m.ssl_issuer ?? ""}>
              {m.ssl_issuer ?? "—"}
            </dd>
          </div>
        </dl>
      )}

      {loading ? (
        <p className="text-xs text-t2">Loading history…</p>
      ) : events.length > 0 ? (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-t3">
              <th className="py-1 pr-4 font-normal">Checked</th>
              <th className="py-1 pr-4 font-normal">Days left</th>
              <th className="py-1 pr-4 font-normal">Status</th>
              <th className="py-1 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {events.map((e) => (
              <tr key={e.id} className="border-b border-border/50 last:border-0">
                <td className="whitespace-nowrap py-1 pr-4 text-t2">
                  {new Date(e.checked_at).toLocaleString()}
                </td>
                <td className="py-1 pr-4 text-t1">{e.days_remaining ?? "—"}</td>
                <td className="py-1 pr-4">
                  {e.valid === 1 ? (
                    <span className="text-success">valid</span>
                  ) : (
                    <span className="text-destructive">invalid</span>
                  )}
                </td>
                <td className="break-all py-1 text-t2">{e.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

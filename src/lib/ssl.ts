/**
 * TLS certificate inspection for HTTPS monitors.
 *
 * Two runtimes, two strategies:
 *
 *  1. Cloudflare Workers (production): workerd does NOT back `node:tls`
 *     outbound sockets, so the old node:tls path silently no-op'd in prod.
 *     We instead probe the cert over a raw `cloudflare:sockets` TCP socket
 *     (see lib/tlsProbe.ts) — free, no dependencies, no third-party service.
 *     It reads the validity window + issuer; chain/hostname trust is NOT
 *     verified (workerd exposes no full TLS stack), but expiry tracking — the
 *     feature's purpose, incl. the 30/14/7-day alerts — works fully.
 *
 *  2. `next dev` (Node): `cloudflare:sockets` doesn't exist, so we fall back
 *     to node:tls, which DOES validate the chain. We connect with
 *     rejectUnauthorized:false to still read expired/self-signed certs, then
 *     report validity from socket.authorized / authorizationError.
 *
 * Every failure mode is caught: if neither runtime can introspect TLS we
 * return { supported: false } and the caller skips silently — an inspection
 * problem must never affect uptime status.
 */

import { fetchLeafCert } from "@/lib/tlsProbe";

export interface SslCheckResult {
  /** False when the runtime can't perform TLS introspection - skip, don't alert. */
  supported: boolean;
  /** Cert expiry as epoch ms (readable even for invalid/expired certs). */
  validTo: number | null;
  issuer: string | null;
  /** Chain valid and not expired. */
  valid: boolean;
  /** NULL if healthy; handshake/validation error message otherwise. */
  error: string | null;
}

interface PeerCertificate {
  valid_to?: string;
  issuer?: Record<string, string>;
  subject?: Record<string, string>;
}

interface TlsSocketLike {
  authorized: boolean;
  authorizationError?: Error | string | null;
  getPeerCertificate(): PeerCertificate;
  destroy(): void;
  setTimeout(ms: number, cb: () => void): void;
  on(event: string, cb: (arg?: unknown) => void): void;
}

export async function checkSslCertificate(
  hostname: string,
  port: number,
  timeoutMs: number,
): Promise<SslCheckResult> {
  // ── 1. Production path: raw-socket probe over cloudflare:sockets. ──
  // webpackIgnore keeps `next build` from trying to bundle this runtime-only
  // module; it resolves natively in workerd and throws (caught) under Node.
  let connect: Parameters<typeof fetchLeafCert>[0] | undefined;
  try {
    const sockets = (await import(
      /* webpackIgnore: true */ "cloudflare:sockets"
    )) as { connect: Parameters<typeof fetchLeafCert>[0] };
    connect = sockets.connect;
  } catch {
    connect = undefined; // not the Workers runtime — fall through to node:tls
  }

  if (connect) {
    try {
      const leaf = await fetchLeafCert(connect, hostname, port, timeoutMs);
      const now = Date.now();
      const expired = leaf.notAfterMs <= now;
      const notYet = leaf.notBeforeMs > now;
      const valid = !expired && !notYet;
      return {
        supported: true,
        validTo: leaf.notAfterMs,
        issuer: leaf.issuer,
        valid,
        error: valid
          ? null
          : expired
            ? "Certificate has expired"
            : notYet
              ? "Certificate is not yet valid"
              : "Certificate validity error",
      };
    } catch (err) {
      // Handshake/read failed (unreachable, TLS alert, TLS 1.3-only host).
      // Report as a presentation failure; the caller's once-only alert guard
      // prevents spam, and it clears when the host recovers.
      return {
        supported: true,
        validTo: null,
        issuer: null,
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── 2. Dev path: node:tls (full chain validation under `next dev`). ──
  let tls: typeof import("node:tls");
  try {
    tls = await import("node:tls");
  } catch {
    return { supported: false, validTo: null, issuer: null, valid: false, error: null };
  }

  return new Promise<SslCheckResult>((resolve) => {
    let settled = false;
    const done = (r: SslCheckResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    let socket: TlsSocketLike;
    try {
      socket = tls.connect({
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false, // we still read authorized/authorizationError
      }) as unknown as TlsSocketLike;
    } catch (err) {
      // Synchronous throw usually means the runtime lacks tls.connect.
      done({
        supported: false,
        validTo: null,
        issuer: null,
        valid: false,
        error: String(err),
      });
      return;
    }

    const timer = setTimeout(() => {
      try {
        socket.destroy();
      } catch {
        /* already gone */
      }
      done({
        supported: true,
        validTo: null,
        issuer: null,
        valid: false,
        error: `TLS handshake timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    socket.on("secureConnect", () => {
      clearTimeout(timer);
      let result: SslCheckResult;
      try {
        const cert = socket.getPeerCertificate();
        const validTo = cert?.valid_to ? Date.parse(cert.valid_to) : NaN;
        const issuer = formatDn(cert?.issuer);
        const expired = Number.isFinite(validTo) && validTo <= Date.now();
        const authError = socket.authorizationError;
        const valid = socket.authorized && !expired;
        result = {
          supported: true,
          validTo: Number.isFinite(validTo) ? validTo : null,
          issuer,
          valid,
          error: valid
            ? null
            : expired
              ? "Certificate has expired"
              : authError
                ? String(authError)
                : "Certificate chain is not trusted",
        };
      } catch (err) {
        result = {
          supported: true,
          validTo: null,
          issuer: null,
          valid: false,
          error: `Could not read certificate: ${String(err)}`,
        };
      }
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      done(result);
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      const msg = String(err);
      // Runtime-level "not implemented" => unsupported, not an invalid cert.
      if (/not implemented|not supported|ENOTSUP/i.test(msg)) {
        done({ supported: false, validTo: null, issuer: null, valid: false, error: null });
      } else {
        done({ supported: true, validTo: null, issuer: null, valid: false, error: msg });
      }
    });
  });
}

// "O=Let's Encrypt, CN=R11" style summary of a cert distinguished name.
function formatDn(dn: Record<string, string> | undefined): string | null {
  if (!dn || typeof dn !== "object") return null;
  const parts: string[] = [];
  for (const key of ["O", "CN", "C"]) {
    if (dn[key]) parts.push(`${key}=${dn[key]}`);
  }
  if (parts.length === 0) {
    for (const [k, v] of Object.entries(dn)) parts.push(`${k}=${v}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

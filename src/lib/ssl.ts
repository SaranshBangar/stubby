/**
 * TLS certificate inspection for HTTPS monitors.
 *
 * Uses node:tls (available in Workers under the nodejs_compat flag, and
 * natively under `next dev`). We connect with rejectUnauthorized:false so we
 * can still read the certificate of an EXPIRED or self-signed host, then use
 * socket.authorized / authorizationError to report validity.
 *
 * The import is dynamic and every failure mode is caught: if the runtime
 * can't do raw TLS at all we return { supported: false } and the caller
 * skips silently — an inspection problem must never affect uptime status.
 */

export interface SslCheckResult {
  /** False when the runtime can't perform TLS introspection — skip, don't alert. */
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

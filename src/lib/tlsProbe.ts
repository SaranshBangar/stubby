/**
 * Raw-socket TLS certificate probe for the Cloudflare Workers runtime.
 *
 * workerd does NOT back `node:tls` outbound sockets, so the old node:tls path
 * silently no-ops in production. Instead we open a raw TCP socket via
 * `cloudflare:sockets`, perform a minimal TLS handshake ourselves, and read the
 * server's plaintext `Certificate` handshake message.
 *
 * Trick: we advertise a max of TLS 1.2 (we deliberately omit the TLS 1.3
 * `supported_versions` extension). Per RFC 8446 a 1.3-capable server must then
 * fall back to 1.2, where the Certificate message is sent in cleartext — in
 * TLS 1.3 it would be encrypted and unreadable without completing the
 * handshake. We then parse the leaf X.509 for notBefore / notAfter / issuer.
 *
 * Scope: this reads the cert the server presents. It checks the validity
 * window (expired / not-yet-valid) but does NOT verify chain trust or hostname
 * — that needs a full TLS stack workerd doesn't expose. Expiry tracking (the
 * feature's whole point, incl. the 30/14/7-day alerts) works fully.
 */

export interface LeafCert {
  notBeforeMs: number;
  notAfterMs: number;
  issuer: string | null;
}

// Minimal shape of the cloudflare:sockets `connect()` we rely on.
type SocketConnect = (
  address: { hostname: string; port: number },
  options?: { secureTransport?: "off" | "on" | "starttls"; allowHalfOpen?: boolean },
) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  close(): Promise<void>;
};

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u24 = (n: number) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ── ClientHello (TLS 1.2, no supported_versions => no 1.3) ────────────
function buildClientHello(host: string): Uint8Array {
  const hostBytes = new TextEncoder().encode(host);

  // SNI extension (server_name).
  const sniEntry = [0x00, ...u16(hostBytes.length), ...hostBytes];
  const sniList = [...u16(sniEntry.length), ...sniEntry];
  const extSni = [...u16(0x0000), ...u16(sniList.length), ...sniList];

  // supported_groups: x25519, secp256r1, secp384r1.
  const groups = [...u16(0x001d), ...u16(0x0017), ...u16(0x0018)];
  const extGroups = [
    ...u16(0x000a),
    ...u16(groups.length + 2),
    ...u16(groups.length),
    ...groups,
  ];

  // ec_point_formats: uncompressed.
  const extEcPoints = [...u16(0x000b), ...u16(2), 0x01, 0x00];

  // signature_algorithms: common RSA + ECDSA + PSS.
  const sigAlgs = [
    0x0401, 0x0501, 0x0601, 0x0403, 0x0503, 0x0603, 0x0804, 0x0805, 0x0806,
    0x0201,
  ].flatMap(u16);
  const extSigAlgs = [
    ...u16(0x000d),
    ...u16(sigAlgs.length + 2),
    ...u16(sigAlgs.length),
    ...sigAlgs,
  ];

  const extensions = [...extSni, ...extGroups, ...extEcPoints, ...extSigAlgs];

  // Cipher suites (ECDHE/RSA, GCM + CBC fallbacks).
  const ciphers = [
    0xc02b, 0xc02f, 0xc02c, 0xc030, 0x009c, 0x009d, 0x002f, 0x0035, 0x000a,
  ].flatMap(u16);

  const random = new Uint8Array(32);
  crypto.getRandomValues(random);

  const body = [
    0x03,
    0x03, // client_version = TLS 1.2
    ...random,
    0x00, // session_id length
    ...u16(ciphers.length),
    ...ciphers,
    0x01,
    0x00, // compression: null
    ...u16(extensions.length),
    ...extensions,
  ];

  const handshake = [0x01, ...u24(body.length), ...body]; // client_hello
  const record = [0x16, 0x03, 0x01, ...u16(handshake.length), ...handshake];
  return Uint8Array.from(record);
}

// ── Pull the leaf cert DER out of accumulated handshake bytes ─────────
// Returns the DER, "more" if we need to read more, or "alert" on failure.
function extractLeafCert(hs: Uint8Array): Uint8Array | "more" | "alert" {
  let o = 0;
  while (hs.length - o >= 4) {
    const msgType = hs[o];
    const len = (hs[o + 1] << 16) | (hs[o + 2] << 8) | hs[o + 3];
    if (hs.length - o - 4 < len) return "more";
    if (msgType === 11) {
      // Certificate: certs_len(3) then [cert_len(3) + cert]...
      const body = hs.subarray(o + 4, o + 4 + len);
      if (body.length < 6) return "alert";
      let p = 3;
      const certLen = (body[p] << 16) | (body[p + 1] << 8) | body[p + 2];
      p += 3;
      if (p + certLen > body.length) return "alert";
      return body.subarray(p, p + certLen);
    }
    o += 4 + len; // skip ServerHello etc.
  }
  return "more";
}

// ── Minimal DER walker ────────────────────────────────────────────────
interface Tlv {
  tag: number;
  valOff: number;
  end: number;
}

function readTlv(buf: Uint8Array, off: number): Tlv {
  const tag = buf[off];
  let len = buf[off + 1];
  let p = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[p++];
  }
  return { tag, valOff: p, end: p + len };
}

function childrenOf(buf: Uint8Array, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let o = parent.valOff;
  while (o < parent.end) {
    const t = readTlv(buf, o);
    out.push(t);
    o = t.end;
  }
  return out;
}

function parseTime(buf: Uint8Array, t: Tlv): number {
  const s = String.fromCharCode(...buf.subarray(t.valOff, t.end));
  let year: number,
    mon: number,
    day: number,
    h: number,
    mi: number,
    sec: number;
  if (t.tag === 0x17) {
    // UTCTime: YYMMDDHHMMSSZ
    const yy = parseInt(s.slice(0, 2), 10);
    year = yy < 50 ? 2000 + yy : 1900 + yy;
    mon = +s.slice(2, 4);
    day = +s.slice(4, 6);
    h = +s.slice(6, 8);
    mi = +s.slice(8, 10);
    sec = +s.slice(10, 12);
  } else {
    // GeneralizedTime: YYYYMMDDHHMMSSZ
    year = +s.slice(0, 4);
    mon = +s.slice(4, 6);
    day = +s.slice(6, 8);
    h = +s.slice(8, 10);
    mi = +s.slice(10, 12);
    sec = +s.slice(12, 14);
  }
  return Date.UTC(year, mon - 1, day, h, mi, sec);
}

// OID 2.5.4.3 (CN) and 2.5.4.10 (O) DER value bytes.
const OID_CN = [0x55, 0x04, 0x03];
const OID_O = [0x55, 0x04, 0x0a];

function oidEquals(buf: Uint8Array, t: Tlv, oid: number[]): boolean {
  if (t.end - t.valOff !== oid.length) return false;
  for (let i = 0; i < oid.length; i++) if (buf[t.valOff + i] !== oid[i]) return false;
  return true;
}

function parseIssuer(buf: Uint8Array, name: Tlv): string | null {
  let cn: string | null = null;
  let org: string | null = null;
  for (const rdn of childrenOf(buf, name)) {
    // rdn is a SET OF AttributeTypeAndValue (SEQUENCE { oid, value }).
    for (const atv of childrenOf(buf, rdn)) {
      const parts = childrenOf(buf, atv);
      if (parts.length < 2) continue;
      const [oid, val] = parts;
      const text = String.fromCharCode(...buf.subarray(val.valOff, val.end));
      if (oidEquals(buf, oid, OID_CN)) cn = text;
      else if (oidEquals(buf, oid, OID_O)) org = text;
    }
  }
  const out: string[] = [];
  if (org) out.push(`O=${org}`);
  if (cn) out.push(`CN=${cn}`);
  return out.length ? out.join(", ") : null;
}

function parseCert(der: Uint8Array): LeafCert {
  const cert = readTlv(der, 0); // Certificate SEQUENCE
  const tbs = readTlv(der, cert.valOff); // tbsCertificate SEQUENCE
  const ch = childrenOf(der, tbs);
  const hasVersion = ch.length > 0 && ch[0].tag === 0xa0;
  const serialIdx = hasVersion ? 1 : 0;
  const issuer = ch[serialIdx + 2];
  const validity = ch[serialIdx + 3];
  const [nb, na] = childrenOf(der, validity);
  return {
    notBeforeMs: parseTime(der, nb),
    notAfterMs: parseTime(der, na),
    issuer: parseIssuer(der, issuer),
  };
}

// ── Public entry: handshake, read cert, parse ─────────────────────────
export async function fetchLeafCert(
  connect: SocketConnect,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<LeafCert> {
  const socket = connect(
    { hostname: host, port },
    { secureTransport: "off", allowHalfOpen: false },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`TLS probe timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const work = (async (): Promise<LeafCert> => {
    const writer = socket.writable.getWriter();
    await writer.write(buildClientHello(host));
    writer.releaseLock();

    const reader = socket.readable.getReader();
    let raw = new Uint8Array(0); // unparsed record bytes
    let hs = new Uint8Array(0); // reassembled handshake bytes

    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("connection closed before certificate");
      raw = concat(raw, value);

      // Drain whole TLS records out of `raw` into the handshake buffer.
      let off = 0;
      while (raw.length - off >= 5) {
        const type = raw[off];
        const recLen = (raw[off + 3] << 8) | raw[off + 4];
        if (raw.length - off - 5 < recLen) break; // partial record
        const payload = raw.subarray(off + 5, off + 5 + recLen);
        if (type === 22) hs = concat(hs, payload);
        else if (type === 21) throw new Error("server sent TLS alert");
        off += 5 + recLen;
      }
      raw = raw.slice(off);

      const der = extractLeafCert(hs);
      if (der === "alert") throw new Error("malformed certificate message");
      if (der !== "more") return parseCert(der);
      if (hs.length > 200_000) throw new Error("certificate message too large");
    }
  })();

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await socket.close();
    } catch {
      /* already closed */
    }
  }
}

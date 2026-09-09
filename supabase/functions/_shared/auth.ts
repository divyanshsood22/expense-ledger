
const ACCESS_CODE_ITERATIONS = 600_000;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/** Hashes a submitted access code with the stored salt, using the same PBKDF2 params as generate-access-code.js. */
export async function hashAccessCode(code: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: ACCESS_CODE_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

/** Constant-time comparison, so a mismatch can't be timed to leak information about the correct hash. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365; // ~1 year; also cleared by explicit logout or clearing cookies

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}

/** Creates a signed session token: "<expiryEpochSeconds>.<hmacSignature>". No DB row needed to validate it. */
export async function createSessionToken(secret: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiry);
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

/** Verifies a session token's signature and expiry. Used later by every protected Edge Function. */
export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = await hmac(secret, payload);
  if (!timingSafeEqualHex(signature, expected)) return false;
  const expiry = parseInt(payload, 10);
  if (Number.isNaN(expiry)) return false;
  return Date.now() / 1000 < expiry;
}

/** Reads the session cookie value from a request, if present. */
export function getSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

/** Builds the Set-Cookie header for a new session. SameSite=None is required for the cross-domain
 *  frontend/Edge-Function setup — see the note above the file list. */
export function buildSessionCookieHeader(token: string): string {
  return `session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

/** Clears the session cookie. Will be used by the logout endpoint in a later phase. */
export function buildClearCookieHeader(): string {
  return `session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}
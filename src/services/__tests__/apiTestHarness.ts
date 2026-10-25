/**
 * Shared helpers for the live-API contract and drift tests.
 *
 * The PHP router protects staff endpoints with a session cookie, so the tests
 * have to sign in before they can compare the local mock API with the live
 * response shapes. Credentials are development-only demo accounts.
 */

export const STAFF_CREDENTIALS = {
  email: 'admin@relieftrack.com',
  password: 'admin123'
} as const;

/**
 * `VITE_API_BASE_URL` is normally the relative `/api` path served through the
 * Vite dev proxy. Node's `fetch` cannot resolve a relative URL, so fall back
 * to the absolute origins the PHP router is reachable on: the XAMPP/Apache
 * deployment and the `php -S` server that `scripts/dev.mjs` spawns.
 */
const configuredBase = (process.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const candidateBases = (
  configuredBase.startsWith('/') || !configuredBase
    ? ['http://localhost/relieftrack-api', 'http://127.0.0.1:8080']
    : [configuredBase, 'http://localhost/relieftrack-api', 'http://127.0.0.1:8080']
).filter((base, index, all) => all.indexOf(base) === index);

export interface StaffSession {
  cookie: string;
  csrfToken: string;
}

export interface ResolvedApi {
  base: string;
  session: StaffSession;
}

function readSetCookie(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') return withGetter.getSetCookie();
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}

/**
 * Extract the `name=value` pair of every cookie in a `Set-Cookie` header list.
 *
 * The router calls `session_start()` and then `session_regenerate_id(true)` on
 * login, so Apache sends two `PHPSESSID` cookies. Browsers keep the last value
 * for a duplicated name; mirroring that keeps the harness on the live session
 * instead of the stale one that regeneration invalidated.
 */
export function toCookieHeader(setCookies: string[]): string {
  const byName = new Map<string, string>();
  for (const entry of setCookies) {
    const pair = entry.split(';', 1)[0].trim();
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    byName.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return [...byName].map(([name, value]) => `${name}=${value}`).join('; ');
}

/**
 * Sign in as the demo staff account and return the session cookie plus the
 * CSRF token that every staff mutation requires.
 */
export async function loginStaff(base: string): Promise<StaffSession> {
  const response = await fetch(`${base}/admin_login.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(STAFF_CREDENTIALS)
  });
  const envelope = (await response.json()) as {
    success: boolean;
    message?: string;
    data?: { admin?: { csrfToken?: string } };
  };
  if (!response.ok || !envelope.success) {
    throw new Error(`admin_login.php failed at ${base}: ${envelope.message ?? response.status}`);
  }
  const csrfToken = envelope.data?.admin?.csrfToken;
  if (!csrfToken) throw new Error(`admin_login.php at ${base} did not return a CSRF token.`);
  const cookie = toCookieHeader(readSetCookie(response.headers));
  if (!cookie) throw new Error(`admin_login.php at ${base} did not set a session cookie.`);
  return { cookie, csrfToken };
}

/** GET a PHP endpoint with the staff session attached. */
export async function staffGet(base: string, path: string, session: StaffSession): Promise<Response> {
  return fetch(`${base}/${path}`, { headers: { Cookie: session.cookie } });
}

/** POST a PHP endpoint with the staff session and CSRF token attached. */
export async function staffPost(
  base: string,
  path: string,
  session: StaffSession,
  body: unknown
): Promise<Response> {
  return fetch(`${base}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: session.cookie,
      'X-CSRF-Token': session.csrfToken
    },
    body: JSON.stringify(body)
  });
}

/**
 * Find a reachable PHP base and an authenticated staff session, or `null` when
 * neither XAMPP nor the dev PHP server is running.
 */
export async function resolveAuthenticatedApi(): Promise<ResolvedApi | null> {
  for (const base of candidateBases) {
    try {
      const probe = await fetch(`${base}/locations.php`);
      if (!probe.ok) continue;
      return { base, session: await loginStaff(base) };
    } catch {
      continue;
    }
  }
  return null;
}

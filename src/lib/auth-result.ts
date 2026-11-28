// How a sign-in attempt ended, so the login page can tell a wrong password from a server that is down.
// Pure; checked by `npx tsx src/lib/auth-result.check.ts`.

export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'error' };

/** What /api/login's reply means. `status` is the HTTP status, or null when no reply came (offline, server unreachable). */
export function loginResult(status: number | null): LoginResult {
  if (status !== null && status >= 200 && status < 300) return { ok: true };
  // 401: wrong email or password. 400: one of them was left out. Anything else is not the user's typing.
  return { ok: false, reason: status === 400 || status === 401 ? 'invalid' : 'error' };
}

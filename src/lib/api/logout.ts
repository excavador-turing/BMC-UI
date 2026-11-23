/**
 * Signing out, kept free of React so `npm test` can run it.
 *
 * The token is revoked on the board first (`POST /api/bmc/logout`, bmcd with
 * excavador-turing/BMC-Firmware#99), so a copy of it -- in a script on this
 * origin, in another tab -- stops working too. Whatever the board answers,
 * the session is then cleared here: an older daemon has no such route (404 or
 * 405), and a board that cannot be reached must not keep anyone signed in.
 */

/** Long enough for a busy board, short enough not to hold up signing out. */
export const LOGOUT_TIMEOUT_MS = 5000;

export type Post = (
  url: string,
  config: { headers: Record<string, string>; timeout: number }
) => Promise<unknown>;

export async function revokeAndClear(
  token: string | null,
  base: string,
  post: Post,
  clear: () => void
): Promise<void> {
  try {
    if (token) {
      await post(`${base}/bmc/logout`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: LOGOUT_TIMEOUT_MS,
      });
    }
  } catch {
    // Nothing to do: the token is dropped below either way.
  } finally {
    clear();
  }
}

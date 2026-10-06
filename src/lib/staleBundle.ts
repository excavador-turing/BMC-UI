import i18n from "i18next";

/**
 * Recover when the page in the browser is older than the files on the board.
 *
 * The bundle is split into chunks named by a hash of their contents, and
 * every firmware upgrade renames them. A browser that kept the old index.html
 * (bmcd sent no Cache-Control, so browsers were free to) asks for chunks the
 * board no longer has. A board answers an unknown path with index.html, so
 * the import does not 404 cleanly: it arrives as HTML where a module should
 * be, and fails. What the person saw was a broken upgrade page, a password
 * page that would not load, and nodes shown as off, until they cleared the
 * browser's cache by hand.
 *
 * The cure is to fetch index.html again, which is what a reload does. Vite
 * announces a failed chunk on `window` as `vite:preloadError`, for every
 * dynamic import in the bundle -- the router's lazy routes included, since
 * they go through the same wrapper (checked: a failed `*.lazy.tsx` import
 * fires it, so no second hook is needed) -- so one listener covers the board, the
 * fleet and the demo, and `location.reload()` keeps whatever base and
 * route the page is on.
 *
 * A reload that does not help must not repeat. If the new index.html is
 * missing a chunk too, the page is not stale, it is broken, and reloading
 * forever would hide that behind a flicker. The attempt is recorded in
 * sessionStorage with its time; a second failure inside the window is let
 * through (the error surfaces as it always did) and a notice says what to do.
 */
export const RELOAD_KEY = "bmc-ui:stale-bundle-reload";
export const RELOAD_WINDOW_MS = 60_000;

/** True, and records the attempt, if a reload is allowed right now. */
function mayReload(now: number): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY));
    // A stamp from the future is not a stamp this code wrote.
    if (last > 0 && last <= now && now - last < RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    // No storage means no way to tell a first failure from a tenth, and a
    // reload loop is worse than the error it would have hidden.
    return false;
  }
}

/** The notice, built by hand: React may be the thing that failed to load. */
function showNotice() {
  if (document.getElementById("stale-bundle-notice")) return;
  const bar = document.createElement("div");
  bar.id = "stale-bundle-notice";
  bar.setAttribute("role", "alert");
  bar.style.cssText =
    "position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:12px 16px;" +
    "display:flex;gap:12px;align-items:center;justify-content:center;" +
    "background:#b45309;color:#fff;font:14px/1.4 system-ui,sans-serif";
  const text = document.createElement("span");
  text.textContent = i18n.t("ui.staleBundle");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = i18n.t("ui.reloadPage");
  button.style.cssText =
    "padding:4px 12px;border:1px solid #fff;border-radius:6px;" +
    "background:transparent;color:inherit;font:inherit;cursor:pointer";
  button.onclick = () => window.location.reload();
  bar.append(text, button);
  document.body.append(bar);
}

// Several chunks usually fail together. The first starts the reload; the rest
// must not read its marker as "a reload already failed" and raise the notice.
let reloading = false;

function recover(): boolean {
  if (reloading) return true;
  if (mayReload(Date.now())) {
    reloading = true;
    window.location.reload();
    return true;
  }
  showNotice();
  return false;
}

export function installStaleBundleRecovery() {
  window.addEventListener("vite:preloadError", (event) => {
    // Without this Vite rethrows and the page is left half-loaded.
    if (recover()) event.preventDefault();
  });
}

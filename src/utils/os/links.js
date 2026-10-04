// Copyright 2026 bittuhere (anurag670singh@gmail.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Leaving the OS — the one honest way out of the page.
 *
 *   openExternal(url)  -> a brand-new tab in the REAL browser (or window),
 *                         never the built-in Edge app.
 *
 * Two rules this module exists to enforce:
 *
 *  1. Project links (Github, the issue tracker, "Buy me a coffee", anything a
 *     user explicitly asks for with target="_blank") must never be swallowed
 *     by the internal browser. A previous boot patch replaced window.open
 *     globally and turned every new tab into an in-OS Edge navigation — that
 *     is why clicking Github did nothing visible and every popup landed in
 *     our own window.
 *  2. It must still work when the popup is refused. window.open returns null
 *     (popup blocker, sandboxed/SRCDoc iframe, a UI without a real user
 *     gesture), so we fall back to a synthetic <a target="_blank"> click.
 *
 * `internal: true` keeps the in-OS route for the few places that genuinely
 * belong to this desktop (never use it for a plain external link).
 */

/** Anything with a scheme we know how to hand to the browser. */
const ABSOLUTE = /^(https?|mailto|tel|sms|ftp):/i;

/**
 * Normalise whatever an app/action throws at us into a URL the browser can
 * open, or "" when it is unusable. Bare domains get https:// prefixed so
 * `openExternal("github.com/foo")` behaves like the omnibox would.
 */
export function toExternalUrl(url) {
  const raw = String(url == null ? "" : url).trim();
  if (!raw) return "";
  if (ABSOLUTE.test(raw)) return raw;
  if (/^www\./i.test(raw) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw)) {
    return `https://${raw}`;
  }
  return "";
}

/* the original browser builtin — captured once, before anything can patch it */
const nativeOpen = typeof window !== "undefined" ? window.open.bind(window) : null;

/* ...but a live window.open wins when one exists: PWA shells, kiosk wrappers
   and test harnesses replace it (and the harnesses are how we prove the tab
   really opens), so the call below always asks the window first. */
const openTab = (url, name) => {
  if (typeof window !== "undefined" && typeof window.open === "function") {
    return window.open(url, name);
  }
  return nativeOpen ? nativeOpen(url, name) : null;
};

/**
 * Open `url` in a new tab of the real browser.
 * Returns the new window, or null when the browser refused (the anchor
 * fallback has then been tried).
 */
export function openExternal(url) {
  const target = toExternalUrl(url);
  if (!target) return null;

  // mailto:/tel: have no window to give back — a same-tab hop is correct
  if (/^(mailto|tel|sms):/i.test(target)) {
    try {
      window.location.href = target;
    } catch (e) {}
    return null;
  }

  if (nativeOpen || (typeof window !== "undefined" && typeof window.open === "function")) {
    try {
      /* Deliberately no "noopener" feature string here: with noopener the
         browser returns null even on SUCCESS, so we could not tell "opened"
         from "blocked" — and the caller would fire a second open through the
         anchor fallback (two tabs for one click). Open plainly, then sever the
         opener by hand, which is the same protection and keeps the signal. */
      const win = openTab(target, "_blank");
      if (win) {
        try {
          win.opener = null;
        } catch (e) {}
        return win;
      }
    } catch (e) {
      /* fall through to the anchor */
    }
  }

  try {
    const a = document.createElement("a");
    a.href = target;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {}

  return null;
}

/**
 * Redux middleware for the two actions that LEAVE the OS.
 *
 *   EXTERNALTAB { payload: url }  -> a new tab in the real browser
 *   EXTERNAL    { payload: url }  -> mailto:/tel: hop (anything else stays in
 *                                    the internal Edge app, handled by the
 *                                    reducer)
 *
 * Why middleware and not the reducer: opening a tab is a side effect, and
 * reducers must stay pure. The old reducer called window.open() *while Redux
 * was reducing*; when the browser refused the popup the anchor fallback fired
 * a DOM click, the shell's global click handler dispatched its hide actions,
 * and Redux threw "error #9 — dispatch called while dispatching". Middleware
 * runs outside that window, still synchronously inside the user's click, so
 * the popup keeps its user activation.
 */
export const externalLinkMiddleware = () => (next) => (action) => {
  if (action && action.type === "EXTERNALTAB") {
    try {
      openExternal(action.payload);
    } catch (e) {}
    // pass a pure, side-effect-free version on for the state machine
    return next({ type: "EXTERNALTAB", payload: action.payload });
  }
  if (
    action &&
    action.type === "EXTERNAL" &&
    /^(mailto|tel|sms):/i.test(String(action.payload || ""))
  ) {
    try {
      openExternal(action.payload);
    } catch (e) {}
    return next({ type: "EXTERNAL", payload: action.payload });
  }
  return next(action);
};

export default openExternal;

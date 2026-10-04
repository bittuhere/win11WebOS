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
 * The WebOS Browser Helper bridge.
 *
 * A normal web page cannot read https://example.com — the browser blocks the
 * cross origin response. The companion extension (see /extensions) runs with
 * host permissions, fetches the page for us and hands the HTML back through
 * postMessage. When the bridge is live, Edge inside this OS can render real
 * websites instead of only the iframe-friendly ones.
 *
 * Handshake:
 *   page -> { src: 'WEBOS_BRIDGE', type: 'ping' }
 *   ext  -> { src: 'WEBOS_BRIDGE', type: 'pong', id, version }
 *   page -> { src: 'WEBOS_BRIDGE', type: 'fetch', rid, url }
 *   ext  -> { src: 'WEBOS_BRIDGE', type: 'fetch-result', rid, ok, status,
 *             body, contentType, finalUrl }
 */
import store from "../../reducers";

const SRC = "WEBOS_BRIDGE";
const PING_INTERVAL = 2500;

let info = null;
let listenersReady = false;
const pendingFetch = new Map();
const pendingAI = new Map();
let rid = 0;
let pingTimer = null;

function publish(extra = {}) {
  const ext = {
    installed: !!info,
    id: info?.id || "",
    version: info?.version || "",
    browser: info?.browser || "",
    checkedAt: Date.now(),
    ...extra,
  };
  store.dispatch({ type: "UIEXT", payload: ext });
  return ext;
}

/* The bridge only speaks to the WebOS desktop itself. Accept messages
   from this page's own origin (the helper content script running here)
   and — belt and braces — from the known OS origins. Anything else
   (e.g. a framed site posting upward) is ignored. */
const OS_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/(win11-web\.pages\.dev|win11-web\.github\.io)$/;
function onMessage(e) {
  const d = e.data;
  if (!d || d.src !== SRC) return;
  const org = e.origin || "";
  if (org && org !== window.location.origin && !OS_ORIGIN_RE.test(org)) return;

  if (d.type === "pong") {
    const first = !info;
    info = { id: d.id || "", version: d.version || "", browser: d.browser || "" };
    publish();
    if (first) {
      window.dispatchEvent(new CustomEvent("webos-bridge", { detail: info }));
    }
    return;
  }

  if (d.type === "fetch-result") {
    const p = pendingFetch.get(d.rid);
    if (!p) return;
    pendingFetch.delete(d.rid);
    clearTimeout(p.timer);
    if (d.ok) p.resolve(d);
    else {
      const err = new Error(d.error || `HTTP ${d.status || 0}`);
      if (d.kind) err.kind = d.kind;
      if (d.code) err.code = d.code;
      p.reject(err);
    }
  }

  if (d.type === "ai-result") {
    const p = pendingAI.get(d.rid);
    if (!p) return;
    pendingAI.delete(d.rid);
    clearTimeout(p.timer);
    if (d.ok) p.resolve(d);
    else p.reject(new Error(d.error || "AI request failed"));
  }
}

/** Start listening + pinging. Idempotent. */
export function startBridge() {
  if (listenersReady) return;
  listenersReady = true;
  window.addEventListener("message", onMessage);

  const ping = () => {
    try {
      window.postMessage({ src: SRC, type: "ping" }, "*");
    } catch (e) {}
  };
  ping();
  pingTimer = setInterval(ping, PING_INTERVAL);
}

export function stopBridge() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

/**
 * One-shot check used by the OOBE "Verify extension" button and by boot.
 * Resolves with the bridge info, or null after `timeout` ms of silence.
 */
export function checkBridge(timeout = 1400) {
  startBridge();
  return new Promise((resolve) => {
    if (info) {
      publish();
      resolve(info);
      return;
    }
    const onEvt = (e) => {
      clearTimeout(t);
      window.removeEventListener("webos-bridge", onEvt);
      resolve(e.detail);
    };
    window.addEventListener("webos-bridge", onEvt);
    const t = setTimeout(() => {
      window.removeEventListener("webos-bridge", onEvt);
      publish();
      resolve(null);
    }, timeout);
    // poke it again in case the first ping fired before the content script ran
    setTimeout(() => {
      try {
        window.postMessage({ src: SRC, type: "ping" }, "*");
      } catch (e) {}
    }, 120);
  });
}

export const bridgeReady = () => !!info;
export const bridgeInfo = () => info;

/**
 * PROOF, not presence. A pong only proves a content script ran — the
 * fetch relay could still be broken (that is exactly what happened when
 * Chrome MV3 moved CORS enforcement onto content scripts and pages
 * started seeing "refused to connect" despite a green verifier).
 *
 * So a real verification sends one actual fetch through the relay and
 * demands a real answer from the extension background.
 */
export function verifyBridge(timeout = 9000) {
  startBridge();
  return new Promise(async (resolve) => {
    const seen = info;
    if (!seen) {
      const pong = await checkBridge(2600);
      if (!pong) {
        resolve({
          ok: false,
          level: "absent",
          why: "The helper is not running in this tab. Load it, then reload this tab so it injects.",
        });
        return;
      }
    }

    // A v1.0.x helper predates the background fetcher (MV3 content scripts
    // obey page CORS, so it can NEVER proxy). Say so instead of a generic
    // "relay failed" that makes people think the web is down.
    if (info && /^1\.0\./.test(String(info.version))) {
      resolve({
        ok: false,
        level: "stale",
        why: "This is helper v1.0.0, which no modern browser allows to lift CORS. Remove it in your browser's extensions page, then Load unpacked the extensions/chrome folder (v1.1+), reload this tab and verify again.",
      });
      return;
    }

    // One live round trip through the whole pipeline:
    // page -> content script -> extension background -> network -> back.
    const probes = [
      "https://www.google.com/generate_204",
      "https://www.cloudflare.com/cdn-cgi/trace",
    ];
    for (const url of probes) {
      try {
        const res = await bridgeFetch(url, { timeout: Math.max(3500, timeout - 2500), as: "text" });
        const ok = res && (res.ok === true || (res.status >= 200 && res.status < 400));
        if (ok) {
          resolve({
            ok: true,
            level: "fetch",
            info: { ...info, viaBackground: res.binary === false },
            why: `Live proxy fetch answered HTTP ${res.status} — the relay works end to end.`,
          });
          return;
        }
      } catch (e) {
        /* try the next probe */
      }
    }

    resolve({
      ok: false,
      level: "presence",
      why: "The helper answers pings, but a live proxied fetch failed. Check the network, or reload the extension at the browser's add-ons page and this tab.",
    });
  });
}

/**
 * Fetch a URL through the extension.
 * Rejects with a descriptive Error when the bridge is not installed.
 */
export function bridgeFetch(url, { timeout = 20000, as = "text" } = {}) {
  if (!info) {
    return Promise.reject(new Error("The WebOS Browser Helper extension is not installed."));
  }
  const id = `r${++rid}_${Date.now().toString(36)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingFetch.delete(id);
      reject(new Error("The request timed out."));
    }, timeout);
    pendingFetch.set(id, { resolve, reject, timer });
    window.postMessage({ src: SRC, type: "fetch", rid: id, url, as }, "*");
  });
}

/**
 * Ask the helper's background to chat with the AI endpoint (it holds the
 * token handshake pages cannot do). Resolves { ok, text, model }.
 */
export function aiChat(messages, { timeout = 50000 } = {}) {
  if (!info) {
    return Promise.reject(new Error("The WebOS Browser Helper extension is not installed."));
  }
  const id = `ai${++rid}_${Date.now().toString(36)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAI.delete(id);
      reject(new Error("The AI request timed out."));
    }, timeout);
    pendingAI.set(id, { resolve, reject, timer });
    try {
      window.postMessage({ src: SRC, type: "ai-chat", rid: id, messages }, "*");
    } catch (e) {
      pendingAI.delete(id);
      clearTimeout(timer);
      reject(e);
    }
  });
}

export default {
  startBridge,
  checkBridge,
  verifyBridge,
  bridgeFetch,
  bridgeReady,
  bridgeInfo,
  aiChat,
};

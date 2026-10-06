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

import React, { useEffect, useRef, useState } from "react";
import { getUser, saveUser, sha256, initDefaultFS, idb } from "../../utils/idb";
import { verifyBridge, startBridge } from "../../utils/os/bridge";
import { notify } from "../../utils/os/ui";
import { BROWSER_LOGOS } from "./BrowserLogos";
import "./oobe.scss";

export const Win11Logo = ({ className = "", fill = "#fff" }) => (
  <svg className={`win11-logo ${className}`} viewBox="0 0 88 88" aria-hidden>
    <rect x="0" y="0" width="40" height="40" fill={fill} />
    <rect x="48" y="0" width="40" height="40" fill={fill} />
    <rect x="0" y="48" width="40" height="40" fill={fill} />
    <rect x="48" y="48" width="40" height="40" fill={fill} />
  </svg>
);

export const MsSquares = ({ className = "ms-squares" }) => (
  <svg className={className} viewBox="0 0 21 21" aria-hidden>
    <rect x="0" y="0" width="10" height="10" fill="#f25022" />
    <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
    <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
    <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
  </svg>
);

export const ProgressRing = ({ dark = false }) => (
  <svg className="oobe-ring progressRing" height={48} width={48} viewBox="0 0 16 16">
    <circle cx="8px" cy="8px" r="7px" style={dark ? { stroke: "#0067c0" } : undefined} />
  </svg>
);

const IcoShield = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 3l8 3v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6l8-3z"
      stroke="#fff"
      strokeWidth="1.6"
    />
    <path
      d="M9 12l2 2 4-4"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const IcoApps = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="#fff" strokeWidth="1.6" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="#fff" strokeWidth="1.6" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="#fff" strokeWidth="1.6" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="#fff" strokeWidth="1.6" />
  </svg>
);
const IcoGlobe = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.6" />
    <path
      d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"
      stroke="#fff"
      strokeWidth="1.4"
    />
  </svg>
);
const IcoFolder = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none">
    <path
      d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10z"
      stroke="#fff"
      strokeWidth="1.6"
    />
  </svg>
);

/* CONTROL.env (baked at build time): ES: OFF keeps the OOBE free of the
   browser-extension screens — the default, plain-browser build. */
const CONTROL = typeof __WOS_CONTROL__ !== "undefined" ? __WOS_CONTROL__ : {};
const EXT_SCREEN =
  String(CONTROL.ES || "OFF")
    .trim()
    .toUpperCase() === "ON";

const STEPS = {
  WELCOME: 0, // screen 1 — "Warm Welcome"
  INFO: 1, // screen 2 — "A few things you should know"
  EXTENSIONS: 2, // NEW      — "Before we go" / choose your browser
  EXTHELP: 3, // NEW      — install instructions + verify
  UNDERSTAND: 4, // screen 3 — "Ready when you are" (5 second lock)
  USERNAME: 5,
  PASSWORD: 6,
  WORKING: 7,
};

/* ------------------------------------------------------------------ *
 *  The four browsers the helper extension can be installed into.
 *  The extension itself lives in /extensions at the root of the repo.
 * ------------------------------------------------------------------ */
const BROWSERS = [
  {
    key: "edge",
    name: "Microsoft Edge",
    folder: "extensions/edge",
    url: "https://www.microsoft.com/edge/download",
    steps: [
      "Copy the extensions/edge folder out of this project onto your PC.",
      "Type edge://extensions in the address bar and press Enter.",
      "Turn on Developer mode with the switch in the bottom-left corner.",
      "Click Load unpacked and choose the extensions/edge folder.",
      "Come back to this tab and press Reload.",
    ],
    note: "Edge keeps unpacked extensions until you remove them, so this only has to be done once.",
  },
  {
    key: "chrome",
    name: "Google Chrome",
    folder: "extensions/chrome",
    url: "https://www.google.com/chrome/",
    steps: [
      "Copy the extensions/chrome folder out of this project onto your PC.",
      "Type chrome://extensions in the address bar and press Enter.",
      "Turn on Developer mode with the switch in the top-right corner.",
      "Click Load unpacked and choose the extensions/chrome folder.",
      "Come back to this tab and press Reload.",
    ],
    note: 'Chrome shows a "Turn off developer mode extensions" bubble on start-up — just dismiss it, the helper keeps working.',
  },
  {
    key: "firefox",
    name: "Mozilla Firefox",
    folder: "extensions/firefox",
    url: "https://www.mozilla.org/firefox/download/",
    steps: [
      "Type about:debugging#/runtime/this-firefox in the address bar.",
      "Click Load Temporary Add-on…",
      "Open extensions/firefox/manifest.json from this project.",
      "Come back to this tab and press Reload.",
      "For a permanent install, zip manifest.json and content.js at the root of the archive, rename it to webos-helper.xpi and open it — Firefox needs the add-on signed unless you are on Developer Edition.",
    ],
    note: "Temporary add-ons are removed when Firefox closes, so you will repeat this after a restart.",
  },
  {
    key: "safari",
    name: "Safari",
    folder: "extensions/safari/webos-helper",
    url: "https://developer.apple.com/documentation/safariservices/safari_web_extensions",
    steps: [
      "Safari cannot load a loose folder — it needs an Xcode app bundle (macOS).",
      "In Xcode choose File ▸ New ▸ Project… ▸ Safari Extension App.",
      "Replace the generated Resources with extensions/safari/webos-helper/manifest.json and content.js.",
      "Choose Product ▸ Run, then open Safari ▸ Settings ▸ Extensions and tick WebOS Browser Helper.",
      "On iPadOS: Settings ▸ Safari ▸ Extensions ▸ WebOS Browser Helper, and allow it on all websites.",
      "Come back to this tab and press Reload.",
    ],
    note: "Never used a Mac? Pick Edge, Chrome or Firefox — the helper is identical in all of them.",
  },
];

export default function OOBE({ onComplete }) {
  const [step, setStep] = useState(STEPS.WELCOME);
  const [leaving, setLeaving] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [lockLeft, setLockLeft] = useState(5);
  /* extension step */
  const [extPick, setExtPick] = useState(null);
  const [extView, setExtView] = useState("ask"); // ask | pick | help
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const userRef = useRef(null);
  const passRef = useRef(null);

  // start listening for the helper as soon as the setup wizard is on screen
  useEffect(() => {
    startBridge();
  }, []);

  useEffect(() => {
    if (step !== STEPS.UNDERSTAND) return;
    setLockLeft(5);
    const t = setInterval(() => {
      setLockLeft((n) => {
        if (n <= 1) {
          clearInterval(t);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (step === STEPS.USERNAME) setTimeout(() => userRef.current?.focus(), 400);
    if (step === STEPS.PASSWORD) setTimeout(() => passRef.current?.focus(), 400);
  }, [step]);

  useEffect(() => {
    if (step !== STEPS.WORKING) return;
    let cancelled = false;
    (async () => {
      const clean = username.trim() || "User";
      const user = {
        username: clean,
        passwordHash: await sha256(password),
        setupComplete: true,
        createdAt: Date.now(),
      };
      await saveUser(user);
      await idb.set("setting.person.name", clean);
      // the Virtual Storage was first built before this account existed —
      // hand it the real name so the profile folder stops being a placeholder
      try {
        const vs = await import("../../utils/os/vs");
        await vs.applyUserName(clean);
      } catch (e) {}
      await initDefaultFS(clean);
      try {
        // Deep merge over the *defaults*, not over whatever partial blob may
        // already be sitting in localStorage — a partial `setting` object is
        // what used to wipe person.theme and reset the OS to light on boot.
        const { readStoredSettings, writeStoredSettings } = await import("../../utils/os/theme");
        const sett = readStoredSettings();
        sett.person = { ...(sett.person || {}), name: clean };
        writeStoredSettings(sett);
        await idb.set("setting", sett);
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 2000));
      if (!cancelled) onComplete(user);
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const go = (next) => {
    setLeaving(true);
    setError("");
    setTimeout(() => {
      setStep(next);
      setLeaving(false);
    }, 240);
  };

  const submitUser = () => {
    const name = username.trim();
    if (!name) {
      setError("Please enter a username.");
      return;
    }
    if (name.length > 20) {
      setError("Username must be 20 characters or fewer.");
      return;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      setError("Use letters, numbers, dots, hyphens or underscores only.");
      return;
    }
    go(STEPS.PASSWORD);
  };

  const submitPass = () => {
    if (!password) {
      setError("Please enter a password. This will lock your PC.");
      return;
    }
    if (password.length < 4) {
      setError("Use at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match. Try again.");
      return;
    }
    go(STEPS.WORKING);
  };

  const onKey = (e, fn) => {
    if (e.key === "Enter") fn();
  };

  const blue =
    step === STEPS.WELCOME ||
    step === STEPS.INFO ||
    step === STEPS.EXTENSIONS ||
    step === STEPS.EXTHELP ||
    step === STEPS.UNDERSTAND ||
    step === STEPS.WORKING;

  /* ---------------- extension step helpers ---------------- */
  const skipExtensions = () => {
    idb.set("ext", { skipped: true, at: Date.now() }).catch(() => {});
    go(STEPS.UNDERSTAND);
  };

  const verifyExtension = async () => {
    setVerifying(true);
    setVerifyMsg(null);
    // REAL verification: ping + one live proxied fetch round-trip.
    const verdict = await verifyBridge(9000);
    setVerifying(false);
    if (verdict.ok) {
      const v = verdict.info || {};
      setVerifyMsg({
        ok: true,
        text: `WebOS Browser Helper ${v.version || ""} is on and the fetch relay is proven working (${verdict.why})`,
      });
      idb
        .set("ext", {
          installed: true,
          id: v.id,
          version: v.version,
          browser: v.browser,
          at: Date.now(),
        })
        .catch(() => {});
      notify({
        app: "Windows Security",
        icon: "img/icon/security.png",
        title: "Extension verified",
        body: `${v.browser || "Browser"} is now allowed to browse the web for this PC.`,
        kind: "success",
      });
      setTimeout(() => go(STEPS.UNDERSTAND), 1100);
    } else {
      setVerifyMsg({
        ok: false,
        text:
          verdict.level === "absent"
            ? "You haven't enabled the extension yet. Load it in your browser, press Reload on this tab, then verify again — or go back and continue without it."
            : `The helper is present but NOT working: ${verdict.why}`,
      });
    }
  };

  return (
    <div className={`oobe-root ${blue ? "oobe-blue" : "oobe-mslogin"}`}>
      {blue && <div className="oobe-bloom" />}
      <div className="oobe-stage">
        {step === STEPS.WELCOME && (
          <div className={`oobe-page ${leaving ? "leave" : ""}`}>
            <Win11Logo />
            <div className="oobe-kicker">Windows Setup</div>
            <h1 className="oobe-title">Warm Welcome to this WebOS.</h1>
            <p className="oobe-sub">Please press next to continue</p>
            <div className="oobe-actions">
              <button className="oobe-btn primary" onClick={() => go(STEPS.INFO)}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === STEPS.INFO && (
          <div className={`oobe-page ${leaving ? "leave" : ""}`}>
            <Win11Logo className="sm" />
            <div className="oobe-kicker">About this PC</div>
            <h1 className="oobe-title">Win11 WebOS</h1>
            <div className="oobe-cards">
              <div className="oobe-card">
                <IcoApps />
                <h3>Real apps, not placeholders</h3>
                <p>
                  Start menu, File Explorer, Store, Browser, Terminal, Calendar, Photos, Mail and
                  more are wired up and usable.
                </p>
              </div>
              <div className="oobe-card">
                <IcoFolder />
                <h3>Your PC lives in IndexedDB</h3>
                <p>
                  Files, notes, installed apps and your account stay on this device. Closing the tab
                  does not wipe them.
                </p>
              </div>
              <div className="oobe-card">
                <IcoGlobe />
                <h3>Browser, the Windows way</h3>
                <p>
                  Search the web inside Microsoft Edge. Pop-ups stay in this OS — nothing hijacks a
                  new browser tab.
                </p>
              </div>
              <div className="oobe-card">
                <IcoShield />
                <h3>A lock only you can open</h3>
                <p>
                  Next you will create a local username and password. That password is what unlocks
                  this PC every time.
                </p>
              </div>
            </div>
            <div className="oobe-actions">
              <button className="oobe-btn ghost" onClick={() => go(STEPS.WELCOME)}>
                Back
              </button>
              <button
                className="oobe-btn primary"
                onClick={() => go(EXT_SCREEN ? STEPS.EXTENSIONS : STEPS.UNDERSTAND)}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            NEW — screen between 2 and 3: the browser helper extension
            ============================================================ */}
        {step === STEPS.EXTENSIONS && extView === "ask" && (
          <div className={`oobe-page ${leaving ? "leave" : ""}`}>
            <Win11Logo className="sm" />
            <div className="oobe-kicker">Windows Setup</div>
            <h1 className="oobe-title">Showing there before we go</h1>
            <p className="oobe-sub">
              The browser has a CORS policy which restricts how many websites it is allowed to show.
              A web page simply cannot read another website — that rule lives in your browser, not
              in this OS.
            </p>

            <div className="extExplainer">
              <div className="extDiagram">
                <div className="extNode you">
                  <span className="extDot" />
                  <b>This PC</b>
                  <i>webos / Edge app</i>
                </div>
                <div className="extLink blocked">
                  <svg viewBox="0 0 64 16" width="64" height="16" aria-hidden>
                    <path
                      d="M2 8h52"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeDasharray="4 4"
                      fill="none"
                    />
                    <path
                      d="M52 3l8 5-8 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <em>CORS blocked</em>
                </div>
                <div className="extNode web">
                  <span className="extDot" />
                  <b>example.com</b>
                  <i>most of the web</i>
                </div>
              </div>
              <p>
                To make your browsing fully functional we need to add an extension. It runs inside
                your real browser, fetches the page <b>for</b> this OS and hands it over. Then
                Microsoft Edge here can open almost any website instead of only the ones that allow
                framing.
              </p>
              <div className="extFacts">
                <span>
                  <b>No account.</b> Nothing is uploaded anywhere.
                </span>
                <span>
                  <b>No background service.</b> It only answers this tab.
                </span>
                <span>
                  <b>Optional.</b> You can add it later from Edge ▸ Settings.
                </span>
              </div>
            </div>

            <div className="oobe-actions">
              <button className="oobe-btn primary" onClick={() => setExtView("pick")}>
                Add Extensions
              </button>
              <button className="oobe-btn ghost" onClick={skipExtensions}>
                Continue without adding
              </button>
            </div>
            <div className="oobe-backlink">
              <button type="button" onClick={() => go(STEPS.INFO)}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === STEPS.EXTENSIONS && extView === "pick" && (
          <div className={`oobe-page extPickPage ${leaving ? "leave" : ""}`}>
            <div className="oobe-kicker">Add extension</div>
            <h1 className="oobe-title">Choose your browser</h1>
            <p className="oobe-sub">
              Pick the browser you are reading this in. The helper is the same extension for all of
              them — only the way you load it changes.
            </p>

            <div className="extGrid">
              {BROWSERS.map((b, i) => {
                const Logo = BROWSER_LOGOS[b.key];
                return (
                  <button
                    type="button"
                    key={b.key}
                    className="extCard"
                    style={{ animationDelay: `${80 + i * 70}ms` }}
                    onClick={() => {
                      setExtPick(b.key);
                      setVerifyMsg(null);
                      go(STEPS.EXTHELP);
                    }}
                  >
                    <Logo size={62} />
                    <b>{b.name}</b>
                    <i>{b.folder}</i>
                  </button>
                );
              })}
            </div>

            <div className="oobe-actions">
              <button className="oobe-btn ghost" onClick={() => setExtView("ask")}>
                Return
              </button>
              <button className="oobe-btn ghost" onClick={skipExtensions}>
                Continue without adding
              </button>
            </div>
          </div>
        )}

        {step === STEPS.EXTHELP && (
          <div className={`oobe-page extHelpPage ${leaving ? "leave" : ""}`}>
            {(() => {
              const b = BROWSERS.find((x) => x.key === extPick) || BROWSERS[0];
              const Logo = BROWSER_LOGOS[b.key];
              return (
                <>
                  <div className="extHelpHead">
                    <Logo size={44} />
                    <div>
                      <div className="oobe-kicker">Install the helper</div>
                      <h1 className="oobe-title">{b.name}</h1>
                    </div>
                  </div>

                  <ol className="extSteps">
                    {b.steps.map((t, i) => (
                      <li key={i} style={{ animationDelay: `${100 + i * 70}ms` }}>
                        <span className="extStepNo">{i + 1}</span>
                        <p>{t}</p>
                      </li>
                    ))}
                  </ol>

                  <div className="extNote">
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <path
                        d="M12 11v6M12 7.6v.8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>{b.note}</span>
                  </div>

                  <div className="extPath">
                    <code>{b.folder}</code>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard?.writeText(b.folder);
                          notify({
                            app: "Setup",
                            title: "Folder path copied",
                            body: b.folder,
                            kind: "success",
                            life: 3,
                          });
                        } catch (e) {}
                      }}
                    >
                      Copy path
                    </button>
                  </div>

                  {verifyMsg ? (
                    <div className={`extVerifyMsg ${verifyMsg.ok ? "ok" : "no"}`}>
                      {verifyMsg.ok ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M8 12.4l2.6 2.6L16 9.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                          <circle
                            cx="12"
                            cy="12"
                            r="9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M12 7.6v6.2M12 16.6v.6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      <span>{verifyMsg.text}</span>
                    </div>
                  ) : null}

                  <div className="oobe-actions">
                    <button
                      className="oobe-btn primary"
                      disabled={verifying}
                      onClick={verifyExtension}
                    >
                      {verifying ? "Checking…" : "Verify extension"}
                    </button>
                    <button
                      className="oobe-btn ghost"
                      onClick={() => {
                        setExtPick(null);
                        setVerifyMsg(null);
                        go(STEPS.EXTENSIONS);
                        setTimeout(() => setExtView("pick"), 260);
                      }}
                    >
                      Return
                    </button>
                    <button className="oobe-btn ghost" onClick={skipExtensions}>
                      Continue without adding
                    </button>
                  </div>

                  {verifying ? (
                    <div className="extSpin">
                      <ProgressRing />
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        )}

        {step === STEPS.UNDERSTAND && (
          <div className={`oobe-page ${leaving ? "leave" : ""}`}>
            <Win11Logo />
            <h1 className="oobe-title">Ready when you are</h1>
            <p className="oobe-sub">
              WebOS is a community project inspired by Windows 11. It is not a product of Microsoft.
              Your password never leaves this browser. Take a moment, then continue.
            </p>
            <div className="oobe-lockhint">
              {lockLeft > 0
                ? `You can continue in ${lockLeft} second${lockLeft === 1 ? "" : "s"}`
                : "You can continue"}
            </div>
            <div className="oobe-actions">
              <button className="oobe-btn ghost" onClick={() => go(STEPS.EXTENSIONS)}>
                Back
              </button>
              <button
                className="oobe-btn primary"
                disabled={lockLeft > 0}
                onClick={() => go(STEPS.USERNAME)}
              >
                OK, I understand
              </button>
            </div>
          </div>
        )}

        {(step === STEPS.USERNAME || step === STEPS.PASSWORD) && (
          <div className="ms-wrap">
            <div className={`ms-card ${leaving ? "leave" : ""}`}>
              <div className="ms-wordmark">
                <MsSquares />
                Microsoft
              </div>
              {step === STEPS.USERNAME ? (
                <>
                  <h1>Sign in</h1>
                  <div className="ms-desc">Please enter a Username</div>
                  <div className="ms-field">
                    <input
                      ref={userRef}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => onKey(e, submitUser)}
                      placeholder="Username"
                      autoComplete="username"
                      spellCheck={false}
                    />
                  </div>
                  {error && <div className="ms-error">{error}</div>}
                  <div className="ms-row">
                    <button className="oobe-btn accent" onClick={submitUser}>
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1>{username}</h1>
                  <div className="ms-desc">Please enter a password which would be your PC lock</div>
                  <div className="ms-field">
                    <input
                      ref={passRef}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="ms-field">
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => onKey(e, submitPass)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                  </div>
                  {error && <div className="ms-error">{error}</div>}
                  <div className="ms-row" style={{ justifyContent: "space-between" }}>
                    <button
                      className="oobe-btn ghost"
                      style={{ color: "#0067c0", borderColor: "#d1d1d1", background: "#fff" }}
                      onClick={() => go(STEPS.USERNAME)}
                    >
                      Back
                    </button>
                    <button className="oobe-btn accent" onClick={submitPass}>
                      Sign in
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="ms-footer">
              <span>Terms of use</span>
              <span>Privacy &amp; cookies</span>
              <span>…</span>
            </div>
          </div>
        )}

        {step === STEPS.WORKING && (
          <div className={`oobe-page oobe-working ${leaving ? "leave" : ""}`}>
            <ProgressRing />
            <h1 className="oobe-title">We are working, just wait a moment...</h1>
            <p className="oobe-sub">Setting up your account and preparing this PC</p>
          </div>
        )}
      </div>
    </div>
  );
}

export { getUser };

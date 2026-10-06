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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../../rotategate.scss";

/* ==================================================================
   The landscape gate — phones only, portrait only, and ON by default.

   A phone held upright gets this screen instead of a cramped desktop:
   the OS is a desktop experience, so the gate says so and offers one
   button that does the whole job — full screen + orientation lock +
   haptics — with an honest status line when a browser refuses.

   Turn the phone sideways (by hand or via the button) and the gate
   disappears; turn it back and it returns. There is no dismiss state.

   Escapes, in order of preference:
     • tap the button            — the OS asks the browser to rotate
     • "Use portrait mode"       — appears only after the browser has made
                                   it clear it cannot lock orientation;
                                   remembers the choice for this PC
     • localStorage "wos.rotateGate" = "off"   — the same flag, by hand
   ================================================================== */

const RG_KEY = "wos.rotateGate";
const RG_Z = 2147483647; // the ceiling — nothing in this OS sits above the gate
const LOCK_MODES = ["landscape", "landscape-primary", "landscape-secondary"];

/* Which devices get the gate?
   A touch device whose *short* screen side is 740 CSS px or less — every phone
   made, and nothing else. The screen is deliberately used instead of the
   viewport because it does not change when the device turns: a phone is a
   phone in both orientations, and the gate simply does not apply to the
   landscape one.

   Why not trust "mobile" alone: Chromium reports mobile: true for Android
   tablets, and every iPad runs WebKit with no userAgentData at all. The size
   test is the honest one; the platform hint can only veto (a touch laptop with
   a desktop UA never gets gated), never promote. Tablets (≥768) and touch
   laptops therefore keep their portrait PC — a portrait tablet is a fine
   desktop. 740 matches the CSS breakpoint in src/mobile.scss. */
export const isPhone = () => {
  const touch = (navigator.maxTouchPoints || 0) > 0;
  if (!touch) return false;
  const w = window.screen?.width || 0;
  const h = window.screen?.height || 0;
  const short = Math.min(w || 9999, h || 9999);
  if (!(short <= 740)) return false;
  try {
    if (navigator.userAgentData?.mobile === false) return false;
  } catch (e) {}
  return true;
};

const isPortrait = () => {
  try {
    const mq = window.matchMedia("(orientation: portrait)");
    if (mq && typeof mq.matches === "boolean") return mq.matches;
  } catch (e) {}
  return window.innerHeight > window.innerWidth;
};

const gateEnabled = () => {
  try {
    return localStorage.getItem(RG_KEY) !== "off";
  } catch (e) {
    return true; // no storage (sandboxed frame): keep the OS's own default
  }
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const STATUS = {
  idle: "One tap: full screen, then landscape. No menus to hunt for.",
  requesting: "Asking your browser to rotate…",
  locked: "Landscape locked — you're set.",
  unsupported: "This browser won't lock orientation — just turn the phone sideways.",
};
const UNSUPPORTED_NO_FS =
  "This browser won't lock orientation and gives the page no full screen either — just turn the phone sideways. Add the OS to your Home Screen and it opens full screen next time.";
const STALLED_STATUS =
  "Landscape is locked, but the screen hasn't turned. Your phone's own rotation lock is probably on — switch it off in Control Centre, or use portrait mode.";

export const RotateGate = () => {
  const [on, setOn] = useState(() => isPhone() && gateEnabled());
  const [portrait, setPortrait] = useState(isPortrait);
  const [phase, setPhase] = useState("idle");
  /* a resolved lock is not a promise that the screen moved: a phone with its
     own rotation lock on (or a headless/desktop viewport) reports success and
     stays upright. If the orientation has not changed a moment later, say so. */
  const [stalled, setStalled] = useState(false);
  const [tilt, setTilt] = useState(0);
  /* what the motion sensor is actually reporting: degrees still to turn, and
     whether a real reading has arrived at all (a desktop has no sensor, so the
     gate falls back to its own animation) */
  const [turnLeft, setTurnLeft] = useState(null);
  const [roll, setRoll] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [noFullscreen, setNoFullscreen] = useState(false);
  /* Settings ▸ Personalisation ▸ Rotate prompt can show this screen on any
     device (a desktop included) by dispatching "wos:rotateGatePreview". */
  const [preview, setPreview] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const btnRef = useRef(null);
  const stallTimer = useRef(0);
  const aliveRef = useRef(true);

  /* ---------------- device class + orientation, from every signal ---------------- */
  useEffect(() => {
    const update = () => {
      setOn(isPhone() && gateEnabled());
      setPortrait(isPortrait());
    };
    const mq = (() => {
      try {
        return window.matchMedia("(orientation: portrait)");
      } catch (e) {
        return null;
      }
    })();
    const so = window.screen?.orientation;

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    mq?.addEventListener?.("change", update);
    so?.addEventListener?.("change", update);

    /* a landscape device at boot: never flash the gate */
    update();

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      mq?.removeEventListener?.("change", update);
      so?.removeEventListener?.("change", update);
    };
  }, []);

  /* ---------------- live tilt: the phone illustration follows the real device ---------------- */
  useEffect(() => {
    if (!on || !portrait) return;
    if (!("DeviceOrientationEvent" in window)) return;
    let frame = 0;
    const onTilt = (e) => {
      const g = typeof e.gamma === "number" ? e.gamma : null; // left/right roll, °
      if (g == null) return;
      const b = typeof e.beta === "number" ? e.beta : null; // front/back pitch, °
      // a phone lying flat reports a meaningless roll — ignore it rather than
      // show a dial that is guessing
      if (Math.abs(g) < 3 && b != null && Math.abs(b) < 15) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = clamp(g, -90, 90);
        setTilt(clamp(r, -35, 35));
        setRoll(r);
        setTurnLeft(Math.max(0, Math.round(90 - Math.abs(r))));
      });
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      window.removeEventListener("deviceorientation", onTilt);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [on, portrait]);

  useEffect(
    () => () => {
      aliveRef.current = false;
      if (stallTimer.current) clearTimeout(stallTimer.current);
    },
    [],
  );

  /* step 2 of the checklist is only true when the browser says it is */
  useEffect(() => {
    const upd = () =>
      setFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", upd);
    document.addEventListener("webkitfullscreenchange", upd);
    upd();
    return () => {
      document.removeEventListener("fullscreenchange", upd);
      document.removeEventListener("webkitfullscreenchange", upd);
    };
  }, []);

  /* an on-demand preview from Settings — renders the gate anywhere */
  useEffect(() => {
    const onPreview = () => {
      setPreview(true);
      setPhase("idle");
      setStalled(false);
      setAttempts(0);
      setNoFullscreen(false);
    };
    window.addEventListener("wos:rotateGatePreview", onPreview);
    return () => window.removeEventListener("wos:rotateGatePreview", onPreview);
  }, []);

  /* the layout actually turned: the stall warning (and the gate) can go */
  useEffect(() => {
    if (!portrait && stallTimer.current) {
      clearTimeout(stallTimer.current);
      stallTimer.current = 0;
      setStalled(false);
    }
  }, [portrait]);

  /* ---------------- the advanced tap: haptics → full screen → lock → verdict ---------------- */
  const rotate = useCallback(async () => {
    setAttempts((n) => n + 1);
    setPhase("requesting");

    // 1. a physical acknowledgement, when the device has a motor
    try {
      navigator.vibrate?.(12);
    } catch (e) {}

    // 2. motion sensors are gesture-gated on iOS — ask while we still have the gesture
    try {
      if (typeof window.DeviceOrientationEvent?.requestPermission === "function") {
        await window.DeviceOrientationEvent.requestPermission();
      }
    } catch (e) {}

    // 3. full screen first: some browsers only honour a lock once full screen
    const el = document.documentElement;
    const reqFS = el.requestFullscreen || el.webkitRequestFullscreen;
    try {
      if (!document.fullscreenElement && reqFS) {
        await reqFS.call(el, { navigationUI: "hide" });
      }
    } catch (e) {}

    // 4. the lock itself — try the generic mode, then each primary/secondary spelling
    const so = window.screen?.orientation;
    if (so && typeof so.lock === "function") {
      for (const mode of LOCK_MODES) {
        try {
          await so.lock(mode);
          setPhase("locked");
          if (stallTimer.current) clearTimeout(stallTimer.current);
          stallTimer.current = window.setTimeout(() => {
            stallTimer.current = 0;
            if (aliveRef.current && isPortrait()) setStalled(true);
          }, 1500);
          return;
        } catch (e) {
          const name = e?.name || "";
          // a refusal that no other spelling will fix (no support, or not full screen)
          if (name === "NotSupportedError" || name === "SecurityError") break;
        }
      }
    }

    // 5. honest verdict — the physical turn is the way from here
    setPhase("unsupported");
    if (!reqFS) setNoFullscreen(true);
  }, []);

  /* ---------------- the escape hatch: portrait, remembered ---------------- */
  const usePortrait = useCallback(() => {
    try {
      localStorage.setItem(RG_KEY, "off");
    } catch (e) {}
    setOn(false); // and let the OS lay itself out for a narrow screen
    setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }, []);

  if (!preview && (!on || !portrait)) return null;

  const busy = phase === "requesting";
  const label = busy
    ? "Rotating…"
    : phase === "locked"
      ? "Landscape locked"
      : phase === "unsupported"
        ? "Try again"
        : "Tap to rotate";
  const stuck = stalled || (attempts >= 2 && phase === "unsupported");
  const hasSensor = turnLeft != null;
  const progress = hasSensor ? clamp((90 - turnLeft) / 90, 0, 1) : 0;
  const near = hasSensor && turnLeft > 0 && turnLeft <= 12;
  /* the live checklist — every tick is something that really happened */
  const steps = [
    { t: "Tap the button", h: "asks for full screen + landscape", done: attempts > 0 },
    {
      t: "Full screen",
      h: fullscreen ? "the OS has the whole screen" : "a permission, if the browser asks",
      done: fullscreen,
    },
    {
      t: "Landscape",
      h: stalled ? "locked, but the screen never turned" : "the desktop lays itself out wide",
      done: phase === "locked" && !stalled,
    },
  ];

  return createPortal(
    <div
      className="wosRotateGate"
      data-rotategate="on"
      data-phase={phase}
      data-sensor={hasSensor ? "1" : "0"}
      data-turn={hasSensor ? String(turnLeft) : ""}
      data-near={near ? "1" : "0"}
      style={{ zIndex: RG_Z, "--prog": progress, "--roll": `${hasSensor ? roll : 0}deg` }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="rgTitle"
      aria-describedby="rgSub rgStatus"
    >
      <div className="rgStars" aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 61 + 13) % 100}%`,
              top: `${(i * 37 + 7) % 100}%`,
              animationDelay: `${((i * 0.29) % 2.4).toFixed(2)}s`,
              animationDuration: `${(2.1 + (i % 5) * 0.35).toFixed(2)}s`,
            }}
          />
        ))}
      </div>
      <div className="rgGlow" aria-hidden />

      <div className="rgPanel">
        <div className="rgStage" aria-hidden>
          <div className="rgPhoneWrap" style={{ "--tilt": `${tilt * 0.7}deg` }}>
            <svg className="rgArc" viewBox="0 0 160 160">
              <circle className="rgArcTrack" cx="80" cy="80" r="58" />
              <path className="rgArcPath" pathLength="100" d="M134 80 A54 54 0 1 1 80 26" />
              <path className="rgArrow" d="M80 12 l14 14 l-14 14" />
            </svg>

            <div className="rgPhone">
              <div className="rgScreen">
                <span className="rgWin" />
                <span className="rgWinBar" />
                <span className="rgTile a" />
                <span className="rgTile b" />
                <span className="rgTask">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>

            {/* the target: what the phone looks like once it is turned */}
            <div className="rgGhost" />

            {/* live telemetry — only when the device is really reporting an angle */}
            {hasSensor ? (
              <div className={`rgDial${near ? " near" : ""}`} aria-hidden>
                <b>{turnLeft}</b>
                <span>&deg; to go</span>
              </div>
            ) : null}
          </div>
        </div>

        <h2 className="rgTitle" id="rgTitle">
          Rotate your device
        </h2>
        <p className="rgSub" id="rgSub">
          Windows 11 WebOS is a desktop experience. Turn your phone sideways and the whole PC comes
          with you — Start, File Explorer, Edge, Solitaire and all.
        </p>

        <button
          type="button"
          ref={btnRef}
          className={`rgBtn${busy ? " busy" : ""}`}
          data-phase={phase}
          onClick={rotate}
          disabled={busy}
        >
          <span className="rgBtnRing" aria-hidden />
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path
              d="M7 9l-2.4-2.4A8 8 0 1 1 4 13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M4.6 3.4v3.6h3.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {label}
        </button>

        <p
          className="rgStatus"
          id="rgStatus"
          role="status"
          aria-live="polite"
          data-phase={stalled ? "stalled" : phase}
        >
          {stalled
            ? STALLED_STATUS
            : phase === "unsupported" && noFullscreen
              ? UNSUPPORTED_NO_FS
              : near
                ? `Almost there — ${turnLeft}° more.`
                : STATUS[phase]}
        </p>

        <ul className="rgSteps" aria-label="What happens when you tap">
          {steps.map((s2, i) => (
            <li key={s2.t} data-done={s2.done ? "1" : "0"}>
              <b aria-hidden>
                {s2.done ? (
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path
                      d="M5 13l4 4L19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </b>
              <span className="rgStepT">
                {s2.t}
                <em>{s2.h}</em>
              </span>
              <span className="rgStepState">{s2.done ? "done" : "waiting"}</span>
            </li>
          ))}
        </ul>

        {stuck && !preview ? (
          <button type="button" className="rgAlt" onClick={usePortrait}>
            Continue in portrait mode instead
          </button>
        ) : null}

        {preview ? (
          <button type="button" className="rgAlt" onClick={() => setPreview(false)}>
            Close preview
          </button>
        ) : null}

        <p className="rgFoot">
          {preview
            ? "Preview — phones in portrait get this screen automatically. Turn it off on the left if you'd rather always open in portrait mode."
            : stuck
              ? "Portrait mode is a fitted desktop — smaller, but fully usable. Turn this screen back on in Settings ▸ Personalisation ▸ Rotate prompt."
              : "This screen follows the phone: portrait is gated, landscape is the OS."}
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default RotateGate;

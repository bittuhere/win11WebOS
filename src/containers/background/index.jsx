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
import { useDispatch, useSelector } from "react-redux";
import Battery from "../../components/shared/Battery";
import { Icon, Image } from "../../utils/general";
import { getUser, verifyPassword } from "../../utils/idb";
import { Win11Logo, ProgressRing } from "../oobe";
import "./back.scss";

export const Background = () => {
  const wall = useSelector((state) => state.wallpaper);

  return (
    <div
      className="background"
      style={{
        backgroundImage: `url(img/wallpaper/${wall.src})`,
      }}
    ></div>
  );
};

export const BootScreen = (props) => {
  const dispatch = useDispatch();
  const wall = useSelector((state) => state.wallpaper);
  const [blackout, setBlackOut] = useState(false);
  const [off, setOff] = useState(false); // shut down all the way — power screen
  /* A boot that the user just started from the power screen. The old code
     relied on `dir`/`blackout` — values that were already in their final
     state — so the effects never ran again and the button did nothing. */
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (props.dir < 0) {
      setBlackOut(false);
      setOff(false);
      const t = setTimeout(() => setBlackOut(true), 4000);
      return () => clearTimeout(t);
    }
    setBlackOut(false);
    setOff(false);
  }, [props.dir, cycle]);

  useEffect(() => {
    if (props.dir >= 0 || !blackout) return;
    if (wall.act == "restart") {
      const a = setTimeout(() => {
        setBlackOut(false);
        const b = setTimeout(() => dispatch({ type: "WALLBOOTED" }), 4000);
      }, 2000);
    } else if (wall.act == "shutdn") {
      // the logo + spinner fade to black, then the power screen stays
      setTimeout(() => setOff(true), 1200);
    }
  }, [blackout, cycle]);

  /* Power on: show the real boot animation again, then hand over to the lock
     screen — exactly like a cold start. */
  const powerOn = () => {
    setOff(false);
    setBlackOut(false);
    dispatch({ type: "WALLPOWERON" });
    setCycle((c) => c + 1); // re-arms both effects for the new boot
    setTimeout(() => dispatch({ type: "WALLBOOTED" }), 4200);
  };

  return (
    <div className="bootscreen">
      <div className={blackout ? "hidden" : ""}>
        <Win11Logo fill="#fff" />
        <div className="mt-48" id="loader">
          <ProgressRing />
        </div>
      </div>
      {off && wall.act == "shutdn" && (
        <div className="powerOffScreen" data-poweroff="on">
          <Win11Logo fill="#3a3a3a" />
          <div className="poMsg">You have shut down your PC</div>
          <button className="poBtn" onClick={powerOn} aria-label="Power on">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 2v9" />
              <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
            </svg>
          </button>
          <div className="poHint">Power on</div>
        </div>
      )}
    </div>
  );
};

const UserAvatar = ({ name = "User", size = 120 }) => {
  const letter = (name || "U").trim().charAt(0).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="rounded-full overflow-hidden">
      <defs>
        <linearGradient id="avbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4cc2ff" />
          <stop offset="100%" stopColor="#0067c0" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#avbg)" />
      <circle cx="60" cy="46" r="20" fill="rgba(255,255,255,0.92)" />
      <path d="M24 108c6-24 22-36 36-36s30 12 36 36" fill="rgba(255,255,255,0.92)" />
      <text x="60" y="118" textAnchor="middle" fontSize="0" fill="transparent">
        {letter}
      </text>
    </svg>
  );
};

export const LockScreen = (props) => {
  const wall = useSelector((state) => state.wallpaper);
  const [lock, setLock] = useState(false);
  const [unlocked, setUnLock] = useState(false);
  const [password, setPass] = useState("");
  const [passType, setType] = useState(1);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [storedName, setStoredName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const dispatch = useDispatch();

  const reduxName = useSelector((state) => state.setting.person.name);
  const userName = storedName || reduxName || "User";

  useEffect(() => {
    getUser().then((u) => {
      if (u?.username) setStoredName(u.username);
    });
  }, []);

  useEffect(() => {
    if (lock) setTimeout(() => inputRef.current?.focus(), 420);
  }, [lock]);

  /**
   * `data-action` lives on the `.uicon` wrapper that <Icon> renders, but the
   * thing you actually click is the <img> inside it — so `e.target.dataset`
   * was always empty and the sign-in option buttons never fired. Walking up
   * with closest() fixes the PIN / keyboard toggle (and the splash click).
   */
  const actOf = (e) => {
    const el = e.target?.closest?.("[data-action]") || null;
    return { act: el?.dataset?.action || "", el };
  };

  const action = (e) => {
    const { act } = actOf(e);
    if (act === "splash" && !lock) setLock(true);
    else if (act === "pinlock") choosePin();
    else if (act === "passkey") chooseKey();
  };

  /** Numeric PIN pad (Windows Hello style) — digits only, max 4. */
  const choosePin = () => {
    setType(0);
    setPass((p) => p.replace(/[^0-9]/g, "").slice(0, 4));
    setError("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  /** Full keyboard — any character. */
  const chooseKey = () => {
    setType(1);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const onPass = (e) => {
    let val = e.target.value;
    if (!passType) {
      // the numerical keyboard: strip everything that is not a digit
      val = val.replace(/[^0-9]/g, "").slice(0, 4);
    }
    setError("");
    setPass(val);
  };

  const proceed = async () => {
    if (busy) return;
    setBusy(true);
    const user = await getUser();
    if (user && user.passwordHash) {
      const ok = await verifyPassword(password);
      if (!ok) {
        setError("The password is incorrect. Try again.");
        setShaking(true);
        setTimeout(() => setShaking(false), 420);
        setPass("");
        setBusy(false);
        inputRef.current?.focus();
        return;
      }
    }
    setUnLock(true);
    setTimeout(() => {
      dispatch({ type: "WALLUNLOCK" });
    }, 700);
  };

  const action2 = (e) => {
    if (e.key == "Enter") proceed();
  };

  return (
    <div
      className={"lockscreen " + (props.dir == -1 ? "slowfadein" : "")}
      data-unlock={unlocked}
      style={{
        backgroundImage: `url(${`img/wallpaper/lock.jpg`})`,
      }}
      onClick={action}
      data-action="splash"
      data-blur={lock}
    >
      <div className="splashScreen mt-40" data-faded={lock}>
        <div className="text-6xl font-semibold text-gray-100">
          {new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "numeric",
            hour12: true,
          })}
        </div>
        <div className="text-lg font-medium text-gray-200">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>
      <div className="fadeinScreen" data-faded={!lock} data-unlock={unlocked}>
        <UserAvatar name={userName} size={120} />
        <div className="mt-4 text-2xl font-medium text-gray-200">{userName}</div>
        <div className={`lockPassRow ${shaking ? "shake" : ""}`}>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={onPass}
            onKeyDown={action2}
            onClick={(e) => e.stopPropagation()}
            placeholder={passType ? "Password" : "PIN"}
            autoComplete="current-password"
            inputMode={passType ? "text" : "numeric"}
            pattern={passType ? undefined : "[0-9]*"}
            maxLength={passType ? 64 : 4}
            spellCheck={false}
          />
          <button
            className="lockGo"
            onClick={(e) => {
              e.stopPropagation();
              proceed();
            }}
            aria-label="Submit"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        {error ? <div className="lockErr">{error}</div> : <div className="lockErr spacer" />}
        <div className="text-xs text-gray-300 mt-1">Sign-in options</div>
        <div className="lockOpt flex" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="lockOptBtn"
            data-on={!passType}
            data-action="pinlock"
            title="PIN — numeric keyboard"
            aria-label="Sign in with a PIN"
            aria-pressed={!passType}
            onClick={(e) => {
              e.stopPropagation();
              choosePin();
            }}
          >
            <img src="img/icon/ui/pinlock.png" width="32" height="32" alt="" draggable="false" />
          </button>
          <button
            type="button"
            className="lockOptBtn"
            data-on={!!passType}
            data-action="passkey"
            title="Password — full keyboard"
            aria-label="Sign in with a password"
            aria-pressed={!!passType}
            onClick={(e) => {
              e.stopPropagation();
              chooseKey();
            }}
          >
            <img src="img/icon/ui/passkey.png" width="32" height="32" alt="" draggable="false" />
          </button>
        </div>
        <div className="lockOptHint">
          {passType ? "Password — full keyboard" : "PIN — numbers only"}
        </div>
      </div>
      <div className="bottomInfo flex">
        <Icon className="mx-2" src="wifi" ui width={16} invert />
        <Battery invert />
      </div>
    </div>
  );
};

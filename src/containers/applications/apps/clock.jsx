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
import { useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb, uid } from "../../../utils/idb";
import { notify } from "../../../utils/os/ui";
import "./extras.scss";

/*
 * The Windows 11 Clock — focus timer, stopwatch with laps, world clock
 * and alarms that actually fire (toast + a chime from WebAudio).
 */

const chime = (() => {
  let ctx = null;
  return (times = 3) => {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      let t = ctx.currentTime;
      for (let i = 0; i < times; i++) {
        [880, 1108.7, 1318.5].forEach((f) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = f;
          o.type = "sine";
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          o.connect(g).connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.55);
        });
        t += 0.65;
      }
    } catch (e) {}
  };
})();

const fmtHMS = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
const fmtSW = (ms) => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

const ZONES = [
  ["Local", undefined],
  ["New York", "America/New_York"],
  ["London", "Europe/London"],
  ["Paris", "Europe/Paris"],
  ["Dubai", "Asia/Dubai"],
  ["Kolkata", "Asia/Kolkata"],
  ["Tokyo", "Asia/Tokyo"],
  ["Sydney", "Australia/Sydney"],
  ["Los Angeles", "America/Los_Angeles"],
];

export const ClockApp = () => {
  const wnapp = useSelector((s) => s.apps.alarm);
  const [tab, setTab] = useState("focus");

  const [now, setNow] = useState(new Date());
  const [ms, setMs] = useState(0);
  const [swRun, setSwRun] = useState(false);
  const [laps, setLaps] = useState([]);
  const [total, setTotal] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [timerOn, setTimerOn] = useState(false);
  const [alarms, setAlarms] = useState([]);
  const [fired, setFired] = useState({});
  const [ah, setAh] = useState("07");
  const [am, setAm] = useState("00");
  const ringRef = useRef(null);

  /* heartbeat */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* stopwatch */
  useEffect(() => {
    if (!swRun) return;
    const t = setInterval(() => setMs((x) => x + 50), 50);
    return () => clearInterval(t);
  }, [swRun]);

  /* timer */
  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => {
      setLeft((x) => {
        if (x <= 1) {
          setTimerOn(false);
          chime(3);
          notify({
            app: "Clock",
            icon: "img/icon/alarm.png",
            title: "Focus session complete",
            body: `${Math.round(total / 60)} minutes done. Take a break ☕`,
            kind: "success",
            life: 8,
          });
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [timerOn, total]);

  /* alarms */
  useEffect(() => {
    idb
      .getAll("alarms")
      .then((r) => setAlarms(r || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    // alarms ring on ANY tab while Clock is running (matches real Windows);
    // they can't fire while the app is closed — noted in the tab footer
    const key = now.toTimeString().slice(0, 5); // HH:MM
    alarms.forEach((a) => {
      if (a.on && a.time === key && !fired[a.id + key]) {
        setFired((f) => ({ ...f, [a.id + key]: true }));
        chime(2);
        notify({
          app: "Clock",
          icon: "img/icon/alarm.png",
          title: `Alarm · ${a.time}`,
          body: a.label || "Wake up!",
          kind: "info",
          life: 10,
        });
      }
    });
  }, [now, alarms, fired]);

  if (!wnapp || !wnapp.alive) return null;

  const saveAlarm = async (a) => {
    await idb.put("alarms", a);
    setAlarms(await idb.getAll("alarms"));
  };
  const delAlarm = async (id) => {
    await idb.deleteFrom("alarms", id);
    setAlarms(await idb.getAll("alarms"));
  };

  const arc = timerOn || left ? (total ? 1 - left / total : 0) : 0;
  const R = 86;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="floatTab dpShad extraApp"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Clock" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow overflow-hidden extraFill">
          <div className="winPad clkPad">
            <div className="clkTabs">
              {[
                ["focus", "Focus"],
                ["timer", "Timer"],
                ["stopwatch", "Stopwatch"],
                ["world", "World"],
                ["alarm", "Alarm"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`winBtn ghost ${tab === id ? "on" : ""}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ---------------- focus / timer ---------------- */}
            {(tab === "focus" || tab === "timer") && (
              <div className="clkCenter clkPane" key={tab}>
                <div className="clkRing" ref={ringRef}>
                  <svg viewBox="0 0 200 200" width="200" height="200">
                    <circle cx="100" cy="100" r={R} className="clkRingBg" />
                    {/* the live analog face — like the real Clock's focus dial */}
                    <g className="clkDial">
                      {/* 60 minor ticks — every 6° */}
                      {Array.from({ length: 60 }, (_, i) => {
                        const a = (i * 6 * Math.PI) / 180;
                        const isMajor = i % 5 === 0;
                        const r1 = isMajor ? 62 : 68;
                        return (
                          <line
                            key={i}
                            x1={100 + r1 * Math.sin(a)}
                            y1={100 - r1 * Math.cos(a)}
                            x2={100 + 74 * Math.sin(a)}
                            y2={100 - 74 * Math.cos(a)}
                            className={`clkTick ${isMajor ? "big" : ""}`}
                          />
                        );
                      })}
                      {/* Numerals at 12 · 3 · 6 · 9 */}
                      {[
                        [0, "12"],
                        [3, "3"],
                        [6, "6"],
                        [9, "9"],
                      ].map(([h, label]) => {
                        const a = (h * 30 * Math.PI) / 180;
                        return (
                          <text
                            key={label}
                            x={100 + 48 * Math.sin(a)}
                            y={100 - 48 * Math.cos(a)}
                            className="clkNumeral"
                          >
                            {label}
                          </text>
                        );
                      })}
                      <line
                        className="clkHand clkHandH"
                        x1="100"
                        y1="100"
                        x2={
                          100 +
                          34 *
                            Math.sin(
                              ((now.getHours() % 12) / 12 + now.getMinutes() / 720) * 2 * Math.PI,
                            )
                        }
                        y2={
                          100 -
                          34 *
                            Math.cos(
                              ((now.getHours() % 12) / 12 + now.getMinutes() / 720) * 2 * Math.PI,
                            )
                        }
                      />
                      <line
                        className="clkHand clkHandM"
                        x1="100"
                        y1="100"
                        x2={
                          100 +
                          52 *
                            Math.sin(
                              (now.getMinutes() / 60 + now.getSeconds() / 3600) * 2 * Math.PI,
                            )
                        }
                        y2={
                          100 -
                          52 *
                            Math.cos(
                              (now.getMinutes() / 60 + now.getSeconds() / 3600) * 2 * Math.PI,
                            )
                        }
                      />
                      <line
                        className="clkHand clkHandS"
                        x1={100 - 10 * Math.sin((now.getSeconds() / 60) * 2 * Math.PI)}
                        y1={100 + 10 * Math.cos((now.getSeconds() / 60) * 2 * Math.PI)}
                        x2={100 + 58 * Math.sin((now.getSeconds() / 60) * 2 * Math.PI)}
                        y2={100 - 58 * Math.cos((now.getSeconds() / 60) * 2 * Math.PI)}
                      />
                      <circle cx="100" cy="100" r="3" className="clkPin" />
                    </g>
                    <circle
                      cx="100"
                      cy="100"
                      r={R}
                      className="clkRingFg"
                      strokeDasharray={C}
                      strokeDashoffset={C * (1 - arc)}
                    />
                  </svg>
                  {(timerOn || (left && left !== total)) && (
                    <div className="clkCountdown">{fmtHMS(left)}</div>
                  )}
                </div>
                <div className="winRow" style={{ justifyContent: "center", marginTop: 14 }}>
                  {[15, 25, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`winBtn ghost ${total === m * 60 ? "on" : ""}`}
                      onClick={() => {
                        setTotal(m * 60);
                        setLeft(m * 60);
                        setTimerOn(false);
                      }}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <div className="winRow" style={{ justifyContent: "center", marginTop: 10 }}>
                  <button
                    type="button"
                    className="winBtn"
                    onClick={() => {
                      if (timerOn) {
                        setTimerOn(false);
                      } else {
                        if (!left) setLeft(total);
                        setTimerOn(true);
                      }
                    }}
                  >
                    {timerOn ? "Pause" : left && left !== total ? "Resume" : "Start"}
                  </button>
                  <button
                    type="button"
                    className="winBtn ghost"
                    onClick={() => {
                      setTimerOn(false);
                      setLeft(0);
                    }}
                  >
                    Reset
                  </button>
                </div>
                <div className="winMuted" style={{ marginTop: 10 }}>
                  {tab === "focus"
                    ? "A gentle chime and a toast when the session ends."
                    : "Timer runs even while you do other things."}
                </div>
              </div>
            )}

            {/* ---------------- stopwatch ---------------- */}
            {tab === "stopwatch" && (
              <div className="clkCenter">
                <div className="clkBig">{fmtSW(ms)}</div>
                <div className="winRow" style={{ justifyContent: "center" }}>
                  <button type="button" className="winBtn" onClick={() => setSwRun((v) => !v)}>
                    {swRun ? "Pause" : ms ? "Resume" : "Start"}
                  </button>
                  <button
                    type="button"
                    className="winBtn ghost"
                    onClick={() => setLaps((l) => [ms, ...l])}
                    disabled={!swRun}
                  >
                    Lap
                  </button>
                  <button
                    type="button"
                    className="winBtn ghost"
                    onClick={() => {
                      setSwRun(false);
                      setMs(0);
                      setLaps([]);
                    }}
                  >
                    Reset
                  </button>
                </div>
                {laps.length ? (
                  <div className="clkLaps">
                    {laps.map((l, i) => (
                      <div key={i} className="clkLap">
                        <span>Lap {laps.length - i}</span>
                        <span>{fmtSW(l - (laps[i + 1] || 0))}</span>
                        <span className="winMuted">{fmtSW(l)}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* ---------------- world ---------------- */}
            {tab === "world" && (
              <div className="clkWorld">
                {ZONES.map(([name, tz]) => {
                  let time = "—",
                    day = "";
                  try {
                    time = now.toLocaleTimeString([], {
                      timeZone: tz,
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    day = now.toLocaleDateString([], { timeZone: tz, weekday: "short" });
                  } catch (e) {}
                  return (
                    <div key={name} className="clkZone">
                      <div>
                        <b>{name}</b>
                        <div className="winMuted">{day}</div>
                      </div>
                      <div className="clkZoneTime">{time}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ---------------- alarms ---------------- */}
            {tab === "alarm" && (
              <div className="clkAlarms">
                <div className="winRow">
                  <input
                    className="winInput"
                    value={ah}
                    onChange={(e) => setAh(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    style={{ width: 56 }}
                    aria-label="hour"
                  />
                  <b>:</b>
                  <input
                    className="winInput"
                    value={am}
                    onChange={(e) => setAm(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    style={{ width: 56 }}
                    aria-label="minute"
                  />
                  <input
                    className="winInput"
                    placeholder="Label (optional)"
                    id="alarmLabel"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="winBtn"
                    onClick={async () => {
                      const h = Math.min(23, Math.max(0, parseInt(ah || "0", 10)));
                      const m = Math.min(59, Math.max(0, parseInt(am || "0", 10)));
                      await saveAlarm({
                        id: uid("al"),
                        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                        on: true,
                        label: document.getElementById("alarmLabel")?.value || "",
                      });
                      if (document.getElementById("alarmLabel"))
                        document.getElementById("alarmLabel").value = "";
                    }}
                  >
                    Add
                  </button>
                </div>
                {alarms.length === 0 ? (
                  <div className="winMuted">No alarms yet. Add one — it really rings.</div>
                ) : (
                  alarms.map((a) => (
                    <div key={a.id} className="clkAlarm">
                      <b className="clkAlarmT">{a.time}</b>
                      <span style={{ flex: 1 }} className="winMuted">
                        {a.label || "Alarm"}
                      </span>
                      <label className="clkSwitch">
                        <input
                          type="checkbox"
                          checked={!!a.on}
                          onChange={() => saveAlarm({ ...a, on: !a.on })}
                        />
                        <span />
                      </label>
                      <button type="button" className="winBtn ghost" onClick={() => delAlarm(a.id)}>
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

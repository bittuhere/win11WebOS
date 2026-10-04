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

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { changeTheme, delApp } from "../../../actions";
import { Icon, Image, ToolBar } from "../../../utils/general";
import {
  checkForUpdates,
  getUpdateState,
  installUpdate,
  loadUpdateHistory,
  reloadIntoNewBuild,
  skipVersion,
  clearSkip,
  muteFor,
  subscribeUpdates,
} from "../../../utils/os/updates";
import { OS, osLabel, osVersion } from "../../../utils/os/version";
import { notify } from "../../../utils/os/ui";
import { applyUserName } from "../../../utils/os/vs";
import LangSwitch from "./assets/Langswitch";
import "./assets/settings.scss";
import data from "./assets/settingsData.json";

/* The one string that must be used verbatim for anything this PC cannot do. */
const HONEST = "Just a placeholder — our PC cannot do that";

/* ─────────── tiny real, persisted state helpers ─────────── */
const useStoredBool = (key, defaultValue) => {
  const [val, setVal] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultValue : v === "1";
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, val ? "1" : "0");
    } catch {}
  }, [key, val]);
  return [val, setVal];
};
const useStoredNumber = (key, defaultValue) => {
  const [val, setVal] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultValue : Number(v) || defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, String(val));
    } catch {}
  }, [key, val]);
  return [val, setVal];
};
const useStoredString = (key, defaultValue) => {
  const [val, setVal] = useState(() => {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });
  useEffect(() => {
    try {
      if (val == null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch {}
  }, [key, val]);
  return [val, setVal];
};

/* ─────────── real runtime probes ─────────── */
const useBattery = () => {
  const [b, setB] = useState(null);
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    if (typeof navigator.getBattery !== "function") {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    let mgr;
    const update = () => {
      if (!mgr) return;
      setB({
        level: mgr.level,
        charging: mgr.charging,
        chargingTime: mgr.chargingTime,
        dischargingTime: mgr.dischargingTime,
      });
    };
    navigator
      .getBattery()
      .then((m) => {
        mgr = m;
        update();
        m.addEventListener("levelchange", update);
        m.addEventListener("chargingchange", update);
        m.addEventListener("chargingtimechange", update);
        m.addEventListener("dischargingtimechange", update);
      })
      .catch(() => setAvailable(false));
    return () => {
      if (!mgr) return;
      mgr.removeEventListener("levelchange", update);
      mgr.removeEventListener("chargingchange", update);
      mgr.removeEventListener("chargingtimechange", update);
      mgr.removeEventListener("dischargingtimechange", update);
    };
  }, []);
  return { b, available };
};

const readNet = () => {
  const c = navigator.connection || {};
  return {
    online: navigator.onLine,
    effectiveType: c.effectiveType ?? null,
    downlink: c.downlink ?? null,
    rtt: c.rtt ?? null,
    saveData: !!c.saveData,
  };
};
const useNetwork = () => {
  const [net, setNet] = useState(readNet);
  useEffect(() => {
    const on = () => setNet(readNet());
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const c = navigator.connection;
    if (c?.addEventListener) c.addEventListener("change", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      if (c?.removeEventListener) c.removeEventListener("change", on);
    };
  }, []);
  return net;
};

const fmtSec = (s) => {
  if (!isFinite(s) || s === 0 || s == null) return "—";
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

/* ─────────── About ─────────── */
const AboutPanel = ({ userName }) => {
  const [est, setEst] = useState(null);
  const [boot] = useState(() => Date.now());
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(setEst)
      .catch(() => {});
  }, []);
  const ua = navigator.userAgent.match(/(Chrom(e|ium)|Edg|Firefox)\/(\d+)/);
  const upSec = Math.floor((Date.now() - boot) / 1000);
  return (
    <div className="sdAbout">
      <p>
        <b>Device name</b> {userName || "User"}-PC
      </p>
      <p>
        <b>Edition</b> Windows 11 WebOS (win11-dream)
      </p>
      <p>
        <b>Runtime</b> {ua ? `${ua[1]} ${ua[3]}` : navigator.userAgent.slice(0, 40)}
      </p>
      <p>
        <b>Screen</b> {screen.width} × {screen.height}
      </p>
      <p>
        <b>Device memory</b>{" "}
        {navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "not exposed by this browser"}
      </p>
      <p>
        <b>Virtual Storage</b>{" "}
        {est
          ? `${(est.usage / 1048576).toFixed(1)} MB of ${(est.quota / 1073741824).toFixed(1)} GB`
          : "IndexedDB"}
      </p>
      <p>
        <b>Uptime</b> {upSec < 60 ? `${upSec}s` : `${Math.floor(upSec / 60)}m ${upSec % 60}s`}
      </p>
    </div>
  );
};

/* ─────────── Microphone tester ─────────── */
const MicTester = () => {
  const [state, setState] = useState("idle"); // idle|requesting|live|denied|unsupported
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const ctxRef = useRef(null);

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close?.().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let peakLocal = 0;
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const l = Math.min(1, rms * 3);
        setLevel(l);
        peakLocal = Math.max(peakLocal * 0.995, l);
        setPeak(peakLocal);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      setState("live");
    } catch {
      setState("denied");
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="sdFeature">
      <div className="sdRow">
        <span>Status</span>
        <span className="sdVal">
          {state === "idle" && "Not tested"}
          {state === "requesting" && "Waiting for permission…"}
          {state === "live" && "Live — speak into the mic"}
          {state === "denied" && "Blocked by the browser or the OS"}
          {state === "unsupported" && "getUserMedia not exposed by this browser"}
        </span>
      </div>
      <div className="sdMeterWrap">
        <div className="sdMeter">
          <div className="sdMeterFill" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        <div className="sdMeterPeak">
          <div className="sdMeterPeakFill" style={{ width: `${Math.round(peak * 100)}%` }} />
        </div>
      </div>
      <div className="sdActions">
        {state !== "live" ? (
          <button className="sdBtn" onClick={start}>
            Test microphone
          </button>
        ) : (
          <button
            className="sdBtn ghost"
            onClick={() => {
              stop();
              setState("idle");
            }}
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────── Camera tester ─────────── */
const CamTester = () => {
  const [state, setState] = useState("idle");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("requesting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      setState("live");
    } catch {
      setState("denied");
    }
  };
  useEffect(() => () => stop(), []);

  return (
    <div className="sdFeature">
      <div className="sdRow">
        <span>Status</span>
        <span className="sdVal">
          {state === "idle" && "Not tested"}
          {state === "requesting" && "Waiting for permission…"}
          {state === "live" && "Live preview"}
          {state === "denied" && "Blocked by the browser or the OS"}
          {state === "unsupported" && "getUserMedia not exposed by this browser"}
        </span>
      </div>
      <div className="sdCamPreview">
        <video ref={videoRef} autoPlay playsInline muted />
      </div>
      <div className="sdActions">
        {state !== "live" ? (
          <button className="sdBtn" onClick={start}>
            Test camera
          </button>
        ) : (
          <button
            className="sdBtn ghost"
            onClick={() => {
              stop();
              setState("idle");
            }}
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────── Site permissions viewer ─────────── */
const PERM_NAMES = [
  "geolocation",
  "notifications",
  "camera",
  "microphone",
  "clipboard-read",
  "clipboard-write",
  "persistent-storage",
  "push",
  "midi",
  "background-sync",
  "accelerometer",
  "gyroscope",
];
const PermissionsViewer = () => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!navigator.permissions?.query) {
        setRows("unsupported");
        return;
      }
      const out = [];
      for (const name of PERM_NAMES) {
        try {
          const st = await navigator.permissions.query({ name });
          out.push({ name, state: st.state });
        } catch {
          out.push({ name, state: "not queryable" });
        }
      }
      if (alive) setRows(out);
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (rows === "unsupported" || rows === null) {
    return (
      <p className="tile_desc">
        {rows === null ? "Reading permissions…" : "Permissions API not exposed by this browser."}
      </p>
    );
  }
  return (
    <div className="sdPermList">
      {rows.map((r) => (
        <div key={r.name} className="sdPermRow">
          <span className="sdPermName">{r.name}</span>
          <span className={`sdPermState ${r.state}`}>{r.state}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────── Storage cleanup ─────────── */
const StorageCleanup = () => {
  const [est, setEst] = useState(null);
  const [caches, setCaches] = useState([]);
  const [dbs, setDbs] = useState([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setEst((await navigator.storage?.estimate?.()) ?? null);
    } catch {}
    try {
      setCaches((await window.caches?.keys?.()) ?? []);
    } catch {
      setCaches([]);
    }
    try {
      const list = await (indexedDB.databases?.() ?? Promise.resolve([]));
      setDbs(list.map((d) => d.name));
    } catch {
      setDbs([]);
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  const clearCaches = async () => {
    if (!window.caches) return;
    setBusy(true);
    for (const c of caches) {
      try {
        await window.caches.delete(c);
      } catch {}
    }
    await refresh();
    setBusy(false);
    notify({
      app: "Settings",
      title: "Caches cleared",
      body: "Cache Storage is now empty.",
      kind: "success",
    });
  };

  return (
    <div className="sdFeature">
      <div className="sdRow">
        <span>Estimated usage</span>
        <span className="sdVal">{est ? `${Math.round((est.usage || 0) / 1e6)} MB` : "—"}</span>
      </div>
      <div className="sdRow">
        <span>Estimated quota</span>
        <span className="sdVal">{est ? `${Math.round((est.quota || 0) / 1e6)} MB` : "—"}</span>
      </div>
      <div className="sdSub">Cache Storage ({caches.length})</div>
      {caches.length === 0 ? (
        <p className="tile_desc">
          No Cache Storage entries. The app doesn’t use the Cache API for offline assets.
        </p>
      ) : (
        <ul className="sdList">
          {caches.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <div className="sdActions">
        <button
          className="sdBtn ghost"
          disabled={busy || caches.length === 0}
          onClick={clearCaches}
        >
          Clear caches
        </button>
        <button className="sdBtn ghost" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="sdSub">IndexedDB databases ({dbs.length})</div>
      {dbs.length === 0 ? (
        <p className="tile_desc">No IndexedDB databases reported by this browser.</p>
      ) : (
        <ul className="sdList">
          {dbs.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      <p className="tile_desc">
        IndexedDB holds your Virtual Storage files. Use the Files app to remove files — this panel
        only reports the database names.
      </p>
    </div>
  );
};

/* ─────────── Diagnostics export ─────────── */
const buildDiagnostics = (userName) => {
  const ua = navigator.userAgent.match(/(Chrom(e|ium)|Edg|Firefox)\/(\d+)/);
  return {
    generatedAt: new Date().toISOString(),
    device: {
      name: `${userName || "User"}-PC`,
      edition: "Windows 11 WebOS (win11-dream)",
      runtime: ua ? `${ua[1]} ${ua[3]}` : navigator.userAgent,
      userAgent: navigator.userAgent,
      screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio },
      deviceMemoryGB: navigator.deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    },
    network: readNet(),
    storage: null, // filled below
    features: {
      getBattery: typeof navigator.getBattery === "function",
      wakeLock: "wakeLock" in navigator,
      permissions: !!navigator.permissions?.query,
      fullscreen: !!document.documentElement.requestFullscreen,
      indexedDBDatabases: typeof indexedDB.databases === "function",
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      mediaDevices: !!navigator.mediaDevices?.getUserMedia,
      notifications: "Notification" in window,
    },
  };
};

const Diagnostics = ({ userName }) => {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    const rep = buildDiagnostics(userName);
    try {
      rep.storage = (await navigator.storage?.estimate?.()) ?? null;
    } catch {}
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `webos-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setBusy(false);
    notify({
      app: "Settings",
      title: "Diagnostics saved",
      body: "A JSON report was written to your Downloads folder.",
      kind: "success",
    });
  };
  return (
    <div className="sdFeature">
      <p className="tile_desc">
        The report contains only real runtime facts — user agent, screen, storage estimate, feature
        support. Nothing is invented.
      </p>
      <div className="sdActions">
        <button className="sdBtn" disabled={busy} onClick={download}>
          Download diagnostics report
        </button>
      </div>
    </div>
  );
};

/* ─────────── Export / import / reset ─────────── */
const SettingsTransfer = () => {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const exportAll = () => {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      dump[k] = localStorage.getItem(k);
    }
    const blob = new Blob(
      [JSON.stringify({ v: 1, savedAt: new Date().toISOString(), data: dump }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `webos-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      const obj = JSON.parse(text);
      if (!obj?.data || typeof obj.data !== "object") throw new Error("bad file");
      const keys = Object.keys(obj.data);
      for (const k of keys) localStorage.setItem(k, obj.data[k]);
      notify({
        app: "Settings",
        title: "Settings imported",
        body: `${keys.length} keys restored. Reload to apply everything.`,
        kind: "success",
      });
    } catch {
      notify({
        app: "Settings",
        title: "Import failed",
        body: "The file is not a valid WebOS settings export.",
        kind: "error",
      });
    }
    setBusy(false);
    e.target.value = "";
  };

  const reset = () => {
    if (
      !confirm(
        "Reset all WebOS local settings? This clears localStorage (settings, wallpaper preference, saved stories, notes, chat history). Virtual Storage files in IndexedDB are kept.",
      )
    )
      return;
    try {
      localStorage.clear();
    } catch {}
    window.location.reload();
  };

  return (
    <div className="sdFeature">
      <p className="tile_desc">
        Export writes every localStorage key to a JSON file. Import restores them. Reset clears them
        and reloads.
      </p>
      <div className="sdActions">
        <button className="sdBtn" onClick={exportAll}>
          Export settings
        </button>
        <button className="sdBtn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
          Import settings
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={importFile}
        />
        <button className="sdBtn danger" onClick={reset}>
          Reset settings
        </button>
      </div>
    </div>
  );
};

/* ─────────── Speaker test ─────────── */
const playTestTone = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ctx = new AC();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 440;
  gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  const t = ctx.currentTime;
  gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
  gain.gain.linearRampToValueAtTime(0, t + 0.5);
  setTimeout(() => {
    try {
      osc.stop();
      ctx.close();
    } catch {}
  }, 600);
  return true;
};

/* ─────────── Rotate prompt (the phone landscape gate) ─────────── */
const ROTATE_KEY = "wos.rotateGate";

/* ------------------------------------------------------------------ *
 *  Windows Update panels
 * ------------------------------------------------------------------ */

const UpdateHistoryPanel = ({ history }) => (
  <div className="updPanel">
    <p className="updPanelLead">
      Every update this browser installed, newest first. The list lives in local storage, so it
      survives a refresh and a restart.
    </p>
    {history.length === 0 ? (
      <p className="updPanelEmpty">
        Nothing has been installed on top of the build this PC shipped with. Build {OS.build} of
        WebOS {OS.major} is the current one.
      </p>
    ) : (
      <div className="updHistList">
        {history.map((h) => (
          <div key={h.version + h.at} className="updHistRow">
            <span className={`updKind ${h.kind}`}>
              {h.kind === "feature" ? "Feature" : "Quality"}
            </span>
            <b>{h.version}</b>
            <span className="updHistWhen">{new Date(h.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PauseUpdatesPanel = () => {
  const [until, setUntil] = useState(() =>
    Number(localStorage.getItem("wos.update.muteUntil") || 0),
  );
  const paused = until > Date.now();
  return (
    <div className="updPanel">
      <p className="updPanelLead">
        Automatic checks run at most once every six hours, a few seconds after the desktop is up.
        Pausing stops them — you can always check by hand from the Update window.
      </p>
      <div className="updPanelRow">
        <b>
          {paused ? `Paused until ${new Date(until).toLocaleString()}` : "Automatic checks are on"}
        </b>
      </div>
      <div className="updRowBtns">
        <button
          type="button"
          className="sdBtn"
          onClick={() => {
            muteFor(24);
            setUntil(Number(localStorage.getItem("wos.update.muteUntil") || 0));
          }}
        >
          Pause for 24 hours
        </button>
        <button
          type="button"
          className="sdBtn"
          onClick={() => {
            localStorage.removeItem("wos.update.muteUntil");
            setUntil(0);
          }}
        >
          Resume now
        </button>
      </div>
    </div>
  );
};

const UpdateAdvancedPanel = ({ state }) => {
  const [feed, setFeed] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`updates/feed.json?cb=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setFeed)
      .catch((e) => setErr(String(e.message || e)));
  }, []);
  return (
    <div className="updPanel">
      <p className="updPanelLead">
        This PC updates from a static feed. There is no account, no telemetry and nothing runs in
        the background: a check is one request, and an install clears this browser's cached copies
        of the old build and reloads.
      </p>
      <div className="updMeta">
        <div>
          <span>Build</span>
          <b>{osLabel()}</b>
        </div>
        <div>
          <span>Channel</span>
          <b>{OS.channel}</b>
        </div>
        <div>
          <span>Feed</span>
          <b>updates/feed.json</b>
        </div>
        <div>
          <span>Latest published</span>
          <b>
            {feed ? `v${feed.latest?.version || "?"}` : err ? `unreadable (${err})` : "reading…"}
          </b>
        </div>
      </div>
      {feed?.latest?.notes && (
        <p className="updPanelEmpty">
          Release notes: <code>{feed.latest.notes}</code>
        </p>
      )}
      {state?.lastCheck ? (
        <p className="updPanelEmpty">Last check: {new Date(state.lastCheck).toLocaleString()}</p>
      ) : null}
      <p className="updPanelNote">
        Version scheme: <code>1.01 → 1.02</code> is a quality update (fixes),{" "}
        <code>1.xx → 2.00</code> is a feature update (new apps and features). The running build is
        declared once, in <code>src/utils/os/version.js</code>.
      </p>
    </div>
  );
};

function RotateGatePanel({ notify }) {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(ROTATE_KEY) !== "off";
    } catch (e) {
      return true;
    }
  });
  const flip = (next) => {
    try {
      if (next) localStorage.removeItem(ROTATE_KEY);
      else localStorage.setItem(ROTATE_KEY, "off");
    } catch (e) {}
    setOn(next);
    // let the running shell notice right away instead of waiting for a resize
    setTimeout(() => window.dispatchEvent(new Event("resize")), 40);
    window.dispatchEvent(new Event("orientationchange"));
    notify?.({
      app: "Settings",
      title: next ? "Rotate prompt on" : "Rotate prompt off",
      body: next
        ? "Portrait phones will be asked to turn sideways again."
        : "This phone will open straight into the fitted portrait desktop.",
      kind: "info",
    });
  };

  return (
    <>
      <label className="sdRow">
        Rotate prompt on portrait phones
        <input type="checkbox" checked={on} onChange={() => flip(!on)} />
      </label>
      <p className="tile_desc">
        On: an upright phone gets the landscape gate — one tap takes it full screen and asks the
        browser to lock the rotation, with a way into portrait mode if the browser refuses. Off:
        this PC always opens in the fitted portrait layout (the same desktop at the same sizes, laid
        out for a narrow screen).
      </p>
      <div className="sdActions">
        <button
          className="sdBtn"
          onClick={() => {
            /* the gate listens for this and renders itself over everything,
               phones included — so the setting is never a blind switch */
            window.dispatchEvent(new Event("wos:rotateGatePreview"));
          }}
        >
          Preview the gate on this device
        </button>
      </div>
      <p className="tile_desc">
        Saved on this PC only (a browser preference, not an account setting). It is the same switch
        as <code>localStorage["wos.rotateGate"]</code>.
      </p>
    </>
  );
}

/* ─────────── Battery panel ─────────── */
const BatteryPanel = () => {
  const { b, available } = useBattery();
  if (available === false)
    return (
      <p className="tile_desc">
        The Battery Status API is not exposed by this browser. A desktop PC without a battery would
        show the same.
      </p>
    );
  if (!b) return <p className="tile_desc">Reading battery…</p>;
  const pct = Math.round(b.level * 100);
  return (
    <div className="sdFeature">
      <div className="sdBatteryRow">
        <div className="sdBatteryIcon" data-charging={b.charging}>
          <div className="sdBatteryFill" style={{ width: `${pct}%` }} />
          <span>{pct}%</span>
        </div>
        <div>
          <p>
            <b>{b.charging ? "Charging" : "On battery"}</b>
          </p>
          <p className="tile_desc">
            {b.charging
              ? `Full in ${fmtSec(b.chargingTime)}`
              : `${fmtSec(b.dischargingTime)} remaining`}
          </p>
        </div>
      </div>
      <p className="tile_desc">
        Values come straight from <code>navigator.getBattery()</code>. On desktops without a battery
        the level reads as 100% and never changes — that’s the browser, not us.
      </p>
    </div>
  );
};

/* ─────────── Connection panel ─────────── */
const ConnectionPanel = () => {
  const n = useNetwork();
  return (
    <div className="sdFeature">
      <div className="sdRow">
        <span>Status</span>
        <span className="sdVal">{n.online ? "Online" : "Offline"}</span>
      </div>
      <div className="sdRow">
        <span>Effective type</span>
        <span className="sdVal">{n.effectiveType ?? "not exposed"}</span>
      </div>
      <div className="sdRow">
        <span>Downlink</span>
        <span className="sdVal">{n.downlink != null ? `${n.downlink} Mbps` : "not exposed"}</span>
      </div>
      <div className="sdRow">
        <span>RTT</span>
        <span className="sdVal">{n.rtt != null ? `${n.rtt} ms` : "not exposed"}</span>
      </div>
      <div className="sdRow">
        <span>Data saver</span>
        <span className="sdVal">{n.saveData ? "On" : "Off"}</span>
      </div>
      <p className="tile_desc">
        These values come from the Network Information API, which is a real but coarse signal.
        Values like “4g” mean “a fast link”, not literal LTE.
      </p>
    </div>
  );
};

/* ─────────── Accent colour ─────────── */
const ACCENT_PRESETS = [
  "#0078d4",
  "#2d7d9a",
  "#00b294",
  "#498205",
  "#8764b8",
  "#c239b3",
  "#e3008c",
  "#ca5010",
  "#da3b01",
  "#c50f1f",
];

const AccentPanel = ({ accent, setAccent }) => {
  const applyCustom = (hex) => {
    setAccent(hex);
  };
  return (
    <div className="sdFeature">
      <div className="sdSwatchGrid">
        {ACCENT_PRESETS.map((c) => (
          <button
            key={c}
            className={`sdSwatch ${accent === c ? "selected" : ""}`}
            style={{ background: c }}
            onClick={() => applyCustom(c)}
            aria-label={`Accent ${c}`}
          />
        ))}
      </div>
      <div className="sdRow">
        <span>Custom</span>
        <input
          type="color"
          value={accent || "#0078d4"}
          onChange={(e) => applyCustom(e.target.value)}
        />
      </div>
      <div className="sdActions">
        <button className="sdBtn ghost" onClick={() => setAccent(null)}>
          Reset to theme default
        </button>
      </div>
      <p className="tile_desc">
        Real: overrides <code>--clrPrm</code> at the document root and persists. The OS theme may
        still reset it on theme change.
      </p>
    </div>
  );
};

/* ─────────── Main Settings component ─────────── */
export const Settings = () => {
  const wnapp = useSelector((state) => state.apps.settings);
  const theme = useSelector((state) => state.setting.person.theme);
  const dispatch = useDispatch();
  const wall = useSelector((state) => state.wallpaper);

  const [page, setPage] = useState("System");
  const [nav, setNav] = useState("");
  const [updating, setUpdating] = useState(false);
  /* the live update state, straight from the updater — no fake delay, no
     "preparing…" theatre: this is the same object the Update window shows */
  const [upd, setUpd] = useState(getUpdateState());
  const [installPhase, setInstallPhase] = useState(null);
  const [updHist, setUpdHist] = useState(() => loadUpdateHistory());
  useEffect(() => subscribeUpdates(setUpd), []);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");
  const [rename, setRename] = useState("");
  const [installed, setInstalled] = useState([]);
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [wakeActive, setWakeActive] = useState(false);

  const brightness = useSelector((s) => s.setting.system.display.brightness);
  const night = useSelector((s) => s.setting.system.display.nightlight.state);
  const wifi = useSelector((s) => s.setting.network.wifi.state);
  const bt = useSelector((s) => s.setting.devices.bluetooth);
  const saver = useSelector((s) => s.setting.system.power.saver.state);
  const notificationsOff = useSelector((s) => !!s.setting.system?.notifications?.disabled);
  const userName = useSelector((state) => state.setting.person.name);

  const [textSizeVal, setTextSizeVal] = useStoredNumber("settings.textSize", 100);
  const [transparency, setTransparency] = useStoredBool("settings.transparency", true);
  const [animations, setAnimations] = useStoredBool("settings.animations", true);
  const [contrast, setContrast] = useStoredBool("settings.contrast", false);
  const [accent, setAccent] = useStoredString("settings.accent", null);

  const wakeRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.fontSize = `${textSizeVal}%`;
  }, [textSizeVal]);
  useEffect(() => {
    document.body.dataset.transparency = transparency ? "on" : "off";
    document.body.dataset.animations = animations ? "on" : "off";
    document.body.dataset.contrast = contrast ? "on" : "off";
  }, [transparency, animations, contrast]);

  /* Accent — set on the html element (inline wins) and re-apply on theme change */
  useEffect(() => {
    const html = document.documentElement;
    if (accent) html.style.setProperty("--clrPrm", accent);
    else html.style.removeProperty("--clrPrm");
  }, [accent, theme]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {}
  };

  const toggleWakeLock = async () => {
    if (!("wakeLock" in navigator)) {
      notify({
        app: "Settings",
        title: "Wake lock",
        body: "Screen Wake Lock API is not exposed by this browser.",
        kind: "info",
      });
      return;
    }
    try {
      if (wakeRef.current) {
        await wakeRef.current.release();
        wakeRef.current = null;
        setWakeActive(false);
      } else {
        const sentinel = await navigator.wakeLock.request("screen");
        wakeRef.current = sentinel;
        setWakeActive(true);
        sentinel.addEventListener("release", () => {
          setWakeActive(false);
          wakeRef.current = null;
        });
      }
    } catch {
      notify({
        app: "Settings",
        title: "Wake lock",
        body: "The browser refused to keep the screen awake on this page.",
        kind: "error",
      });
    }
  };

  /* Placeholder tiles — nothing here is possible in a browser PC. */
  const PLACEHOLDER = useMemo(
    () =>
      new Set([
        "Nearby sharing",
        "Multi-tasking",
        "Activation",
        "Troubleshoot",
        "Projecting to this PC",
        "Remote Desktop",
        "Add device",
        "View more devices",
        "Devices",
        "Printers & scanners",
        "Your Phone",
        "Cameras",
        "Mouse",
        "Touchpad",
        "Pen & Windows Ink",
        "AutoPlay",
        "USB",
        "VPN",
        "Mobile hotspot",
        "Proxy",
        "Dial-up",
        "Advanced network settings",
        "Lock screen",
        "Touch keyboard",
        "Fonts",
        "Device usage",
        "Default apps",
        "Focus Assist",
        "Find my device",
        "For developers",
        "Optional features",
        "Apps for websites",
        "Offline maps",
        "Family",
        "Windows backup",
        "Other users",
        "Access work or school",
        "Sign-in options",
        "Email & accounts",
        "Xbox Game Bar",
        "Captures",
        "Game Mode",
      ]),
    [],
  );

  const simToast = (name, on) =>
    notify({
      app: "Settings",
      title: name,
      body: on
        ? `${name} is on. This PC has no radio hardware, so this is a simulation — the switch itself is real and persists.`
        : `${name} is off.`,
      kind: "info",
      life: 5,
    });

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const out = [];
    for (const cat of Object.keys(data)) {
      for (const t of data[cat]) {
        const name = t.name || (t.type === "langSwitcher" ? "Windows display language" : "");
        const desc = t.desc || "";
        if (name.toLowerCase().includes(q) || desc.toLowerCase().includes(q)) {
          out.push({ cat, tile: t, name });
        }
      }
    }
    return out;
  }, [query]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (query) setQuery("");
      else if (detail) setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, detail]);

  useEffect(() => {
    let alive = true;
    import("../../../utils/idb")
      .then(({ idb }) => idb.getAll("installed"))
      .then((list) => {
        if (alive) setInstalled(list || []);
      })
      .catch(() => {});
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const el = document.getElementById("brightoverlay");
    if (el) el.style.opacity = String((100 - (brightness || 100)) / 140);
  }, [brightness]);

  useEffect(() => {
    document.body.dataset.sepia = night ? "true" : "false";
  }, [night]);

  const themechecker = {
    default: "light",
    dark: "dark",
    ThemeA: "dark",
    ThemeB: "dark",
    ThemeD: "light",
    ThemeC: "light",
  };
  const handleWallAndTheme = (e) => {
    const payload = e.target.dataset.payload;
    const theme_nxt = themechecker[payload.split("/")[0]];
    if (theme_nxt !== theme) changeTheme();
    dispatch({ type: "WALLSET", payload });
  };

  const keyActivate = (fn) => (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  const gotoSection = (name) => {
    setPage(name);
    setDetail(null);
    setQuery("");
  };
  const tileClick = (e) => {
    setDetail(e);
    if (PLACEHOLDER.has(e.name)) {
      notify({ app: "Settings", title: e.name, body: HONEST, kind: "info", life: 5 });
    }
  };

  return (
    <div
      className="settingsApp floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size === "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Settings" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow flex flex-col">
          <nav className={nav}>
            <div className="nav_top">
              <div
                className="account"
                role="button"
                tabIndex={0}
                onClick={() => gotoSection("Accounts")}
                onKeyDown={keyActivate(() => gotoSection("Accounts"))}
              >
                <img src="img/settings/defAccount.webp" alt="" height={60} width={60} />
                <div>
                  <p>{userName}</p>
                  <p>Local Account</p>
                </div>
              </div>
              <input
                type="text"
                className="search"
                placeholder="Find a setting"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Find a setting"
              />
            </div>
            <div className="nav_bottom win11Scroll">
              {Object.keys(data).map((e) => (
                <div
                  key={e}
                  className={`navLink ${e === page ? "selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => gotoSection(e)}
                  onKeyDown={keyActivate(() => gotoSection(e))}
                >
                  <img
                    src={`img/settings/${encodeURIComponent(e)}.webp`}
                    alt=""
                    height={16}
                    width={16}
                  />
                  {e}
                </div>
              ))}
              <div className="marker"></div>
            </div>
          </nav>

          {query.trim() ? (
            <main className="searchView">
              <h1>Results for “{query}”</h1>
              <div className="tilesCont win11Scroll">
                {searchResults.length === 0 ? (
                  <p className="searchEmpty">No settings match “{query}”.</p>
                ) : (
                  searchResults.map((r, i) => (
                    <div
                      key={i}
                      className="tile searchResult prtclk"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setPage(r.cat);
                        tileClick(r.tile);
                        setQuery("");
                      }}
                      onKeyDown={keyActivate(() => {
                        setPage(r.cat);
                        tileClick(r.tile);
                        setQuery("");
                      })}
                    >
                      <span className="settingsIcon">{r.tile.icon || ""}</span>
                      <div>
                        <p>{r.name}</p>
                        <p className="tile_desc">
                          {r.cat}
                          {r.tile.desc ? ` · ${r.tile.desc}` : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </main>
          ) : (
            Object.keys(data).map(
              (e) =>
                page === e && (
                  <main key={e}>
                    <h1>{e}</h1>
                    <div className="tilesCont win11Scroll">
                      {data[e].map((el, i) => {
                        switch (el.type) {
                          case "sysTop":
                            return (
                              <div key={i} className={el.type}>
                                <div className="left">
                                  <img
                                    src={`img/wallpaper/${wall.src}`}
                                    alt=""
                                    className="device_img"
                                  />
                                  <div className="column_device">
                                    <p className="device_name">Liber-V</p>
                                    <p className="device_model">NS14A8</p>
                                    <p className="device_rename">Rename</p>
                                  </div>
                                </div>
                                <div className="right">
                                  <div className="column">
                                    <img
                                      src="https://upload.wikimedia.org/wikipedia/commons/2/25/Microsoft_icon.svg"
                                      height={20}
                                      alt=""
                                    />
                                    <p>
                                      Microsoft 365
                                      <br />
                                      <span className="column_lower">View benefits</span>
                                    </p>
                                  </div>
                                  <div
                                    className="column"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => gotoSection("Windows Update")}
                                    onKeyDown={keyActivate(() => gotoSection("Windows Update"))}
                                  >
                                    <img
                                      src={`img/settings/${encodeURIComponent("Windows Update")}.webp`}
                                      alt=""
                                      height={20}
                                    />
                                    <p>
                                      Windows Update
                                      <br />
                                      <span className="column_lower">Open update settings</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          case "netTop":
                            return (
                              <div key={i} className="netTop">
                                <div>
                                  <img src="img/settings/wifi.png" alt="" height={100} />
                                  <div>
                                    <h2 className="font-medium text-lg">Wi‑Fi</h2>
                                    <p>
                                      {wifi
                                        ? "Simulated radio — no network hardware on this PC"
                                        : "Off"}
                                    </p>
                                  </div>
                                </div>
                                <div className="box">
                                  <span className="settingsIcon"></span>
                                  <div>
                                    <h3>Properties</h3>
                                    <p>Public network · simulated</p>
                                  </div>
                                </div>
                                <div className="box">
                                  <span className="settingsIcon"></span>
                                  <div>
                                    <h3>Data usage</h3>
                                    <p>Not measured — browser sandbox</p>
                                  </div>
                                </div>
                              </div>
                            );
                          case "personaliseTop":
                            return (
                              <div key={i} className="personaliseTop">
                                <img className="mainImg" src={`img/wallpaper/${wall.src}`} alt="" />
                                <div>
                                  <h3>Select a theme to apply</h3>
                                  <div className="bgBox">
                                    {wall.themes.map((t, j) => (
                                      <Image
                                        key={j}
                                        className={wall.src.includes(t) ? "selected" : ""}
                                        src={`img/wallpaper/${t}/img0.jpg`}
                                        ext
                                        onClick={handleWallAndTheme}
                                        click="WALLSET"
                                        payload={`${t}/img0.jpg`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          case "accountsTop":
                            return (
                              <div key={i} className="accountsTop">
                                <img src="img/settings/defAccount.webp" alt="" width={90} />
                                <div>
                                  <p>{userName.toUpperCase()}</p>
                                  <p>Local Account</p>
                                  <p>Administrator</p>
                                </div>
                              </div>
                            );
                          case "timeTop":
                            return (
                              <div className="timeTop">
                                <h1>
                                  {new Date().toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "numeric",
                                    hour12: true,
                                  })}
                                </h1>
                              </div>
                            );
                          case "langSwitcher":
                            return (
                              <div key={i} className="tile langSwitcherTile">
                                <span className="settingsIcon"></span>
                                <div className="tile_content">
                                  <p>Windows display language</p>
                                  <p className="tile_desc">
                                    Windows features like Settings and File Explorer will appear in
                                    this language
                                  </p>
                                </div>
                                <LangSwitch />
                              </div>
                            );
                          case "updateTop":
                            return (
                              <div key={i} className="updateTop">
                                <div className="left">
                                  <img src="img/settings/update.png" width={90} alt="" />
                                  <div>
                                    <h2>
                                      {upd.status === "available"
                                        ? upd.update.kind === "feature"
                                          ? `WebOS ${upd.update.major} is available`
                                          : `Update ready — ${upd.update.version}`
                                        : upd.status === "checking"
                                          ? "Checking for updates…"
                                          : upd.status === "error"
                                            ? "Could not check for updates"
                                            : "You're up to date"}
                                    </h2>
                                    <p>
                                      {upd.status === "available"
                                        ? `${upd.update.kind === "feature" ? "Feature update" : "Quality update"} · ${
                                            upd.update.size
                                              ? `${(upd.update.size / 1048576).toFixed(1)} MB · `
                                              : ""
                                          }released ${upd.update.released || "recently"}`
                                        : upd.status === "error"
                                          ? upd.error.message
                                          : `${osLabel()} — the newest build for the ${OS.channel} channel.`}
                                    </p>
                                    <p className="updInline">
                                      {upd.lastCheck
                                        ? `Last checked ${new Date(upd.lastCheck).toLocaleString()}`
                                        : "Never checked on this PC."}
                                    </p>
                                  </div>
                                </div>
                                <div className="right">
                                  {upd.status === "available" && (
                                    <div
                                      className="btn accent"
                                      role="button"
                                      tabIndex={0}
                                      onClick={async () => {
                                        setUpdating(true);
                                        setInstallPhase({ pct: 4 });
                                        await installUpdate(upd.update, (p) => {
                                          setInstallPhase(p);
                                          if (p.step === "done") {
                                            setUpdHist(loadUpdateHistory());
                                            setTimeout(() => reloadIntoNewBuild(upd.update), 900);
                                          }
                                        });
                                      }}
                                      onKeyDown={keyActivate(() => {})}
                                    >
                                      {updating ? "Installing…" : "Install now"}
                                    </div>
                                  )}
                                  <div
                                    className="btn"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => checkForUpdates()}
                                    onKeyDown={keyActivate(() => checkForUpdates())}
                                  >
                                    {upd.status === "checking" ? "Checking…" : "Check for updates"}
                                  </div>
                                </div>
                                {installPhase && (
                                  <div className="updBarWrap">
                                    <div className="updBar">
                                      <span style={{ width: `${installPhase.pct}%` }} />
                                    </div>
                                    <span className="updBarTxt">
                                      {installPhase.step === "prepare" &&
                                        "Preparing the newest build…"}
                                      {installPhase.step === "clear" &&
                                        "Clearing the caches of the old build…"}
                                      {installPhase.step === "reload" && "Restarting the desktop…"}
                                      {installPhase.step === "done" && "Done — restarting"}
                                    </span>
                                  </div>
                                )}
                                {upd.status === "error" && (
                                  <div className="updErrRow">
                                    {upd.error.message}{" "}
                                    <span className="updErrCode">{upd.error.code}</span>
                                  </div>
                                )}
                                {upd.update?.notes && (
                                  <div className="updActionsRow">
                                    <div
                                      className="btn ghost"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() =>
                                        dispatch({ type: "UPDATEWIN", payload: "full" })
                                      }
                                      onKeyDown={keyActivate(() =>
                                        dispatch({ type: "UPDATEWIN", payload: "full" }),
                                      )}
                                    >
                                      Open the Update window
                                    </div>
                                    {upd.skipped === upd.update.version ? (
                                      <div
                                        className="btn ghost"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => clearSkip()}
                                        onKeyDown={keyActivate(() => clearSkip())}
                                      >
                                        Show this update again
                                      </div>
                                    ) : (
                                      <div
                                        className="btn ghost"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => skipVersion(upd.update.version)}
                                        onKeyDown={keyActivate(() =>
                                          skipVersion(upd.update.version),
                                        )}
                                      >
                                        Skip {upd.update.version}
                                      </div>
                                    )}
                                    <div
                                      className="btn ghost"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => muteFor(24)}
                                      onKeyDown={keyActivate(() => muteFor(24))}
                                    >
                                      Pause automatic checks for a day
                                    </div>
                                  </div>
                                )}
                                {updHist.length > 0 && (
                                  <div className="updHist">
                                    {updHist.slice(0, 4).map((h) => (
                                      <div key={h.version + h.at} className="updHistOne">
                                        <b>{h.version}</b>
                                        <span>
                                          {h.kind === "feature"
                                            ? "Feature update"
                                            : "Quality update"}
                                        </span>
                                        <span>{new Date(h.at).toLocaleDateString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          case "subHeading":
                          case "spacer":
                            return (
                              <div key={i} className={el.type}>
                                {el.name}
                              </div>
                            );
                          case "tile":
                          case "tile square":
                          case "tile thin-blue":
                            return (
                              <div
                                key={el.name}
                                className={el.type + " prtclk"}
                                role="button"
                                tabIndex={0}
                                onClick={() => tileClick(el)}
                                onKeyDown={keyActivate(() => tileClick(el))}
                              >
                                <span className="settingsIcon">{el.icon}</span>
                                <div>
                                  <p>{el.name}</p>
                                  <p className="tile_desc">{el.desc}</p>
                                </div>
                              </div>
                            );
                          default:
                            return console.log(`error - type ${el.type} not found`);
                        }
                      })}
                    </div>
                  </main>
                ),
            )
          )}

          {detail && (
            <div className="settingsDetail" key={detail.name}>
              <div className="sdHeader">
                <button className="sdBack" onClick={() => setDetail(null)} aria-label="Back">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M10 3L5 8l5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="sdCrumb">{page}</span>
              </div>

              <div className="sdHero">
                <span className="sdHeroIcon settingsIcon">{detail.icon || ""}</span>
                <div className="sdHeroText">
                  <h1>{detail.name}</h1>
                  {detail.desc && <p>{detail.desc}</p>}
                </div>
              </div>

              <div className="sdBody">
                {detail.name === "Display" && (
                  <>
                    <label className="sdRow">
                      Brightness
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={brightness}
                        onChange={(e) =>
                          dispatch({
                            type: "STNGSETV",
                            payload: { path: "system.display.brightness", value: +e.target.value },
                          })
                        }
                      />
                      <span>{brightness}%</span>
                    </label>
                    <label className="sdRow">
                      Night light
                      <input
                        type="checkbox"
                        checked={!!night}
                        onChange={() =>
                          dispatch({ type: "STNGTOGG", payload: "system.display.nightlight.state" })
                        }
                      />
                    </label>
                    <div className="sdRow">
                      <span>Fullscreen</span>
                      <span className="sdVal">{isFullscreen ? "On" : "Off"}</span>
                      <button className="sdBtn ghost" onClick={toggleFullscreen}>
                        {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                      </button>
                    </div>
                  </>
                )}

                {detail.name === "Sound" && (
                  <>
                    <p>
                      Volume is controlled from the taskbar speaker icon. This PC uses your browser
                      audio output.
                    </p>
                    <div className="sdActions">
                      <button
                        className="sdBtn"
                        onClick={() =>
                          playTestTone() ||
                          notify({
                            app: "Settings",
                            title: "Speaker test",
                            body: "Web Audio is not exposed by this browser.",
                            kind: "info",
                          })
                        }
                      >
                        Play test tone (440 Hz)
                      </button>
                    </div>
                    <p className="tile_desc">A real oscillator through Web Audio — nothing fake.</p>
                  </>
                )}

                {detail.name === "Rotate prompt" && <RotateGatePanel notify={notify} />}
                {detail.name === "Update history" && <UpdateHistoryPanel history={updHist} />}
                {detail.name === "Pause updates" && <PauseUpdatesPanel />}
                {detail.name === "Advanced options" && <UpdateAdvancedPanel state={upd} />}

                {detail.name === "Battery" && <BatteryPanel />}
                {detail.name === "Connection status" && <ConnectionPanel />}
                {detail.name === "Storage cleanup" && <StorageCleanup />}
                {detail.name === "Diagnostics" && <Diagnostics userName={userName} />}
                {detail.name === "Reset & export" && <SettingsTransfer />}
                {detail.name === "Site permissions" && <PermissionsViewer />}
                {detail.name === "Microphone" && <MicTester />}
                {detail.name === "Camera" && <CamTester />}
                {detail.name === "Accent colour" && (
                  <AccentPanel accent={accent} setAccent={setAccent} />
                )}

                {(detail.name === "Bluetooth" || detail.name === "Bluetooth & devices") && (
                  <label className="sdRow">
                    Bluetooth
                    <input
                      type="checkbox"
                      checked={!!bt}
                      onChange={() => {
                        dispatch({ type: "STNGTOGG", payload: "devices.bluetooth" });
                        simToast("Bluetooth", !bt);
                      }}
                    />
                  </label>
                )}

                {detail.name === "WiFi" && (
                  <label className="sdRow">
                    Wi‑Fi
                    <input
                      type="checkbox"
                      checked={!!wifi}
                      onChange={() => {
                        dispatch({ type: "STNGTOGG", payload: "network.wifi.state" });
                        simToast("Wi‑Fi", !wifi);
                      }}
                    />
                  </label>
                )}

                {detail.name === "Flight mode" && (
                  <button
                    className="sdBtn"
                    onClick={() => {
                      dispatch({ type: "TOGGAIRPLNMD" });
                      notify({
                        app: "Settings",
                        title: "Flight mode",
                        body: "Toggled. There are no radios on this PC, so nothing to switch off — but the state persists.",
                        kind: "info",
                      });
                    }}
                  >
                    Toggle flight mode
                  </button>
                )}

                {(detail.name === "Colours" ||
                  detail.name === "Themes" ||
                  detail.name === "Background") && (
                  <button className="sdBtn" onClick={() => changeTheme()}>
                    Switch to {theme === "light" ? "dark" : "light"} theme
                  </button>
                )}

                {(detail.name === "Night light" || detail.name === "Visual effects") && (
                  <>
                    <label className="sdRow">
                      Night light
                      <input
                        type="checkbox"
                        checked={!!night}
                        onChange={() =>
                          dispatch({ type: "STNGTOGG", payload: "system.display.nightlight.state" })
                        }
                      />
                    </label>
                    {detail.name === "Visual effects" && (
                      <>
                        <label className="sdRow">
                          Transparency effects
                          <input
                            type="checkbox"
                            checked={transparency}
                            onChange={() => setTransparency(!transparency)}
                          />
                        </label>
                        <label className="sdRow">
                          Animation effects
                          <input
                            type="checkbox"
                            checked={animations}
                            onChange={() => setAnimations(!animations)}
                          />
                        </label>
                      </>
                    )}
                  </>
                )}

                {detail.name === "Text size" && (
                  <label className="sdRow">
                    Text size
                    <input
                      type="range"
                      min="100"
                      max="150"
                      value={textSizeVal}
                      onChange={(e) => setTextSizeVal(+e.target.value)}
                    />
                    <span>{textSizeVal}%</span>
                  </label>
                )}

                {detail.name === "Contrast themes" && (
                  <label className="sdRow">
                    High contrast
                    <input
                      type="checkbox"
                      checked={contrast}
                      onChange={() => setContrast(!contrast)}
                    />
                  </label>
                )}

                {detail.name === "Power & battery" && (
                  <>
                    <label className="sdRow">
                      Battery saver
                      <input
                        type="checkbox"
                        checked={!!saver}
                        onChange={() =>
                          dispatch({ type: "STNGTOGG", payload: "system.power.saver.state" })
                        }
                      />
                    </label>
                    <div className="sdRow">
                      <span>Screen wake lock</span>
                      <span className="sdVal">{wakeActive ? "Held" : "Released"}</span>
                      <button className="sdBtn ghost" onClick={toggleWakeLock}>
                        {wakeActive ? "Release" : "Hold screen awake"}
                      </button>
                    </div>
                    <p className="tile_desc">
                      Uses the Screen Wake Lock API. Requires a user click and HTTPS (or localhost).
                    </p>
                    <BatteryPanel />
                  </>
                )}

                {detail.name === "Storage" && (
                  <p>
                    {`Open “Storage cleanup” for a live breakdown of Cache Storage and IndexedDB on this device.`}
                  </p>
                )}

                {(detail.name === "Your info" || detail.name === "Your Microsoft account") && (
                  <label className="sdRow">
                    Account name
                    <input
                      type="text"
                      value={rename || userName}
                      onChange={(e) => setRename(e.target.value)}
                      onBlur={() => {
                        if (!rename || rename === userName) return;
                        dispatch({
                          type: "STNGSETV",
                          payload: { path: "person.name", value: rename },
                        });
                        applyUserName(rename)
                          .then(() =>
                            notify({
                              app: "Settings",
                              title: "Account renamed",
                              body: `C:\\Users\\${rename} is live across the PC.`,
                              kind: "success",
                            }),
                          )
                          .catch(() => {});
                      }}
                    />
                  </label>
                )}

                {detail.name === "About" && <AboutPanel userName={userName} />}

                {detail.name === "Windows Security" && (
                  <button
                    className="sdBtn"
                    onClick={() => dispatch({ type: "SECURITYAPP", payload: "full" })}
                  >
                    Open Windows Security
                  </button>
                )}

                {detail.name === "Clipboard" && (
                  <button className="sdBtn" onClick={() => navigator.clipboard?.writeText("")}>
                    Clear clipboard
                  </button>
                )}

                {detail.name === "Recovery" && (
                  <p>
                    Open Terminal and run <code>reset-setup</code>, then reload to run OOBE again.
                  </p>
                )}

                {detail.name === "Notifications" && (
                  <label className="sdRow">
                    Notifications
                    <input
                      type="checkbox"
                      checked={!notificationsOff}
                      onChange={() => {
                        dispatch({ type: "STNGTOGG", payload: "system.notifications.disabled" });
                        notify({
                          app: "Settings",
                          title: "Notifications",
                          body: !notificationsOff
                            ? "Notifications are off — toasts from apps and the system are muted."
                            : "Notifications are on.",
                          kind: "info",
                        });
                      }}
                    />
                  </label>
                )}

                {detail.name === "Date & time" && (
                  <div>
                    <p style={{ fontSize: 26, fontWeight: 600, margin: "4px 0" }}>
                      {now.toLocaleTimeString()}
                    </p>
                    <p>
                      <b>Date</b>{" "}
                      {now.toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p>
                      <b>Time zone</b> {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </p>
                  </div>
                )}

                {detail.name === "Background" && (
                  <div className="bgBox">
                    {wall.themes.map((t, i) => (
                      <Image
                        key={i}
                        className={wall.src.includes(t) ? "selected" : ""}
                        src={`img/wallpaper/${t}/img0.jpg`}
                        ext
                        onClick={handleWallAndTheme}
                        click="WALLSET"
                        payload={`${t}/img0.jpg`}
                      />
                    ))}
                  </div>
                )}

                {detail.name === "Apps & features" && (
                  <div className="sdApps">
                    {installed.length === 0 ? (
                      <p className="tile_desc">Nothing installed from the Microsoft Store yet.</p>
                    ) : (
                      installed.map((app) => (
                        <div key={app.icon || app.name} className="sdAppRow">
                          <Icon src={app.icon} width={22} />
                          <span className="sdAppName">{app.name}</span>
                          <button
                            className="sdBtn"
                            onClick={() => {
                              delApp("delete", {
                                dataset: { action: app.action, payload: app.icon },
                              });
                              setInstalled((x) => x.filter((y) => y.name !== app.name));
                            }}
                          >
                            Uninstall
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {detail.name === "Startup" && (
                  <div className="sdApps">
                    {installed.length === 0 ? (
                      <p className="tile_desc">No installed apps to list.</p>
                    ) : (
                      installed.map((app) => (
                        <div key={app.icon || app.name} className="sdAppRow">
                          <Icon src={app.icon} width={22} />
                          <span className="sdAppName">{app.name}</span>
                          <span className="tile_desc">Not autostarted</span>
                        </div>
                      ))
                    )}
                    <p className="tile_desc">
                      Browser apps do not autostart with the OS — this list is read-only.
                    </p>
                  </div>
                )}

                {PLACEHOLDER.has(detail.name) && <p className="tile_desc">{HONEST}</p>}
              </div>
            </div>
          )}

          <div className="navMenuBtn" onClick={() => setNav(nav ? "" : "open")}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 48 48"
              width={24}
              height={24}
            >
              <path d="M5.5 9a1.5 1.5 0 1 0 0 3h37a1.5 1.5 0 1 0 0-3h-37zm0 13.5a1.5 1.5 0 1 0 0 3h37a1.5 1.5 0 1 0 0-3h-37zm0 13.5a1.5 1.5 0 1 0 0 3h37a1.5 1.5 0 1 0 0-3h-37z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

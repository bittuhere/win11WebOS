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

import { Suspense, Component, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDispatch, useSelector } from "react-redux";
import "./i18nextConf";
import "./index.css";

import ActMenu from "./components/menu";
import { BandPane, CalnWid, DesktopApp, SidePane, StartMenu, WidPane } from "./components/start";
import Taskbar from "./components/taskbar";
import RunDialog from "./components/shared/RunDialog";
import { Background, BootScreen, LockScreen } from "./containers/background";
import OOBE from "./containers/oobe";
import { ShellUI } from "./containers/ui";
import "./rotategate.scss";
import "./mobile.scss";
import RotateGate from "./components/shared/RotateGate";
import "./polish.scss";

import { loadSettings } from "./actions";
import { AboutWin, WINDOW_APPS } from "./containers/applications";
import { notify } from "./utils/os/ui";
import { checkForUpdates, loadUpdatePrefs, shouldAutoCheck, confirmInstalledBuild } from "./utils/os/updates";
import { osVersion } from "./utils/os/version";

/** the version line for a toast body — kept tiny on purpose */
const u_ver = (st) =>
  st?.os ? `v${st.os.major}.${String(st.os.build).padStart(2, "0")}` : osVersion();
import * as Drafts from "./containers/applications/draft";
import { getUser, seedIfEmpty, getUserWithFallback } from "./utils/idb";
import store from "./reducers";
import { hydrateTheme } from "./utils/os/theme";
import { allApps } from "./utils";
import { checkBridge } from "./utils/os/bridge";

/**
 * Per-app crash isolation: a throwing window shows a graceful "app stopped
 * working" card inside its own window — the desktop, taskbar and every other
 * app keep running. Only a shell-level failure reaches the outer BSOD.
 */
class AppBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    // surfaces in the console (and the driver's error log) with the app name
    console.error(
      `[AppBoundary:${this.props.name}]`,
      err?.message || err,
      info?.componentStack || "",
    );
  }
  restart = () => {
    const { dispatch, action } = this.props;
    this.setState({ err: null });
    if (!action) return;
    dispatch({ type: action, payload: "close" });
    setTimeout(() => dispatch({ type: action, payload: "full" }), 340);
  };
  quit = () => {
    const { dispatch, action } = this.props;
    this.setState({ err: null });
    if (action) dispatch({ type: action, payload: "close" });
  };
  render() {
    const { err } = this.state;
    const { name, dispatch, action, children } = this.props;
    if (!err) return children;
    return (
      <div className="floatTab dpShad appCrash" data-max="true" style={{ zIndex: 999 }}>
        <div className="appCrashCard">
          <svg viewBox="0 0 48 48" width="52" height="52">
            <circle cx="24" cy="24" r="22" fill="none" stroke="#e8a300" strokeWidth="3" />
            <path d="M24 13v14" stroke="#e8a300" strokeWidth="4" strokeLinecap="round" />
            <circle cx="24" cy="34" r="2.4" fill="#e8a300" />
          </svg>
          <h2>{name || "This app"} ran into a problem</h2>
          <p className="appCrashMsg">{String(err?.message || err).slice(0, 160)}</p>
          <p className="appCrashSub">
            Other apps are unaffected. Windows keeps the crash log in the console.
          </p>
          <div className="winRow" style={{ justifyContent: "center", marginTop: 14 }}>
            <button className="winBtn" onClick={this.restart}>
              Restart app
            </button>
            <button className="winBtn ghost" onClick={this.quit}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <meta charSet="UTF-8" />
      <title>404 - Page</title>
      <div id="page">
        <div id="container">
          <h1>:(</h1>
          <h2>
            Your PC ran into a problem and needs to restart. We're just collecting some error info,
            and then we'll restart for you.
          </h2>
          <h2>
            <span id="percentage">0</span>% complete
          </h2>
          <div id="details">
            <div id="qr">
              <div id="image">
                <img src="img/logo.png" alt="Windows 11 WebOS" width="96" height="96" />
              </div>
            </div>
            <div id="stopcode">
              <h4>
                For more information about this issue and possible fixes, visit
                <br />{" "}
                <a href="https://github.com/bittuhere/win11WebOS/issues">
                  https://github.com/bittuhere/win11WebOS/issues
                </a>{" "}
              </h4>
              <h5>
                If you call a support person, give them this info:
                <br />
                Stop Code: {error.message}
              </h5>
              <button onClick={resetErrorBoundary}>Try again</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const apps = useSelector((state) => state.apps);
  const startmenu = useSelector((state) => state.startmenu);
  const wall = useSelector((state) => state.wallpaper);
  const dispatch = useDispatch();
  const [setup, setSetup] = useState(null);
  const deepLink = useRef(false);
  const sessionReady = wall.booted && !wall.locked;
  const aboutShown = useRef(false);
  const bootUpdateChecked = useRef(false);
  const [desktopStarted, setDesktopStarted] = useState(false);
  useEffect(() => { if (sessionReady) setDesktopStarted(true); }, [sessionReady]);

  useEffect(() => {
    let alive = true;
    /* The boot read must ALWAYS land on a setup verdict. It used to be a
       bare await — one IndexedDB hiccup and the app sat on the boot screen
       forever, and a lost user record dropped people back into OOBE even
       though they had set this PC up before. */
    (async () => {
      let user = null;
      try {
        user = await getUserWithFallback();
      } catch (e) {
        user = null;
      }
      try {
        if (user?.setupComplete) await seedIfEmpty();
      } catch (e) {}
      if (!alive) return;
      if (!alive) return;

      // the profile folder is named after the account — VS may have booted
      // before that name existed, so re-apply it on every start
      if (user?.username) {
        try {
          const vs = await import("./utils/os/vs");
          if (vs.getUserName() !== user.username) await vs.applyUserName(user.username);
        } catch (e) {}
      }

      // IndexedDB mirror of the settings wins when localStorage was cleared,
      // so the theme you picked survives even a wiped site-data cache.
      try {
        const { idb } = await import("./utils/idb");
        const saved = await idb.get("setting");
        const localRaw = localStorage.getItem("setting");
        if (saved && !localRaw) hydrateTheme(store, saved);
      } catch (e) {}

      setSetup(!!(user && user.setupComplete));
      if (user?.username) {
        dispatch({
          type: "STNGSETV",
          payload: { path: "person.name", value: user.username },
        });
      }

      // Is the CORS-lifting browser extension installed? (see OOBE step)

    })().catch(() => {
      /* even a half-broken boot must not loop the first-run wizard */
      if (alive) setSetup(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    confirmInstalledBuild();
    checkBridge();
    import("./actions").then((m) => m.restoreInstalled().catch(() => {}));
    import("./utils/os/display").then((m) => m.startDisplaySync()).catch(() => {});
  }, [sessionReady]);

  const afterMath = (event) => {
    var ess = [
      ["START", "STARTHID"],
      ["BAND", "BANDHIDE"],
      ["PANE", "PANEHIDE"],
      ["WIDG", "WIDGHIDE"],
      ["CALN", "CALNHIDE"],
      ["MENU", "MENUHIDE"],
    ];

    var actionType = "";
    try {
      actionType = event.target.dataset.action || "";
    } catch (err) {}

    var actionType0 = getComputedStyle(event.target).getPropertyValue("--prefix");

    ess.forEach((item, i) => {
      if (!actionType.startsWith(item[0]) && !actionType0.startsWith(item[0])) {
        dispatch({
          type: item[1],
        });
      }
    });
  };

  useEffect(() => {
    const onContext = (e) => {
      afterMath(e);
      e.preventDefault();
      var data = {
        top: e.clientY,
        left: e.clientX,
      };

      // text fields keep the browser's own menu (copy/paste matters)
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;

      // the marker can sit on an ancestor (Icon paints data-menu on its root
      // while the physical target is the img inside) — walk up to it
      const host = e.target?.closest?.("[data-menu]");
      if (!host) return;
      // the DESK menu belongs to bare wallpaper only — a right-click inside
      // an app window must never bubble up to it (windows sit inside the
      // .desktop container, so without this check every app leaked the menu)
      if (host.dataset.menu === "desk" && e.target.closest?.(".floatTab")) return;
      data.menu = host.dataset.menu;
      data.attr = host.attributes;
      data.dataset = host.dataset;
      dispatch({
        type: "MENUSHOW",
        payload: data,
      });
    };
    window.addEventListener("click", afterMath);
    window.addEventListener("contextmenu", onContext);
    return () => {
      window.removeEventListener("click", afterMath);
      window.removeEventListener("contextmenu", onContext);
    };
  }, [dispatch]);

  useEffect(() => {
    const topWindow = () =>
      Object.keys(apps)
        .filter((k) => k !== "hz")
        .map((k) => apps[k])
        .find((a) => a && a.alive && !a.closing && a.z === apps.hz);

    // Win+Arrow snaps the focused window to half the screen, like Windows.
    const snap = (dir) => {
      const top = topWindow();
      if (!top?.action) return;
      const half = (x, y, w, h) =>
        dispatch({
          type: top.action,
          payload: "resize",
          dim: { width: w, height: h, top: y, left: x },
        });
      if (dir === "left") half(0, 0, "50%", "100%");
      else if (dir === "right") half("50%", 0, "50%", "100%");
      else if (dir === "up") dispatch({ type: top.action, payload: "mxmz" });
      else if (dir === "down") dispatch({ type: top.action, payload: "mnmz" });
    };

    const onKey = (e) => {
      if (e.key === "Escape" && !(startmenu?.hide ?? true)) {
        dispatch({ type: "STARTHID" }); // Escape closes Start, like Windows
        return;
      }
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        // classic Alt+Tab: raise the window just below the focused one
        const alive = Object.keys(apps)
          .filter(
            (k) =>
              k !== "hz" &&
              apps[k]?.alive &&
              !apps[k]?.closing &&
              apps[k]?.action &&
              apps[k]?.z > 0,
          )
          .map((k) => apps[k])
          .sort((a, b) => b.z - a.z);
        if (alive.length < 2) return;
        const next = alive[1];
        dispatch({ type: next.action, payload: "togg" });
        return;
      }
      if (e.altKey && (e.key === "F4" || e.code === "F4")) {
        e.preventDefault();
        const top = topWindow();
        if (top?.action) dispatch({ type: top.action, payload: "close" });
        return;
      }
      const meta = e.metaKey || (e.ctrlKey && e.altKey); // ctrl+alt as the no-Windows-key alias
      if (!meta) return;
      // e.code, not e.key: AltGr (Ctrl+Alt) layouts can rewrite e.key to an
      // accented glyph, and the code is what stays honest across layouts
      if (e.code === "KeyR" || e.key === "r" || e.key === "R") {
        e.preventDefault();
        dispatch({ type: "RUNSHOW" });
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        snap("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        snap("right");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        snap("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        snap("down");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apps, startmenu, dispatch]);

  useEffect(() => {
    const onReject = (e) => {
      // honest stability: unhandled promise rejections must be visible, not silent
      console.error("[unhandledrejection]", e?.reason?.stack || e?.reason || e);
    };
    window.addEventListener("unhandledrejection", onReject);
    return () => window.removeEventListener("unhandledrejection", onReject);
  }, []);

  useEffect(() => {
    const closing = Object.keys(apps).filter((k) => k !== "hz" && apps[k]?.closing);
    if (!closing.length) return;
    const timers = closing.map((id) =>
      setTimeout(() => dispatch({ type: "APPREAP", payload: id }), 280),
    );
    return () => timers.forEach(clearTimeout);
  }, [apps, dispatch]);

  useEffect(() => {
    if (setup !== true) return;
    /* NOTE: this effect used to PATCH window.open globally, rerouting every
       new tab into the in-OS Edge app. That hijack is gone: real external
       links (Github, issue tracker, "open in a new tab") now leave through
       utils/os/links.js -> a genuine browser tab, while the OS's own
       "open this URL in Edge" actions use the EDGELINK action explicitly. */
    if (!window.onstart) {
      loadSettings();
      window.onstart = setTimeout(() => {
        dispatch({ type: "WALLBOOTED" });
      }, 4200);
    }
  }, [setup]);

  /* The keyboard easter eggs (type "pikachu", "mario" or "ohhh") live in
     public/react-pwa.js — ~220 KB that used to block every boot. They are
     fetched only once the desktop is on screen. */
  useEffect(() => {
    if (!sessionReady) return;
    const t = setTimeout(() => {
      try {
        if (document.querySelector("script[data-wos-eggs]")) return;
        const sc = document.createElement("script");
        sc.src = "react-pwa.js";
        sc.defer = true;
        sc.dataset.wosEggs = "1";
        document.body.appendChild(sc);
      } catch (e) {}
    }, 1500);
    return () => clearTimeout(t);
  }, [sessionReady]);

  /* Deep links: /?app=notepad, /?app="File Explorer", /?app=NOTEPAD — the
     installable app's shortcuts use these, and they make any app shareable by
     URL. Resolved against the same registry the desktop and Start menu use, so
     a renamed app keeps working; an unknown name is simply ignored. */
  useEffect(() => {
    if (!sessionReady || deepLink.current) return;
    deepLink.current = true;
    let want = "";
    try {
      want = new URLSearchParams(window.location.search).get("app") || "";
    } catch (e) {
      return;
    }
    if (!want) return;
    const slug = (v) =>
      String(v || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const hit = allApps.find(
      (a) => !a.hidden && (slug(a.name) === slug(want) || slug(a.action) === slug(want)),
    );
    if (hit && hit.action) dispatch({ type: hit.action, payload: "full" });
  }, [sessionReady, dispatch]);

  /* Every boot — the cold start above and an in-OS Restart alike — raises the
     About panel again. It is redux-driven so the panel reappears whatever the
     boot source is; Ok closes it until the next boot. */
  useEffect(() => {
    if (!wall.booted) aboutShown.current = false;
    if (sessionReady && !aboutShown.current) {
      aboutShown.current = true;
      dispatch({ type: "DESKABOUT", payload: { open: true, boot: true } });
    }
  }, [sessionReady, dispatch]);

  /* One automatic attempt per boot, only after sign-in. A lock/unlock is not
     a new boot. Offline/hidden/paused boots defer their one attempt; failed
     attempts can be retried manually, or automatically on the next boot. */
  useEffect(() => {
    if (!wall.booted) bootUpdateChecked.current = false;
    if (!sessionReady) return undefined;
    let alive = true;
    const readyAt = Date.now() + 15000;
    const runCheck = async () => {
      if (!alive || document.hidden || bootUpdateChecked.current || Date.now() < readyAt) return;
      loadUpdatePrefs();
      if (!shouldAutoCheck() || !navigator.onLine) return;
      bootUpdateChecked.current = true; // claim before awaiting: visibility/online cannot race
      const st = await checkForUpdates();
      if (!alive || st.status === "checking") return;
      if (st.status === "available" && st.skipped !== st.update.version) {
        const u = st.update;
        notify({
          app: "Windows Update",
          icon: "img/icon/update.png",
          title:
            u.kind === "feature"
              ? `WebOS ${u.major} is ready to install`
              : `Update ready — ${u.version}`,
          body:
            u.kind === "feature"
              ? "A feature update with new apps and new features."
              : "A quality update with fixes for this PC.",
          kind: "info",
          life: 14,
          actions: [
            {
              label: "See what's new",
              onClick: () => dispatch({ type: "UPDATEWIN", payload: "full" }),
            },
          ],
        });
      } else if (st.status === "error") {
        /* never shout about a failed check — it is information, not an error
           the person caused. The Settings page has the full story. */
        notify({
          app: "Windows Update",
          icon: "img/icon/update.png",
          title: "Could not check for updates",
          body: st.error?.message || "The update server was unreachable.",
          kind: "warn",
          life: 6,
          actions: [
            {
              label: "Open Windows Update",
              onClick: () => dispatch({ type: "UPDATEWIN", payload: "full" }),
            },
          ],
        });
      }
    };
    const t = setTimeout(runCheck, 15000);
    const interval = setInterval(runCheck, 60000); // only while the boot attempt is deferred
    const onResume = () => { if (!document.hidden) runCheck(); };
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(interval);
      window.removeEventListener("online", onResume);
      document.removeEventListener("visibilitychange", onResume);
    };
  }, [wall.booted, sessionReady, dispatch]);

  const finishOobe = (user) => {
    if (user?.username) {
      dispatch({
        type: "STNGSETV",
        payload: { path: "person.name", value: user.username },
      });
    }
    setSetup(true);
    dispatch({ type: "WALLALOCK" });
    window.onstart = setTimeout(() => {
      dispatch({ type: "WALLBOOTED" });
    }, 4200);
  };

  if (setup === null) {
    return (
      <div className="App">
        <BootScreen dir={0} />
        <ShellUI />
        <RotateGate />
      </div>
    );
  }

  if (setup === false) {
    return (
      <div className="App">
        <OOBE onComplete={finishOobe} />
        <ShellUI />
        {/* first-run counts: a phone in portrait gets the gate from the very
            first screen, before any account exists */}
        <RotateGate />
      </div>
    );
  }

  return (
    <div className="App">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        {!wall.booted ? <BootScreen dir={wall.dir} /> : null}
        {wall.locked ? <LockScreen dir={wall.dir} /> : null}
        {desktopStarted && <div className="appwrap" style={{visibility: sessionReady ? "visible" : "hidden"}} {...(!sessionReady ? {inert: ""} : {})}>
          <Background />
          <div className="desktop" data-menu="desk">
            <DesktopApp />
            {WINDOW_APPS.map(({ icon, Comp }) => {
              const app = apps[icon];
              if (!app?.alive) return null;
              return (
                <AppBoundary
                  key={icon + "-" + (app.session || 0)}
                  name={app.name || icon}
                  action={app.action}
                  dispatch={dispatch}
                >
                  <Suspense fallback={<div className="appLoadHint" role="status">Opening app…</div>}><Comp /></Suspense>
                </AppBoundary>
              );
            })}
            {Object.keys(apps)
              .filter((x) => x != "hz")
              .map((key) => apps[key])
              .map((app) => {
                if (app.pwa && app.alive) {
                  var WinApp = Drafts[app.data.type];
                  if (!WinApp) return null;
                  return (
                    <AppBoundary
                      key={app.icon + "-" + (app.session || 0)}
                      name={app.name || app.icon}
                      action={app.action}
                      dispatch={dispatch}
                    >
                      <WinApp icon={app.icon} {...app.data} />
                    </AppBoundary>
                  );
                }
                return null;
              })}
            <AboutWin />
            <StartMenu />
            <BandPane />
            <SidePane />
            <WidPane />
            <CalnWid />
          </div>
          <Taskbar />
          <ActMenu />
          <RotateGate />
        </div>}
        <ShellUI />
        {sessionReady && <RunDialog />}
      </ErrorBoundary>
    </div>
  );
}

export default App;

import "./release-polish.scss";

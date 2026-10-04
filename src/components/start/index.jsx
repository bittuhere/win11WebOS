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
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import * as Actions from "../../actions";
import { getTreeValue, handleFileOpen } from "../../actions";
import { notify } from "../../utils/os/ui";
import { openExternal } from "../../utils/os/links";
import * as vs from "../../utils/os/vs";
import store from "../../reducers";
import { Icon } from "../../utils/general";
import Battery from "../shared/Battery";
import "./searchpane.scss";
import "./sidepane.scss";
import "./startmenu.scss";

export * from "./start";
export * from "./widget";

export const DesktopApp = () => {
  const deskApps = useSelector((state) => {
    var arr = { ...state.desktop };
    var tmpApps = [...arr.apps];

    if (arr.sort == "name") {
      tmpApps.sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
    } else if (arr.sort == "size") {
      tmpApps.sort((a, b) => {
        var anm = a.name,
          bnm = b.name;

        return anm[bnm.charCodeAt(0) % anm.length] > bnm[anm.charCodeAt(0) % bnm.length] ? 1 : -1;
      });
    } else if (arr.sort == "date") {
      tmpApps.sort((a, b) => {
        var anm = a.name,
          bnm = b.name;
        var anml = anm.length,
          bnml = bnm.length;

        return anm[(bnml * 13) % anm.length] > bnm[(anml * 17) % bnm.length] ? 1 : -1;
      });
    }

    arr.apps = tmpApps;
    return arr;
  });
  const dispatch = useDispatch();
  const files = useSelector((state) => state.files);
  const user = useSelector((state) => state.setting.person.name);

  /* the REAL desktop also shows the contents of the Desktop folder —
     New ▸ Folder / Text Document land here and immediately show up */
  const deskFiles = useMemo(() => {
    try {
      const desk = files.data?.getId(files.data?.special?.["%desktop%"]);
      return (desk?.data || []).filter(Boolean);
    } catch (e) {
      return [];
    }
  }, [files]);

  /* Delete removes everything the rubber band selected; Escape clears */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Escape") return;
      if (e.target?.closest?.("input, textarea, .floatTab, .startMenu")) return;
      const sel = [...document.querySelectorAll(".dskApp.dsksel")];
      if (!sel.length) return;
      if (e.key === "Escape") {
        sel.forEach((n) => n.classList.remove("dsksel"));
        return;
      }
      e.preventDefault();
      sel.forEach((n) => {
        if (n.dataset.fileid) {
          store.dispatch({ type: "FILEDEL", payload: [n.dataset.fileid] });
        } else if (n.dataset.name) {
          store.dispatch({ type: "DESKREM", payload: n.dataset.name });
        }
      });
      sel.forEach((n) => n.classList.remove("dsksel"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- drag-select: the Windows 11 rubber band over the wallpaper ---- */
  const bandRef = useRef(null);
  const dragRef = useRef(null);

  const bandMove = (e) => {
    if (!dragRef.current || !bandRef.current) return;
    const [x0, y0] = dragRef.current;
    const x1 = e.clientX,
      y1 = e.clientY;
    const el = bandRef.current;
    el.style.display = "block";
    el.style.left = Math.min(x0, x1) + "px";
    el.style.top = Math.min(y0, y1) + "px";
    el.style.width = Math.abs(x1 - x0) + "px";
    el.style.height = Math.abs(y1 - y0) + "px";
    // highlight every icon the band touches, like the real desktop.
    // band rect straight from the drag coordinates — element rects are
    // unreliable (zero-size in test DOMs, and cheap anyway)
    const bl = Math.min(x0, x1);
    const bt = Math.min(y0, y1);
    const br = Math.max(x0, x1);
    const bb = Math.max(y0, y1);
    document.querySelectorAll(".dskApp").forEach((n) => {
      const r = n.getBoundingClientRect();
      const hit = !(r.right < bl || r.left > br || r.bottom < bt || r.top > bb);
      n.classList.toggle("dsksel", hit);
    });
  };
  const bandUp = () => {
    dragRef.current = null;
    if (bandRef.current) bandRef.current.style.display = "none";
    window.removeEventListener("pointermove", bandMove);
    window.removeEventListener("pointerup", bandUp);
  };
  const bandDown = (e) => {
    if (e.button !== 0 || e.target.closest(".dskApp")) return;
    dragRef.current = [e.clientX, e.clientY];
    window.addEventListener("pointermove", bandMove);
    window.addEventListener("pointerup", bandUp);
  };

  /* ---- drag & drop: drop apps (Start/taskbar) or files (Explorer) here ---- */
  const onDragOver = (e) => {
    const t = e.dataTransfer?.types || [];
    if (t.includes("application/x-wos-app") || t.includes("application/x-wos-files")) {
      e.preventDefault(); // allow the drop
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const onDrop = async (e) => {
    const appName = e.dataTransfer?.getData("application/x-wos-app");
    const fileRaw = e.dataTransfer?.getData("application/x-wos-files");
    if (!appName && !fileRaw) return;
    e.preventDefault();
    e.stopPropagation();
    if (appName) {
      // a shortcut for the dropped app lands on the desktop
      const desk = store.getState().desktop;
      if (!desk.apps.some((x) => x.name === appName)) {
        store.dispatch({ type: "DESKADD", payload: appName });
        notify({
          app: "Desktop",
          icon: "img/icon/explorer.png",
          title: "Shortcut created",
          body: `${appName} is on your desktop.`,
          kind: "success",
          life: 3,
        });
      }
      return;
    }
    // files dragged out of File Explorer MOVE into the Desktop folder
    try {
      const ids = JSON.parse(fileRaw || "[]");
      const st = store.getState().files;
      const deskPath = vs.pathOf(st.data.getId(st.data.special["%desktop%"]));
      let moved = 0;
      for (const id of ids) {
        const item = st.data.getId(id);
        if (!item) continue;
        const from = vs.pathOf(item);
        if (from === `${deskPath}\\${item.name}`) continue;
        await vs.vsCopy(from, deskPath, { move: true });
        moved += 1;
      }
      if (moved) {
        store.dispatch({ type: "FILEREFRESH" });
        notify({
          app: "Desktop",
          icon: "img/icon/explorer.png",
          title: moved === 1 ? "File moved to desktop" : `${moved} files moved to desktop`,
          body: deskPath,
          kind: "success",
          life: 3,
        });
      }
    } catch (err) {
      notify({
        app: "Desktop",
        icon: "img/icon/explorer.png",
        title: "Could not move that here",
        body: String(err?.message || err),
        kind: "error",
      });
    }
  };

  return (
    <div className="desktopCont" onMouseDown={bandDown} onDragOver={onDragOver} onDrop={onDrop}>
      {createPortal(<div className="dselBand" ref={bandRef} />, document.body)}
      {!deskApps.hide &&
        deskApps.apps.map((app, i) => {
          return (
            // to allow it to be focusable (:focus) — the menu attributes live
            // HERE so every right-click action can read data-action/data-name
            <div
              key={i}
              className="dskApp"
              tabIndex={0}
              title={`${app.name} — double-click to open`}
              data-menu="app"
              data-action={app.action}
              data-payload={app.payload || "full"}
              data-name={app.name}
              data-icon={app.icon}
              onClickCapture={(e) => {
                // a single click only selects — the real Windows opens on double-click
                e.stopPropagation();
                e.preventDefault();
              }}
              onDoubleClick={() => {
                if (app.action === "EXTERNALTAB" || /github/i.test(app.name || "")) {
                  // project links open a REAL browser tab — the one exception
                  openExternal(app.payload || "https://github.com/bittuhere/win11WebOS");
                  return;
                }
                dispatch({ type: app.action, payload: app.payload || "full" });
              }}
            >
              <Icon className="dskIcon" src={app.icon} width={Math.round(deskApps.size * 36)} />
              <div className="appName">{app.name}</div>
            </div>
          );
        })}
      {!deskApps.hide &&
        deskFiles.map((f) => {
          const isDir = f.type === "folder";
          return (
            <div
              key={f.id}
              className="dskApp dskFile"
              tabIndex={0}
              title={`${f.name} — double-click to open`}
              data-menu="file"
              data-fileid={f.id}
              data-name={f.name}
              onClickCapture={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onDoubleClick={() => handleFileOpen(f.id)}
            >
              <Icon
                className="dskIcon"
                fafa={isDir ? "faFolder" : "faFileLines"}
                width={Math.round(deskApps.size * 32)}
              />
              <div className="appName">{f.name}</div>
            </div>
          );
        })}
    </div>
  );
};

export const BandPane = () => {
  const sidepane = useSelector((state) => state.sidepane);

  return (
    <div className="bandpane dpShad" data-hide={sidepane.banhide} style={{ "--prefix": "BAND" }}>
      <div className="bandContainer">
        <Icon
          className="hvlight"
          width={17}
          click="CALCUAPP"
          payload="togg"
          open="true"
          src="calculator"
        />
        <Icon
          className="hvlight"
          width={17}
          click="SETTINGS"
          payload="togg"
          open="true"
          src="settings"
        />
        <Icon className="hvlight" width={17} click="NOTEPAD" payload="togg" src="notepad" />
      </div>
    </div>
  );
};

export const SidePane = () => {
  const sidepane = useSelector((state) => state.sidepane);
  const setting = useSelector((state) => state.setting);
  const tasks = useSelector((state) => state.taskbar);
  const [pnstates, setPnstate] = useState([]);
  const dispatch = useDispatch();

  let [btlevel, setBtLevel] = useState("");
  const childToParent = () => {};

  const clickDispatch = (event) => {
    var action = {
      type: event.target.dataset.action,
      payload: event.target.dataset.payload,
    };

    if (action.type) {
      if (action.type != action.type.toUpperCase()) {
        Actions[action.type](action.payload);
      } else dispatch(action);
    }
    // For battery saver
    if (action.payload === "system.power.saver.state") setBrightness();
  };

  const vSlider = document.querySelector(".vSlider");
  const bSlider = document.querySelector(".bSlider");

  const setVolume = (e) => {
    var aud = 3;
    if (e.target.value < 70) aud = 2;
    if (e.target.value < 30) aud = 1;
    if (e.target.value == 0) aud = 0;

    dispatch({ type: "TASKAUDO", payload: aud });

    sliderBackground(vSlider, e.target.value);
  };

  function sliderBackground(elem, e) {
    elem.style.setProperty(
      "--track-color",
      `linear-gradient(90deg, var(--clrPrm) ${e - 3}%, #888888 ${e}%)`,
    );
  }

  const setBrightness = (e) => {
    var brgt = document.getElementById("brightnessSlider").value;
    if (!e) {
      // Battery saver
      const state = setting.system.power.saver.state;
      const factor = state ? 0.7 : 100 / 70;
      const newBrgt = brgt * factor;
      setBrightnessValue(newBrgt);
      document.getElementById("brightnessSlider").value = newBrgt;
    } else {
      // Brightness slider
      setBrightnessValue(brgt);
    }
  };

  function setBrightnessValue(brgt) {
    document.getElementById("brightoverlay").style.opacity = (100 - brgt) / 100;
    dispatch({
      type: "STNGSETV",
      payload: {
        path: "system.display.brightness",
        value: brgt,
      },
    });
    sliderBackground(bSlider, brgt);
  }

  useEffect(() => {
    sidepane.quicks.map((item, i) => {
      if (item.src == "nightlight") {
        if (pnstates[i]) document.body.dataset.sepia = true;
        else document.body.dataset.sepia = false;
      }
    });
  });

  useEffect(() => {
    // console.log("ok")
    var tmp = [];
    for (var i = 0; i < sidepane.quicks.length; i++) {
      var val = getTreeValue(setting, sidepane.quicks[i].state);
      if (sidepane.quicks[i].name == "Theme") val = val == "dark";
      tmp.push(val);
    }

    setPnstate(tmp);
  }, [setting, sidepane]);

  return (
    <div className="sidePane dpShad" data-hide={sidepane.hide} style={{ "--prefix": "PANE" }}>
      <div className="quickSettings p-5 pb-8">
        <div className="qkCont">
          {sidepane.quicks.map((qk, idx) => {
            return (
              <div key={idx} className="qkGrp">
                <div
                  className="qkbtn handcr prtclk"
                  onClick={clickDispatch}
                  data-action={qk.action}
                  data-payload={qk.payload || qk.state}
                  data-state={pnstates[idx]}
                >
                  <Icon
                    className="quickIcon"
                    ui={qk.ui}
                    src={qk.src}
                    width={14}
                    invert={pnstates[idx] ? true : null}
                  />
                </div>
                <div className="qktext">{qk.name}</div>
              </div>
            );
          })}
        </div>
        <div className="sliderCont">
          <Icon className="mx-2" src="brightness" ui width={20} />
          <input
            id="brightnessSlider"
            className="sliders bSlider"
            onChange={setBrightness}
            type="range"
            min="10"
            max="100"
            defaultValue="100"
          />
        </div>
        <div className="sliderCont">
          <Icon className="mx-2" src={"audio" + tasks.audio} ui width={18} />
          <input
            className="sliders vSlider"
            onChange={setVolume}
            type="range"
            min="0"
            max="100"
            defaultValue="100"
          />
        </div>
      </div>
      <div className="p-1 bottomBar">
        <div className="px-3 battery-sidepane">
          <Battery pct />
        </div>
      </div>
    </div>
  );
};

export const CalnWid = () => {
  const sidepane = useSelector((state) => state.sidepane);
  const [loaded, setLoad] = useState(false);

  const [collapse, setCollapse] = useState("");

  const collapseToggler = () => {
    collapse === "" ? setCollapse("collapse") : setCollapse("");
  };

  useEffect(() => {
    if (!loaded) {
      setLoad(true);
      window.dycalendar.draw({
        target: "#dycalendar",
        type: "month",
        dayformat: "ddd",
        monthformat: "full",
        prevnextbutton: "show",
        highlighttoday: true,
      });
    }
  });

  return (
    <div
      className={`calnpane ${collapse} dpShad`}
      data-hide={sidepane.calhide}
      style={{ "--prefix": "CALN" }}
    >
      <div className="topBar pl-4 text-sm">
        <div className="date">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
        <div className="collapser p-2 m-4 rounded" onClick={collapseToggler}>
          {collapse === "" ? <Icon fafa="faChevronDown" /> : <Icon fafa="faChevronUp" />}
        </div>
      </div>
      <div id="dycalendar"></div>
    </div>
  );
};

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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./photos.scss";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb } from "../../../utils/idb";
import * as vs from "../../../utils/os/vs";
import { ownsKeyboard } from "../../../utils/os/keys";
import { notify, wosConfirm, wosPrompt } from "../../../utils/os/ui";

/* ------------------------------------------------------------------ *
 *  Photos — Windows 11 viewer.  Reads every picture that lives on the
 *  Virtual Storage (Pictures / Desktop / Downloads / Documents) plus
 *  the captures that Camera and Paint wrote to IndexedDB.
 * ------------------------------------------------------------------ */

const IMG_EXT = /^(png|jpe?g|gif|webp|bmp|svg|ico)$/i;
const LIB_DIRS = ["Pictures", "Desktop", "Downloads", "Documents"];

const fmt = (b) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(2)} MB`;
};
const dateOf = (t) =>
  t ? new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export const PhotosApp = () => {
  const wnapp = useSelector((s) => s.apps.photos) || {};
  const hz = useSelector((s) => s.apps.hz);
  const personName = useSelector((s) => s.setting.person.name);
  const dispatch = useDispatch();

  const [items, setItems] = useState([]); // {key,name,path,src,size,updated,native}
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(0); // index into items, -1 = collection
  const [zoom, setZoom] = useState(0); // 0 = fit
  const [rot, setRot] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [fav, setFav] = useState([]);
  const [info, setInfo] = useState(false);
  const [slide, setSlide] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [fitTick, setFitTick] = useState(0);
  const stage = useRef(null);
  const drag = useRef(null);

  const open = view >= 0 ? items[view] : null;

  /* ---------------- library scan ---------------- */
  const scan = useCallback(async () => {
    setLoading(true);
    try {
      await vs.hydrate();
    } catch (e) {}
    const user = vs.getUserName() || personName || "User";
    const out = [];
    for (const d of LIB_DIRS) {
      const list = await vs.vsList(`C:\\Users\\${user}\\${d}`).catch(() => []);
      list.forEach((f) => {
        if (f.type !== "file" || !IMG_EXT.test(f.name)) return;
        out.push({
          key: f.path,
          name: f.name,
          path: f.path,
          size: f.size,
          updated: f.updated,
          src: null,
          native: true,
        });
      });
    }
    // legacy capture store (Camera / Paint)
    const shots = (await idb.getAll("photos").catch(() => [])) || [];
    shots.forEach((p) => {
      out.push({
        key: p.id,
        name: p.name || `Capture ${new Date(p.at || Date.now()).toLocaleDateString()}`,
        path: p.path || null,
        size: p.size || (p.dataUrl ? Math.round((p.dataUrl.length * 3) / 4) : null),
        updated: p.at || Date.now(),
        src: p.dataUrl || p.src,
        native: false,
        idbId: p.id,
      });
    });
    // pull the real bytes for everything that lives on the VS
    await Promise.all(
      out.map(async (it) => {
        if (it.src || !it.native || !it.path) return;
        const rec = await vs.vsReadDataUrl(it.path).catch(() => null);
        if (rec?.dataUrl) it.src = rec.dataUrl;
      }),
    );
    out.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    setItems(out.filter((i) => i.src));
    setLoading(false);
  }, [personName]);

  useEffect(() => {
    if (wnapp.hide) return;
    scan();
  }, [wnapp.hide, scan]);

  useEffect(() => {
    idb
      .get("photos.fav")
      .then((f) => setFav(Array.isArray(f) ? f : []))
      .catch(() => {});
  }, []);

  /* opened from File Explorer */
  useEffect(() => {
    if (!wnapp.openPhoto) return;
    const d = wnapp.openPhoto;
    const reset = () => {
      setZoom(0);
      setRot(0);
      setFlipH(false);
      setFlipV(false);
      setScale(1);
      setPan({ x: 0, y: 0 });
    };
    (async () => {
      const at = items.findIndex((i) => i.path && i.path === d.path);
      if (at >= 0) {
        setView(at);
        reset();
        dispatch({ type: "PHOTOOPEN" });
        return;
      }
      let src = null;
      if (typeof d.data === "string" && d.data.startsWith("data:")) src = d.data;
      else if (d.data?.dataUrl) src = d.data.dataUrl;
      else if (d.path) {
        const rec = await vs.vsReadDataUrl(d.path).catch(() => null);
        src = rec?.dataUrl || null;
      }
      if (!src) {
        notify({
          app: "Photos",
          icon: "img/icon/photos.png",
          title: "Can't open that picture",
          body: d.name || d.path || "",
          kind: "error",
        });
        dispatch({ type: "PHOTOOPEN" });
        return;
      }
      const fresh = {
        key: d.path || d.name || `open-${Date.now()}`,
        name: d.name || "Picture",
        path: d.path || null,
        src,
        updated: Date.now(),
        native: !!d.path,
      };
      setItems((list) => [fresh, ...list]);
      setView(0);
      reset();
      dispatch({ type: "PHOTOOPEN" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wnapp.openPhoto]);

  /* ---------------- viewer maths ---------------- */
  const step = (dir) => {
    if (!items.length) return;
    const n = (view + dir + items.length) % items.length;
    setView(n);
    setZoom(0);
    setRot(0);
    setFlipH(false);
    setFlipV(false);
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!open) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNatural({ w: 0, h: 0 });
    img.src = open.src;
  }, [open?.src]);

  const fitScale = useMemo(() => {
    if (!stage.current || !natural.w) return 1;
    const box = stage.current.getBoundingClientRect();
    if (!box.width || !box.height) return 1;
    const swapped = rot % 180 !== 0;
    const w = swapped ? natural.h : natural.w;
    const h = swapped ? natural.w : natural.h;
    return Math.min((box.width - 48) / w, (box.height - 48) / h, 1);
  }, [natural, rot, view, slide, fitTick]);

  useEffect(() => {
    const onResize = () => setFitTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effScale = (zoom ? zoom / 100 : fitScale) * scale;

  /* ---------------- actions ---------------- */
  const toggleFav = () => {
    if (!open) return;
    const k = open.key;
    const next = fav.includes(k) ? fav.filter((x) => x !== k) : [...fav, k];
    setFav(next);
    idb.set("photos.fav", next).catch(() => {});
    notify({
      app: "Photos",
      icon: "img/icon/photos.png",
      title: fav.includes(k) ? "Removed from favourites" : "Added to favourites",
      body: open.name,
      kind: "success",
      life: 3,
    });
  };

  const remove = async () => {
    if (!open) return;
    const go = await wosConfirm(`Move "${open.name}" to the Recycle Bin?`, {
      title: "Photos",
      okText: "Delete",
      danger: true,
    });
    if (!go) return;
    if (open.native && open.path) {
      await vs.vsRemove(open.path).catch(() => {});
    } else if (open.idbId) {
      await idb.delete("photos", open.idbId).catch(() => {});
    }
    notify({
      app: "Photos",
      icon: "img/icon/photos.png",
      title: "Moved to Recycle Bin",
      body: open.name,
      kind: "success",
      life: 4,
    });
    setView(-1);
    scan();
  };

  const saveCopy = async () => {
    if (!open) return;
    const user = vs.getUserName() || personName || "User";
    const name = await wosPrompt("File name:", {
      title: "Save a copy",
      value: open.name.replace(/(\.[a-z0-9]+)$/i, " - copy$1"),
      okText: "Save",
    });
    if (name === null) return;
    const target = `C:\\Users\\${user}\\Pictures\\${name.trim() || open.name}`;
    await vs.vsWriteDataUrl(target, open.src);
    notify({
      app: "Photos",
      icon: "img/icon/photos.png",
      title: "Saved",
      body: target,
      kind: "success",
      life: 4,
    });
    scan();
  };

  const copyImage = async () => {
    if (!open) return;
    try {
      const res = await fetch(open.src);
      const blob = await res.blob();
      if (window.ClipboardItem && blob.type.startsWith("image/")) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(open.src);
      }
      notify({
        app: "Photos",
        icon: "img/icon/photos.png",
        title: "Copied to clipboard",
        kind: "success",
        life: 3,
      });
    } catch (e) {
      notify({
        app: "Photos",
        icon: "img/icon/photos.png",
        title: "Could not copy",
        body: "The browser blocked clipboard access.",
        kind: "warn",
      });
    }
  };

  const editInPaint = () => {
    if (!open) return;
    dispatch({ type: "OPENPAINT", payload: { src: open.src, name: open.name, path: open.path } });
  };

  /* ---------------- stage interaction ---------------- */
  const onWheel = (e) => {
    if (!open) return;
    e.preventDefault();
    setScale((s) => Math.min(6, Math.max(0.2, s * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
  };

  const onDown = (e) => {
    if (!open || effScale <= fitScale) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  };
  const onUp = () => (drag.current = null);

  /* ---------------- slideshow ---------------- */
  useEffect(() => {
    if (!slide) return;
    const t = setInterval(() => step(1), 3200);
    return () => clearInterval(t);
  }, [slide, view, items.length]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!ownsKeyboard(wnapp, hz)) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      const c = e.ctrlKey || e.metaKey;
      if (c) {
        const k = e.key.toLowerCase();
        if (k === "+" || k === "=") {
          e.preventDefault();
          setZoom((z) => Math.min(500, (z || 100) + 25));
        } else if (k === "-") {
          e.preventDefault();
          setZoom((z) => Math.max(25, (z || 100) - 25));
        } else if (k === "0") {
          e.preventDefault();
          setZoom(0);
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else if (k === "c") {
          e.preventDefault();
          copyImage();
        } else if (k === "s" && e.shiftKey) {
          e.preventDefault();
          saveCopy();
        } else if (k === "r") {
          e.preventDefault();
          setRot((r) => (r + 90) % 360);
        }
        return;
      }
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          step(-1);
          break;
        case "Escape":
          e.preventDefault();
          if (slide) setSlide(false);
          else if (open) setView(-1);
          break;
        case "Delete":
          e.preventDefault();
          remove();
          break;
        case "F11":
        case "Enter":
          e.preventDefault();
          setSlide((s) => !s);
          break;
        case "i":
          e.preventDefault();
          setInfo((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wnapp.alive, wnapp.hide, hz, view, items, slide, open, fav]);

  /* ---------------- render ---------------- */
  const IconBtn = ({ title, onClick, children, danger, wide, active }) => (
    <button
      type="button"
      className={`phBtn ${danger ? "danger" : ""} ${wide ? "wide" : ""} ${active ? "on" : ""}`}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const d = new Date(it.updated || Date.now());
      const k = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    });
    return [...map.entries()];
  }, [items]);

  if (!wnapp.alive) return null;

  return (
    <div
      className="photosApp win11photos floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar
        app={wnapp.action}
        icon={wnapp.icon}
        size={wnapp.size}
        name={open ? `${open.name} - Photos` : "Photos"}
      />

      <div className="windowScreen" data-dock="true">
        {open ? (
          /* ============================ viewer ============================ */
          <div className={`phViewer ${slide ? "slide" : ""}`}>
            {!slide ? (
              <div className="phTop">
                <div className="phTopL">
                  <IconBtn title="Back to collection (Esc)" onClick={() => setView(-1)}>
                    <svg viewBox="0 0 16 16" width="14" height="14">
                      <path
                        d="M10 3L5 8l5 5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <span className="phName" title={open.path || open.name}>
                    {open.name}
                  </span>
                </div>
                <div className="phTopR">
                  <IconBtn title="Rotate (Ctrl+R)" onClick={() => setRot((r) => (r + 90) % 360)}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5V5h-2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn
                    title="Flip horizontal"
                    onClick={() => setFlipH((v) => !v)}
                    active={flipH}
                  >
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M8 2v12M5 5L2 8l3 3V5zM11 5l3 3-3 3V5z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn
                    title="Zoom in (Ctrl++)"
                    onClick={() => setZoom((z) => Math.min(500, (z || 100) + 25))}
                  >
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <circle
                        cx="7"
                        cy="7"
                        r="4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <path
                        d="M10.5 10.5L14 14M5 7h4M7 5v4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn
                    title="Zoom out (Ctrl+-)"
                    onClick={() => setZoom((z) => Math.max(25, (z || 100) - 25))}
                  >
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <circle
                        cx="7"
                        cy="7"
                        r="4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      <path
                        d="M10.5 10.5L14 14M5 7h4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn
                    title="Fit to window (Ctrl+0)"
                    onClick={() => {
                      setZoom(0);
                      setScale(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Copy (Ctrl+C)" onClick={copyImage}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <rect
                        x="5"
                        y="5"
                        width="8"
                        height="9"
                        rx="1.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                      />
                      <path
                        d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Save a copy (Ctrl+Shift+S)" onClick={saveCopy}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M3 3h8l2 2v8H3V3z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinejoin="round"
                      />
                      <rect
                        x="5.5"
                        y="3"
                        width="5"
                        height="3.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        fill="none"
                      />
                      <rect
                        x="5.5"
                        y="9.5"
                        width="5"
                        height="3.5"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        fill="none"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Favourite" onClick={toggleFav} active={fav.includes(open.key)}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M8 2.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5L8 2.5z"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        fill={fav.includes(open.key) ? "currentColor" : "none"}
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Edit in Paint" onClick={editInPaint}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Info (I)" onClick={() => setInfo((v) => !v)} active={info}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <circle
                        cx="8"
                        cy="8"
                        r="6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                      />
                      <path
                        d="M8 7v4.5M8 4.8v.4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Slideshow (F11)" onClick={() => setSlide(true)}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M4 3l9 5-9 5V3z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        fill="none"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                  <IconBtn title="Delete (Del)" danger onClick={remove}>
                    <svg viewBox="0 0 16 16" width="15" height="15">
                      <path
                        d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9M6.8 6.8v4.4M9.2 6.8v4.4"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconBtn>
                </div>
              </div>
            ) : null}

            <div
              ref={stage}
              className="phStage"
              onWheel={onWheel}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={onUp}
              onDoubleClick={() => (zoom ? setZoom(0) : setZoom(100))}
              style={{
                cursor: drag.current ? "grabbing" : effScale > fitScale ? "grab" : "default",
              }}
            >
              <img
                src={open.src}
                alt={open.name}
                draggable="false"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${effScale}) rotate(${rot}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  transition: drag.current ? "none" : "transform 180ms cubic-bezier(0.1,0.9,0.2,1)",
                }}
              />
            </div>

            {info ? (
              <div className="phInfo">
                <button
                  type="button"
                  className="phInfoX"
                  onClick={() => setInfo(false)}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 12 12" width="9" height="9">
                    <path
                      d="M1 1l10 10M11 1L1 11"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <h3>{open.name}</h3>
                {natural.w ? (
                  <div className="phInfoDim">
                    {natural.w} × {natural.h}
                  </div>
                ) : null}
                <dl>
                  <dt>File name</dt>
                  <dd>{open.name}</dd>
                  <dt>Location</dt>
                  <dd>{open.path || "Captured in this session"}</dd>
                  <dt>Item type</dt>
                  <dd>{(open.name.split(".").pop() || "image").toUpperCase()} file</dd>
                  <dt>Size</dt>
                  <dd>{fmt(open.size)}</dd>
                  <dt>Date</dt>
                  <dd>{dateOf(open.updated)}</dd>
                </dl>
                <div className="phInfoNote">
                  Saved on the Virtual Storage (IndexedDB) — it survives a page reload.
                </div>
              </div>
            ) : null}

            {!slide ? (
              <>
                <button
                  type="button"
                  className="phArrow prev"
                  onClick={() => step(-1)}
                  aria-label="Previous"
                >
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path
                      d="M10 3L5 8l5 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="phArrow next"
                  onClick={() => step(1)}
                  aria-label="Next"
                >
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="phFilm">
                  {items.map((it, i) => (
                    <button
                      key={it.key}
                      type="button"
                      className={`phThumb ${i === view ? "on" : ""}`}
                      onClick={() => {
                        setView(i);
                        setZoom(0);
                        setRot(0);
                        setScale(1);
                        setPan({ x: 0, y: 0 });
                      }}
                      title={it.name}
                    >
                      <img src={it.src} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
                <div className="phBottom">
                  <span>
                    {view + 1} / {items.length}
                  </span>
                  <span className="phBottomSpacer" />
                  <span>{zoom ? `${zoom}%` : `${Math.round(effScale * 100)}% (fit)`}</span>
                </div>
              </>
            ) : (
              <button type="button" className="phSlideExit" onClick={() => setSlide(false)}>
                Exit slideshow · Esc
              </button>
            )}
          </div>
        ) : (
          /* ========================== collection ========================== */
          <div className="phColl">
            <div className="phCollHead">
              <div>
                <h1>Collection</h1>
                <p>
                  {loading
                    ? "Reading your Virtual Storage…"
                    : `${items.length} item${items.length === 1 ? "" : "s"}`}
                  {!loading && items.length
                    ? ` · ${fmt(items.reduce((a, i) => a + (i.size || 0), 0))} total`
                    : ""}
                </p>
              </div>
              <div className="phCollActs">
                <button
                  type="button"
                  className="phBtn wide"
                  onClick={scan}
                  title="Rescan the Virtual Storage"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2v3h-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Refresh
                </button>
                <button
                  type="button"
                  className="phBtn wide accent"
                  onClick={() => dispatch({ type: "EXPLORER", payload: "full" })}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      d="M2 4.5h4l1.5 2H14v6H2v-8z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      fill="none"
                      strokeLinejoin="round"
                    />
                  </svg>
                  File Explorer
                </button>
              </div>
            </div>

            <div className="phCollBody win11Scroll">
              {loading ? (
                <div className="phSpin">
                  <div />
                  <p>Loading your pictures…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="phEmpty">
                  <svg viewBox="0 0 64 64" width="56" height="56">
                    <rect
                      x="6"
                      y="12"
                      width="52"
                      height="40"
                      rx="4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle
                      cx="22"
                      cy="27"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <path
                      d="M8 46l14-13 10 9 8-7 14 12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <h2>No pictures yet</h2>
                  <p>
                    Take one with the Camera app, draw something in Paint, or drop a picture into
                    File Explorer — it lands on your Virtual Storage and shows up here.
                  </p>
                  <div className="phEmptyBtns">
                    <button
                      type="button"
                      className="phBtn wide accent"
                      onClick={() => dispatch({ type: "CAMERA", payload: "full" })}
                    >
                      Open Camera
                    </button>
                    <button
                      type="button"
                      className="phBtn wide"
                      onClick={() => dispatch({ type: "PAINT", payload: "full" })}
                    >
                      Open Paint
                    </button>
                  </div>
                </div>
              ) : (
                groups.map(([month, list]) => (
                  <section key={month} className="phMonth">
                    <h2>{month}</h2>
                    <div className="phGrid wosStagger">
                      {list.map((it) => {
                        const idx = items.indexOf(it);
                        return (
                          <button
                            key={it.key}
                            type="button"
                            className="phCard"
                            onClick={() => {
                              setView(idx);
                              setZoom(0);
                              setRot(0);
                              setScale(1);
                              setPan({ x: 0, y: 0 });
                            }}
                            title={`${it.name} · ${fmt(it.size)}`}
                          >
                            <img src={it.src} alt="" loading="lazy" />
                            {fav.includes(it.key) ? (
                              <i className="phCardStar">
                                <svg viewBox="0 0 16 16" width="11" height="11">
                                  <path
                                    d="M8 2.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2l-3.4 1.8.7-3.8L2.5 6.5l3.8-.5L8 2.5z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </i>
                            ) : null}
                            <span className="phCardName">{it.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotosApp;

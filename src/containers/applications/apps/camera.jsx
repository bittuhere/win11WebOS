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
import { useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { WosSelect } from "../../../components/shared/Controls";
import { idb, uid } from "../../../utils/idb";
import * as vs from "../../../utils/os/vs";
import { ownsKeyboard } from "../../../utils/os/keys";
import { notify } from "../../../utils/os/ui";
import "./camera.scss";

/* ------------------------------------------------------------------ *
 *  Camera — Windows 11.  Live preview, photo + video capture, the
 *  shots really land on the Virtual Storage (Pictures > Camera Roll).
 * ------------------------------------------------------------------ */

const CAM_FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.55) contrast(1.06)" },
  { id: "warm", label: "Warm", css: "sepia(0.32) saturate(1.25)" },
  { id: "mono", label: "Mono", css: "grayscale(1)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.3) brightness(0.92)" },
  { id: "vintage", label: "Vintage", css: "sepia(0.52) contrast(0.95) brightness(1.06)" },
];
const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export const Camera = () => {
  const wnapp = useSelector((s) => s.apps.camera) || {};
  const hz = useSelector((s) => s.apps.hz);
  const personName = useSelector((s) => s.setting.person.name);

  const [mode, setMode] = useState("photo"); // photo | video
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState([]);
  const [rec, setRec] = useState(0); // recording seconds
  const [mirror, setMirror] = useState(true);
  const [grid, setGrid] = useState(false);
  const [timer, setTimer] = useState(0);
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [facing, setFacing] = useState("user");
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState("none");
  const fcss = (CAM_FILTERS.find((f) => f.id === filter) || CAM_FILTERS[0]).css;

  const video = useRef(null);
  const stream = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const tick = useRef(null);

  const user = () => vs.getUserName() || personName || "User";

  /* ---------------- recent shots ---------------- */
  const loadShots = useCallback(async () => {
    const picDir = `C:\\Users\\${user()}\\Pictures\\Camera Roll`;
    const vidDir = `C:\\Users\\${user()}\\Videos\\Camera Roll`;
    const [fromVs, vids] = await Promise.all([
      vs.vsList(picDir).catch(() => []),
      vs.vsList(vidDir).catch(() => []),
    ]);
    fromVs.push(...vids); // one strip: photos + clips, each from its own roll
    const list = [];
    for (const f of fromVs.filter((x) => x.type === "file")) {
      const rec = await vs.vsReadDataUrl(f.path).catch(() => null);
      if (rec?.dataUrl)
        list.push({
          key: f.path,
          name: f.name,
          src: rec.dataUrl,
          at: f.updated,
          path: f.path,
          video: /\.(webm|mp4)$/i.test(f.name),
        });
    }
    const legacy = (await idb.getAll("photos").catch(() => [])) || [];
    legacy
      .filter((p) => p.name && /^Camera|^VID_/i.test(p.name))
      .slice(-12)
      .forEach((p) => {
        if (!list.some((l) => l.name === p.name)) {
          list.push({ key: p.id, name: p.name, src: p.dataUrl, at: p.at, video: false });
        }
      });
    list.sort((a, b) => (b.at || 0) - (a.at || 0));
    setShots(list.slice(0, 24));
  }, [personName]);

  useEffect(() => {
    if (wnapp.alive && !wnapp.hide) loadShots();
  }, [wnapp.alive, wnapp.hide, loadShots]);

  /* ---------------- live preview ---------------- */
  const start = useCallback(async () => {
    setErr("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr("This browser has no camera API (getUserMedia is missing).");
        return;
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === "video",
      });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
        // apply an optical zoom if the device supports it
        const track = s.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() || {};
        if (caps.zoom && track.applyConstraints) {
          const z = Math.min(Math.max(zoom, caps.zoom.min || 1), caps.zoom.max || 1);
          track.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {});
        }
      }
    } catch (e) {
      const name = e?.name || "";
      setErr(
        name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in your browser's address bar, then try again."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : `The camera could not be started — ${e?.message || name}`,
      );
    }
  }, [facing, mode, zoom]);

  const stop = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (wnapp.alive && !wnapp.hide) start();
    else stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wnapp.alive, wnapp.hide, facing]);

  /* ---------------- capture ---------------- */
  const doFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 210);
  };

  const runTimer = async (fn) => {
    if (!timer) return fn();
    for (let i = timer; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(0);
    return fn();
  };

  const takePhoto = async () => {
    if (!stream.current || !video.current) return;
    setBusy(true);
    await runTimer(() => {
      const v = video.current;
      const c = document.createElement("canvas");
      c.width = v.videoWidth || 1280;
      c.height = v.videoHeight || 720;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.save();
      if (fcss && fcss !== "none") g.filter = fcss;
      if (mirror) {
        g.translate(c.width, 0);
        g.scale(-1, 1);
      }
      g.drawImage(v, 0, 0, c.width, c.height);
      g.restore();
      return c.toDataURL("image/png");
    })
      .then(async (dataUrl) => {
        if (!dataUrl) return;
        doFlash();
        const name = `IMG_${stamp()}.png`;
        const path = `C:\\Users\\${user()}\\Pictures\\Camera Roll\\${name}`;
        await vs.vsWriteDataUrl(path, dataUrl, { mime: "image/png" }).catch(() => {});
        await idb
          .put("photos", {
            id: uid("cam"),
            name,
            dataUrl,
            path,
            at: Date.now(),
            size: Math.round((dataUrl.length * 3) / 4),
          })
          .catch(() => {});
        notify({
          app: "Camera",
          icon: "img/icon/camera.png",
          title: "Photo saved",
          body: path,
          kind: "success",
          life: 4,
          hero: dataUrl,
        });
        loadShots();
      })
      .catch((e) =>
        notify({
          app: "Camera",
          icon: "img/icon/camera.png",
          title: "Could not save the photo",
          body: String(e?.message || e),
          kind: "error",
        }),
      );
    setBusy(false);
  };

  const startVideo = () => {
    if (!stream.current) return;
    chunks.current = [];
    /* MP4 first (H.264 plays everywhere — gallery, Movies & TV, phones);
       WebM stays as the fallback for browsers without an mp4 encoder */
    const mime = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
    try {
      recorder.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    } catch (e) {
      notify({
        app: "Camera",
        icon: "img/icon/camera.png",
        title: "Video recording is not supported here",
        body: String(e?.message || e),
        kind: "error",
      });
      return;
    }
    recorder.current.ondataavailable = (e) => e.data?.size && chunks.current.push(e.data);
    recorder.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: mime || "video/webm" });
      const ext = (mime || "").includes("mp4") ? "mp4" : "webm";
      const name = `VID_${stamp()}.${ext}`;
      /* video clips live in Videos\Camera Roll — Photos keeps the pictures */
      const path = `C:\\Users\\${user()}\\Videos\\Camera Roll\\${name}`;
      const dataUrl = await vs
        .blobToB64(blob)
        .then((b64) => `data:${blob.type};base64,${b64}`)
        .catch(() => null);
      if (dataUrl) await vs.vsWriteDataUrl(path, dataUrl, { mime: blob.type }).catch(() => {});
      notify({
        app: "Camera",
        icon: "img/icon/camera.png",
        title: "Video saved",
        body: `${path} · ${(blob.size / 1024).toFixed(0)} KB`,
        kind: "success",
        life: 5,
      });
      setShots((s) => [
        { key: path, name, src: URL.createObjectURL(blob), at: Date.now(), path, video: true },
        ...s,
      ]);
      loadShots();
    };
    recorder.current.start(250);
    setRec(0);
    tick.current = setInterval(() => setRec((n) => n + 1), 1000);
  };

  const stopVideo = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    recorder.current?.state === "recording" && recorder.current.stop();
  };

  const shutter = () => {
    if (mode === "photo") takePhoto();
    else if (recorder.current?.state === "recording") stopVideo();
    else startVideo();
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!ownsKeyboard(wnapp, hz)) return;
    const onKey = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        shutter();
      } else if (e.key.toLowerCase() === "v") setMode((m) => (m === "photo" ? "video" : "photo"));
      else if (e.key.toLowerCase() === "m") setMirror((v) => !v);
      else if (e.key.toLowerCase() === "g") setGrid((v) => !v);
      else if (e.key.toLowerCase() === "f")
        setFacing((v) => (v === "user" ? "environment" : "user"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wnapp.alive, wnapp.hide, hz, mode, mirror, timer, busy, facing]);

  if (!wnapp.alive) return null;

  const recording = recorder.current?.state === "recording" || rec > 0;
  const recTime = `${String(Math.floor(rec / 60)).padStart(2, "0")}:${String(rec % 60).padStart(2, "0")}`;

  return (
    <div
      className="camApp floatTab dpShad"
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
        name="Camera"
        invert
        bg="#0a0a0c"
      />

      <div className="windowScreen" data-dock="true">
        <div className="camBody">
          {/* -------- preview -------- */}
          <div className="camStage">
            <video
              ref={video}
              className="camVideo"
              playsInline
              autoPlay
              muted
              style={{
                transform: `${mirror ? "scaleX(-1)" : ""} scale(${zoom})`,
                filter: fcss !== "none" ? fcss : undefined,
              }}
            />
            {grid ? (
              <div className="camGrid">
                <i />
                <i />
                <i />
                <i />
              </div>
            ) : null}
            {flash ? <div className="camFlash" /> : null}
            {countdown ? <div className="camCount">{countdown}</div> : null}

            {err ? (
              <div className="camErr">
                <svg viewBox="0 0 48 48" width="42" height="42">
                  <path
                    d="M6 14h8l4-5h12l4 5h8v26H6V14z"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="24"
                    cy="27"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    fill="none"
                  />
                  <path
                    d="M14 34L34 20"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
                <h2>Camera unavailable</h2>
                <p>{err}</p>
                <button type="button" className="camErrBtn" onClick={start}>
                  Try again
                </button>
              </div>
            ) : null}

            {recording ? (
              <div className="camRec">
                <i />
                <span>{recTime}</span>
              </div>
            ) : null}
          </div>

          {/* -------- film strip -------- */}
          <aside className="camStrip">
            <div className="camStripHead" style={{ marginTop: 6 }}>
              <span>Filters</span>
            </div>
            <div className="camFilters" role="radiogroup" aria-label="Camera filter">
              {CAM_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.id}
                  className={`camFilterChip ${filter === f.id ? "on" : ""}`}
                  style={f.css !== "none" ? { filter: f.css } : undefined}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="camStripHead">
              <span>Recent</span>
              <button type="button" className="camStripX" title="Refresh" onClick={loadShots}>
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <path
                    d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2v3h-3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="camStripList win11Scroll">
              {shots.length === 0 ? (
                <p className="camStripEmpty">
                  Photos land in <b>Pictures\Camera Roll</b>; clips record as <b>MP4</b> into{" "}
                  <b>Videos\Camera Roll</b>.
                </p>
              ) : (
                shots.map((s) =>
                  s.video ? (
                    <video
                      key={s.key}
                      className="camShot"
                      src={s.src}
                      muted
                      title={s.name}
                      onClick={() =>
                        notify({
                          app: "Camera",
                          icon: "img/icon/camera.png",
                          title: s.name,
                          body: s.path || "Saved in Camera Roll",
                          kind: "info",
                          life: 4,
                        })
                      }
                    />
                  ) : (
                    <img
                      key={s.key}
                      className="camShot"
                      src={s.src}
                      alt={s.name}
                      title={`${s.name}${s.path ? `\n${s.path}` : ""}`}
                      onClick={() =>
                        notify({
                          app: "Camera",
                          icon: "img/icon/camera.png",
                          title: s.name,
                          body: s.path || "Saved in Camera Roll",
                          kind: "info",
                          life: 4,
                          hero: s.src,
                        })
                      }
                    />
                  ),
                )
              )}
            </div>
          </aside>

          {/* -------- controls -------- */}
          <div className="camCtrl">
            <div className="camCtrlTop">
              <button
                type="button"
                className="camMini"
                title={mirror ? "Mirroring on (M)" : "Mirroring off (M)"}
                data-on={mirror}
                onClick={() => setMirror((v) => !v)}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M8 2v12M5 5L2 8l3 3V5zM11 5l3 3-3 3V5z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="camMini"
                title="Grid lines (G)"
                data-on={grid}
                onClick={() => setGrid((v) => !v)}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <rect
                    x="2"
                    y="2"
                    width="12"
                    height="12"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill="none"
                  />
                  <path
                    d="M6 2v12M10 2v12M2 6h12M2 10h12"
                    stroke="currentColor"
                    strokeWidth="1.1"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="camMini"
                title="Flip camera (F)"
                onClick={() => setFacing((v) => (v === "user" ? "environment" : "user"))}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M2.5 6a5.5 5.5 0 0 1 9.6-2.6M13.5 10a5.5 5.5 0 0 1-9.6 2.6M12 1.5V4h-2.5M4 14.5V12h2.5"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <label className="camZoom" title="Zoom">
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <circle
                    cx="7"
                    cy="7"
                    r="4.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <path
                    d="M10.5 10.5L14 14M5 7h4M7 5v4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="range"
                  min="100"
                  max="300"
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(+e.target.value / 100)}
                />
                <b>{zoom.toFixed(1)}×</b>
              </label>
              <div className="camTimer" title="Photo timer">
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <circle
                    cx="8"
                    cy="9"
                    r="5.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <path
                    d="M8 6v3l2 1.5M6 1.5h4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <WosSelect
                  value={String(timer)}
                  onChange={(v) => setTimer(+v)}
                  options={[
                    { value: "0", label: "Off" },
                    { value: "3", label: "3 s" },
                    { value: "5", label: "5 s" },
                    { value: "10", label: "10 s" },
                  ]}
                />
              </div>
            </div>

            <div className="camCtrlBottom">
              <div className="camMode">
                <button
                  type="button"
                  data-on={mode === "photo"}
                  onClick={() => {
                    if (!recording) setMode("photo");
                  }}
                >
                  Photo
                </button>
                <button
                  type="button"
                  data-on={mode === "video"}
                  onClick={() => {
                    if (!recording) setMode("video");
                  }}
                >
                  Video
                </button>
              </div>

              <button
                type="button"
                className={`camShutter ${mode === "video" ? "video" : ""} ${recording ? "rec" : ""}`}
                onClick={shutter}
                disabled={busy || !!err}
                title={
                  mode === "photo"
                    ? "Take a photo (Space)"
                    : recording
                      ? "Stop recording"
                      : "Start recording (Space)"
                }
              >
                <span />
              </button>

              <div className="camHint">
                {mode === "photo"
                  ? "Space to shoot · V for video"
                  : recording
                    ? "Space to stop"
                    : "Space to record"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Camera;

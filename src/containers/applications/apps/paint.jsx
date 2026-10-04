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
import "./paint.scss";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { notify, wosConfirm, wosPrompt, wosFileOpen, wosFileSave } from "../../../utils/os/ui";
import { ownsKeyboard } from "../../../utils/os/keys";
import * as vs from "../../../utils/os/vs";

/* ------------------------------------------------------------------ *
 *  Paint — Windows 11.  Ribbon, tools, shapes, colours, undo history
 *  and a canvas that really saves back to the Virtual Storage.
 * ------------------------------------------------------------------ */

const SWATCHES = [
  "#000000",
  "#7f7f7f",
  "#880015",
  "#ed1c24",
  "#ff7f27",
  "#fff200",
  "#22b14c",
  "#00a2e8",
  "#3f48cc",
  "#a349a4",
  "#ffffff",
  "#c3c3c3",
  "#b97a57",
  "#ffaec9",
  "#ffc90e",
  "#efe4b0",
  "#b5e61d",
  "#99d9ea",
  "#7092be",
  "#c8bfe7",
];

const TOOLS = [
  {
    id: "select",
    label: "Select",
    hint: "Rectangular selection",
    svg: (
      <path
        d="M2.5 2.5h10v10h-10z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeDasharray="2.4 2"
      />
    ),
  },
  {
    id: "crop",
    label: "Crop",
    hint: "Crop to the selection",
    svg: (
      <path
        d="M4 1.5v11h11M1.5 4h11v11"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "pencil",
    label: "Pencil",
    hint: "Freehand, 1px crisp line",
    svg: (
      <path
        d="M11 2.2l2.8 2.8L5.6 13.2 2 14l.8-3.6L11 2.2z"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "fill",
    label: "Fill",
    hint: "Flood fill with colour 1",
    svg: (
      <path
        d="M4.5 7.5L9 3l4.5 4.5-4.5 4.5-4.5-4.5zM2 12.5c.9 0 1.5.7 1.5 1.4 0 .8-.7 1.4-1.5 1.4"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "text",
    label: "Text",
    hint: "Click the canvas and type",
    svg: (
      <path
        d="M3 3.5h10M8 3.5v10M6 13.5h4"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "eraser",
    label: "Eraser",
    hint: "Erase to the background colour",
    svg: (
      <path
        d="M6 13.5H3.5L2 12V9.5l7-7 4.5 4.5-5 5H6zM9 4.5l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "picker",
    label: "Colour picker",
    hint: "Pick colour 1 from the canvas",
    svg: (
      <path
        d="M13.6 2.4l-1.2 1.2-2-2 1.2-1.2 2 2zM10 4l-7 7v3h3l7-7-3-3z"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "magnifier",
    label: "Magnifier",
    hint: "Zoom in / out",
    svg: <circle cx="6.8" cy="6.8" r="4.3" stroke="currentColor" strokeWidth="1.4" fill="none" />,
  },
  {
    id: "brush",
    label: "Brushes",
    hint: "Paint with a soft brush",
    svg: (
      <path
        d="M3 13.5c2.2.6 3.6-.4 3.6-2 0-1-.7-1.6-1.6-1.6-1.4 0-2 1.2-2 3.6zM7.4 10.2l5.4-6.9c.5-.6 1.4-.7 1.9-.1.5.5.4 1.4-.1 1.9l-6.9 5.4"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "spray",
    label: "Airbrush",
    hint: "Spray paint",
    svg: (
      <path
        d="M5 4h4v9.5H5zM9 6.5l1.6-1.6M9 8.5h2.2M9 10.5l1.6 1.6M3 3.5h6"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "shape",
    label: "Shapes",
    hint: "Draw the selected shape — hold Shift for even proportions",
    svg: (
      <>
        <rect
          x="1.8"
          y="1.8"
          width="6"
          height="6"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
        />
        <circle cx="11" cy="5" r="3.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path
          d="M5 14.2L2.2 9.6h5.6L5 14.2z"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          strokeLinejoin="round"
        />
        <path d="M9.5 14h4.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
  },
];

const SHAPES = [
  {
    id: "line",
    label: "Line",
    svg: (
      <path d="M2.5 13.5L13.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    ),
  },
  {
    id: "curve",
    label: "Curve",
    svg: (
      <path
        d="M2 12C5 2 11 14 14 4"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "oval",
    label: "Oval",
    svg: (
      <ellipse cx="8" cy="8" rx="6" ry="4.6" stroke="currentColor" strokeWidth="1.4" fill="none" />
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    svg: (
      <rect
        x="2.2"
        y="3.6"
        width="11.6"
        height="8.8"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
    ),
  },
  {
    id: "rrect",
    label: "Rounded rectangle",
    svg: (
      <rect
        x="2.2"
        y="3.6"
        width="11.6"
        height="8.8"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
    ),
  },
  {
    id: "poly",
    label: "Polygon",
    svg: (
      <path
        d="M8 1.8l6 4.4-2.3 7H4.3L2 6.2l6-4.4z"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "tri",
    label: "Triangle",
    svg: (
      <path
        d="M8 2.4L14.2 13.4H1.8L8 2.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "arrow",
    label: "Arrow",
    svg: (
      <path
        d="M2.5 13.5L12 4M8.2 3.6H13v4.8"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "star",
    label: "Star",
    svg: (
      <path
        d="M8 1.8l1.9 4 4.4.6-3.2 3 .8 4.4L8 11.7l-3.9 2.1.8-4.4-3.2-3 4.4-.6L8 1.8z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "heart",
    label: "Heart",
    svg: (
      <path
        d="M8 13.6S2 9.8 2 6.4A3 3 0 0 1 8 5.2 3 3 0 0 1 14 6.4c0 3.4-6 7.2-6 7.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
];

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

const Tool = ({ t, on, onClick, tip }) => (
  <button
    type="button"
    className={`ptTool ${on ? "on" : ""}`}
    title={tip || `${t.label} — ${t.hint}`}
    onClick={() => onClick(t.id)}
  >
    <svg viewBox="0 0 16 16" width="16" height="16">
      {t.svg}
    </svg>
  </button>
);

export const PaintApp = () => {
  const wnapp = useSelector((s) => s.apps.paint) || {};
  const hz = useSelector((s) => s.apps.hz);
  const personName = useSelector((s) => s.setting.person.name);
  const dispatch = useDispatch();

  const [tool, setTool] = useState("brush");
  const [shape, setShape] = useState("rect");
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [c1, setC1] = useState("#101014");
  const [c2, setC2] = useState("#ffffff");
  const [fillShape, setFillShape] = useState(false);
  const [docName, setDocName] = useState("Untitled");
  const [docPath, setDocPath] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [histTick, setHistTick] = useState(0); // history lives in a ref — nudge renders so Undo/Redo enable/disable truly
  const [zoom, setZoom] = useState(1);
  const [fontSize, setFontSize] = useState(28);
  const [text, setText] = useState(null); // {x,y}
  const [busy, setBusy] = useState("");

  const cv = useRef(null);
  const ctx = useRef(null);
  const hist = useRef([]);
  const future = useRef([]);
  const drawing = useRef(null);
  const snap = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);

  /* ---------------- canvas setup ---------------- */
  useEffect(() => {
    const c = cv.current;
    if (!c || ctx.current) return;
    ctx.current = c.getContext("2d", { willReadFrequently: true });
    const g = ctx.current;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.lineJoin = "round";
    g.lineCap = "round";
    push();
  }, []);

  const push = () => {
    const c = cv.current;
    if (!c) return;
    hist.current.push(c.toDataURL("image/png"));
    if (hist.current.length > 40) hist.current.shift();
    future.current = [];
    setHistTick((t) => t + 1);
  };

  const restore = (url) => {
    const g = ctx.current;
    const img = new Image();
    img.onload = () => {
      g.clearRect(0, 0, cv.current.width, cv.current.height);
      g.drawImage(img, 0, 0);
      setDirty(true);
    };
    img.src = url;
  };

  const undo = () => {
    if (hist.current.length < 2) return;
    const cur = hist.current.pop();
    future.current.push(cur);
    restore(hist.current[hist.current.length - 1]);
    setHistTick((t) => t + 1);
  };
  const redo = () => {
    const n = future.current.pop();
    if (!n) return;
    hist.current.push(n);
    restore(n);
    setHistTick((t) => t + 1);
  };

  /* ---------------- effects: one click, undoable ---------------- */
  const EFFECTS = {
    invert: "Invert colours",
    grayscale: "Black & white",
    sepia: "Sepia",
    blur: "Soft blur",
    pixelate: "Pixelate",
  };
  const applyEffect = (kind) => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext("2d", { willReadFrequently: true });
    const tmp = document.createElement("canvas");
    tmp.width = c.width;
    tmp.height = c.height;
    tmp.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
    if (kind === "pixelate") {
      const px = Math.max(4, Math.round(Math.min(c.width, c.height) / 56));
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.floor(c.width / px));
      small.height = Math.max(1, Math.floor(c.height / px));
      const sg = small.getContext("2d", { willReadFrequently: true });
      sg.drawImage(tmp, 0, 0, small.width, small.height);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(small, 0, 0, small.width, small.height, 0, 0, c.width, c.height);
      g.imageSmoothingEnabled = true;
    } else {
      const css = {
        invert: "invert(1)",
        grayscale: "grayscale(1)",
        sepia: "sepia(0.85)",
        blur: "blur(2.5px)",
      }[kind];
      let done = false;
      try {
        if ("filter" in g) {
          g.save();
          g.clearRect(0, 0, c.width, c.height);
          g.filter = css;
          g.drawImage(tmp, 0, 0);
          g.restore();
          done = true;
        }
      } catch (e) {}
      if (!done) {
        // manual pixel fallback where canvas filters are unsupported
        const im = tmp
          .getContext("2d", { willReadFrequently: true })
          .getImageData(0, 0, c.width, c.height);
        const d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          if (kind === "invert") {
            d[i] = 255 - d[i];
            d[i + 1] = 255 - d[i + 1];
            d[i + 2] = 255 - d[i + 2];
          } else if (kind === "grayscale") {
            const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = d[i + 1] = d[i + 2] = y;
          } else if (kind === "sepia") {
            const r = d[i],
              gg = d[i + 1],
              b = d[i + 2];
            d[i] = Math.min(255, 0.393 * r + 0.769 * gg + 0.189 * b);
            d[i + 1] = Math.min(255, 0.349 * r + 0.686 * gg + 0.168 * b);
            d[i + 2] = Math.min(255, 0.272 * r + 0.534 * gg + 0.131 * b);
          }
        }
        tmp.getContext("2d", { willReadFrequently: true }).putImageData(im, 0, 0);
        g.clearRect(0, 0, c.width, c.height);
        g.drawImage(tmp, 0, 0);
      }
    }
    push(); // undoable like any stroke
    setDirty(true);
  };

  /* ---------------- geometry ---------------- */
  const pos = (e) => {
    const c = cv.current;
    const r = c.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return {
      x: ((p.clientX - r.left) / r.width) * c.width,
      y: ((p.clientY - r.top) / r.height) * c.height,
    };
  };

  const strokeStyle = () => {
    const g = ctx.current;
    g.globalAlpha = opacity;
    if (tool === "eraser") {
      g.strokeStyle = c2;
      g.fillStyle = c2;
    } else if (tool === "pencil") {
      g.strokeStyle = c1;
      g.fillStyle = c1;
      g.globalAlpha = 1;
    } else {
      g.strokeStyle = c1;
      g.fillStyle = c1;
    }
    g.lineWidth = tool === "pencil" ? Math.max(1, size / 3) : tool === "eraser" ? size * 2.4 : size;
  };

  const drawShape = (from, to, commit) => {
    const g = ctx.current;
    strokeStyle();
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    g.beginPath();
    switch (shape) {
      case "line":
        g.moveTo(from.x, from.y);
        g.lineTo(to.x, to.y);
        break;
      case "arrow": {
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        const head = 12 + size * 1.8;
        g.moveTo(from.x, from.y);
        g.lineTo(to.x, to.y);
        g.moveTo(to.x, to.y);
        g.lineTo(to.x - head * Math.cos(ang - 0.42), to.y - head * Math.sin(ang - 0.42));
        g.moveTo(to.x, to.y);
        g.lineTo(to.x - head * Math.cos(ang + 0.42), to.y - head * Math.sin(ang + 0.42));
        break;
      }
      case "curve":
        g.moveTo(from.x, from.y);
        g.bezierCurveTo(from.x + w * 0.35, from.y - h, to.x - w * 0.35, to.y + h, to.x, to.y);
        break;
      case "oval":
        g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      case "rect":
        g.rect(x, y, w, h);
        break;
      case "rrect": {
        const r = Math.min(w, h) / 5;
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
        break;
      }
      case "poly": {
        const cx = x + w / 2,
          cy = y + h / 2,
          rx = w / 2,
          ry = h / 2,
          n = 6;
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n - Math.PI / 2;
          const px = cx + rx * Math.cos(a),
            py = cy + ry * Math.sin(a);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        break;
      }
      case "tri":
        g.moveTo(x + w / 2, y);
        g.lineTo(x + w, y + h);
        g.lineTo(x, y + h);
        g.closePath();
        break;
      case "star": {
        const cx = x + w / 2,
          cy = y + h / 2,
          R = Math.min(w, h) / 2,
          r = R * 0.42;
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * i) / 5 - Math.PI / 2;
          const rad = i % 2 ? r : R;
          const px = cx + rad * Math.cos(a),
            py = cy + rad * Math.sin(a);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        break;
      }
      case "heart": {
        const s = Math.min(w, h);
        const hx = x + w / 2,
          hy = y + h / 2;
        g.moveTo(hx, hy + s * 0.34);
        g.bezierCurveTo(hx + s * 0.62, hy - s * 0.1, hx + s * 0.3, hy - s * 0.52, hx, hy - s * 0.2);
        g.bezierCurveTo(
          hx - s * 0.3,
          hy - s * 0.52,
          hx - s * 0.62,
          hy - s * 0.1,
          hx,
          hy + s * 0.34,
        );
        break;
      }
      default:
        break;
    }
    if (fillShape && shape !== "line" && shape !== "arrow" && shape !== "curve") g.fill();
    g.stroke();
    g.globalAlpha = 1;
    if (commit) {
      setDirty(true);
      push();
    }
  };

  const spray = (p) => {
    const g = ctx.current;
    g.globalAlpha = opacity * 0.35;
    g.fillStyle = c1;
    const r = size * 3;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      g.beginPath();
      g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.1, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };

  const floodFill = (p) => {
    const g = ctx.current;
    const c = cv.current;
    const { width: W, height: H } = c;
    const sx = clamp(Math.floor(p.x), 0, W - 1);
    const sy = clamp(Math.floor(p.y), 0, H - 1);
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    const at = (x, y) => (y * W + x) * 4;
    const i0 = at(sx, sy);
    const target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    const hex = c1.replace("#", "");
    const fill = [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      Math.round(opacity * 255),
    ];
    if (target.every((v, i) => v === fill[i])) return;
    const match = (i) =>
      Math.abs(d[i] - target[0]) < 12 &&
      Math.abs(d[i + 1] - target[1]) < 12 &&
      Math.abs(d[i + 2] - target[2]) < 12 &&
      Math.abs(d[i + 3] - target[3]) < 12;
    const stack = [[sx, sy]];
    const seen = new Uint8Array(W * H);
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = y * W + x;
      if (seen[k]) continue;
      seen[k] = 1;
      const i = k * 4;
      if (!match(i)) continue;
      d[i] = fill[0];
      d[i + 1] = fill[1];
      d[i + 2] = fill[2];
      d[i + 3] = fill[3];
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    g.putImageData(img, 0, 0);
    setDirty(true);
    push();
  };

  const pickColour = (p) => {
    const g = ctx.current;
    const d = g.getImageData(
      clamp(Math.floor(p.x), 0, cv.current.width - 1),
      clamp(Math.floor(p.y), 0, cv.current.height - 1),
      1,
      1,
    ).data;
    const hx = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    setC1(hx);
    notify({
      app: "Paint",
      icon: "img/icon/paint.png",
      title: "Colour 1 set",
      body: hx,
      kind: "info",
      life: 2.4,
    });
  };

  /* ---------------- pointer events ---------------- */
  const down = (e) => {
    e.preventDefault();
    cv.current.focus?.();
    const p = pos(e);
    const g = ctx.current;
    if (tool === "text") {
      setText({ x: p.x, y: p.y });
      return;
    }
    if (tool === "fill") return floodFill(p);
    if (tool === "picker") return pickColour(p);
    if (tool === "magnifier") {
      setZoom((z) => clamp(e.shiftKey ? z / 1.25 : z * 1.25, 0.25, 4));
      return;
    }
    if (tool === "select" || tool === "crop") {
      snap.current = g.getImageData(0, 0, cv.current.width, cv.current.height);
      drawing.current = { mode: tool, from: p, to: p };
      return;
    }
    snap.current = g.getImageData(0, 0, cv.current.width, cv.current.height);
    drawing.current = { mode: tool, from: p, to: p };
    if (tool === "brush" || tool === "pencil" || tool === "eraser") {
      strokeStyle();
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x + 0.01, p.y);
      g.stroke();
    }
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const g = ctx.current;
    const d = drawing.current;
    d.to = p;
    const shiftShape =
      e.shiftKey && ["rect", "rrect", "oval", "tri", "star", "heart", "poly"].includes(shape);
    if (shiftShape) {
      const w = p.x - d.from.x,
        h = p.y - d.from.y;
      const m = Math.max(Math.abs(w), Math.abs(h));
      p.x = d.from.x + Math.sign(w) * m;
      p.y = d.from.y + Math.sign(h) * m;
      d.to = { ...p };
    }
    if (d.mode === "select" || d.mode === "crop") {
      g.putImageData(snap.current, 0, 0);
      g.save();
      g.strokeStyle = "#4cc2ff";
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.strokeRect(
        Math.min(d.from.x, p.x),
        Math.min(d.from.y, p.y),
        Math.abs(p.x - d.from.x),
        Math.abs(p.y - d.from.y),
      );
      g.restore();
      return;
    }
    if (d.mode === "spray") return spray(p);
    if (d.mode === "brush" || d.mode === "pencil" || d.mode === "eraser") {
      strokeStyle();
      g.lineTo(p.x, p.y);
      g.stroke();
      return;
    }
    // shape preview
    g.putImageData(snap.current, 0, 0);
    drawShape(d.from, p, false);
  };

  const up = (e) => {
    const d = drawing.current;
    if (!d) return;
    drawing.current = null;
    const g = ctx.current;
    const p = d.to;
    if (d.mode === "select") {
      g.putImageData(snap.current, 0, 0);
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Selection made",
        body: "Use Crop to cut the canvas down to it.",
        kind: "info",
        life: 3.4,
      });
      return;
    }
    if (d.mode === "crop") {
      const x = Math.min(d.from.x, p.x),
        y = Math.min(d.from.y, p.y);
      const w = Math.abs(p.x - d.from.x),
        h = Math.abs(p.y - d.from.y);
      if (w < 4 || h < 4) {
        g.putImageData(snap.current, 0, 0);
        return;
      }
      const cut = g.getImageData(x, y, w, h);
      const c = cv.current;
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      g.fillStyle = c2;
      g.fillRect(0, 0, c.width, c.height);
      g.putImageData(cut, 0, 0);
      g.lineJoin = "round";
      g.lineCap = "round";
      setDirty(true);
      push();
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Cropped",
        body: `${c.width} × ${c.height}`,
        kind: "success",
        life: 3,
      });
      return;
    }
    if (["brush", "pencil", "eraser", "spray"].includes(d.mode)) {
      setDirty(true);
      push();
      return;
    }
    g.putImageData(snap.current, 0, 0);
    drawShape(d.from, p, true);
  };

  /* ---------------- text ---------------- */
  const commitText = (value) => {
    setText(null);
    if (!value) return;
    const g = ctx.current;
    g.globalAlpha = opacity;
    g.fillStyle = c1;
    g.font = `${fontSize}px "Segoe UI", system-ui, sans-serif`;
    g.textBaseline = "top";
    value.split("\n").forEach((line, i) => g.fillText(line, text.x, text.y + i * fontSize * 1.22));
    g.globalAlpha = 1;
    setDirty(true);
    push();
  };

  /* ---------------- whole-canvas ops ---------------- */
  const rotate = (deg) => {
    const c = cv.current;
    const g = ctx.current;
    const src = c.toDataURL();
    const img = new Image();
    img.onload = () => {
      if (deg % 180 === 0) {
        c.width = img.width;
        c.height = img.height;
      } else {
        c.width = img.height;
        c.height = img.width;
      }
      g.save();
      g.translate(c.width / 2, c.height / 2);
      g.rotate((deg * Math.PI) / 180);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      g.restore();
      g.lineJoin = "round";
      g.lineCap = "round";
      setDirty(true);
      push();
    };
    img.src = src;
  };

  const flip = (axis) => {
    const c = cv.current;
    const g = ctx.current;
    const img = new Image();
    img.onload = () => {
      g.save();
      g.clearRect(0, 0, c.width, c.height);
      g.translate(axis === "h" ? c.width : 0, axis === "v" ? c.height : 0);
      g.scale(axis === "h" ? -1 : 1, axis === "v" ? -1 : 1);
      g.drawImage(img, 0, 0);
      g.restore();
      setDirty(true);
      push();
    };
    img.src = c.toDataURL();
  };

  const invert = () => {
    const g = ctx.current;
    const c = cv.current;
    const img = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 255 - img.data[i];
      img.data[i + 1] = 255 - img.data[i + 1];
      img.data[i + 2] = 255 - img.data[i + 2];
    }
    g.putImageData(img, 0, 0);
    setDirty(true);
    push();
  };

  const greyscale = () => {
    const g = ctx.current;
    const c = cv.current;
    const img = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    setDirty(true);
    push();
  };

  const clearCanvas = async () => {
    const go = await wosConfirm("Clear the whole canvas?", {
      title: "Paint",
      okText: "Clear",
      danger: true,
    });
    if (!go) return;
    const g = ctx.current;
    g.fillStyle = c2;
    g.fillRect(0, 0, cv.current.width, cv.current.height);
    setDirty(true);
    push();
  };

  const resizeCanvas = async () => {
    const w = await wosPrompt("Width × height (px):", {
      title: "Resize",
      value: `${cv.current.width} x ${cv.current.height}`,
    });
    const m = /(\d+)\s*[x,]\s*(\d+)/i.exec(w || "");
    if (!m) return;
    const nw = clamp(parseInt(m[1], 10), 16, 4096);
    const nh = clamp(parseInt(m[2], 10), 16, 4096);
    const src = cv.current.toDataURL();
    const img = new Image();
    img.onload = () => {
      cv.current.width = nw;
      cv.current.height = nh;
      const g = ctx.current;
      g.fillStyle = c2;
      g.fillRect(0, 0, nw, nh);
      g.drawImage(img, 0, 0, nw, nh);
      g.lineJoin = "round";
      g.lineCap = "round";
      setDirty(true);
      push();
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Resized",
        body: `${nw} × ${nh}`,
        kind: "success",
        life: 3,
      });
    };
    img.src = src;
  };

  /* ---------------- file ops ---------------- */
  const dataUrl = () => cv.current?.toDataURL("image/png") || "";

  const loadImage = async (path) => {
    setBusy("Opening…");
    const rec = await vs.vsReadDataUrl(path).catch(() => null);
    setBusy("");
    if (!rec?.dataUrl) {
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Could not open that file",
        body: path,
        kind: "error",
      });
      return;
    }
    const img = new Image();
    img.onload = () => {
      const c = cv.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = ctx.current;
      g.drawImage(img, 0, 0);
      g.lineJoin = "round";
      g.lineCap = "round";
      setDocName(rec.name);
      setDocPath(rec.path);
      setDirty(false);
      hist.current = [c.toDataURL("image/png")];
      future.current = [];
    };
    img.onerror = () =>
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "That file is not an image",
        body: path,
        kind: "error",
      });
    img.src = rec.dataUrl;
  };

  const openFile = async () => {
    await vs.hydrate();
    const user = vs.getUserName() || personName || "User";
    const answer = await wosFileOpen({
      title: "Open",
      dir: `C:\\Users\\${user}\\Pictures`,
      types: [
        {
          label: "Images (*.png, *.jpg, *.gif, *.webp, *.bmp)",
          exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
        },
        { label: "All files", exts: null },
      ],
    });
    if (!answer) return;
    await loadImage(answer);
  };

  const doSave = async (as) => {
    const user = vs.getUserName() || personName || "User";
    let path = docPath;
    let name = docName;
    if (as || !path) {
      // the real Save-As window — browses the Virtual Storage, lands in Pictures
      const answer = await wosFileSave({
        title: "Save as",
        value: /\.(png|jpe?g|webp)$/i.test(name) ? name : `${name}.png`,
        dir: `C:\\Users\\${user}\\Pictures`,
      });
      if (!answer || !answer.path) return;
      name = answer.name || answer.path.split("\\").pop();
      path = answer.path;
    }
    setBusy("Saving…");
    try {
      await vs.vsWriteDataUrl(path, dataUrl(), { mime: "image/png" });
      setDocName(path.split("\\").pop());
      setDocPath(path);
      setDirty(false);
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Saved",
        body: path,
        kind: "success",
        life: 4,
      });
    } catch (e) {
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Could not save",
        body: String(e?.message || e),
        kind: "error",
      });
    }
    setBusy("");
  };

  const newDoc = async () => {
    if (dirty) {
      const keep = await wosConfirm(`Save changes to ${docName}?`, {
        title: "Paint",
        okText: "Save",
        cancelText: "Discard",
      });
      if (keep) await doSave(false);
    }
    const c = cv.current;
    c.width = 900;
    c.height = 560;
    const g = ctx.current;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    g.lineJoin = "round";
    g.lineCap = "round";
    setDocName("Untitled");
    setDocPath(null);
    setDirty(false);
    hist.current = [c.toDataURL("image/png")];
    future.current = [];
  };

  const importFile = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = cv.current;
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = ctx.current;
        g.drawImage(img, 0, 0);
        g.lineJoin = "round";
        g.lineCap = "round";
        setDocName(file.name);
        setDocPath(null);
        setDirty(true);
        push();
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };

  const exportLocal = () => {
    const a = document.createElement("a");
    a.href = dataUrl();
    a.download = /\.(png|jpe?g)$/i.test(docName) ? docName : `${docName}.png`;
    a.click();
    notify({
      app: "Paint",
      icon: "img/icon/paint.png",
      title: "Exported to your real Downloads",
      body: a.download,
      kind: "success",
      life: 4,
    });
  };

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await it.getType(type);
        importFile(new File([blob], `pasted-${Date.now()}.png`, { type }));
        return;
      }
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "No image on the clipboard",
        kind: "info",
        life: 3,
      });
    } catch {
      notify({
        app: "Paint",
        icon: "img/icon/paint.png",
        title: "Clipboard blocked",
        body: "Use Ctrl+V while the canvas has focus instead.",
        kind: "warn",
      });
    }
  };

  /* paste image straight onto the canvas */
  useEffect(() => {
    const onPaste = (e) => {
      if (wnapp.hide || !wnapp.alive) return;
      const f = [...(e.clipboardData?.files || [])][0];
      if (f) {
        e.preventDefault();
        importFile(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [wnapp.hide, wnapp.alive]);

  /* a picture was handed over by Photos / Explorer */
  useEffect(() => {
    if (!wnapp.openDoc) return;
    const d = wnapp.openDoc;
    if (d.path) {
      loadImage(d.path);
    } else if (d.src) {
      const img = new Image();
      img.onload = () => {
        const c = cv.current;
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        ctx.current.drawImage(img, 0, 0);
        ctx.current.lineJoin = "round";
        ctx.current.lineCap = "round";
        setDocName(d.name || "Untitled");
        setDocPath(null);
        setDirty(true);
        push();
      };
      img.src = d.src;
    }
    dispatch({ type: "OPENPAINT" });
  }, [wnapp.openDoc]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!ownsKeyboard(wnapp, hz)) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const c = e.ctrlKey || e.metaKey;
      if (!c) {
        if (e.key === "Delete") {
          e.preventDefault();
          clearCanvas();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (k === "s" && e.shiftKey) {
        e.preventDefault();
        doSave(true);
      } else if (k === "s") {
        e.preventDefault();
        doSave(false);
      } else if (k === "n") {
        e.preventDefault();
        newDoc();
      } else if (k === "o") {
        e.preventDefault();
        openFile();
      } else if (k === "e") {
        e.preventDefault();
        exportLocal();
      } else if (k === "b") {
        e.preventDefault();
        setTool("brush");
      } else if (k === "p") {
        e.preventDefault();
        setTool("pencil");
      } else if (k === "t") {
        e.preventDefault();
        setTool("text");
      } else if (k === "g") {
        e.preventDefault();
        setTool("fill");
      } else if (k === "i") {
        e.preventDefault();
        setTool("picker");
      } else if (k === "+" || k === "=") {
        e.preventDefault();
        setZoom((z) => clamp(z * 1.25, 0.25, 4));
      } else if (k === "-") {
        e.preventDefault();
        setZoom((z) => clamp(z / 1.25, 0.25, 4));
      } else if (k === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    wnapp.alive,
    wnapp.hide,
    hz,
    tool,
    size,
    c1,
    c2,
    opacity,
    docName,
    docPath,
    dirty,
    fontSize,
    text,
  ]);

  const canvasW = cv.current?.width || 900;
  const canvasH = cv.current?.height || 560;
  const toolObj = useMemo(() => TOOLS.find((t) => t.id === tool), [tool]);

  if (!wnapp.alive) return null;

  return (
    <div
      className="paintApp win11paint floatTab dpShad"
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
        name={`${docName}${dirty ? " •" : ""} - Paint`}
      />

      <div className="windowScreen" data-dock="true">
        {/* ============================ ribbon ============================ */}
        <div className="ptRibbon">
          <div className="ptFileBtns">
            <button type="button" className="ptBig" title="New (Ctrl+N)" onClick={newDoc}>
              <svg viewBox="0 0 18 18" width="17" height="17">
                <path
                  d="M4 2.5h7L15 6v9.5H4V2.5z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 2.5V6h4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
              <span>New</span>
            </button>
            <button type="button" className="ptBig" title="Open (Ctrl+O)" onClick={openFile}>
              <svg viewBox="0 0 18 18" width="17" height="17">
                <path
                  d="M2 5h5l2 2.2h7V15H2V5z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Open</span>
            </button>
            <button
              type="button"
              className="ptBig"
              title="Save (Ctrl+S)"
              onClick={() => doSave(false)}
            >
              <svg viewBox="0 0 18 18" width="17" height="17">
                <path
                  d="M3 3h9l3 3v9H3V3z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
                <rect
                  x="6"
                  y="3"
                  width="6"
                  height="4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
                <rect
                  x="6"
                  y="10.5"
                  width="6"
                  height="4.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
              </svg>
              <span>Save</span>
            </button>
            <button
              type="button"
              className="ptBig"
              title="Save as (Ctrl+Shift+S)"
              onClick={() => doSave(true)}
            >
              <svg viewBox="0 0 18 18" width="17" height="17">
                <path
                  d="M3 3h9l3 3v9H3V3z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
                <path
                  d="M7.5 9.5h6M11 7l2.5 2.5L11 12"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Save as</span>
            </button>
          </div>
          <i className="ptDiv" />

          <button
            type="button"
            className="ptBig"
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={hist.current.length < 2}
          >
            <svg viewBox="0 0 18 18" width="17" height="17">
              <path
                d="M6.5 5.5H12a3.5 3.5 0 0 1 0 7H8M6.5 5.5L9 3M6.5 5.5L9 8"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Undo</span>
          </button>
          <button
            type="button"
            className="ptBig"
            title="Redo (Ctrl+Y)"
            onClick={redo}
            disabled={!future.current.length}
          >
            <svg viewBox="0 0 18 18" width="17" height="17">
              <path
                d="M11.5 5.5H6a3.5 3.5 0 0 0 0 7h4M11.5 5.5L9 3M11.5 5.5L9 8"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Redo</span>
          </button>
          <i className="ptDiv" />

          <div className="ptGroup">
            <div className="ptTools">
              {TOOLS.map((t) => (
                <Tool key={t.id} t={t} on={tool === t.id} onClick={setTool} />
              ))}
            </div>
            <span className="ptGroupLbl">Tools</span>
          </div>
          <i className="ptDiv" />

          <div className="ptGroup">
            <div className="ptShapes">
              {SHAPES.map((s) => (
                <Tool
                  key={s.id}
                  t={{ ...s, hint: `Draw a ${s.label.toLowerCase()} (Shift keeps proportions)` }}
                  on={shape === s.id && tool === "shape"}
                  onClick={() => {
                    setShape(s.id);
                    setTool("shape");
                  }}
                />
              ))}
            </div>
            <span className="ptGroupLbl">Shapes</span>
          </div>
          <i className="ptDiv" />

          <div className="ptGroup">
            <div className="ptShapes">
              {Object.entries(EFFECTS).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className="ptEff"
                  title={`${label} (undoable)`}
                  onClick={() => applyEffect(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="ptGroupLbl">Effects</span>
          </div>
          <i className="ptDiv" />

          <div className="ptGroup ptColours">
            <div className="ptColRow">
              <label className="ptSwatch big" title="Colour 1 (foreground)">
                <span style={{ background: c1 }} />
                <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} />
              </label>
              <label className="ptSwatch big" title="Colour 2 (background / eraser)">
                <span style={{ background: c2 }} />
                <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} />
              </label>
              <button
                type="button"
                className="ptSwap"
                title="Swap colours"
                onClick={() => {
                  setC1(c2);
                  setC2(c1);
                }}
              >
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <path
                    d="M2 5.5h10L9.5 3M14 10.5H4l2.5 2.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="ptPalette">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ptSw"
                  style={{ background: c }}
                  title={c}
                  onClick={(e) => (e.shiftKey ? setC2(c) : setC1(c))}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setC2(c);
                  }}
                />
              ))}
            </div>
            <span className="ptGroupLbl">Colours · Shift-click sets colour 2</span>
          </div>
          <i className="ptDiv" />

          <div className="ptGroup">
            <div className="ptSliders">
              <label>
                <span>Size</span>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={size}
                  onChange={(e) => setSize(+e.target.value)}
                />
                <b>{size}</b>
              </label>
              <label>
                <span>Opacity</span>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(+e.target.value / 100)}
                />
                <b>{Math.round(opacity * 100)}%</b>
              </label>
              {tool === "text" ? (
                <label>
                  <span>Text size</span>
                  <input
                    type="range"
                    min="8"
                    max="140"
                    value={fontSize}
                    onChange={(e) => setFontSize(+e.target.value)}
                  />
                  <b>{fontSize}</b>
                </label>
              ) : null}
              {tool === "shape" ? (
                <label className="ptCheck">
                  <input
                    type="checkbox"
                    checked={fillShape}
                    onChange={(e) => setFillShape(e.target.checked)}
                  />
                  <span>Fill shape</span>
                </label>
              ) : null}
            </div>
            <span className="ptGroupLbl">{toolObj ? toolObj.hint : "Draw shapes"}</span>
          </div>
          <i className="ptDiv" />

          <div className="ptGroup">
            <div className="ptMiniBtns">
              <button
                type="button"
                className="ptMini"
                title="Rotate left 90°"
                onClick={() => rotate(-90)}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5V5h2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="ptMini"
                title="Rotate right 90°"
                onClick={() => rotate(90)}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5V5h-2.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="ptMini"
                title="Flip horizontal"
                onClick={() => flip("h")}
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
                className="ptMini"
                title="Flip vertical"
                onClick={() => flip("v")}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M2 8h12M5 5L8 2l3 3H5zM5 11l3 3 3-3H5z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button type="button" className="ptMini" title="Invert colours" onClick={invert}>
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
                </svg>
              </button>
              <button type="button" className="ptMini" title="Greyscale" onClick={greyscale}>
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <rect
                    x="2"
                    y="3"
                    width="12"
                    height="10"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <path d="M2 8h12M5 3v10" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
              <button type="button" className="ptMini" title="Resize canvas" onClick={resizeCanvas}>
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M2 6V2h4M14 10v4h-4M2 2l5 5M14 14l-5-5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="ptMini"
                title="Clear canvas (Del)"
                onClick={clearCanvas}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <span className="ptGroupLbl">Image</span>
          </div>
          <i className="ptDiv" />

          <div className="ptGroup">
            <div className="ptMiniBtns">
              <button
                type="button"
                className="ptMini wide"
                title="Paste an image (Ctrl+V)"
                onClick={pasteFromClipboard}
              >
                Paste
              </button>
              <button
                type="button"
                className="ptMini wide"
                title="Copy the canvas"
                onClick={async () => {
                  try {
                    const blob = await (await fetch(dataUrl())).blob();
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                    notify({
                      app: "Paint",
                      icon: "img/icon/paint.png",
                      title: "Canvas copied",
                      kind: "success",
                      life: 3,
                    });
                  } catch {
                    notify({
                      app: "Paint",
                      icon: "img/icon/paint.png",
                      title: "Clipboard blocked by the browser",
                      kind: "warn",
                    });
                  }
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="ptMini wide"
                title="Import from this PC"
                onClick={() => fileRef.current?.click()}
              >
                Import
              </button>
              <button
                type="button"
                className="ptMini wide"
                title="Export to your real Downloads (Ctrl+E)"
                onClick={exportLocal}
              >
                Export
              </button>
            </div>
            <span className="ptGroupLbl">Clipboard</span>
          </div>
        </div>

        {/* ============================ canvas ============================ */}
        <div className="ptBody win11Scroll" ref={wrapRef}>
          <div className="ptCanvasWrap" style={{ transform: `scale(${zoom})` }}>
            <canvas
              ref={cv}
              width={900}
              height={560}
              className="ptCanvas"
              tabIndex={0}
              onMouseDown={down}
              onMouseMove={move}
              onMouseUp={up}
              onMouseLeave={up}
              onTouchStart={down}
              onTouchMove={move}
              onTouchEnd={up}
              onDrop={(e) => {
                e.preventDefault();
                importFile(e.dataTransfer.files?.[0]);
              }}
              onDragOver={(e) => e.preventDefault()}
              onPaste={(e) => {
                const f = e.clipboardData?.files?.[0];
                if (f) {
                  e.preventDefault();
                  importFile(f);
                }
              }}
            />
            {text ? (
              <textarea
                className="ptText"
                autoFocus
                style={{ left: text.x, top: text.y, fontSize, color: c1 }}
                defaultValue=""
                placeholder="Type here…"
                onKeyDown={(e) => {
                  if (e.key === "Escape") commitText(e.currentTarget.value);
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                    commitText(e.currentTarget.value);
                }}
                onBlur={(e) => commitText(e.currentTarget.value)}
              />
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {/* ============================ status ============================ */}
        <div className="ptStatus">
          <span>
            {toolObj ? toolObj.label : "Shape"} ·{" "}
            {shape && tool === "shape" ? SHAPES.find((s) => s.id === shape)?.label : "—"}
          </span>
          <span>
            {canvasW} × {canvasH} px
          </span>
          <span className="ptStatusSpacer" />
          {busy ? <span className="ptBusy">{busy}</span> : null}
          <div className="ptZoom">
            <button
              type="button"
              onClick={() => setZoom((z) => clamp(z / 1.25, 0.25, 4))}
              title="Zoom out (Ctrl+-)"
            >
              −
            </button>
            <input
              type="range"
              min="25"
              max="400"
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(+e.target.value / 100)}
              title="Zoom"
            />
            <button
              type="button"
              onClick={() => setZoom((z) => clamp(z * 1.25, 0.25, 4))}
              title="Zoom in (Ctrl++)"
            >
              +
            </button>
            <b>{Math.round(zoom * 100)}%</b>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaintApp;

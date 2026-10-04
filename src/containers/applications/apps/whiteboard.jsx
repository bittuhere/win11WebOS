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
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb } from "../../../utils/idb";
import * as vs from "../../../utils/os/vs";
import { ownsKeyboard } from "../../../utils/os/keys";
import { notify, wosConfirm, wosPrompt, wosFileSave } from "../../../utils/os/ui";
import { WosSelect } from "../../../components/shared/Controls";
import "./whiteboard.scss";

/* ------------------------------------------------------------------ *
 *  Microsoft Whiteboard — an infinite ink canvas.
 *  Pens, highlighter, eraser, lasso, shapes, sticky notes, text and
 *  pictures.  The whole board lives on the Virtual Storage so it is
 *  still there after you close the tab.
 * ------------------------------------------------------------------ */

const PEN_COLOURS = [
  { id: "black", c: "#1b1b1f", n: "Black" },
  { id: "grey", c: "#7a7d85", n: "Grey" },
  { id: "red", c: "#e8112d", n: "Red" },
  { id: "orange", c: "#f7630c", n: "Orange" },
  { id: "yellow", c: "#e6b800", n: "Yellow" },
  { id: "green", c: "#16883e", n: "Green" },
  { id: "teal", c: "#03807a", n: "Teal" },
  { id: "blue", c: "#0f6cbd", n: "Blue" },
  { id: "indigo", c: "#4f4bd8", n: "Indigo" },
  { id: "purple", c: "#8b2fc9", n: "Purple" },
  { id: "pink", c: "#d63f86", n: "Pink" },
  { id: "brown", c: "#8a5a2b", n: "Brown" },
];

const HL_COLOURS = ["#fff176", "#a5f3a5", "#9ad8ff", "#ffc1e3", "#d9c7ff"];

const NOTE_COLOURS = ["#fff59a", "#ffd0a8", "#b8f0c0", "#a8dcff", "#e2ccff", "#ffc2d4"];

const SHAPES = [
  {
    id: "rect",
    n: "Rectangle",
    svg: (
      <rect
        x="3"
        y="5"
        width="14"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    ),
  },
  {
    id: "ellipse",
    n: "Ellipse",
    svg: (
      <ellipse
        cx="10"
        cy="10"
        rx="7.5"
        ry="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    ),
  },
  {
    id: "line",
    n: "Line",
    svg: <path d="M3.5 16L16.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  },
  {
    id: "arrow",
    n: "Arrow",
    svg: (
      <path
        d="M3.5 16L15 4.5M10.5 4h5.2v5.2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "triangle",
    n: "Triangle",
    svg: (
      <path
        d="M10 3.5L17 15.5H3L10 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    id: "diamond",
    n: "Diamond",
    svg: (
      <path
        d="M10 3l7 7-7 7-7-7 7-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
];

const BOARD_KEY = "board.doc";
const uid = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* how far a hand-drawn stroke has to look like a shape before we snap it */
function recognise(pts) {
  if (pts.length < 12) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const w = maxX - minX,
    h = maxY - minY;
  if (w < 26 || h < 26) return null;

  const first = pts[0],
    last = pts[pts.length - 1];
  const closed = Math.hypot(last[0] - first[0], last[1] - first[1]) < Math.max(w, h) * 0.18;

  // path length vs. the diagonal of the bounding box: a straight line is ~1
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const diag = Math.hypot(w, h);
  const ratio = len / diag;

  if (closed) {
    // corner test: how many points sit near a bounding-box corner?
    const corners = [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ];
    const near = corners.filter(([cx, cy]) =>
      pts.some((p) => Math.hypot(p[0] - cx, p[1] - cy) < Math.max(w, h) * 0.16),
    ).length;
    const fill = (w * h) / Math.max(1, len * Math.max(w, h) * 0.16);
    if (near >= 4 && ratio > 2.4 && ratio < 4.6) return { kind: "rect" };
    if (ratio > 2.2 && ratio < 4.4 && fill > 0.6) return { kind: "ellipse" };
    if (near >= 3 && ratio > 2.2 && ratio < 4.4) return { kind: "triangle" };
    return null;
  }
  if (ratio < 1.14) {
    // arrowheads have a small hook at the end — look for a direction reversal
    const tail = pts.slice(-Math.max(3, Math.floor(pts.length * 0.16)));
    const dx = last[0] - first[0],
      dy = last[1] - first[1];
    const ang = Math.atan2(dy, dx);
    const hook = tail.some((p) => {
      const a = Math.atan2(last[1] - p[1], last[0] - p[0]);
      const d = Math.abs(((a - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      return d > 0.7 && d < 2.5 && Math.hypot(last[0] - p[0], last[1] - p[1]) > 8;
    });
    return { kind: hook ? "arrow" : "line" };
  }
  return null;
}

export const WhiteBoard = () => {
  const wnapp = useSelector((s) => s.apps.board) || {};
  const hz = useSelector((s) => s.apps.hz);
  const dispatch = useDispatch();

  const [tool, setTool] = useState("pen");
  const [colour, setColour] = useState(PEN_COLOURS[0].c);
  const [hl, setHl] = useState(HL_COLOURS[0]);
  const [note, setNote] = useState(NOTE_COLOURS[0]);
  const [width, setWidth] = useState(3);
  const [shape, setShape] = useState("rect");
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [els, setEls] = useState([]);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(null); // {id, kind}
  const [picker, setPicker] = useState(null); // 'colour' | 'shape' | 'note'
  const [loaded, setLoaded] = useState(false);

  const cv = useRef(null);
  const box = useRef(null);
  const fileRef = useRef(null);
  const act = useRef(null); // the in-progress gesture
  const hist = useRef([]);
  const future = useRef([]);
  const viewRef = useRef(view);
  const elsRef = useRef(els);
  const boardPathRef = useRef(null); // the file this board was opened from
  viewRef.current = view;
  elsRef.current = els;

  /* ---------------- load the saved board ---------------- */
  useEffect(() => {
    (async () => {
      let doc = null;
      try {
        const rec = await vs.vsRead("C:\\Users\\Public\\Documents\\Whiteboard.wb.json");
        if (rec?.content) doc = JSON.parse(rec.content);
      } catch (e) {}
      if (!doc) doc = await idb.get(BOARD_KEY).catch(() => null);
      if (doc && Array.isArray(doc.els)) {
        setEls(doc.els);
        if (doc.view) setView(doc.view);
        elsRef.current = doc.els;
        hist.current = [JSON.stringify(doc.els)];
      } else {
        hist.current = ["[]"];
        // a small welcome so the board is never blank
        const welcome = [
          {
            id: uid(),
            kind: "note",
            x: 120,
            y: 120,
            w: 250,
            h: 190,
            color: NOTE_COLOURS[0],
            text: "Welcome to Whiteboard 👋\n\nDraw with the pen, drop sticky notes, add shapes — everything is saved to your Virtual Storage.",
          },
          {
            id: uid(),
            kind: "ink",
            color: "#0f6cbd",
            w: 4,
            pts: [
              [420, 180],
              [452, 168],
              [486, 176],
              [512, 200],
              [520, 232],
              [500, 258],
              [466, 262],
              [438, 244],
              [428, 212],
            ],
          },
        ];
        setEls(welcome);
        elsRef.current = welcome;
        hist.current = [JSON.stringify(welcome)];
      }
      setLoaded(true);
    })();
  }, []);

  /* a document was handed over (Explorer → Open in Whiteboard).
     d may be {path, name} or a plain VS path string — both load that file,
     and later autosaves go back to THE SAME file, not the public board. */
  useEffect(() => {
    if (!wnapp.openDoc || !loaded) return;
    const d = wnapp.openDoc;
    (async () => {
      try {
        let doc = null;
        let boardPath = null;
        let label = "";
        if (typeof d === "string") {
          if (/^([A-Za-z]:\\|%)/.test(d)) {
            boardPath = d;
            label = d.split("\\").pop();
            const rec = await vs.vsRead(d);
            doc = rec?.content ? JSON.parse(rec.content) : null;
          } else {
            doc = JSON.parse(d);
          }
        } else if (d && d.path) {
          boardPath = d.path;
          label = d.name || d.path.split("\\").pop();
          const rec = await vs.vsRead(d.path);
          doc = rec?.content ? JSON.parse(rec.content) : null;
        } else {
          doc = d;
        }
        if (Array.isArray(doc?.els)) {
          setEls(doc.els);
          elsRef.current = doc.els;
          if (doc.view) setView(doc.view);
          hist.current = [JSON.stringify(doc.els)];
          future.current = [];
          boardPathRef.current = boardPath; // autosave target from now on
          notify({
            app: "Whiteboard",
            icon: "img/icon/board.png",
            title: "Board opened",
            body: label,
            kind: "success",
            life: 3.5,
          });
        } else {
          notify({
            app: "Whiteboard",
            icon: "img/icon/board.png",
            title: "That file is not a Whiteboard",
            body: label || "No board data inside.",
            kind: "error",
          });
        }
      } catch (e) {
        notify({
          app: "Whiteboard",
          icon: "img/icon/board.png",
          title: "That file is not a Whiteboard",
          body: String(e?.message || e),
          kind: "error",
        });
      }
      dispatch({ type: "OPENBOARD" });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wnapp.openDoc, loaded]);

  /* ---------------- autosave ---------------- */
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      const payload = JSON.stringify({ els, view, at: Date.now() });
      idb.set(BOARD_KEY, { els, view, at: Date.now() }).catch(() => {});
      // save to the file the board was opened from; otherwise the public board
      vs.vsWrite(
        boardPathRef.current || "C:\\Users\\Public\\Documents\\Whiteboard.wb.json",
        payload,
        {
          mime: "application/json",
        },
      ).catch(() => {});
      setDirty(false);
    }, 900);
    return () => clearTimeout(t);
  }, [els, view, loaded]);

  /* ---------------- history ---------------- */
  const push = useCallback(() => {
    hist.current.push(JSON.stringify(elsRef.current));
    if (hist.current.length > 60) hist.current.shift();
    future.current = [];
    setDirty(true);
  }, []);

  const undo = () => {
    if (hist.current.length < 2) return;
    const cur = hist.current.pop();
    future.current.push(cur);
    const prev = JSON.parse(hist.current[hist.current.length - 1]);
    setEls(prev);
    elsRef.current = prev;
    setSel([]);
    setDirty(true);
  };

  const redo = () => {
    const n = future.current.pop();
    if (!n) return;
    hist.current.push(n);
    const next = JSON.parse(n);
    setEls(next);
    elsRef.current = next;
    setSel([]);
    setDirty(true);
  };

  /* ---------------- canvas ---------------- */
  const resize = useCallback(() => {
    const c = cv.current,
      b = box.current;
    if (!c || !b) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = b.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * dpr));
    c.height = Math.max(1, Math.round(r.height * dpr));
    c.style.width = `${r.width}px`;
    c.style.height = `${r.height}px`;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (box.current) ro.observe(box.current);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    draw();
  }, [els, view, sel, grid]);

  const toBoard = (cx, cy) => {
    const r = cv.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  };

  function draw() {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.width / dpr,
      H = c.height / dpr;
    const v = viewRef.current;
    const list = elsRef.current;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);

    // dotted grid, in board space
    if (grid) {
      const step = 28 * v.k;
      if (step > 9) {
        g.fillStyle = "rgba(20, 20, 30, 0.13)";
        const ox = ((v.x % step) + step) % step;
        const oy = ((v.y % step) + step) % step;
        for (let x = ox; x < W; x += step)
          for (let y = oy; y < H; y += step) {
            g.beginPath();
            g.arc(x, y, 0.95, 0, Math.PI * 2);
            g.fill();
          }
      }
    }

    g.save();
    g.translate(v.x, v.y);
    g.scale(v.k, v.k);

    const live = act.current?.preview || null;

    [...list, ...(live ? [live] : [])].forEach((el) => {
      if (el.kind === "ink") drawInk(g, el);
      else if (el.kind === "hl") drawInk(g, { ...el, alpha: 0.4, w: el.w * 5, cap: "butt" });
      else if (el.kind === "shape") drawShape(g, el);
      else if (el.kind === "note") drawNote(g, el);
      else if (el.kind === "text") drawText(g, el);
      else if (el.kind === "image") drawImage(g, el);
      else if (el.kind === "ruler") drawRuler(g, el);
    });

    // selection outlines
    if (sel.length) {
      const b = boundsOf(list.filter((e) => sel.includes(e.id)));
      if (b) {
        g.save();
        g.strokeStyle = "#0f6cbd";
        g.lineWidth = 1.4 / v.k;
        g.setLineDash([6 / v.k, 4 / v.k]);
        g.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
        g.restore();
      }
    }

    // lasso
    if (act.current?.mode === "lasso" && act.current.pts.length > 1) {
      g.save();
      g.strokeStyle = "#0f6cbd";
      g.fillStyle = "rgba(15,108,189,0.08)";
      g.lineWidth = 1.2 / v.k;
      g.setLineDash([5 / v.k, 4 / v.k]);
      g.beginPath();
      act.current.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }

    g.restore();
  }

  const drawInk = (g, el) => {
    const pts = el.pts;
    if (!pts?.length) return;
    g.save();
    g.globalAlpha = el.alpha ?? 1;
    g.strokeStyle = el.color;
    g.lineWidth = el.w;
    g.lineCap = el.cap || "round";
    g.lineJoin = "round";
    g.beginPath();
    if (pts.length < 3) {
      g.moveTo(pts[0][0], pts[0][1]);
      g.lineTo(pts[pts.length - 1][0] + 0.01, pts[pts.length - 1][1]);
    } else {
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
    g.stroke();
    g.restore();
  };

  const drawShape = (g, el) => {
    g.save();
    g.strokeStyle = el.color;
    g.fillStyle = el.fill || "transparent";
    g.lineWidth = el.w;
    g.lineCap = "round";
    g.lineJoin = "round";
    const { x, y, x2, y2 } = el;
    const l = Math.min(x, x2),
      t = Math.min(y, y2);
    const w = Math.abs(x2 - x),
      h = Math.abs(y2 - y);
    g.beginPath();
    switch (el.shape) {
      case "ellipse":
        g.ellipse(l + w / 2, t + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      case "line":
        g.moveTo(x, y);
        g.lineTo(x2, y2);
        break;
      case "arrow": {
        const a = Math.atan2(y2 - y, x2 - x);
        const head = Math.max(12, el.w * 4.2);
        g.moveTo(x, y);
        g.lineTo(x2, y2);
        g.moveTo(x2, y2);
        g.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42));
        g.moveTo(x2, y2);
        g.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42));
        break;
      }
      case "triangle":
        g.moveTo(l + w / 2, t);
        g.lineTo(l + w, t + h);
        g.lineTo(l, t + h);
        g.closePath();
        break;
      case "diamond":
        g.moveTo(l + w / 2, t);
        g.lineTo(l + w, t + h / 2);
        g.lineTo(l + w / 2, t + h);
        g.lineTo(l, t + h / 2);
        g.closePath();
        break;
      default:
        g.rect(l, t, w, h);
        break;
    }
    if (el.fill && el.fill !== "transparent") g.fill();
    g.stroke();
    g.restore();
  };

  const drawNote = (g, el) => {
    g.save();
    const w = el.w || 210,
      h = el.h || 170;
    g.shadowColor = "rgba(0,0,0,0.18)";
    g.shadowBlur = 14;
    g.shadowOffsetY = 5;
    g.fillStyle = el.color || NOTE_COLOURS[0];
    g.beginPath();
    const r = 4;
    g.moveTo(el.x + r, el.y);
    g.arcTo(el.x + w, el.y, el.x + w, el.y + h, r);
    g.arcTo(el.x + w, el.y + h, el.x, el.y + h, r);
    g.arcTo(el.x, el.y + h, el.x, el.y, r);
    g.arcTo(el.x, el.y, el.x + w, el.y, r);
    g.closePath();
    g.fill();
    g.shadowColor = "transparent";
    // the folded corner
    g.fillStyle = "rgba(0,0,0,0.07)";
    g.beginPath();
    g.moveTo(el.x + w - 18, el.y + h);
    g.lineTo(el.x + w, el.y + h - 18);
    g.lineTo(el.x + w, el.y + h);
    g.closePath();
    g.fill();
    g.fillStyle = "#2a2a2e";
    g.font = '15px "Segoe UI", system-ui, sans-serif';
    g.textBaseline = "top";
    wrapText(g, el.text || "", el.x + 14, el.y + 13, w - 28, 20);
    g.restore();
  };

  const drawText = (g, el) => {
    g.save();
    g.fillStyle = el.color;
    g.font = `${el.size || 22}px "Segoe UI", system-ui, sans-serif`;
    g.textBaseline = "top";
    wrapText(g, el.text || "", el.x, el.y, el.w || 420, (el.size || 22) * 1.32);
    g.restore();
  };

  const wrapText = (g, text, x, y, maxW, lh) => {
    let line = "";
    let cy = y;
    String(text)
      .split("\n")
      .forEach((para) => {
        para.split(" ").forEach((word) => {
          const test = line ? `${line} ${word}` : word;
          if (g.measureText(test).width > maxW && line) {
            g.fillText(line, x, cy);
            cy += lh;
            line = word;
          } else line = test;
        });
        g.fillText(line, x, cy);
        cy += lh;
        line = "";
      });
  };

  const drawImage = (g, el) => {
    if (!el._img) {
      const img = new Image();
      img.onload = () => {
        el._img = img;
        draw();
      };
      img.src = el.src;
      return;
    }
    g.save();
    g.shadowColor = "rgba(0,0,0,0.22)";
    g.shadowBlur = 16;
    g.shadowOffsetY = 6;
    g.drawImage(el._img, el.x, el.y, el.w, el.h);
    g.restore();
  };

  const drawRuler = (g, el) => {
    g.save();
    g.translate(el.x, el.y);
    g.rotate(((el.a || 0) * Math.PI) / 180);
    g.fillStyle = "rgba(226,232,240,0.92)";
    g.strokeStyle = "rgba(100,116,139,0.6)";
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect ? g.roundRect(-el.w / 2, -22, el.w, 44, 5) : g.rect(-el.w / 2, -22, el.w, 44);
    g.fill();
    g.stroke();
    g.strokeStyle = "rgba(71,85,105,0.75)";
    for (let i = -el.w / 2 + 10; i < el.w / 2; i += 10) {
      const big = Math.round(i) % 50 === 0;
      g.beginPath();
      g.moveTo(i, 20);
      g.lineTo(i, big ? 6 : 13);
      g.stroke();
    }
    g.restore();
  };

  const boundsOf = (list) => {
    if (!list.length) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    list.forEach((el) => {
      if (el.kind === "ink" || el.kind === "hl") {
        el.pts.forEach(([x, y]) => {
          minX = Math.min(minX, x - el.w);
          minY = Math.min(minY, y - el.w);
          maxX = Math.max(maxX, x + el.w);
          maxY = Math.max(maxY, y + el.w);
        });
      } else if (el.kind === "shape") {
        minX = Math.min(minX, el.x, el.x2);
        minY = Math.min(minY, el.y, el.y2);
        maxX = Math.max(maxX, el.x, el.x2);
        maxY = Math.max(maxY, el.y, el.y2);
      } else {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + (el.w || 200));
        maxY = Math.max(maxY, el.y + (el.h || 120));
      }
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const hit = (p) => {
    const list = elsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      const pad = 8;
      if (el.kind === "ink" || el.kind === "hl") {
        if (el.pts.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < el.w + pad)) return el;
      } else if (el.kind === "shape") {
        const l = Math.min(el.x, el.x2) - pad,
          t = Math.min(el.y, el.y2) - pad;
        const w = Math.abs(el.x2 - el.x) + pad * 2,
          h = Math.abs(el.y2 - el.y) + pad * 2;
        if (p.x >= l && p.x <= l + w && p.y >= t && p.y <= t + h) return el;
      } else if (
        p.x >= el.x - pad &&
        p.x <= el.x + (el.w || 200) + pad &&
        p.y >= el.y - pad &&
        p.y <= el.y + (el.h || 120) + pad
      ) {
        return el;
      }
    }
    return null;
  };

  /* ---------------- pointer ---------------- */
  const onDown = (e) => {
    cv.current.focus?.();
    const p = toBoard(e.clientX, e.clientY);
    const raw = { x: e.clientX, y: e.clientY };
    const middle = e.button === 1;
    const space = e.altKey || middle;

    if (space || tool === "pan") {
      act.current = { mode: "pan", raw, view: { ...viewRef.current } };
      return;
    }

    if (tool === "pen" || tool === "hl" || tool === "eraser") {
      const isErase = tool === "eraser";
      const el = {
        id: uid(),
        kind: tool === "hl" ? "hl" : "ink",
        color: isErase ? "#ffffff" : tool === "hl" ? hl : colour,
        w: isErase ? 26 : tool === "hl" ? width : width,
        pts: [[p.x, p.y]],
        alpha: isErase ? 1 : 1,
      };
      act.current = { mode: isErase ? "erase" : "draw", el, preview: isErase ? null : el };
      if (!isErase) setEls((l) => [...l, el]);
      return;
    }

    if (tool === "shape") {
      const el = {
        id: uid(),
        kind: "shape",
        shape,
        x: p.x,
        y: p.y,
        x2: p.x,
        y2: p.y,
        color: colour,
        w: width,
      };
      act.current = { mode: "shape", el, preview: el };
      return;
    }

    if (tool === "note") {
      const el = {
        id: uid(),
        kind: "note",
        x: p.x - 105,
        y: p.y - 85,
        w: 210,
        h: 170,
        color: note,
        text: "",
      };
      setEls((l) => [...l, el]);
      elsRef.current = [...elsRef.current, el];
      push();
      setEditing({ id: el.id, kind: "note", text: "" });
      setTool("pan");
      return;
    }

    if (tool === "text") {
      const el = {
        id: uid(),
        kind: "text",
        x: p.x,
        y: p.y,
        w: 420,
        h: 40,
        color: colour,
        size: Math.max(16, width * 7),
        text: "",
      };
      setEls((l) => [...l, el]);
      elsRef.current = [...elsRef.current, el];
      push();
      setEditing({ id: el.id, kind: "text", text: "" });
      setTool("pan");
      return;
    }

    if (tool === "lasso") {
      act.current = { mode: "lasso", pts: [[p.x, p.y]] };
      return;
    }

    // pan tool doubles as select/move
    const el = hit(p);
    if (el) {
      setSel([el.id]);
      act.current = {
        mode: "move",
        ids: [el.id],
        start: p,
        snap: JSON.parse(JSON.stringify(strip(elsRef.current.filter((x) => x.id === el.id)))),
      };
    } else {
      setSel([]);
      act.current = { mode: "pan", raw, view: { ...viewRef.current } };
    }
  };

  // images carry an Image() object that must not be serialised
  const strip = (list) =>
    list.map((el) => {
      const { _img, ...rest } = el;
      return rest;
    });

  const onMove = (e) => {
    const a = act.current;
    if (!a) return;
    e.preventDefault();
    const p = toBoard(e.clientX, e.clientY);

    if (a.mode === "pan") {
      setView({
        ...a.view,
        x: a.view.x + (e.clientX - a.raw.x),
        y: a.view.y + (e.clientY - a.raw.y),
      });
      return;
    }
    if (a.mode === "draw") {
      a.el.pts.push([p.x, p.y]);
      draw();
      return;
    }
    if (a.mode === "erase") {
      const keep = elsRef.current.filter((el) => {
        if (el.kind !== "ink" && el.kind !== "hl") return true;
        return !el.pts.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 22);
      });
      if (keep.length !== elsRef.current.length) {
        setEls(keep);
        elsRef.current = keep;
        draw();
      }
      return;
    }
    if (a.mode === "shape") {
      let x2 = p.x,
        y2 = p.y;
      if (e.shiftKey && ["rect", "ellipse", "triangle", "diamond"].includes(shape)) {
        const m = Math.max(Math.abs(x2 - a.el.x), Math.abs(y2 - a.el.y));
        x2 = a.el.x + Math.sign(x2 - a.el.x) * m;
        y2 = a.el.y + Math.sign(y2 - a.el.y) * m;
      }
      a.el.x2 = x2;
      a.el.y2 = y2;
      draw();
      return;
    }
    if (a.mode === "lasso") {
      a.pts.push([p.x, p.y]);
      draw();
      return;
    }
    if (a.mode === "move") {
      const dx = p.x - a.start.x,
        dy = p.y - a.start.y;
      const moved = a.snap.map((el) => {
        if (el.kind === "ink" || el.kind === "hl")
          return { ...el, pts: el.pts.map(([x, y]) => [x + dx, y + dy]) };
        if (el.kind === "shape")
          return { ...el, x: el.x + dx, y: el.y + dy, x2: el.x2 + dx, y2: el.y2 + dy };
        return { ...el, x: el.x + dx, y: el.y + dy };
      });
      const next = elsRef.current.map((el) => moved.find((m) => m.id === el.id) || el);
      setEls(next);
      elsRef.current = next;
      draw();
    }
  };

  const onUp = (e) => {
    const a = act.current;
    if (!a) return;
    act.current = null;

    if (a.mode === "draw") {
      // tidy: drop points that are closer than half a pixel
      const pts = a.el.pts.filter(
        (p, i, arr) => i === 0 || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 0.6,
      );
      a.el.pts = pts;
      const got = tool === "pen" && snap ? recognise(pts) : null;
      if (got) {
        const b = boundsOf([a.el]);
        const shapeEl = {
          id: uid(),
          kind: "shape",
          shape: got.kind,
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          x2: b.x + b.w / 2,
          y2: b.y + b.h / 2,
          color: colour,
          w: width,
        };
        if (
          got.kind === "rect" ||
          got.kind === "ellipse" ||
          got.kind === "triangle" ||
          got.kind === "diamond"
        ) {
          shapeEl.x = b.x;
          shapeEl.y = b.y;
          shapeEl.x2 = b.x + b.w;
          shapeEl.y2 = b.y + b.h;
        }
        setEls((l) => [...l.filter((x) => x.id !== a.el.id), shapeEl]);
        elsRef.current = [...elsRef.current.filter((x) => x.id !== a.el.id), shapeEl];
        notify({
          app: "Whiteboard",
          icon: "img/icon/board.png",
          title: `Snapped to a ${got.kind}`,
          body: "Turn off Shapes → Ink to shape in the toolbar to draw freehand.",
          kind: "info",
          life: 3,
        });
      } else {
        setEls((l) => l.map((x) => (x.id === a.el.id ? a.el : x)));
        elsRef.current = elsRef.current.map((x) => (x.id === a.el.id ? a.el : x));
      }
      push();
      return;
    }
    if (a.mode === "erase" || a.mode === "shape") {
      if (a.mode === "shape") {
        if (Math.hypot(a.el.x2 - a.el.x, a.el.y2 - a.el.y) < 4) {
          setEls((l) => l.filter((x) => x.id !== a.el.id));
          elsRef.current = elsRef.current.filter((x) => x.id !== a.el.id);
        } else {
          setEls((l) => [...l, a.el]);
          elsRef.current = [...elsRef.current, a.el];
        }
      }
      push();
      return;
    }
    if (a.mode === "lasso") {
      const b = (() => {
        const xs = a.pts.map((p) => p[0]),
          ys = a.pts.map((p) => p[1]);
        return {
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
        };
      })();
      const inside = elsRef.current.filter((el) => {
        const eb = boundsOf([el]);
        return (
          eb &&
          eb.x >= b.x - 6 &&
          eb.y >= b.y - 6 &&
          eb.x + eb.w <= b.x + b.w + 6 &&
          eb.y + eb.h <= b.y + b.h + 6
        );
      });
      setSel(inside.map((el) => el.id));
      if (!inside.length)
        notify({
          app: "Whiteboard",
          icon: "img/icon/board.png",
          title: "Nothing selected",
          body: "Drag the lasso all the way around the ink you want.",
          kind: "info",
          life: 3,
        });
      draw();
      return;
    }
    if (a.mode === "move") push();
  };

  /* ---------------- wheel: zoom + pan ---------------- */
  const onWheel = (e) => {
    e.preventDefault();
    const v = viewRef.current;
    const r = cv.current.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || tool === "zoom") {
      const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const k = Math.min(6, Math.max(0.15, v.k * f));
      const mx = e.clientX - r.left,
        my = e.clientY - r.top;
      setView({ k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k });
    } else {
      setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    }
  };

  /* ---------------- touch: pinch + two-finger pan ---------------- */
  useEffect(() => {
    const el = cv.current;
    if (!el) return;
    let last = null;
    const onTouch = (e) => {
      if (e.touches.length !== 2) {
        last = null;
        return;
      }
      e.preventDefault();
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const cx = (a.clientX + b.clientX) / 2,
        cy = (a.clientY + b.clientY) / 2;
      const v = viewRef.current;
      if (last) {
        const k = Math.min(6, Math.max(0.15, v.k * (d / last.d)));
        const r = el.getBoundingClientRect();
        const mx = cx - r.left,
          my = cy - r.top;
        setView({
          k,
          x: mx - ((mx - v.x) / v.k) * k + (cx - last.cx),
          y: my - ((my - v.y) / v.k) * k + (cy - last.cy),
        });
      }
      last = { d, cx, cy };
    };
    el.addEventListener("touchmove", onTouch, { passive: false });
    const onTouchEnd = () => (last = null);
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchmove", onTouch);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  /* ---------------- commands ---------------- */
  const deleteSel = () => {
    if (!sel.length) return;
    setEls((l) => l.filter((e) => !sel.includes(e.id)));
    elsRef.current = elsRef.current.filter((e) => !sel.includes(e.id));
    setSel([]);
    push();
  };

  const changeSel = (partial) => {
    if (!sel.length) return;
    const next = elsRef.current.map((e) => (sel.includes(e.id) ? { ...e, ...partial } : e));
    setEls(next);
    elsRef.current = next;
    push();
  };

  const clearBoard = async () => {
    const go = await wosConfirm("Clear the whole board? This can be undone with Ctrl+Z.", {
      title: "Whiteboard",
      okText: "Clear",
      danger: true,
    });
    if (!go) return;
    setEls([]);
    elsRef.current = [];
    setSel([]);
    push();
  };

  const resetView = () => {
    setView({ x: 0, y: 0, k: 1 });
    setSel([]);
  };

  const zoomBy = (f) => {
    const v = viewRef.current;
    const b = box.current?.getBoundingClientRect();
    const mx = (b?.width || 600) / 2,
      my = (b?.height || 400) / 2;
    const k = Math.min(6, Math.max(0.15, v.k * f));
    setView({ k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k });
  };

  const insertImage = async (file) => {
    if (!file) return;
    setBusy("Adding picture…");
    const dataUrl = await vs
      .blobToB64(file)
      .then((b) => `data:${file.type || "image/png"};base64,${b}`)
      .catch(() => null);
    setBusy("");
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 520 / img.naturalWidth);
      const v = viewRef.current;
      const b = box.current.getBoundingClientRect();
      const cx = (b.width / 2 - v.x) / v.k,
        cy = (b.height / 2 - v.y) / v.k;
      const el = {
        id: uid(),
        kind: "image",
        src: dataUrl,
        x: cx - (img.naturalWidth * k) / 2,
        y: cy - (img.naturalHeight * k) / 2,
        w: img.naturalWidth * k,
        h: img.naturalHeight * k,
      };
      setEls((l) => [...l, el]);
      elsRef.current = [...elsRef.current, el];
      push();
    };
    img.src = dataUrl;
  };

  const saveBoard = async () => {
    const name = await wosFileSave({ title: "Save board", value: "My board.wb.json" });
    if (name === null) return;
    const path = name;
    setBusy("Saving…");
    try {
      await vs.vsWrite(path, JSON.stringify({ els: strip(els), view, at: Date.now() }), {
        mime: "application/json",
      });
      notify({
        app: "Whiteboard",
        icon: "img/icon/board.png",
        title: "Board saved",
        body: path,
        kind: "success",
        life: 4,
      });
    } catch (e) {
      notify({
        app: "Whiteboard",
        icon: "img/icon/board.png",
        title: "Could not save the board",
        body: String(e?.message || e),
        kind: "error",
      });
    }
    setBusy("");
  };

  const exportPng = async () => {
    const list = strip(els);
    const b = boundsOf(list);
    if (!b) {
      notify({
        app: "Whiteboard",
        icon: "img/icon/board.png",
        title: "The board is empty",
        body: "Draw something first, then export it.",
        kind: "info",
      });
      return;
    }
    const pad = 28;
    const dpr = 2;
    const W = b.w + pad * 2,
      H = b.h + pad * 2;
    const c = document.createElement("canvas");
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);
    g.translate(-b.x + pad, -b.y + pad);

    // pictures may still be loading — wait for them once
    await Promise.all(
      list
        .filter((el) => el.kind === "image")
        .map(
          (el) =>
            new Promise((done) => {
              const img = new Image();
              img.onload = img.onerror = () => {
                el._img = img.complete && img.naturalWidth ? img : null;
                done();
              };
              img.src = el.src;
            }),
        ),
    );

    list.forEach((el) => {
      if (el.kind === "ink") drawInk(g, el);
      else if (el.kind === "hl") drawInk(g, { ...el, alpha: 0.4, w: el.w * 5, cap: "butt" });
      else if (el.kind === "shape") drawShape(g, el);
      else if (el.kind === "note") drawNote(g, el);
      else if (el.kind === "text") drawText(g, el);
      else if (el.kind === "ruler") drawRuler(g, el);
      else if (el.kind === "image" && el._img) g.drawImage(el._img, el.x, el.y, el.w, el.h);
    });

    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `whiteboard-${Date.now()}.png`;
    a.click();
    notify({
      app: "Whiteboard",
      icon: "img/icon/board.png",
      title: "Exported as a picture",
      body: a.download,
      kind: "success",
      life: 4,
    });
  };

  const addRuler = () => {
    const v = viewRef.current;
    const b = box.current.getBoundingClientRect();
    const el = {
      id: uid(),
      kind: "ruler",
      x: (b.width / 2 - v.x) / v.k,
      y: (b.height / 2 - v.y) / v.k,
      w: 340,
      h: 44,
      a: 0,
    };
    setEls((l) => [...l, el]);
    elsRef.current = [...elsRef.current, el];
    push();
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    if (!ownsKeyboard(wnapp, hz) || editing) return;
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const c = e.ctrlKey || e.metaKey;
      if (c) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (k === "y" || (k === "z" && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (k === "a") {
          e.preventDefault();
          setSel(elsRef.current.map((x) => x.id));
        } else if (k === "s") {
          e.preventDefault();
          saveBoard();
        } else if (k === "p") {
          e.preventDefault();
          setTool("pen");
        } else if (k === "h") {
          e.preventDefault();
          setTool("hl");
        } else if (k === "e") {
          e.preventDefault();
          setTool("eraser");
        } else if (k === "l") {
          e.preventDefault();
          setTool("lasso");
        } else if (k === "n") {
          e.preventDefault();
          setTool("note");
        } else if (k === "t") {
          e.preventDefault();
          setTool("text");
        } else if (k === "0") {
          e.preventDefault();
          resetView();
        } else if (k === "+" || k === "=") {
          e.preventDefault();
          zoomBy(1.2);
        } else if (k === "-") {
          e.preventDefault();
          zoomBy(1 / 1.2);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSel();
      } else if (e.key === "Escape") {
        setSel([]);
        setPicker(null);
      } else if (e.key === " ") {
        e.preventDefault();
        setTool((t) => (t === "pan" ? "pen" : "pan"));
      } else if (/^[1-9]$/.test(e.key)) setWidth(+e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wnapp.alive, wnapp.hide, sel, editing, tool, colour, width, snap, hz]);

  const editingEl = useMemo(() => els.find((e) => e.id === editing?.id), [els, editing]);
  const editBox = useMemo(() => {
    if (!editingEl) return null;
    const v = view;
    const left = editingEl.x * v.k + v.x;
    const top = editingEl.y * v.k + v.y;
    const w = (editingEl.w || 210) * v.k;
    return { left, top, width: w, height: (editingEl.h || 170) * v.k };
  }, [editingEl, view]);

  if (!wnapp.alive) return null;

  const TB = ({ id, title, onClick, children, on, danger }) => (
    <button
      type="button"
      className={`wbTool ${on ? "on" : ""} ${danger ? "danger" : ""}`}
      title={title}
      onClick={onClick}
      data-id={id}
    >
      {children}
    </button>
  );

  return (
    <div
      className="wbApp floatTab dpShad"
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
        name="Whiteboard"
        bg="#f4f5f7"
        noinvert
      />

      <div className="windowScreen" data-dock="true">
        {/* ------------------------- top bar ------------------------- */}
        <div className="wbTop">
          <div className="wbTopL">
            <img
              className="wbLogo"
              src="img/icon/board.png"
              alt=""
              onError={(e) => (e.target.style.display = "none")}
            />
            <div className="wbDoc">
              <b>Whiteboard</b>
              <span>
                {busy ||
                  (dirty ? "Saving…" : `Saved · ${els.length} item${els.length === 1 ? "" : "s"}`)}
              </span>
            </div>
          </div>
          <div className="wbTopR">
            <button
              type="button"
              className="wbChip"
              onClick={undo}
              disabled={hist.current.length < 2}
              title="Undo (Ctrl+Z)"
            >
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M6 5h5.5a3.2 3.2 0 0 1 0 6.4H8M6 5l2.4-2.4M6 5l2.4 2.4"
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
              className="wbChip"
              onClick={redo}
              disabled={!future.current.length}
              title="Redo (Ctrl+Y)"
            >
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M10 5H4.5a3.2 3.2 0 0 0 0 6.4H8M10 5L7.6 2.6M10 5L7.6 7.4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <i className="wbVr" />
            <button
              type="button"
              className="wbChip"
              onClick={() => zoomBy(1 / 1.2)}
              title="Zoom out (Ctrl+-)"
            >
              −
            </button>
            <span className="wbZoomLbl">{Math.round(view.k * 100)}%</span>
            <button
              type="button"
              className="wbChip"
              onClick={() => zoomBy(1.2)}
              title="Zoom in (Ctrl++)"
            >
              +
            </button>
            <button
              type="button"
              className="wbChip wide"
              onClick={resetView}
              title="Reset the view (Ctrl+0)"
            >
              Fit
            </button>
            <i className="wbVr" />
            <button
              type="button"
              className="wbChip wide"
              onClick={() => setGrid((g) => !g)}
              data-on={grid}
              title="Grid"
            >
              Grid
            </button>
            <button
              type="button"
              className="wbChip wide"
              onClick={saveBoard}
              title="Save a copy (Ctrl+S)"
            >
              Save
            </button>
            <button
              type="button"
              className="wbChip wide"
              onClick={exportPng}
              title="Export as a picture"
            >
              Export
            </button>
            <button
              type="button"
              className="wbChip wide danger"
              onClick={clearBoard}
              title="Clear the board"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ------------------------- canvas -------------------------- */}
        <div className="wbStage" ref={box}>
          <canvas
            ref={cv}
            className={`wbCanvas ${tool === "pan" ? "grab" : tool === "eraser" ? "erase" : "draw"}`}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onDown(e);
            }}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
            onDoubleClick={(e) => {
              const p = toBoard(e.clientX, e.clientY);
              const el = hit(p);
              if (el && (el.kind === "note" || el.kind === "text"))
                setEditing({ id: el.id, kind: el.kind, text: el.text || "" });
            }}
          />

          {editing && editBox ? (
            <textarea
              className={`wbEdit ${editing.kind}`}
              autoFocus
              style={{
                left: editBox.left,
                top: editBox.top,
                width: editBox.width,
                height: Math.max(editBox.height, 60),
                background: editing.kind === "note" ? editingEl?.color : "transparent",
                color: editing.kind === "note" ? "#2a2a2e" : colour,
                fontSize: (editing.kind === "note" ? 15 : editingEl?.size || 22) * view.k,
              }}
              defaultValue={editing.text}
              placeholder={editing.kind === "note" ? "Type your note…" : "Type here…"}
              onKeyDown={(e) => {
                if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              onBlur={(e) => {
                const text = e.currentTarget.value;
                setEls((l) =>
                  l
                    .filter((x) => x.id !== editing.id || text.trim())
                    .map((x) => (x.id === editing.id ? { ...x, text } : x)),
                );
                elsRef.current = elsRef.current
                  .filter((x) => x.id !== editing.id || text.trim())
                  .map((x) => (x.id === editing.id ? { ...x, text } : x));
                setEditing(null);
                push();
              }}
            />
          ) : null}

          {/* ---------------------- floating dock ---------------------- */}
          <div className="wbDock" onMouseDown={(e) => e.stopPropagation()}>
            <TB
              id="pan"
              title="Select & pan (Space)"
              on={tool === "pan"}
              onClick={() => setTool("pan")}
            >
              <svg viewBox="0 0 20 20" width="17" height="17">
                <path
                  d="M7.5 10V4.2a1.3 1.3 0 0 1 2.6 0V9m0-.6V3.4a1.3 1.3 0 0 1 2.6 0v5m0-.6V5a1.3 1.3 0 0 1 2.6 0v6.5c0 3-2 5.5-5 5.5s-4.4-1.6-5.4-3.6l-1.7-3.4a1.3 1.3 0 0 1 2.2-1.3L7.5 10z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            </TB>
            <TB
              id="lasso"
              title="Lasso select (Ctrl+L)"
              on={tool === "lasso"}
              onClick={() => setTool("lasso")}
            >
              <svg viewBox="0 0 20 20" width="17" height="17">
                <path
                  d="M4 8c0-3 2.7-5 6-5s6 2 6 5-2.7 5-6 5c-.7 0-1.4-.1-2-.3M4 8c0 2 1 3.6 2.6 4.5M8 18c1.6 0 2.6-.9 2.6-2 0-1.3-1.4-2-2.6-2-1 0-1.6-.4-1.6-1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </TB>
            <i className="wbDockDiv" />
            <div className="wbDockSlot">
              <TB
                id="pen"
                title={`Pen (Ctrl+P) · thickness ${width}`}
                on={tool === "pen"}
                onClick={() => {
                  setTool("pen");
                  setPicker("colour");
                }}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <path
                    d="M13.4 2.9l3.7 3.7L7.4 16.3l-4.6 1.2 1.2-4.6 9.4-10z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <path d="M11.6 4.7l3.7 3.7" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                <i className="wbDot" style={{ background: colour }} />
              </TB>
              <TB
                id="hl"
                title={`Highlighter (Ctrl+H)`}
                on={tool === "hl"}
                onClick={() => {
                  setTool("hl");
                  setPicker("hl");
                }}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <path
                    d="M6 12.5l5.5-8 3.5 2.4L9.5 15H6v-2.5zM4.5 17.2h9"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <i className="wbDot" style={{ background: hl }} />
              </TB>
              <TB
                id="eraser"
                title="Eraser (Ctrl+E)"
                on={tool === "eraser"}
                onClick={() => {
                  setTool("eraser");
                  setPicker(null);
                }}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <path
                    d="M8 16.5H4.5L2.8 14.8 10 7.6l4.6 4.6-4 4.3H8zM11.5 6.1l2.4-2.4 4.6 4.6-2.4 2.4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              </TB>
            </div>
            <i className="wbDockDiv" />
            <div className="wbDockSlot">
              <TB
                id="shape"
                title="Shapes"
                on={tool === "shape"}
                onClick={() => {
                  setTool("shape");
                  setPicker("shape");
                }}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <rect
                    x="2.4"
                    y="2.4"
                    width="7.4"
                    height="7.4"
                    rx="1.2"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <circle
                    cx="13.6"
                    cy="6.1"
                    r="3.9"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <path
                    d="M6.2 17.6L2.6 11.6h7.2L6.2 17.6z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11.4 17.4h6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </TB>
              <TB
                id="note"
                title="Sticky note (Ctrl+N)"
                on={tool === "note"}
                onClick={() => setTool("note")}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <path
                    d="M3.5 3.5h13v9l-4 4h-9v-13z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16.5 12.5h-4v4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              </TB>
              <TB
                id="text"
                title="Text (Ctrl+T)"
                on={tool === "text"}
                onClick={() => setTool("text")}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <path
                    d="M4 4.5h12M10 4.5v11M7.5 15.5h5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </TB>
              <TB
                id="image"
                title="Insert a picture"
                on={false}
                onClick={() => fileRef.current?.click()}
              >
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <rect
                    x="2.6"
                    y="4.2"
                    width="14.8"
                    height="11.6"
                    rx="1.6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <circle
                    cx="7"
                    cy="8.4"
                    r="1.6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill="none"
                  />
                  <path
                    d="M3.4 14.6l4-3.6 3 2.6 2.4-2 3.8 3.4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </TB>
              <TB id="ruler" title="Ruler" on={false} onClick={addRuler}>
                <svg viewBox="0 0 20 20" width="17" height="17">
                  <rect
                    x="2"
                    y="7"
                    width="16"
                    height="6"
                    rx="1.2"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                  <path
                    d="M5.5 13V9.8M8.5 13v-2M11.5 13V9.8M14.5 13v-2"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </TB>
            </div>
            <i className="wbDockDiv" />
            <TB id="del" title="Delete the selection (Del)" on={false} danger onClick={deleteSel}>
              <svg viewBox="0 0 20 20" width="17" height="17">
                <path
                  d="M3.5 5.5h13M7.5 5.5V3.6h5v1.9M5.5 5.5l.9 11h7.2l.9-11M8.4 8.4v5.4M11.6 8.4v5.4"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </TB>

            {/* --------------------- popovers --------------------- */}
            {picker === "colour" ? (
              <div className="wbPop">
                <div className="wbPopHead">Pen colour · Shift-click for the highlighter</div>
                <div className="wbSwatches">
                  {PEN_COLOURS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`wbSw ${colour === p.c ? "on" : ""}`}
                      style={{ background: p.c }}
                      title={p.n}
                      onClick={() => {
                        setColour(p.c);
                        setTool("pen");
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setHl(p.c);
                        setTool("hl");
                      }}
                    />
                  ))}
                </div>
                <div className="wbPopRow">
                  <span>Thickness</span>
                  <input
                    type="range"
                    min="1"
                    max="18"
                    value={width}
                    onChange={(e) => setWidth(+e.target.value)}
                  />
                  <b>{width}</b>
                </div>
                <label className="wbCheck">
                  <input
                    type="checkbox"
                    checked={snap}
                    onChange={(e) => setSnap(e.target.checked)}
                  />
                  <span>
                    Shapes · Ink to shape — draw a rectangle, circle, line or arrow and it snaps
                  </span>
                </label>
              </div>
            ) : null}

            {picker === "hl" ? (
              <div className="wbPop">
                <div className="wbPopHead">Highlighter</div>
                <div className="wbSwatches">
                  {HL_COLOURS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`wbSw ${hl === c ? "on" : ""}`}
                      style={{ background: c }}
                      title={c}
                      onClick={() => {
                        setHl(c);
                        setTool("hl");
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {picker === "shape" ? (
              <div className="wbPop">
                <div className="wbPopHead">Shapes · hold Shift for even proportions</div>
                <div className="wbShapeGrid">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`wbShape ${shape === s.id ? "on" : ""}`}
                      title={s.n}
                      onClick={() => {
                        setShape(s.id);
                        setTool("shape");
                      }}
                    >
                      <svg viewBox="0 0 20 20" width="20" height="20">
                        {s.svg}
                      </svg>
                    </button>
                  ))}
                </div>
                <div className="wbSwatches">
                  {PEN_COLOURS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`wbSw ${colour === p.c ? "on" : ""}`}
                      style={{ background: p.c }}
                      title={p.n}
                      onClick={() => setColour(p.c)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* note colour popover */}
          {tool === "note" ? (
            <div className="wbNotePop">
              {NOTE_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`wbSw ${note === c ? "on" : ""}`}
                  style={{ background: c }}
                  title="Sticky note colour"
                  onClick={() => setNote(c)}
                />
              ))}
              <span>Click the board to drop a note</span>
            </div>
          ) : null}

          {/* selection toolbar */}
          {sel.length ? (
            <div className="wbSelBar">
              <span className="wbSelN">{sel.length} selected</span>
              <div className="wbSwatches sm">
                {PEN_COLOURS.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="wbSw"
                    style={{ background: p.c }}
                    title={`Recolour to ${p.n}`}
                    onClick={() => changeSel({ color: p.c })}
                  />
                ))}
              </div>
              {sel.some((id) => els.find((e) => e.id === id)?.kind === "note") ? (
                <div className="wbSwatches sm">
                  {NOTE_COLOURS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="wbSw"
                      style={{ background: c }}
                      title="Note colour"
                      onClick={() => changeSel({ color: c })}
                    />
                  ))}
                </div>
              ) : null}
              <WosSelect
                value={String(width)}
                onChange={(v) => changeSel({ w: +v })}
                options={[1, 2, 3, 4, 6, 8, 12, 18].map((n) => ({
                  value: String(n),
                  label: `${n}px`,
                }))}
                className="wbSelW"
              />
              <button type="button" className="wbChip danger" onClick={deleteSel}>
                Delete
              </button>
              <button type="button" className="wbChip" onClick={() => setSel([])}>
                Clear selection
              </button>
            </div>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              insertImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default WhiteBoard;

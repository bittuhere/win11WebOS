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
import { idb } from "../../../utils/idb";
import { notify } from "../../../utils/os/ui";
import "./minesweeper.scss";

/*
 * Minesweeper — the one everyone actually opens. Windows 11 dressing:
 * fluent tiles, live counters, first-click-is-never-a-mine, chording,
 * flags, and best times kept in IndexedDB per difficulty.
 */

const LEVELS = {
  Beginner: { c: 9, r: 9, m: 10 },
  Intermediate: { c: 16, r: 16, m: 40 },
  Expert: { c: 30, r: 16, m: 99 },
};
const NUM_COLORS = [
  "",
  "#1976d2",
  "#388e3c",
  "#d32f2f",
  "#7b1fa2",
  "#ff8f00",
  "#0097a7",
  "#424242",
  "#757575",
];

const makeBoard = (c, r, m) => ({
  c,
  r,
  m,
  cells: Array.from({ length: c * r }, () => ({ mine: false, open: false, flag: 0, n: 0 })), // flag: 0 none 1 flag 2 ?
  started: false,
  dead: false,
  won: false,
});

const neighbours = (b, i) => {
  const x = i % b.c,
    y = Math.floor(i / b.c);
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx,
        ny = y + dy;
      if (nx >= 0 && nx < b.c && ny >= 0 && ny < b.r) out.push(ny * b.c + nx);
    }
  return out;
};

const placeMines = (b, safe) => {
  const banned = new Set([safe, ...neighbours(b, safe)]);
  let placed = 0;
  while (placed < b.m) {
    const i = Math.floor(Math.random() * b.cells.length);
    if (b.cells[i].mine || banned.has(i)) continue;
    b.cells[i].mine = true;
    placed++;
  }
  b.cells.forEach((cell, i) => {
    cell.n = neighbours(b, i).filter((j) => b.cells[j].mine).length;
  });
  b.started = true;
};

export const MineApp = () => {
  const wnapp = useSelector((s) => s.apps.mine);
  const [level, setLevel] = useState("Beginner");
  const [b, setB] = useState(() => makeBoard(9, 9, 10));
  const [t, setT] = useState(0);
  const [best, setBest] = useState({});
  const tick = useRef(null);

  useEffect(() => {
    idb
      .get("minesweeper.best")
      .then((x) => x && setBest(x))
      .catch(() => {});
  }, []);

  const start = useCallback((lv) => {
    const L = LEVELS[lv];
    setLevel(lv);
    setB(makeBoard(L.c, L.r, L.m));
    setT(0);
    clearInterval(tick.current);
  }, []);

  useEffect(() => () => clearInterval(tick.current), []);

  const finish = async (won, secs) => {
    clearInterval(tick.current);
    if (won) {
      const prev = best[level];
      if (!prev || secs < prev) {
        const next = { ...best, [level]: secs };
        setBest(next);
        idb.set("minesweeper.best", next).catch(() => {});
        notify({
          app: "Minesweeper",
          icon: "img/icon/mine.png",
          title: `New ${level} record!`,
          body: `Cleared in ${secs}s`,
          kind: "success",
          life: 6,
        });
      } else {
        notify({
          app: "Minesweeper",
          icon: "img/icon/mine.png",
          title: "Board cleared 🎉",
          body: `${secs}s — best is ${prev}s`,
          kind: "success",
        });
      }
    }
  };

  const openCell = (bd, i) => {
    const stack = [i];
    while (stack.length) {
      const k = stack.pop();
      const cell = bd.cells[k];
      if (cell.open || cell.flag === 1) continue;
      cell.open = true;
      if (cell.n === 0 && !cell.mine)
        neighbours(bd, k).forEach((j) => !bd.cells[j].open && stack.push(j));
    }
  };

  const click = (i) => {
    if (b.dead || b.won) return;
    const bd = { ...b, cells: b.cells.map((c) => ({ ...c })) };
    if (!bd.started) {
      placeMines(bd, i);
      clearInterval(tick.current);
      tick.current = setInterval(() => setT((x) => x + 1), 1000);
    }
    const cell = bd.cells[i];
    if (cell.flag === 1 || cell.open) return;
    if (cell.mine) {
      cell.open = true;
      bd.dead = true;
      bd.cells.forEach((c) => c.mine && (c.open = true));
      setB(bd);
      clearInterval(tick.current);
      notify({
        app: "Minesweeper",
        icon: "img/icon/mine.png",
        title: "Boom 💥",
        body: "Click the smiley for a fresh board.",
        kind: "error",
      });
      return;
    }
    openCell(bd, i);
    const closed = bd.cells.filter((c) => !c.open).length;
    if (closed === bd.m) {
      bd.won = true;
      bd.cells.forEach((c) => c.mine && (c.flag = 1));
      setB(bd);
      finish(true, t);
      return;
    }
    setB(bd);
  };

  const chord = (i) => {
    if (b.dead || b.won || !b.cells[i].open || !b.cells[i].n) return;
    const nb = neighbours(b, i);
    const flags = nb.filter((j) => b.cells[j].flag === 1).length;
    if (flags !== b.cells[i].n) return;
    const bd = { ...b, cells: b.cells.map((c) => ({ ...c })) };
    let boom = false;
    nb.forEach((j) => {
      const c = bd.cells[j];
      if (c.flag === 1 || c.open) return;
      if (c.mine) boom = true;
      openCell(bd, j);
    });
    if (boom) {
      bd.dead = true;
      bd.cells.forEach((c) => c.mine && (c.open = true));
      setB(bd);
      clearInterval(tick.current);
      return;
    }
    const closed = bd.cells.filter((c) => !c.open).length;
    setB(bd);
    if (closed === bd.m) {
      bd.won = true;
      finish(true, t);
    }
  };

  const flag = (e, i) => {
    e.preventDefault();
    if (b.dead || b.won || b.cells[i].open) return;
    const bd = { ...b, cells: b.cells.map((c) => ({ ...c })) };
    bd.cells[i].flag = (bd.cells[i].flag + 1) % 3; // none -> flag -> ? -> none
    setB(bd);
  };

  const flagsLeft = b.m - b.cells.filter((c) => c.flag === 1).length;
  const face = b.dead ? "😵" : b.won ? "😎" : "🙂";

  if (!wnapp || !wnapp.alive) return null;

  return (
    <div
      className="floatTab dpShad extraApp mineApp"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Minesweeper" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow overflow-hidden extraFill">
          <div className="mineWrap">
            <div className="mineBar">
              <div className="mineLcd">🚩 {String(flagsLeft).padStart(2, "0")}</div>
              <button
                type="button"
                className="mineFace"
                title="New game"
                onClick={() => start(level)}
              >
                {face}
              </button>
              <div className="mineLcd">⏱ {String(t).padStart(3, "0")}</div>
            </div>
            <div className="mineBar mineBar2">
              {Object.keys(LEVELS).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  className={`winBtn ghost ${level === lv ? "on" : ""}`}
                  onClick={() => start(lv)}
                >
                  {lv}
                </button>
              ))}
              {best[level] ? <span className="mineBest">best {best[level]}s</span> : null}
            </div>
            <div
              className={`mineBoard ${b.dead ? "dead" : ""} ${b.won ? "won" : ""}`}
              style={{ "--mc": b.c }}
            >
              {b.cells.map((cell, i) => (
                <button
                  key={i}
                  type="button"
                  className={[
                    "mineCell",
                    cell.open ? "open" : "",
                    cell.flag === 1 && !cell.open ? "flag" : "",
                    cell.flag === 2 && !cell.open ? "maybe" : "",
                    cell.open && cell.mine ? "boom" : "",
                  ].join(" ")}
                  style={{
                    color: cell.open && !cell.mine && cell.n ? NUM_COLORS[cell.n] : undefined,
                  }}
                  onClick={() => click(i)}
                  onContextMenu={(e) => flag(e, i)}
                  onDoubleClick={() => chord(i)}
                >
                  {cell.open
                    ? cell.mine
                      ? "💣"
                      : cell.n || ""
                    : cell.flag === 1
                      ? "🚩"
                      : cell.flag === 2
                        ? "?"
                        : ""}
                </button>
              ))}
            </div>
            <div className="mineHint">
              left-click reveals · right-click cycles flag · double-click a number to chord
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

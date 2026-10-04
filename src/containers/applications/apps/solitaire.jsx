/*
 * Copyright 2026 bittuhere (anurag670singh@gmail.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ================================================================
   Solitaire — Klondike for Windows 11 WebOS.

   The game is the vendored engine in ./solitaire-aashish (MIT, © 2025
   Aashish Chakravarty): real rules, scoring + high score, multi-level undo,
   hints, auto-complete, animated moves, save/resume, and drag *or*
   double-click *or* click-to-move.

   This component is the Win11 host:
     • the window chrome and the action bar (the engine has no UI of its own),
     • sizing: it measures the window and hands the engine a card geometry
       (--card-width / --card-height / --board-gap / --stack-offset) so the
       board fits without any CSS transform — cards stay pixel-crisp and the
       engine's `position: fixed` animation clones stay anchored correctly,
     • mount/unmount: the engine is created when the window opens and fully
       torn down when it closes (listeners + timers), so re-opening is clean,
     • the win overlay and the per-PC tally.
   ================================================================ */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { createSolitaire } from "./solitaire-aashish/engine";
import "./solitaire-aashish/engine.css";
import "./solitaire.scss";

const BOARD_COLS = 7;
const MIN_CARD_W = 56;
const MAX_CARD_W = 132;

export const SolitaireApp = () => {
  const wnapp = useSelector((state) => state.apps.solitaire);
  const theme = useSelector((state) => state.setting.person.theme);

  const wrapRef = useRef(null); // measured; the engine builds its board here
  const gameRef = useRef(null); // the engine handle

  const [geom, setGeom] = useState({ cardW: 100, cardH: 140, gap: 15, stack: 30 });
  const [state, setState] = useState({
    score: 0,
    highScore: 0,
    moves: 0,
    canUndo: false,
    canAutoComplete: false,
    drawCount: 1,
    wins: 0,
    played: 0,
  });
  const [won, setWon] = useState(null); // { score, moves }
  const [noHint, setNoHint] = useState(false);

  /* ---------------- fit the board to the window ---------------- */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const measure = () => {
      const w = wrap.clientWidth || 900;
      const h = wrap.clientHeight || 520;
      /* pick the card size that fits seven columns plus the gaps, and leaves
         room for a four/five-row tableau before it has to scroll */
      let cardW = Math.floor((w - 40) / BOARD_COLS) - 12;
      cardW = Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, cardW));
      const gap = Math.max(8, Math.round(cardW * 0.14));
      const withGaps = cardW * BOARD_COLS + gap * (BOARD_COLS - 1) + 40;
      if (withGaps > w)
        cardW = Math.max(MIN_CARD_W, Math.floor((w - 40 - gap * (BOARD_COLS - 1)) / BOARD_COLS));
      const cardH = Math.round(cardW * 1.4);
      /* a tableau stack of ~14 cards should still leave the board usable */
      const stack = Math.max(12, Math.round(Math.min(cardH * 0.22, (h - cardH - 110) / 8)));
      setGeom({ cardW, cardH, gap, stack });
    };

    measure();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(wrap);
    } else {
      window.addEventListener("resize", measure);
    }
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [wnapp?.alive]);

  /* ---------------- engine lifecycle ---------------- */
  useEffect(() => {
    const root = wrapRef.current;
    if (!root || !wnapp?.alive) return;

    const game = createSolitaire(root, {
      onState: (s) => setState(s),
      onWin: (info) => setWon(info),
    });
    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, [wnapp?.alive]);

  /* ---------------- actions ---------------- */
  const act = useCallback(
    (fn) => () => {
      const g = gameRef.current;
      if (g) fn(g);
    },
    [],
  );

  const newGame = act((g) => {
    setWon(null);
    g.newGame();
  });
  const restart = act((g) => {
    setWon(null);
    g.restart();
  });
  const undo = act((g) => g.undo());
  const autoComplete = act((g) => g.autoComplete());
  const pickDraw = useCallback((n) => {
    const g = gameRef.current;
    if (g) g.setDraw(n);
  }, []);
  const hint = act((g) => {
    const ok = g.hint();
    if (!ok) {
      setNoHint(true);
      setTimeout(() => setNoHint(false), 1200);
    }
  });

  if (!wnapp || !wnapp.alive) return null;

  const geomStyle = {
    "--card-width": `${geom.cardW}px`,
    "--card-height": `${geom.cardH}px`,
    "--board-gap": `${geom.gap}px`,
    "--stack-offset": `${geom.stack}px`,
  };

  return (
    <div
      className="floatTab dpShad solitaireWin"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
      data-theme={theme}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Solitaire" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow overflow-hidden solFill" style={geomStyle}>
          <div className="solBar">
            <button type="button" className="solBtn" onClick={newGame} title="Deal a fresh game">
              New game
            </button>
            <button
              type="button"
              className="solBtn"
              onClick={restart}
              title="Replay this same deal"
            >
              Restart
            </button>
            <button
              type="button"
              className="solBtn"
              onClick={undo}
              disabled={!state.canUndo}
              title="Undo the last move"
            >
              ↶
            </button>
            <button
              type="button"
              className={`solBtn${noHint ? " warn" : ""}`}
              onClick={hint}
              title="Show a possible move (costs 5 points)"
            >
              {noHint ? "No moves" : "💡 Hint"}
            </button>
            {state.canAutoComplete && !won ? (
              <button
                type="button"
                className="solBtn accent"
                onClick={autoComplete}
                title="Send every card home"
              >
                Auto-complete
              </button>
            ) : null}
            <div className="solDrawTog" title="Cards turned over per stock flip">
              <button
                type="button"
                className={`solBtn ${state.drawCount === 1 ? "on" : ""}`}
                onClick={() => pickDraw(1)}
              >
                Draw 1
              </button>
              <button
                type="button"
                className={`solBtn ${state.drawCount === 3 ? "on" : ""}`}
                onClick={() => pickDraw(3)}
              >
                Draw 3
              </button>
            </div>
            <div className="solMeta">
              <span>{state.moves} moves</span>
              <span className="solStats" title="Score and best score on this PC">
                Score {state.score} · Best {state.highScore}
              </span>
              <span className="solStats" title="Games won / games started on this PC">
                W {state.wins}/{state.played}
              </span>
            </div>
          </div>

          {/* the engine builds its board inside this element */}
          <div
            className="solAash"
            ref={wrapRef}
            data-theme={theme}
            aria-label="Klondike solitaire board"
          />

          {won ? (
            <div className="solToast" data-win="true" role="status">
              <div>
                <b>You win!</b> All 52 cards home — score {won.score} in {won.moves} moves.
              </div>
              <button type="button" className="solBtn" onClick={newGame}>
                Play again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SolitaireApp;

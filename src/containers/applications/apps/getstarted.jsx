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

import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb } from "../../../utils/idb";
import { changeTheme } from "../../../actions";
import "./assets/getstarted.scss"; // was orphaned — the file styled this app but nothing imported it

/*
 * Get Started — a real interactive tour. Every card performs an actual
 * action on this PC (opens the app, flips the theme, snaps a window…)
 * and ticks itself off. Progress persists in the Virtual Storage.
 * No placeholders: if a card is here, it works.
 */

const DONE_KEY = "getstarted.done.v1";

export const Getstarted = () => {
  const wnapp = useSelector((state) => state.apps.getstarted);
  const dispatch = useDispatch();
  const person = useSelector((state) => state.setting.person.name);
  const theme = useSelector((state) => state.setting.person.theme);

  const [done, setDone] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    idb
      .get(DONE_KEY)
      .then((v) => setDone(v || {}))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const mark = async (id) => {
    if (done[id]) return;
    const next = { ...done, [id]: Date.now() };
    setDone(next);
    idb.set(DONE_KEY, next).catch(() => {});
  };

  const cards = [
    {
      id: "personalize",
      icon: "🎨",
      title: "Make this PC yours",
      desc: "Pick your wallpaper, colours and theme in Settings.",
      btn: "Open Settings",
      run: () => dispatch({ type: "SETTINGS", payload: "full" }),
    },
    {
      id: "theme",
      icon: "🌗",
      title: "Dark or light?",
      desc: "Flip the whole desktop between light and dark, right now.",
      btn: () => `Switch to ${theme === "dark" ? "light" : "dark"}`,
      run: () => changeTheme(),
    },
    {
      id: "start",
      icon: "🪟",
      title: "Meet your Start menu",
      desc: "All your apps, pinned and ready. Search finds any app instantly.",
      btn: "Open Start",
      run: () => dispatch({ type: "STARTOGG" }),
    },
    {
      id: "store",
      icon: "🛍️",
      title: "Get more apps",
      desc: "The Store has hundreds of real apps and games, one click away.",
      btn: "Open Store",
      run: () => dispatch({ type: "WNSTORE", payload: "full" }),
    },
    {
      id: "snip",
      icon: "✂️",
      title: "Take your first snip",
      desc: "The Snipping Tool saves straight into your Pictures folder.",
      btn: "Open Snipping Tool",
      run: () => dispatch({ type: "SNIPPING", payload: "full" }),
    },
    {
      id: "terminal",
      icon: "⌨️",
      title: "Talk to your PC",
      desc: "36 real commands — try neofetch, calc or weather Patna.",
      btn: "Open Terminal",
      run: () => dispatch({ type: "OPENTERM", payload: null }),
    },
    {
      id: "edge",
      icon: "🌐",
      title: "Browse the real web",
      desc: "Edge starts on Google — tabs, history and reader view included.",
      btn: "Open Edge",
      run: () => dispatch({ type: "EDGE", payload: "full" }),
    },
    {
      id: "help",
      icon: "❓",
      title: "Get help anytime",
      desc: "The Help app answers the common questions, and you can email me.",
      btn: "Open Help",
      run: () => dispatch({ type: "HELPAPP", payload: "full" }),
    },
  ];

  const total = cards.length;
  const count = cards.filter((c) => done[c.id]).length;

  return (
    <div
      className="getstarted floatTab dpShad gsApp"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Get Started" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow flex flex-col">
          <div className="gsWrap win11Scroll">
            <div className="gsHead">
              <div className="gsHello">Welcome{person ? `, ${person}` : ""} 👋</div>
              <h1>Get started with Windows 11 WebOS</h1>
              <p>
                Eight things worth trying once — every button here really does the thing. Your
                progress saves on this PC.
              </p>
              <div className="gsProgress">
                <div className="gsProgressBar">
                  <i style={{ width: `${Math.round((count / total) * 100)}%` }} />
                </div>
                <span>
                  {count} of {total} tried
                </span>
              </div>
            </div>
            <div className="gsGrid">
              {cards.map((c, i) => {
                const isDone = !!done[c.id];
                const label = typeof c.btn === "function" ? c.btn() : c.btn;
                return (
                  <div
                    key={c.id}
                    className={`gsCard ${isDone ? "done" : ""}`}
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <div className="gsCardTop">
                      <span className="gsIcon">{c.icon}</span>
                      {isDone && <span className="gsCheck">✓</span>}
                    </div>
                    <b>{c.title}</b>
                    <p>{c.desc}</p>
                    <button
                      type="button"
                      className="winBtn"
                      onClick={() => {
                        c.run();
                        mark(c.id);
                      }}
                    >
                      {label}
                    </button>
                  </div>
                );
              })}
            </div>
            {ready && count === total && (
              <div className="gsDone">
                🎉 That's everything — this PC is yours now. Tips has the deeper tour.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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
import { ToolBar, Icon } from "../../../utils/general";
import { notify } from "../../../utils/os/ui";
import { getUserName } from "../../../utils/os/vs";
import "./assets/taskmanager.scss";

/*
 * The real Task Manager. The Processes tab lists the windows that are
 * actually open (alive in the window store) with stable, drifting stats —
 * and End task genuinely closes the window. Performance draws live CPU and
 * memory graphs (memory is real in Chromium via performance.memory).
 */

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const seedStats = (name) => ({
  cpu: 0.3 + hash(name) * 6,
  mem: 60 + hash(name + "m") * 380,
  disk: hash(name + "d") * 1.4,
  net: hash(name + "n") * 0.8,
  gpu: hash(name + "g") * 4,
  power: ["Very low", "Low", "Moderate", "High"][Math.floor(hash(name + "p") * 4)],
});

export const Taskmanager = () => {
  const wnapp = useSelector((state) => state.apps.taskmanager);
  const apps = useSelector((state) => state.apps);
  const dispatch = useDispatch();

  const [tab, setTab] = useState("Processes");
  const [nav, setNav] = useState("open");
  const [tickN, setTickN] = useState(0);
  const [drift, setDrift] = useState({});
  const [cpuHist, setCpuHist] = useState(Array(60).fill(8));
  const [memHist, setMemHist] = useState(Array(60).fill(30));
  const [picked, setPicked] = useState(null);
  const t0 = useRef(Date.now());
  const cpuRef = useRef(null);
  const memRef = useRef(null);

  /* live sampling */
  useEffect(() => {
    const t = setInterval(() => {
      setTickN((n) => n + 1);
      const mem = performance?.memory
        ? performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
        : 0.3 + Math.sin(Date.now() / 9000) * 0.12;
      setMemHist((h) => [...h.slice(1), Math.round(mem * 100)]);
      setCpuHist((h) => {
        const last = h[h.length - 1];
        const target = Math.min(96, Math.max(3, mem * 70 + 6));
        const next = last + (target - last) * 0.25 + (Math.random() - 0.5) * 9;
        return [...h.slice(1), Math.round(Math.min(99, Math.max(2, next)))];
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* the windows that are actually alive */
  const procs = useMemo(() => {
    return Object.keys(apps)
      .filter((k) => apps[k] && apps[k].action && apps[k].alive)
      .map((k) => {
        const a = apps[k];
        const base = drift[a.icon] || seedStats(a.name || k);
        const wob = (Math.sin((tickN + hash(a.icon) * 97) / 6) + 1) / 2;
        return {
          key: k,
          name: a.name || k,
          icon: a.icon,
          action: a.action,
          cpu: Math.max(0, base.cpu * (0.55 + wob * 0.7)),
          mem: base.mem * (0.9 + wob * 0.12),
          disk: base.disk * wob,
          net: base.net * wob,
          gpu: base.gpu * wob,
          power: base.power,
          hwnd: a.hwnd,
        };
      })
      .sort((x, y) => y.cpu - x.cpu);
  }, [apps, tickN, drift]);

  /* seed the drift table once per process */
  useEffect(() => {
    setDrift((d) => {
      let changed = false;
      const next = { ...d };
      procs.forEach((p) => {
        if (!next[p.icon]) {
          next[p.icon] = seedStats(p.name);
          changed = true;
        }
      });
      return changed ? next : d;
    });
  }, [procs]);

  const drawGraph = (canvas, data, colour) => {
    if (!canvas) return;
    const g = canvas.getContext("2d");
    const W = (canvas.width = canvas.clientWidth * 2);
    const H = (canvas.height = canvas.clientHeight * 2);
    g.clearRect(0, 0, W, H);
    // grid
    g.strokeStyle = "rgba(128,128,128,0.25)";
    g.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(0, (H / 5) * i);
      g.lineTo(W, (H / 5) * i);
      g.stroke();
    }
    for (let i = 1; i < 6; i++) {
      g.beginPath();
      g.moveTo((W / 6) * i, 0);
      g.lineTo((W / 6) * i, H);
      g.stroke();
    }
    // the line
    g.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - (v / 100) * H;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.strokeStyle = colour;
    g.lineWidth = 2.4;
    g.stroke();
    // fill under
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.closePath();
    g.fillStyle = colour + "22";
    g.fill();
  };

  useEffect(() => {
    drawGraph(cpuRef.current, cpuHist, "#0078d4");
    drawGraph(memRef.current, memHist, "#8764b8");
  }, [cpuHist, memHist]);

  if (!wnapp) return null;

  const totalCpu = Math.round(procs.reduce((a, p) => a + p.cpu, 0));
  const uptimeS = Math.floor((Date.now() - t0.current) / 1000);

  const endTask = (p) => {
    dispatch({ type: p.action, payload: "close" });
    setPicked(null);
    notify({
      app: "Task Manager",
      icon: "img/icon/taskmanager.png",
      title: "Task ended",
      body: `${p.name} was closed.`,
      kind: "info",
      life: 3,
    });
  };

  return (
    <div
      className="taskmanagerApp floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{
        ...(wnapp.size == "cstm" ? wnapp.dim : null),
        zIndex: wnapp.z,
      }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Task Manager" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow flex flex-col">
          <nav className={nav}>
            {[
              { title: "Processes", icon: "faTableCellsLarge" },
              { title: "Performance", icon: "faWaveSquare" },
              { title: "Details", icon: "faList" },
            ].map((t, i) => (
              <div
                key={i}
                className={`navLink ${t.title === tab ? "selected" : ""}`}
                onClick={() => setTab(t.title)}
              >
                <Icon className="mx-2" fafa={t.icon} />
                <span className="tabName">{t.title}</span>
              </div>
            ))}
            <div className="marker"></div>
          </nav>
          <main className="win11Scroll">
            {tab === "Processes" ? (
              <div className="Processes">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>
                        {totalCpu.toFixed(0)}%<br />
                        <small>CPU</small>
                      </th>
                      <th>
                        {procs.length}
                        <br />
                        <small>Windows</small>
                      </th>
                      <th>
                        <br />
                        <small>Disk</small>
                      </th>
                      <th>
                        <br />
                        <small>Network</small>
                      </th>
                      <th>
                        <br />
                        <small>GPU</small>
                      </th>
                      <th>
                        <br />
                        <small>Power usage</small>
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {procs.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: 24, opacity: 0.6 }}>
                          Nothing is running. Open an app and it shows up here — live.
                        </td>
                      </tr>
                    ) : (
                      procs.map((p) => (
                        <tr
                          key={p.key}
                          className={picked === p.key ? "picked" : ""}
                          onClick={() => setPicked(p.key)}
                          onDoubleClick={() => endTask(p)}
                        >
                          <td className="name">
                            <Icon
                              src={p.icon}
                              width={16}
                              style={{
                                marginRight: 8,
                                display: "inline-block",
                                verticalAlign: "-3px",
                              }}
                            />
                            {p.name}
                          </td>
                          <td>{p.cpu.toFixed(1)}%</td>
                          <td>{(p.mem / 1).toFixed(0)} MB</td>
                          <td>{p.disk.toFixed(2)} MB/s</td>
                          <td>{p.net.toFixed(2)} Mbps</td>
                          <td>{p.gpu.toFixed(1)}%</td>
                          <td>{p.power}</td>
                          <td>
                            <button
                              type="button"
                              className="tmEnd"
                              title="End task"
                              onClick={(e) => {
                                e.stopPropagation();
                                endTask(p);
                              }}
                            >
                              End task
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : tab === "Performance" ? (
              <div className="tmPerf">
                <div className="tmCard">
                  <div className="tmCardHead">
                    <b>CPU</b>
                    <span>
                      {cpuHist[cpuHist.length - 1]}% · {procs.length} windows · up {fmtUp(uptimeS)}
                    </span>
                  </div>
                  <canvas ref={cpuRef} className="tmGraph" />
                </div>
                <div className="tmCard">
                  <div className="tmCardHead">
                    <b>Memory</b>
                    <span>
                      {memHist[memHist.length - 1]}% of the browser heap
                      {performance?.memory
                        ? ` (${fmtMB(performance.memory.usedJSHeapSize)} used)`
                        : ""}
                    </span>
                  </div>
                  <canvas ref={memRef} className="tmGraph" />
                </div>
                <div className="tmFoot winMuted">
                  Memory is real (Chromium heap). CPU blends heap pressure with window activity — a
                  browser PC has no perf counters.
                </div>
              </div>
            ) : (
              <div className="tmDetails">
                <table>
                  <thead>
                    <tr>
                      <th>Window</th>
                      <th>State</th>
                      <th>Position</th>
                      <th>Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(apps)
                      .filter((k) => apps[k] && apps[k].action && apps[k].alive)
                      .map((k) => (
                        <tr key={k}>
                          <td className="name">{apps[k].name || k}</td>
                          <td>
                            {apps[k].hide ? "Minimised" : apps[k].max ? "Maximised" : "Custom"}
                          </td>
                          <td>
                            {apps[k].dim ? `${apps[k].dim.width} × ${apps[k].dim.height}` : "—"}
                          </td>
                          <td>#{apps[k].session || 1}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
          <div className="navMenuBtn" onClick={() => setNav(nav ? "" : "open")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 4h10M2 7h10M2 10h10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

const fmtUp = (s) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const fmtMB = (b) => `${(b / 1048576).toFixed(0)} MB`;

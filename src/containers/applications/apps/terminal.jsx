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

import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { installApp } from "../../../actions";
import {
  getUser,
  fsList,
  fsRead,
  fsWrite,
  fsEnsureDir,
  fsRm,
  joinPath,
  parentPath,
  idb,
} from "../../../utils/idb";
import * as vs from "../../../utils/os/vs";
import { changeTheme } from "../../../actions";

export const WnTerminal = () => {
  const wnapp = useSelector((state) => state.apps.terminal);
  const person = useSelector((state) => state.setting.person.name);
  const running = useSelector((state) => state.apps);
  const [user, setUser] = useState(person || "User");
  const [stack, setStack] = useState([]);
  const [pwd, setPwd] = useState("C:\\Users\\User");
  const [lastCmd, setLsc] = useState(0);
  const [wntitle, setWntitle] = useState("Terminal");
  const inited = useRef(false);
  const cmdHist = useRef([]); // every command typed this session
  const dispatch = useDispatch();

  useEffect(() => {
    getUser().then((u) => {
      const name = u?.username || person || "User";
      setUser(name);
      if (!inited.current) {
        setPwd(wnapp.dir || `C:\\Users\\${name}`);
        setStack([
          `Microsoft Windows [Version 10.0.22621.2428]`,
          `(c) Microsoft Corporation. All rights reserved.`,
          ``,
        ]);
        inited.current = true;
      }
    });
  }, [person]);

  let IpDetails = [];
  const getIPDetails = async () => {
    try {
      await fetch("https://ipapi.co/json")
        .then((response) => response.json())
        .then((data) => {
          IpDetails.push(data);
        });
    } catch (error) {
      IpDetails.push({
        ip: "__network_error",
        network: "__kindly check internet connection",
        city: "",
        region: "",
        org: "",
        postal: "",
      });
    }
  };

  const cmdTool = async (cmd) => {
    var tmpStack = [...stack];
    tmpStack.push(pwd + ">" + cmd);

    var raw = cmd.trim();
    var arr = raw.split(" ");
    var type = (arr[0] || "").trim().toLowerCase();
    var arg = arr.splice(1).join(" ").trim();
    if (raw && type !== "history") cmdHist.current.push(raw);

    const push = (...lines) => tmpStack.push(...lines);

    if (type == "echo") {
      const redir = arg.split(">");
      if (redir.length > 1) {
        /* trim first, then strip the quotes — `echo "hi" > f` used to leave a
           stray closing quote inside the file */
        const text = redir[0].trim().replace(/^"|"$/g, "");
        const file = redir.slice(1).join(">").replace(/^>/, "").trim().replace(/^"|"$/g, "");
        const path = joinPath(pwd, file);
        await fsWrite(path, text);
        push(`Wrote ${path}`);
      } else if (arg.length) push(arg);
      else push("ECHO is on.");
    } else if (type == "mkdir" || type == "md") {
      if (!arg) push("The syntax of the command is incorrect.");
      else {
        await fsEnsureDir(joinPath(pwd, arg));
        push(`Created directory ${arg}`);
      }
    } else if (type == "del" || type == "rm" || type == "erase") {
      if (!arg) push("The syntax of the command is incorrect.");
      else {
        await fsRm(joinPath(pwd, arg));
        push(`Deleted ${arg}`);
      }
    } else if (type == "install") {
      if (arg.length) {
        push("Installing app...");
        var parts = arg.split(" ");
        installApp({
          name: parts[0],
          icon: parts[2] || "img/icon/store.png",
          type: "app",
          data: { type: "IFrame", url: parts[1], invert: true },
        });
        push("App installed.");
      } else push("INSTALL <name> <url> [icon]");
    } else if (type == "cd") {
      if (!arg) push(pwd);
      else if (arg == ".") {
        /* stay */
      } else {
        /* an absolute path or a drive-relative jump is taken as given — the
           old join turned `cd C:\Users` into `C:\Users\Tester\C:\Users` */
        const raw = arg.replace(/^"|"$/g, "").trim();
        const isAbs = /^[a-z]:\\/i.test(raw) || /^[a-z]:$/i.test(raw) || raw.startsWith("\\");
        const next =
          raw == ".."
            ? parentPath(pwd)
            : isAbs
              ? raw.length === 2
                ? `${raw}\\`
                : raw
              : joinPath(pwd, raw);
        const rec = await fsRead(next);
        const kids = rec ? null : await fsList(next);
        if (rec && rec.type == "dir") setPwd(next);
        else if (next == "C:\\" || next == "C:") setPwd("C:\\");
        else if (kids && (rec || kids.length || arg == "..")) setPwd(next);
        else {
          await fsEnsureDir(next);
          setPwd(next);
        }
      }
    } else if (type == "dir" || type == "ls") {
      push(" Directory of " + pwd, "");
      push("<DIR>    .");
      push("<DIR>    ..");
      const tdir = await fsList(pwd);
      for (const f of tdir) {
        push((f.type == "dir" ? "<DIR>    " : "         ") + f.name);
      }
      if (!tdir.length) push("         (empty — try mkdir docs)");
    } else if (type == "type" || type == "cat") {
      if (!arg) push("The syntax of the command is incorrect.");
      else {
        const rec = await fsRead(joinPath(pwd, arg));
        if (!rec || rec.type != "file") push("The system cannot find the file specified.");
        else push(...String(rec.content || "").split("\n"));
      }
    } else if (type == "cls") {
      tmpStack = [];
    } else if (type == "color") {
      let color = "#FFFFFF";
      let background = "#000000";
      let re = /^[A-Fa-f0-9]+$/g;
      if (!arg || (arg.length < 3 && re.test(arg))) {
        if (arg.length == 2) {
          color = colorCode(arg[1]);
          background = colorCode(arg[0]);
        } else if (arg.length == 1) {
          color = colorCode(arg[0]);
        }
        var cmdcont = document.getElementById("cmdcont");
        if (cmdcont) {
          cmdcont.style.backgroundColor = background;
          cmdcont.style.color = color;
        }
      } else {
        push("COLOR [attr]  — 0-F background then foreground. Example: COLOR 0a");
      }
    } else if (type == "start") {
      dispatch({ type: "EDGELINK", payload: arg });
    } else if (type == "date") {
      push("The current date is: " + new Date().toLocaleDateString());
    } else if (type == "time") {
      push("The current time is: " + new Date().toLocaleTimeString());
    } else if (type == "exit") {
      tmpStack = [];
      dispatch({ type: wnapp.action, payload: "close" });
    } else if (type == "title") {
      setWntitle(arg.length ? arg : "Terminal");
    } else if (type == "hostname" || type == "whoami") {
      push(user);
    } else if (type == "ver") {
      push("Microsoft Windows [Version 10.0.22621.2428]");
    } else if (type == "neofetch") {
      let est = null;
      try {
        est = await Promise.race([
          navigator.storage?.estimate?.() ?? Promise.resolve(null),
          new Promise((r) => setTimeout(() => r(null), 400)),
        ]);
      } catch (e) {}
      const art = [
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "                   ",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
        "llllllllllllllll   llllllllllllllll",
      ];
      const info = [
        `${user}@WEBOS`,
        `-----------------`,
        `OS: Windows 11 WebOS (win11-dream)`,
        `Kernel: Chromium ${/Chrome\/(\d+)/.test(navigator.userAgent) ? navigator.userAgent.match(/Chrome\/(\d+)/)[1] : "?"}`,
        `Shell: webcmd 2.0`,
        `Resolution: ${screen.width}x${screen.height}`,
        `DE: Fluent / React 18`,
        `Apps: ${Object.keys(running).filter((k) => running[k]?.action).length} registered`,
        `Terminal: this one`,
        `Storage: ${est ? `${vs.bytes(est.usage)} / ${vs.bytes(est.quota || 0)}` : "IndexedDB"}`,
      ];
      const rows = Math.max(art.length, info.length);
      try {
        for (let i = 0; i < rows; i++) {
          push(`${String(art[i] || "                   ").padEnd(38)}${String(info[i] || "")}`);
        }
      } catch (e) {
        push(`neofetch: ${e.message || e}`);
      }
    } else if (type == "apps") {
      const list = Object.keys(running)
        .filter((k) => running[k]?.action && running[k]?.name)
        .map((k) => running[k].name)
        .sort();
      list.forEach((n) => push(`  ${n}`));
      push(`\n${list.length} apps.`);
    } else if (type == "open") {
      const want = String(arg || "")
        .toLowerCase()
        .replace(/\s+/g, "");
      const keys = Object.keys(running).filter((k) => running[k]?.action && running[k]?.name);
      const hit = keys.find((k) => running[k].name.toLowerCase().replace(/\s+/g, "") === want);
      if (!hit) {
        push(`Windows can't find "${arg || ""}". Try APPS to list them.`);
      } else {
        dispatch({ type: running[hit].action, payload: "full" });
        push(`Starting ${running[hit].name}…`);
      }
    } else if (type == "curl") {
      if (!arg) {
        push("Usage: curl https://example.com");
      } else {
        push(`Fetching ${arg} …`);
        try {
          let r = await fetch(arg).catch(() => null);
          if (!r || !r.ok) r = await fetch(`/webos-proxy?url=${encodeURIComponent(arg)}`);
          const ct = r.headers.get("content-type") || "";
          if (/json/i.test(ct) || /webos-proxy/.test(r.url || "")) {
            const j = await r.json();
            if (j.body && /html|text/.test(j.contentType || "text")) {
              const text = String(j.body)
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              push(text.slice(0, 900) || "(empty page)");
            } else {
              push(JSON.stringify(j).slice(0, 900));
            }
          } else {
            const text = await r.text();
            push(
              text
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 900),
            );
          }
          push(`\n[HTTP ${r.status} · ${ct || "unknown type"}]`);
        } catch (e) {
          push(`curl: ${e.message || e}`);
        }
      }
    } else if (type == "weather") {
      const city = arg || "Patna";
      push(`Weather for ${city} …`);
      try {
        let geo = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
        )
          .then((r) => r.json())
          .catch(() => null);
        if (!geo?.results?.length) {
          const pr = await fetch(
            `/webos-proxy?url=${encodeURIComponent(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`)}`,
          ).then((r) => r.json());
          geo = pr.body ? JSON.parse(pr.body) : pr;
        }
        const h = geo?.results?.[0];
        if (!h) {
          push(`weather: city lookup failed for "${city}"`);
        } else {
          const furl = `https://api.open-meteo.com/v1/forecast?latitude=${h.latitude}&longitude=${h.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
          let fx = await fetch(furl)
            .then((r) => r.json())
            .catch(() => null);
          if (!fx?.current) {
            const pr = await fetch(`/webos-proxy?url=${encodeURIComponent(furl)}`).then((r) =>
              r.json(),
            );
            fx = pr.body ? JSON.parse(pr.body) : pr;
          }
          const codes = {
            0: "Clear",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast",
            45: "Fog",
            51: "Drizzle",
            61: "Light rain",
            63: "Rain",
            65: "Heavy rain",
            71: "Snow",
            80: "Showers",
            95: "Thunderstorm",
          };
          push(`${h.name}${h.admin1 ? ", " + h.admin1 : ""} ${h.country || ""}`);
          push(
            `  ${Math.round(fx.current.temperature_2m)}°C ${codes[fx.current.weather_code] || ""}`,
          );
          push(
            `  feels like ${Math.round(fx.current.apparent_temperature)}°C, wind ${Math.round(fx.current.wind_speed_10m)} km/h`,
          );
          push(
            `  today ${Math.round(fx.daily.temperature_2m_min[0])}…${Math.round(fx.daily.temperature_2m_max[0])}°C`,
          );
        }
      } catch (e) {
        push(`weather: ${e.message || e}`);
      }
    } else if (type == "systeminfo") {
      [
        `Host Name:                 ${user.toUpperCase()}`,
        `OS Name:                   Microsoft Windows 11 WebOS`,
        `OS Version:                10.0.22621 N/A Build 22621`,
        `Registered Owner:          ${user}`,
        `System Type:               x64-based PC`,
        `Storage:                   IndexedDB (WebOS internal)`,
      ].forEach((l) => push(l));
    } else if (type == "tree") {
      const root = arg ? joinPath(pwd, arg) : pwd;
      const rec = await fsRead(root);
      if (!rec) {
        push(`Folder path not found — ${root}`);
      } else {
        push(root);
        const walk = async (dir, prefix) => {
          const kids = (await fsList(dir)).sort((a, b) =>
            a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1,
          );
          for (let i = 0; i < kids.length; i++) {
            const last = i === kids.length - 1;
            push(`${prefix}${last ? "└── " : "├── "}${kids[i].name}`);
            if (kids[i].type === "dir") await walk(kids[i].path, prefix + (last ? "    " : "│   "));
          }
        };
        await walk(root, "");
      }
    } else if (type == "ren" || type == "rename") {
      const parts = arg.split(/\s+/);
      const from = joinPath(pwd, parts[0] || "");
      const to = parts[1] || "";
      if (!parts[0] || !to) push("REN [old name] [new name]");
      else {
        try {
          const r = await vs.vsRename(from, to);
          push(r ? `Renamed to ${to}` : `Could not rename ${parts[0]} — no such item here`);
        } catch (err) {
          push(err?.message || "Rename failed");
        }
      }
    } else if (type == "rmdir" || type == "rd") {
      if (!arg) push("RMDIR [folder]");
      else {
        const r = await fsRm(joinPath(pwd, arg));
        push(r ? `Moved ${arg} to the Recycle Bin` : `Could not remove ${arg}`);
      }
    } else if (type == "touch") {
      if (!arg) push("TOUCH [file] — create an empty file");
      else {
        const path = joinPath(pwd, arg);
        const rec = await fsRead(path);
        if (rec && rec.type == "file") {
          await fsWrite(path, rec.content || "");
          push(`Touched ${arg} (contents kept)`);
        } else {
          await fsWrite(path, "");
          push(`Created ${arg}`);
        }
      }
    } else if (type == "copy" || type == "cp") {
      const parts = arg.split(/\s+/);
      if (parts.length < 2) push("COPY [source] [destination folder]");
      else {
        const src = joinPath(pwd, parts[0]);
        const dst = joinPath(pwd, parts.slice(1).join(" "));
        try {
          const r = await vs.vsCopy(src, dst);
          push(r ? `Copied ${parts[0]} → ${dst}` : "Copy failed — check both paths");
        } catch (err) {
          push(err?.message || "Copy failed");
        }
      }
    } else if (type == "move" || type == "mv") {
      const parts = arg.split(/\s+/);
      if (parts.length < 2) push("MOVE [source] [destination folder]");
      else {
        try {
          const r = await vs.vsCopy(
            joinPath(pwd, parts[0]),
            joinPath(pwd, parts.slice(1).join(" ")),
            { move: true },
          );
          push(r ? `Moved ${parts[0]}` : "Move failed — check both paths");
        } catch (err) {
          push(err?.message || "Move failed");
        }
      }
    } else if (type == "find" || type == "search") {
      if (!arg) push("FIND [text] — searches every file on the Virtual Storage");
      else {
        const q = arg.toLowerCase();
        const all = await idb.getAll("files");
        const hits = all.filter(
          (f) =>
            f.type === "file" &&
            (f.name.toLowerCase().includes(q) ||
              String(f.content || "")
                .toLowerCase()
                .includes(q)),
        );
        push(hits.length ? `${hits.length} match(es) for "${arg}"` : `No matches for "${arg}"`);
        hits.slice(0, 24).forEach((f) => push("  " + f.path));
      }
    } else if (type == "open") {
      if (!arg) push("OPEN [file or app] — notepad, paint, photos, explorer, edge, settings…");
      else {
        const key = arg.toLowerCase().replace(/\.exe$/, "");
        const known = {
          notepad: "NOTEPAD",
          paint: "PAINT",
          photos: "PHOTOSAPP",
          explorer: "EXPLORER",
          edge: "EDGE",
          msedge: "EDGE",
          browser: "EDGE",
          settings: "SETTINGS",
          store: "WNSTORE",
          camera: "CAMERA",
          board: "BOARD",
          whiteboard: "BOARD",
          calc: "CALC",
          calculator: "CALC",
          terminal: "TERMINAL",
          cmd: "TERMINAL",
          clock: "CLOCKAPP",
          alarm: "CLOCKAPP",
          bin: "RECYCLEBIN",
        };
        if (known[key]) {
          dispatch({
            type: known[key],
            payload: known[key] === "SETTINGS" || known[key] === "EXPLORER" ? "full" : "full",
          });
        } else {
          const target = joinPath(pwd, arg);
          const rec = await fsRead(target);
          if (!rec) push(`Cannot find ${arg}`);
          else if (rec.type === "dir") setPwd(rec.path);
          else if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(rec.name)) {
            dispatch({ type: "PHOTOSAPP", payload: "full" });
            dispatch({ type: "PHOTOOPEN", payload: { path: rec.path, name: rec.name } });
          } else {
            dispatch({
              type: "OPENTXT",
              payload: { name: rec.name, text: rec.content, path: rec.path },
            });
          }
        }
      }
    } else if (type == "theme") {
      const want = arg.toLowerCase();
      if (want === "dark" || want === "light" || want === "default" || want === "system") {
        changeTheme(want);
        push(`Theme set to ${want}. It survives a reload.`);
      } else {
        push("THEME [dark | light | system]");
      }
    } else if (type == "vs" || type == "storage") {
      await vs.hydrate();
      const all = await idb.getAll("files");
      const files = all.filter((f) => f.type === "file");
      const dirs = all.filter((f) => f.type === "dir");
      const total = files.reduce((a, f) => a + (f.size || String(f.content || "").length || 0), 0);
      const est = await navigator.storage?.estimate?.().catch(() => null);
      push('Virtual Storage — IndexedDB database "WebOS"');
      push(`  Files . . . . . . . : ${files.length}`);
      push(`  Folders . . . . . . : ${dirs.length}`);
      push(`  Size  . . . . . . . : ${vs.bytes(total)}`);
      if (est?.usage != null)
        push(`  Browser usage . . . : ${vs.bytes(est.usage)} of ${vs.bytes(est.quota || 0)}`);
      push("");
      push("Everything you save here is still on this PC after a reload.");
    } else if (type == "history") {
      if (!cmdHist.current.length) push("(no commands yet this session)");
      cmdHist.current.forEach((c, i) => push(`${String(i + 1).padStart(4)}  ${c}`));
    } else if (type == "calc") {
      // the REAL maths engine from bittuhere/ai (vendored with BitBot) —
      // deterministic parser + BODMAS stepper, never a floating guess
      const expr = arg?.trim();
      if (!expr) {
        push("Usage: calc 2 + 2 * 3   |   calc solve 2x + 5 = 17");
      } else {
        try {
          if (!window.BitMath) {
            push("loading the maths engine…");
            const r = await fetch("/bitbot/math.js");
            if (!r.ok) throw new Error("engine fetch failed");
            const code = await r.text();
            new Function("window", "module", "globalThis", code)(window, undefined, window);
          }
          if (/^solve\b/i.test(expr)) {
            const eq = expr.replace(/^solve\s+/i, "");
            const er = window.BitMath.solveEquation(eq);
            if (er?.ok) {
              push(`${eq}  →  ${er.variable || "x"} = ${(er.exact || er.roots || []).join(", ")}`);
              (er.steps || []).forEach((st) =>
                push(`   ${st.why ? st.why + ": " : ""}${st.calc ?? ""}`),
              );
              if (er.checks?.length) push("   ✓ verified by substitution");
            } else push("could not solve that equation");
          } else {
            const mr = window.BitMath.solve(expr);
            if (mr?.ok) {
              push(`${expr} = ${mr.value}`);
              (mr.steps || []).forEach((st) =>
                push(`   ${st.why ? st.why + ": " : ""}${st.calc ?? ""}`),
              );
            } else push(mr?.error || "could not evaluate that expression");
          }
        } catch (e) {
          push("calc error: " + String(e?.message || e));
        }
      }
    } else if (type == "help") {
      [
        "APPS       List the apps on this PC",
        "CALC EXPR  Real maths engine — calc 2+2*3, calc solve 2x+5=17",
        "HISTORY    Commands typed this session",
        "CD          Change directory",
        "CLS         Clear screen",
        "COLOR       Set console colors",
        "CURL URL    Fetch a URL through the OS relay",
        "OPEN APP    Launch an app by name (open notepad)",
        "NEOFETCH    System info, the fun way",
        "WEATHER CITY   Live weather (open-meteo)",
        "COPY        COPY source destination-folder",
        "DATE        Display date",
        "DEL         Delete a file (goes to the Recycle Bin)",
        "DIR / LS    List directory",
        "ECHO        Display a message. echo hi > file.txt writes a file",
        "EXIT        Quit Terminal",
        "FIND        FIND text — searches every file on the Virtual Storage",
        "HELP        This list",
        "INSTALL     INSTALL name url [icon]",
        "MKDIR / MD  Create a directory",
        "MOVE        MOVE source destination-folder",
        "OPEN        OPEN notepad | paint | photos | explorer | file.txt",
        "REN         REN old-name new-name",
        "RMDIR       Remove a directory",
        "START       Open a URL in Edge",
        "SYSTEMINFO  PC details",
        "THEME       THEME dark | light | system",
        "TIME        Display time",
        "TITLE       Set window title",
        "TREE        Show the folder tree",
        "TOUCH       Create an empty file",
        "TYPE / CAT  Show a text file",
        "VER         Windows version",
        "VS          Virtual Storage usage (IndexedDB)",
        "WHOAMI      Current user",
        "TASKLIST    Running apps",
        "RESET-SETUP Wipe account, settings and files; run OOBE next launch",
      ].forEach((l) => push(l));
    } else if (type == "tasklist") {
      const live = Object.values(running || {}).filter((a) => a && a.alive && !a.hide);
      push("Image Name                     PID   Status");
      push("========================= ======== =========");
      push(`${user.toLowerCase() || "user"}.exe                     1000  Running`);
      push("explorer.exe                       4  Running");
      live.forEach((a, i) =>
        push(
          `${String(a.name || a.icon || "app").padEnd(28)}${String(1001 + i).padStart(4)}  Running`,
        ),
      );
      push("");
      push(`${live.length + 2} task(s) listed.`);
    } else if (type == "ipconfig") {
      const IP = IpDetails[0] || {};
      push(
        "Windows IP Configuration",
        "",
        "IPv4 Address. . . . . . . . . : " + (IP.ip || "10.0.0.2"),
      );
    } else if (type == "reset-setup") {
      await idb.del("user");
      await idb.del("vstree");
      await idb.set("seeded", false);
      ["installed", "desktop", "setting", "taskbar", "mstmp"].forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch (e) {}
      });
      push("Account, settings and the Virtual Storage were cleared.");
      push("Reload the page to run setup again.");
    } else if (type == "notepad") {
      dispatch({ type: "NOTEPAD", payload: "full" });
    } else if (type == "") {
    } else {
      push(`'${type}' is not recognized as an internal or external command,`);
      push("operable program or batch file.");
      push("");
      push('Type "help" for available commands');
    }

    if (type.length > 0) tmpStack.push("");
    setStack(tmpStack);
  };

  const colorCode = (color) => {
    const map = {
      0: "#000000",
      1: "#0000AA",
      2: "#00AA00",
      3: "#00AAAA",
      4: "#AA0000",
      5: "#AA00AA",
      6: "#AA5500",
      7: "#AAAAAA",
      8: "#555555",
      9: "#5555FF",
      A: "#55FF55",
      B: "#55FFFF",
      C: "#FF5555",
      D: "#FF55FF",
      E: "#FFFF55",
      F: "#FFFFFF",
    };
    return map[String(color).toUpperCase()] || "#000000";
  };

  const action = (event) => {
    var cmdline = document.getElementById("curcmd");
    var actionName = event.target.dataset.action;

    if (cmdline) {
      if (actionName == "hover") {
        var crline = cmdline.parentNode;
        var cmdcont = document.getElementById("cmdcont");
        if (crline && cmdcont) {
          cmdcont.scrollTop = crline.offsetTop;
        }
        cmdline.focus();
      } else if (actionName == "enter") {
        if (event.key == "Enter") {
          event.preventDefault();
          var tmpStack = [...stack];
          // textContent first: jsdom’s innerText getter goes stale after a
          // programmatic clear (real browsers agree on either)
          var cmd = (event.target.textContent ?? event.target.innerText ?? "").trim();
          event.target.innerText = "";
          setLsc(tmpStack.length + 1);
          cmdTool(cmd);
        } else if (event.key == "ArrowUp" || event.key == "ArrowDown") {
          event.preventDefault();
          var i = lastCmd + [1, -1][Number(event.key == "ArrowUp")];
          while (i >= 0 && i < stack.length) {
            if (stack[i].startsWith("C:\\") && stack[i].includes(">")) {
              var tp = stack[i].split(">");
              event.target.innerText = tp.slice(1).join(">") || "";
              setLsc(i);
              break;
            }
            i += [1, -1][Number(event.key == "ArrowUp")];
          }
          cmdline.focus();
        } else if (event.key == "Tab") {
          event.preventDefault();
        }
      }
      cmdline.focus();
    }
  };

  useEffect(() => {
    getIPDetails();
    if (wnapp.dir && wnapp.dir != pwd) {
      setPwd(wnapp.dir);
      dispatch({ type: "OPENTERM", payload: null });
    }
  }, [wnapp.dir]);

  return (
    <div
      className="wnterm floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{
        ...(wnapp.size == "cstm" ? wnapp.dim : null),
        zIndex: wnapp.z,
      }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar
        app={wnapp.action}
        icon={wnapp.icon}
        size={wnapp.size}
        name={wntitle}
        invert
        bg="#060606"
      />
      <div className="windowScreen flex" data-dock="true">
        <div className="restWindow h-full flex-grow text-gray-100">
          <div
            className="cmdcont w-full box-border overflow-y-scroll win11Scroll prtclk"
            id="cmdcont"
            onMouseOver={action}
            onClick={action}
            data-action="hover"
          >
            <div className="w-full h-max pb-12">
              {stack.map((x, i) => (
                <pre key={i} className="cmdLine">
                  {x}
                </pre>
              ))}
              <div className="cmdLine actmd">
                {pwd}&gt;
                <div
                  className="ipcmd"
                  id="curcmd"
                  contentEditable
                  data-action="enter"
                  onKeyDown={action}
                  spellCheck="false"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

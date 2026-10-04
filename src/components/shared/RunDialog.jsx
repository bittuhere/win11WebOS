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
import { Icon } from "../../utils/general";
import "./run.scss";

/*
 * The Run dialog (Win+R). Knows every installed app by name, opens web
 * addresses in Edge, shell folders in Explorer, and tells the truth when
 * it can't find something.
 */

const FOLDERS = {
  "C:": "C:\\",
  desktop: "%user%\\Desktop",
  documents: "%user%\\Documents",
  downloads: "%user%\\Downloads",
  pictures: "%user%\\Pictures",
  music: "%user%\\Music",
  videos: "%user%\\Videos",
};

const RunDialog = () => {
  const open = useSelector((s) => s.globals.run);
  const apps = useSelector((s) => s.apps);
  const user = useSelector((s) => s.setting.person.name);
  const dispatch = useDispatch();
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const hits = useMemo(() => {
    const v = value.trim().toLowerCase().replace(/\s+/g, "");
    if (!v) return [];
    return Object.keys(apps)
      .filter((k) => apps[k]?.action && apps[k]?.name)
      .filter((k) => {
        const n = apps[k].name.toLowerCase().replace(/\s+/g, "");
        let i = 0;
        for (let j = 0; j < n.length && i < v.length; j++) if (n[j] === v[i]) i++;
        return n.includes(v) || i === v.length;
      })
      .slice(0, 5)
      .map((k) => apps[k]);
  }, [value, apps]);

  const close = () => dispatch({ type: "RUNHIDE" });

  const go = () => {
    const v = value.trim();
    if (!v) return;
    const lv = v.toLowerCase().replace(/\s+/g, "");

    // a folder?
    if (FOLDERS[lv]) {
      const path = FOLDERS[lv].replace(/%user%/g, `C:\\Users\\${user || "User"}`);
      dispatch({ type: "FILEPATH", payload: path });
      dispatch({ type: "EXPLORER", payload: "full" });
      close();
      return;
    }
    // a web address?
    if (/^(https?:\/\/|www\.)/i.test(v)) {
      dispatch({ type: "EDGELINK", payload: /^https?:/i.test(v) ? v : `https://${v}` });
      close();
      return;
    }
    // an app (exact first, then the fuzzy list)?
    const exact = hits.find((a) => a.name.toLowerCase().replace(/\s+/g, "") === lv);
    const target = exact || hits[0];
    if (target) {
      dispatch({ type: target.action, payload: "full" });
      close();
      return;
    }
    // a search, like the real Run falls through to nothing — say it straight
    dispatch({ type: "EDGELINK", payload: v });
    close();
  };

  if (!open) return null;

  return (
    <>
      <div className="runScrim" onMouseDown={close} />
      <div className="runBox dpShad" role="dialog" aria-label="Run">
        <div className="runHead">
          <Icon src="home" width={20} />
          <b>Run</b>
        </div>
        <div className="runRow">
          <Icon className="runIcoRun" fafa="faArrowRight" reg width={12} />
          <input
            ref={inputRef}
            value={value}
            spellCheck={false}
            placeholder="Type an app, a folder (desktop), or a web address…"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                go();
              }
              if (e.key === "Escape") close();
            }}
          />
        </div>
        {hits.length ? (
          <div className="runHits">
            {hits.map((a) => (
              <div
                key={a.icon}
                className="runHit"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  dispatch({ type: a.action, payload: "full" });
                  close();
                }}
              >
                <Icon src={a.icon} width={18} />
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="runActs">
          <button type="button" className="runBtn" onClick={close}>
            OK
          </button>
          <button type="button" className="runBtn" onClick={go}>
            Run
          </button>
        </div>
        <div className="runHint">Win + R · try “notepad”, “desktop”, “www.bing.com” or “cmd”</div>
      </div>
    </>
  );
};

export default RunDialog;

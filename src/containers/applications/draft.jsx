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

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../utils/general";

export const IFrame = (props) => {
  const wnapp = useSelector((state) => state.apps[props.icon]);
  const dispatch = useDispatch();
  const [hint, setHint] = useState(false);
  const [loading, setLoading] = useState(true);
  // a REF, not state: the 12s watchdog must see the load even though
  // React state inside a timeout closure goes stale (the old bug that
  // showed "may be blocking" over perfectly loaded apps)
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!wnapp?.alive) return;
    loadedRef.current = false;
    setLoading(true);
    setHint(false);
    // Browsers give no load-failure signal for cross-origin frames, so after
    // a fair wait the window offers an honest way out — but ONLY if the frame
    // never fired its load event. A loaded page must never see the hint.
    const poll = setInterval(() => {
      if (loadedRef.current) {
        clearInterval(poll);
        setLoading(false);
      }
    }, 200);
    const t = setTimeout(() => {
      clearInterval(poll);
      if (!loadedRef.current) {
        setLoading(false);
        setHint(true);
      }
    }, 12000);
    return () => {
      clearInterval(poll);
      clearTimeout(t);
    };
    // alive + url only — minimize/restore must NOT restart the watchdog
  }, [wnapp?.alive, wnapp?.data?.url]);

  if (!wnapp || !wnapp.alive) return null;
  var data = wnapp.data;

  return (
    <div
      data-size={wnapp.size}
      className={"floatTab dpShad " + (data.invert != true ? "lightWindow" : "darkWindow")}
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
        name={wnapp.name}
        invert={data.invert == true ? true : null}
        noinvert
      />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow flex flex-col">
          <div className="flex-grow overflow-hidden pwaFrame">
            <iframe
              src={data.url}
              allow="camera;microphone"
              className="w-full h-full"
              frameborder="0"
              onLoad={() => {
                loadedRef.current = true;
                setLoading(false);
                setHint(false);
              }}
            ></iframe>
            {loading && !hint ? (
              <div className="pwaLoading">
                <svg
                  className="pwaBlocks"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="1.5" y="1.5" rx="1" width="9" height="9">
                    <animate
                      id="wosBlkA"
                      begin="0;wosBlkD.end+0.15s"
                      attributeName="x"
                      dur="0.6s"
                      values="1.5;.5;1.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="0;wosBlkD.end+0.15s"
                      attributeName="y"
                      dur="0.6s"
                      values="1.5;.5;1.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="0;wosBlkD.end+0.15s"
                      attributeName="width"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="0;wosBlkD.end+0.15s"
                      attributeName="height"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                  </rect>
                  <rect x="13.5" y="1.5" rx="1" width="9" height="9">
                    <animate
                      begin="wosBlkA.begin+0.15s"
                      attributeName="x"
                      dur="0.6s"
                      values="13.5;12.5;13.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.15s"
                      attributeName="y"
                      dur="0.6s"
                      values="1.5;.5;1.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.15s"
                      attributeName="width"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.15s"
                      attributeName="height"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                  </rect>
                  <rect x="13.5" y="13.5" rx="1" width="9" height="9">
                    <animate
                      begin="wosBlkA.begin+0.3s"
                      attributeName="x"
                      dur="0.6s"
                      values="13.5;12.5;13.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.3s"
                      attributeName="y"
                      dur="0.6s"
                      values="13.5;12.5;13.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.3s"
                      attributeName="width"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.3s"
                      attributeName="height"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                  </rect>
                  <rect x="1.5" y="13.5" rx="1" width="9" height="9">
                    <animate
                      id="wosBlkD"
                      begin="wosBlkA.begin+0.45s"
                      attributeName="x"
                      dur="0.6s"
                      values="1.5;.5;1.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.45s"
                      attributeName="y"
                      dur="0.6s"
                      values="13.5;12.5;13.5"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.45s"
                      attributeName="width"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                    <animate
                      begin="wosBlkA.begin+0.45s"
                      attributeName="height"
                      dur="0.6s"
                      values="9;11;9"
                      keyTimes="0;.2;1"
                    />
                  </rect>
                </svg>
                <div>
                  Opening <b>{wnapp.name}</b>…
                </div>
              </div>
            ) : null}
            {hint ? (
              <div className="pwaHint">
                <span>
                  <b>{wnapp.name}</b> is slow, or this site refuses embedding. Give it a moment,
                  read it in Edge, or try another app from the Store.
                </span>
                <button
                  onClick={() => {
                    setHint(false);
                    dispatch({ type: "MSEDGE", payload: "full" });
                    setTimeout(() => dispatch({ type: "EDGELINK", payload: data.url }), 350);
                  }}
                >
                  Open in Edge
                </button>
                <button onClick={() => setHint(false)}>✕</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

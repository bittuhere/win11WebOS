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

/**
 * Windows Update — a real window, because that is where this information
 * belongs: the version, what an update contains, how big it is, and the two
 * honest buttons (install now, or not yet).
 *
 * Everything it shows comes from utils/os/updates.js, which owns the network
 * call, the feed validation and the cache purge; this file is presentation and
 * the small amount of state a person expects from a progress bar.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ToolBar } from "../../utils/general";
import { OS, osLabel, osVersion } from "../../utils/os/version";
import {
  checkForUpdates,
  getUpdateState,
  installUpdate,
  loadNotes,
  loadUpdateHistory,
  reloadIntoNewBuild,
  skipVersion,
  clearSkip,
  muteFor,
  subscribeUpdates,
} from "../../utils/os/updates";
import { mdToHtml } from "../../utils/os/md";
import "./update.scss";

const fmtSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (!n) return "size not published";
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};

const fmtWhen = (ts) => {
  if (!ts) return "never";
  const d = new Date(ts);
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return d.toLocaleString();
};

const IcoRefresh = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3.2h-3.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const UpdateWin = () => {
  const wnapp = useSelector((s) => s.apps.update);
  const dispatch = useDispatch();
  const [s, setS] = useState(getUpdateState());
  const [notesHtml, setNotesHtml] = useState("");
  const [phase, setPhase] = useState(null); // { step, pct }
  const [history, setHistory] = useState(() => loadUpdateHistory());
  const [showAllNotes, setShowAllNotes] = useState(false);

  useEffect(() => subscribeUpdates(setS), []);

  /* checking as soon as the window opens is what a person expects, but a
     check that just happened a minute ago is not repeated */
  useEffect(() => {
    if (wnapp.hide) return;
    if (!s.lastCheck || Date.now() - s.lastCheck > 60000) checkForUpdates();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [wnapp.hide]);

  /* release notes: fetched once per offered version, rendered locally */
  const notesPath = s.update?.notes;
  useEffect(() => {
    let alive = true;
    if (!notesPath) {
      setNotesHtml("");
      return undefined;
    }
    loadNotes(notesPath).then((md) => {
      if (alive && md) setNotesHtml(mdToHtml(md, notesPath));
    });
    return () => {
      alive = false;
    };
  }, [notesPath]);

  const kind = s.update?.kind || "none";
  const headline = useMemo(() => {
    if (s.status === "checking") return "Checking for updates…";
    if (s.status === "available") {
      return kind === "feature"
        ? `WebOS ${s.update.major} is available`
        : `A quality update is available — ${s.update.version}`;
    }
    if (s.status === "error") return s.error?.message || "The check failed.";
    return "You're up to date";
  }, [s, kind]);

  const isSkipped = s.update && s.skipped === s.update.version;

  const install = async () => {
    setPhase({ step: "prepare", pct: 4 });
    await installUpdate(s.update, (p) => {
      setPhase(p);
      if (p.step === "done") {
        setHistory(loadUpdateHistory());
        setTimeout(() => reloadIntoNewBuild(s.update), 900);
      }
    });
  };

  return (
    <div
      className="wnupd floatTab dpShad"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Windows Update" />
      <div className="windowScreen flex updScreen">
        <header className="updHero">
          <div className="updHeroArt">
            <img src="img/settings/update.png" alt="" width={64} height={64} />
            <span className="updRing" data-busy={s.status === "checking"} />
          </div>
          <div className="updHeroCopy">
            <h1>{headline}</h1>
            <p className="updSub">
              {s.status === "available"
                ? `${fmtSize(s.update.size)} · released ${s.update.released || "recently"} · channel ${s.update.channel}`
                : `Last checked ${fmtWhen(s.lastCheck)}`}
            </p>
            <div className="updBadges">
              <span className="updBadge">WebOS {OS.major}</span>
              <span className="updBadge">{osVersion()}</span>
              <span className="updBadge">Build {OS.build}</span>
              <span className="updBadge">{OS.channel}</span>
            </div>
          </div>
          <div className="updHeroActs">
            <button
              type="button"
              className="updBtn"
              onClick={() => checkForUpdates()}
              disabled={s.status === "checking"}
            >
              <IcoRefresh /> {s.status === "checking" ? "Checking…" : "Check for updates"}
            </button>
            {s.status === "available" && (
              <>
                <button
                  type="button"
                  className="updBtn accent"
                  onClick={install}
                  disabled={!!phase}
                >
                  {phase ? "Installing…" : "Install now"}
                </button>
                <button
                  type="button"
                  className="updBtn ghost"
                  onClick={() => skipVersion(s.update.version)}
                  disabled={!!phase}
                >
                  Skip this version
                </button>
              </>
            )}
          </div>
        </header>

        {phase && (
          <div className="updProgress" data-step={phase.step}>
            <div className="updProgressBar">
              <span style={{ width: `${phase.pct}%` }} />
            </div>
            <p>
              {phase.step === "prepare" && "Asking the browser for the newest build…"}
              {phase.step === "clear" && "Clearing every cached copy of the old build…"}
              {phase.step === "reload" && "Restarting the desktop on the new build…"}
              {phase.step === "done" && "Done — reloading…"}
            </p>
          </div>
        )}

        {s.status === "error" && (
          <div className="updError">
            <div>
              <b>{s.error.message}</b>
              {s.error.hint && <span> {s.error.hint}</span>}
              <div className="updErrorCode">code: {s.error.code}</div>
            </div>
            <button type="button" className="updBtn" onClick={() => checkForUpdates()}>
              Try again
            </button>
          </div>
        )}

        {isSkipped && (
          <div className="updNotice">
            You skipped {s.update.version}. It stays hidden until you ask again.{" "}
            <button type="button" className="updLink" onClick={clearSkip}>
              Show it again
            </button>
          </div>
        )}

        <div className="updBody win11Scroll">
          {s.status === "available" ? (
            <>
              <section className="updCard">
                <div className="updCardHead">
                  <span className={`updKind ${kind}`}>
                    {kind === "feature" ? "Feature update" : "Quality update"}
                  </span>
                  <h2>
                    {s.update.title || `WebOS ${s.update.major}, version ${s.update.version}`}
                  </h2>
                </div>
                {s.update.highlights.length > 0 && (
                  <ul className="updHighlights">
                    {s.update.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
                <div className="updMeta">
                  <div>
                    <span>Download size</span>
                    <b>{fmtSize(s.update.size)}</b>
                  </div>
                  <div>
                    <span>Release date</span>
                    <b>{s.update.released || "not published"}</b>
                  </div>
                  <div>
                    <span>Kind</span>
                    <b>{kind === "feature" ? "Feature update" : "Quality update"}</b>
                  </div>
                  <div>
                    <span>Channel</span>
                    <b>{s.update.channel}</b>
                  </div>
                </div>
                <p className="updFine">
                  This PC runs from static files, so there is nothing to download to your disk:{" "}
                  <b>Install now</b> clears every cached copy of {osVersion()} — service worker,
                  cache storage and the update check itself — and reloads on the newest build. Your
                  files, apps and settings live in IndexedDB and are kept.
                </p>
              </section>

              {notesPath && (
                <section className="updNotes">
                  <h2>
                    What's new in {s.update.version}
                    {s.notes?.error ? (
                      <span className="updNotesErr"> — {s.notes.error}</span>
                    ) : null}
                  </h2>
                  {s.notes?.loading && (
                    <p className="updNotesLoading">Loading the release notes…</p>
                  )}
                  {notesHtml && (
                    <div
                      className={`updNotesBody ${showAllNotes ? "" : "clamped"}`}
                      dangerouslySetInnerHTML={{ __html: notesHtml }}
                    />
                  )}
                  {notesHtml && (
                    <button
                      type="button"
                      className="updLink"
                      onClick={() => setShowAllNotes((v) => !v)}
                    >
                      {showAllNotes ? "Show less" : "Read the full release notes"}
                    </button>
                  )}
                </section>
              )}
            </>
          ) : (
            <section className="updCard quiet">
              <h2>{s.status === "checking" ? "One moment…" : "Nothing to install"}</h2>
              <p>
                {s.status === "checking"
                  ? "Asking the update server for the newest build."
                  : `This PC is on ${osLabel()}, the newest build published for the ${OS.channel} channel.`}
              </p>
              <div className="updMeta">
                <div>
                  <span>Version</span>
                  <b>{osVersion()}</b>
                </div>
                <div>
                  <span>Build</span>
                  <b>{OS.build}</b>
                </div>
                <div>
                  <span>Last checked</span>
                  <b>{fmtWhen(s.lastCheck)}</b>
                </div>
                <div>
                  <span>Feed</span>
                  <b>updates/feed.json</b>
                </div>
              </div>
              <div className="updRowBtns">
                <button type="button" className="updBtn ghost" onClick={() => muteFor(24)}>
                  Pause automatic checks for a day
                </button>
                <button
                  type="button"
                  className="updBtn ghost"
                  onClick={() => dispatch({ type: "UPDATEWIN", payload: "close" })}
                >
                  Close
                </button>
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section className="updHistory">
              <h3>Update history</h3>
              <div className="updHistList">
                {history.map((h) => (
                  <div key={h.version + h.at} className="updHistRow">
                    <span className={`updKind ${h.kind}`}>
                      {h.kind === "feature" ? "Feature" : "Quality"}
                    </span>
                    <b>{h.version}</b>
                    <span className="updHistWhen">{new Date(h.at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateWin;

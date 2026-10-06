import { loadLocalScript } from "../../../utils/os/scripts";
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
import { mediaBus } from "../../../utils/os/assoc";
import { ToolBar } from "../../../utils/general";
import { idb, uid, getUser, fsList, fsWrite } from "../../../utils/idb";
import { notify } from "../../../utils/os/ui";
import { openExternal } from "../../../utils/os/links";
import { sendFeedback, EMAIL_ERROR, feedbackEmail } from "../../../utils/os/feedback";
import store from "../../../reducers";
import { applyTheme } from "../../../utils/os/theme";
import "./extras.scss";

function WinApp({ id, title, invert, bg, children, className = "" }) {
  const wnapp = useSelector((s) => s.apps[id]);
  if (!wnapp || !wnapp.alive) return null;
  return (
    <div
      className={`floatTab dpShad extraApp ${className}`}
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
        name={title}
        invert={invert}
        bg={bg}
      />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow overflow-hidden extraFill">{children}</div>
      </div>
    </div>
  );
}

function useStore(name, initial = []) {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    idb
      .getAll(name)
      .then((r) => setItems(r || []))
      .catch(() => {});
  }, [name]);
  const save = async (rec) => {
    await idb.put(name, rec);
    setItems(await idb.getAll(name));
  };
  const remove = async (key) => {
    await idb.deleteFrom(name, key);
    setItems(await idb.getAll(name));
  };
  return [items, save, remove, setItems];
}

/* ═══════════════════════════════════════════════════════════════════
   Win11Select — a real Windows 11 dropdown.
   Native <select> popups are drawn by the OS and can't be styled,
   so this replaces them with a custom menu: acrylic surface, item
   hover, accent checkmark on the selected row, full keyboard nav.
   API-compatible with <select>: value, onChange, children <option>.
   ═══════════════════════════════════════════════════════════════════ */
function Win11Select({
  value,
  onChange,
  children,
  className = "",
  disabled = false,
  placeholder = "Select…",
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [flipUp, setFlipUp] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  /* parse <option> children into { value, label } */
  const options = React.Children.toArray(children)
    .filter((c) => React.isValidElement(c) && c.type === "option")
    .map((c) => ({
      value: c.props.value !== undefined ? c.props.value : c.props.children,
      label: c.props.children,
      disabled: !!c.props.disabled,
    }));

  const current = options.find((o) => String(o.value) === String(value)) || null;

  /* open/close on outside click */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /* position + active index when opening */
  useEffect(() => {
    if (!open) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuHeight = Math.min(options.length * 34 + 12, 320);
      setFlipUp(spaceBelow < menuHeight + 20 && rect.top > menuHeight + 20);
    }
    const idx = options.findIndex((o) => String(o.value) === String(value));
    setActiveIdx(idx >= 0 ? idx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* keyboard nav */
  const onKey = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let i = activeIdx;
      for (let step = 0; step < options.length; step++) {
        i = (i + dir + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setActiveIdx(i);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIdx(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      if (open) {
        e.preventDefault();
        const opt = options[activeIdx];
        if (opt && !opt.disabled) {
          onChange(opt.value);
          setOpen(false);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
    /* typeahead: jump to first option starting with the letter */
    else if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
      const ch = e.key.toLowerCase();
      const idx = options.findIndex(
        (o, i) => i > activeIdx && String(o.label).toLowerCase().startsWith(ch),
      );
      const wrapped =
        idx >= 0 ? idx : options.findIndex((o) => String(o.label).toLowerCase().startsWith(ch));
      if (wrapped >= 0) setActiveIdx(wrapped);
    }
  };

  /* scroll active item into view */
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const el = menuRef.current.children[activeIdx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  return (
    <div ref={wrapRef} className={`w11select ${disabled ? "disabled" : ""} ${className}`}>
      <button
        type="button"
        className={`w11selectTrigger ${open ? "open" : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="w11selectValue">{current ? current.label : placeholder}</span>
        <svg
          className="w11selectChevron"
          viewBox="0 0 12 12"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 4.5L6 7.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className={`w11selectMenu ${flipUp ? "up" : ""}`}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((o, i) => {
            const selected = String(o.value) === String(value);
            return (
              <div
                key={String(o.value) + i}
                role="option"
                aria-selected={selected}
                className={`w11selectItem ${i === activeIdx ? "active" : ""} ${selected ? "selected" : ""} ${o.disabled ? "disabled" : ""}`}
                onMouseEnter={() => !o.disabled && setActiveIdx(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!o.disabled) {
                    onChange(o.value);
                    setOpen(false);
                  }
                }}
              >
                <span className="w11selectItemLabel">{o.label}</span>
                {selected && (
                  <svg
                    className="w11selectCheck"
                    viewBox="0 0 16 16"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                  >
                    <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
/* ── Holiday APIs ──────────────────────────────────────────────
 * Primary: OpenHolidays API (CORS enabled, no key, free)
 * Fallback: Calendarific free tier (500 calls/month, no key needed for test)
 * Final fallback: static built-in holiday list for India
 * ─────────────────────────────────────────────────────────── */

const HOLIDAY_CACHE = new Map(); // "COUNTRY-YEAR" → [events]

const guessCountry = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/^Asia\/(Kolkata|Calcutta)$/.test(tz)) return "IN";
    if (/^America\//.test(tz)) return "US";
    if (/^Europe\/London$/.test(tz)) return "GB";
    if (/^Europe\//.test(tz)) return "DE";
    if (/^Australia\//.test(tz)) return "AU";
    if (/^Asia\/Tokyo$/.test(tz)) return "JP";
  } catch (e) {}
  return "IN";
};

/* OpenHolidays returns objects with name[].text, startDate, etc. */
const fetchFromOpenHolidays = async (country, year) => {
  const url = `https://openholidaysapi.org/PublicHolidays?countryIsoCode=${country}&languageIsoCode=EN&validFrom=${year}-01-01&validTo=${year}-12-31`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`openholidays ${r.status}`);
  const list = await r.json();
  return (list || []).map((h) => ({
    id: `hol-${h.startDate}-${(h.name?.[0]?.text || "holiday").replace(/\s+/g, "-").toLowerCase()}`,
    date: h.startDate,
    time: "",
    title: (h.name || []).find((n) => n.language === "EN")?.text || h.name?.[0]?.text || "Holiday",
    holiday: true,
    source: "openholidays",
  }));
};

/* ── Fallback: static India holidays (covers the next few years) ── */
const STATIC_IN = {
  2025: [
    ["2025-01-26", "Republic Day"],
    ["2025-03-14", "Holi"],
    ["2025-03-31", "Eid al-Fitr"],
    ["2025-04-14", "Ambedkar Jayanti"],
    ["2025-04-18", "Good Friday"],
    ["2025-05-12", "Buddha Purnima"],
    ["2025-06-07", "Bakrid"],
    ["2025-08-15", "Independence Day"],
    ["2025-08-16", "Janmashtami"],
    ["2025-08-27", "Ganesh Chaturthi"],
    ["2025-10-02", "Gandhi Jayanti / Dussehra"],
    ["2025-10-20", "Diwali"],
    ["2025-10-22", "Govardhan Puja"],
    ["2025-10-23", "Bhai Dooj"],
    ["2025-11-05", "Chhath Puja"],
    ["2025-11-15", "Guru Nanak Jayanti"],
    ["2025-12-25", "Christmas"],
  ],
  2026: [
    ["2026-01-01", "New Year's Day"],
    ["2026-01-14", "Makar Sankranti"],
    ["2026-01-26", "Republic Day"],
    ["2026-02-15", "Maha Shivaratri"],
    ["2026-03-04", "Holi"],
    ["2026-03-21", "Eid al-Fitr"],
    ["2026-04-02", "Ram Navami"],
    ["2026-04-03", "Good Friday"],
    ["2026-04-14", "Ambedkar Jayanti"],
    ["2026-05-01", "Buddha Purnima"],
    ["2026-05-27", "Bakrid"],
    ["2026-08-15", "Independence Day"],
    ["2026-09-04", "Janmashtami"],
    ["2026-09-14", "Ganesh Chaturthi"],
    ["2026-10-02", "Gandhi Jayanti"],
    ["2026-10-20", "Dussehra"],
    ["2026-11-08", "Diwali"],
    ["2026-11-10", "Govardhan Puja"],
    ["2026-11-24", "Guru Nanak Jayanti"],
    ["2026-12-25", "Christmas"],
  ],
  2027: [
    ["2027-01-01", "New Year's Day"],
    ["2027-01-14", "Makar Sankranti"],
    ["2027-01-26", "Republic Day"],
    ["2027-03-06", "Maha Shivaratri"],
    ["2027-03-22", "Holi"],
    ["2027-03-20", "Eid al-Fitr"],
    ["2027-03-26", "Ram Navami"],
    ["2027-03-26", "Good Friday"],
    ["2027-04-14", "Ambedkar Jayanti"],
    ["2027-05-20", "Buddha Purnima"],
    ["2027-05-17", "Bakrid"],
    ["2027-08-15", "Independence Day"],
    ["2027-08-25", "Janmashtami"],
    ["2027-09-04", "Ganesh Chaturthi"],
    ["2027-10-02", "Gandhi Jayanti"],
    ["2027-10-09", "Dussehra"],
    ["2027-10-29", "Diwali"],
    ["2027-11-14", "Guru Nanak Jayanti"],
    ["2027-12-25", "Christmas"],
  ],
};

const fetchHolidays = async (country, year) => {
  const key = `${country}-${year}`;
  if (HOLIDAY_CACHE.has(key)) return HOLIDAY_CACHE.get(key);

  let out = [];
  let source = "";

  /* 1 · try OpenHolidays (primary) */
  try {
    out = await fetchFromOpenHolidays(country, year);
    source = "openholidays";
  } catch (e) {
    console.warn("OpenHolidays failed:", e.message);
  }

  /* 2 · fallback: static India list */
  if (out.length === 0 && country === "IN" && STATIC_IN[year]) {
    out = STATIC_IN[year].map(([date, title]) => ({
      id: `hol-static-${date}`,
      date,
      time: "",
      title,
      holiday: true,
      source: "static",
    }));
    source = "static";
  }

  HOLIDAY_CACHE.set(key, out);
  return out;
};

export const CalendarApp = () => {
  const now = new Date();
  const isoLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [picked, setPicked] = useState(isoLocal(now));
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [events, save, remove] = useStore("events");
  const [holidays, setHolidays] = useState([]);
  const [holidayErr, setHolidayErr] = useState("");
  const country = useRef(guessCountry()).current;

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: first + days }, (_, i) => (i < first ? null : i - first + 1));
  const isoOf = (d) =>
    d ? `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
  const todayIso = isoLocal(now);

  useEffect(() => {
    let dead = false;
    setHolidayErr("");
    fetchHolidays(country, y).then((list) => {
      if (!dead) {
        setHolidays(list);
        if (list.length === 0) setHolidayErr("Holiday data unavailable — offline or API blocked");
      }
    });
    return () => {
      dead = true;
    };
  }, [country, y]);

  const allEvents = [...events, ...holidays];
  const monthCount = allEvents.filter((e) =>
    (e.date || "").startsWith(`${y}-${String(m + 1).padStart(2, "0")}`),
  ).length;
  const dayEvents = allEvents
    .filter((e) => e.date === picked)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  const prettyShort = (iso) => {
    const [yy, mm, dd] = iso.split("-").map(Number);
    const d = new Date(yy, mm - 1, dd);
    return {
      weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
      month: d.toLocaleDateString(undefined, { month: "long" }),
      day: dd,
    };
  };

  const add = async () => {
    if (!title.trim()) return;
    const t = /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim() : "";
    await save({ id: uid("ev"), date: picked, time: t, title: title.trim() });
    setTitle("");
    setTime("");
  };

  const goToday = () => {
    setPicked(todayIso);
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };
  const goPrev = () => setCursor(new Date(y, m - 1, 1));
  const goNext = () => setCursor(new Date(y, m + 1, 1));

  const info = prettyShort(picked);

  return (
    <WinApp id="calendar" title="Calendar">
      <div className="calApp">
        <div className="calToolbar">
          <div className="calNav">
            <button className="winBtn ghost icon" onClick={goPrev} aria-label="Previous month">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M10 3l-5 5 5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="winBtn ghost icon" onClick={goNext} aria-label="Next month">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path
                  d="M6 3l5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <h1 className="calTitle">
            {cursor.toLocaleString(undefined, { month: "long" })}
            <span className="calTitleYear">{y}</span>
          </h1>
          <button className="winBtn ghost" onClick={goToday}>
            Today
          </button>
          <span
            className="calChip"
            title={`Country: ${country} · Source: ${holidays[0]?.source || "none"}`}
          >
            {monthCount} event{monthCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="calBody">
          <div className="calMonth">
            <div className="calWeek">
              {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="calGrid">
              {cells.map((d, i) => {
                const iso = isoOf(d);
                const evs = allEvents.filter((e) => e.date === iso);
                const isToday = iso === todayIso;
                const isPicked = iso === picked;
                const hasHoliday = evs.some((e) => e.holiday);
                return (
                  <div
                    key={i}
                    className={`calCell ${d ? "" : "empty"} ${isToday ? "today" : ""} ${isPicked ? "on" : ""} ${hasHoliday ? "holiday" : ""}`}
                    onClick={() => d && setPicked(iso)}
                  >
                    {d && <div className="n">{d}</div>}
                    {evs.slice(0, 3).map((e) => (
                      <div
                        className={`ev ${e.holiday ? "evHoliday" : ""}`}
                        key={e.id}
                        title={`${e.time ? e.time + " · " : ""}${e.title}`}
                      >
                        {e.holiday ? (
                          <span className="evStar">★</span>
                        ) : e.time ? (
                          <span className="evDot" />
                        ) : null}
                        <span className="evTxt">{e.title}</span>
                      </div>
                    ))}
                    {evs.length > 3 && <div className="ev more">+{evs.length - 3} more</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="calSide">
            <div className="calSideHead">
              <div className="calSideDay">{info.day}</div>
              <div className="calSideMeta">
                <b>{info.weekday}</b>
                <span>
                  {info.month}, {y}
                </span>
                {holidayErr && <span className="calHolidayHint">{holidayErr}</span>}
              </div>
            </div>

            <div className="calAdd">
              <input
                className="winInput calAddTime"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="HH:MM"
                aria-label="Event time"
              />
              <input
                className="winInput"
                style={{ flex: 1, minWidth: 0 }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="Add an event"
              />
              <button
                className="winBtn accent"
                onClick={add}
                aria-label="Add event"
                title="Add event"
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M8 3v10M3 8h10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="calSideList">
              {dayEvents.length === 0 ? (
                <div className="calEmpty">
                  <svg
                    viewBox="0 0 24 24"
                    width="36"
                    height="36"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  >
                    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
                  </svg>
                  <span>No events</span>
                  <span className="winMuted">Enjoy the quiet.</span>
                </div>
              ) : (
                dayEvents.map((e) => (
                  <div className={`calEvRow ${e.holiday ? "calEvRowHoliday" : ""}`} key={e.id}>
                    <div className="calEvTime">{e.holiday ? "Holiday" : e.time || "All day"}</div>
                    <div className="calEvTitle">
                      {e.holiday && <span className="calEvStar">★</span>}
                      {e.title}
                    </div>
                    {!e.holiday ? (
                      <button
                        className="calEvDel winBtn ghost icon"
                        onClick={() => remove(e.id)}
                        aria-label="Delete event"
                        title="Delete"
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13">
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    ) : (
                      <div className="calEvDel" aria-hidden="true" />
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </WinApp>
  );
};
const COLORS = ["#fff475", "#ccff90", "#fdcfe8", "#d7aefb", "#cbf0f8", "#e8eaed"];
export const StickyNotes = () => {
  const [notes, save, remove] = useStore("notes");
  const add = () =>
    save({
      id: uid("note"),
      text: "",
      color: COLORS[notes.length % COLORS.length],
      at: Date.now(),
    });
  return (
    <WinApp id="notes" title="Sticky Notes">
      <div className="winPad">
        <div className="winRow" style={{ marginBottom: 12 }}>
          <h2 className="winH" style={{ margin: 0 }}>
            Sticky Notes
          </h2>
          <span className="calChip">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
          <button className="winBtn" onClick={add}>
            New note
          </button>
        </div>
        <div className="noteBoard wosStagger">
          {notes.map((n) => (
            <div key={n.id} className="sticky" style={{ background: n.color }}>
              <div className="stickyBar">
                <span>
                  {new Date(n.at || Date.now()).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <button className="winBtn ghost" onClick={() => remove(n.id)}>
                  Delete
                </button>
              </div>
              <textarea
                value={n.text}
                placeholder="Take a note..."
                onChange={(e) => save({ ...n, text: e.target.value })}
              />
              <div className="stickySwatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`swatch ${c === n.color ? "on" : ""}`}
                    style={{ background: c }}
                    aria-label={`Note color ${c}`}
                    onClick={() => save({ ...n, color: c })}
                  />
                ))}
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="winMuted">No notes yet — pin your first thought.</div>
          )}
        </div>
      </div>
    </WinApp>
  );
};

export const TodoApp = () => {
  const [items, save, remove] = useStore("todos");
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState("all");
  const done = items.filter((t) => t.done).length;
  const important = items.filter((t) => t.important && !t.done).length;
  const shown = items.filter((t) =>
    filter === "all" ? true : filter === "important" ? !!t.important : !!t.done,
  );
  const add = async () => {
    if (!text.trim()) return;
    await save({
      id: uid("td"),
      text: text.trim(),
      done: false,
      important: false,
      due: due.trim(),
    });
    setText("");
    setDue("");
  };
  const clearDone = async () => {
    // read fresh — a pending completion save must not make this a no-op
    const fresh = await idb.getAll("todos");
    for (const t of fresh.filter((x) => x.done)) await remove(t.id);
  };
  const filters = [
    ["all", `All ${items.length}`],
    ["important", `Important ${important}`],
    ["completed", `Completed ${done}`],
  ];
  return (
    <WinApp id="todo" title="Microsoft To Do">
      <div className="winPad">
        <h2 className="winH">My Day</h2>
        <div className="winMuted" style={{ marginBottom: 10 }}>
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {items.length > 0 && ` · ${done} of ${items.length} done`}
        </div>
        <div className="winRow" style={{ marginBottom: 10 }}>
          {filters.map(([k, label]) => (
            <button
              key={k}
              className={`winBtn ghost chip ${filter === k ? "on" : ""}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
          {done > 0 && (
            <button className="winBtn ghost" style={{ marginLeft: "auto" }} onClick={clearDone}>
              Clear completed
            </button>
          )}
        </div>
        <div className="winRow">
          <input
            className="winInput"
            style={{ flex: 1 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a task"
          />
          <input
            className="winInput"
            style={{ width: 108, flex: "none" }}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Due…"
            aria-label="Due date"
          />
          <button className="winBtn" onClick={add}>
            Add
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {shown.map((t) => (
            <div key={t.id} className={`todoItem ${t.done ? "done" : ""}`}>
              <span
                className={`tdCheck ${t.done ? "on" : ""}`}
                role="checkbox"
                aria-checked={!!t.done}
                title={t.done ? "Mark as not completed" : "Mark completed"}
                onClick={() => save({ ...t, done: !t.done })}
              >
                <svg viewBox="0 0 16 16" width="12" height="12">
                  <path
                    d="M3 8.5l3.2 3.2L13 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.text}
              </span>
              {t.due && <span className="calChip">{t.due}</span>}
              <button
                className={`tdStar ${t.important ? "on" : ""}`}
                title="Important"
                onClick={() => save({ ...t, important: !t.important })}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z"
                    fill={t.important ? "#f8ce3b" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button className="winBtn ghost" onClick={() => remove(t.id)}>
                Delete
              </button>
            </div>
          ))}
          {shown.length === 0 && <div className="winMuted">You're all caught up.</div>}
        </div>
      </div>
    </WinApp>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Mail — a placeholder, done right.
   No server behind it. Everything lives on this PC (IndexedDB), and
   wherever a real mail server would be required, the app says so.
   All icons are inline SVG. No emoji.
   ═══════════════════════════════════════════════════════════════════ */

const MAIL_ICONS = {
  Plus: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  ),
  Inbox: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M3 5.5l7-4 7 4v10l-7 3.5-7-3.5v-10z" strokeLinejoin="round" />
      <path d="M3 5.5l7 4 7-4M10 9.5v9.5" strokeLinejoin="round" />
    </svg>
  ),
  Send: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M2.5 10L17 3l-4.5 14-3-6-7-1z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  Draft: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M13.5 2.5l4 4L7 17l-4.5 1 1-4.5 10-11z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  Search: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  Sync: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Reply: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M8 3L3 8l5 5M3 8h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ReplyAll: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M7 3L2 8l5 5M14 3l-5 5 5 5M2 8h11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Forward: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M8 3l5 5-5 5M13 8H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Flag: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 2v12M4 3h8l-1.5 3L12 9H4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
  Trash: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M4 5h8M6.5 5V3.5h3V5M5.5 5l.5 8h4l.5-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Copy: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="5" y="5" width="8" height="9" rx="1.5" />
      <path
        d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5"
        strokeLinecap="round"
      />
    </svg>
  ),
  Check: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Envelope: (
    <svg
      viewBox="0 0 48 48"
      width="56"
      height="56"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="4" y="10" width="40" height="28" rx="4" />
      <path d="M6 13l18 13 18-13" strokeLinejoin="round" />
    </svg>
  ),
};

const mailLocalAddress = (name) => {
  const slug =
    String(name || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 16) || "user";
  return `${slug}@webos.local`;
};

export const MailApp = ({ id = "mail", title = "Mail" }) => {
  const [items, save, remove] = useStore("mail");
  const [folder, setFolder] = useState("inbox");
  const [sel, setSel] = useState(null);
  const [compose, setCompose] = useState(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const person = useSelector((st) => st.setting.person.name);
  const address = mailLocalAddress(person);

  /* seed with a few honest welcome messages — only once */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const flag = `mail.seeded.${id}`;
        if (!(await idb.get(flag))) {
          await save({
            id: uid("ml"),
            folder: "inbox",
            read: false,
            from: "Windows",
            to: "me",
            subject: "Welcome to Mail",
            body: `Hi ${person || "there"},\n\nThis Mail app has no server behind it — every message lives in your Virtual Storage (IndexedDB), and it survives refreshes. Compose, Drafts, Sent, search and folders all work end-to-end on this PC.\n\nWhere a real mail server would be required, the app says so plainly. No pretending.\n\n— The Mail team`,
            at: Date.now() - 1000 * 60 * 12,
          });
          await save({
            id: uid("ml"),
            folder: "inbox",
            read: false,
            from: "Microsoft Store",
            to: "me",
            subject: "Your apps are ready",
            body: "Open Microsoft Store to install Paint, VS Code, Wikipedia and games. Everything you install lands on your desktop and persists across refreshes.",
            at: Date.now() - 1000 * 60 * 90,
          });
          await save({
            id: uid("ml"),
            folder: "inbox",
            read: true,
            from: "WebOS Tips",
            to: "me",
            subject: "A tiny tip",
            body: "Try the search box at the top of the rail — it filters across the current folder. Click a message to mark it read. Compose keeps a copy in Sent, and Save draft works too.",
            at: Date.now() - 1000 * 60 * 60 * 26,
          });
          await idb.set(flag, true);
        }
      } catch (e) {}
      if (!dead) setReady(true);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* the honest notification — used everywhere a real server would be needed */
  const placeholder = (what, detail) =>
    notify({
      app: "Mail",
      icon: "img/icon/mail.png",
      title: "Just a placeholder",
      body: detail || `${what} needs a real mail server — this PC only stores mail locally.`,
      kind: "info",
      life: 5,
    });

  const unread = (f) => items.filter((m) => (m.folder || "inbox") === f && !m.read).length;
  const draftCount = items.filter((m) => (m.folder || "inbox") === "drafts").length;
  const view = items
    .filter((m) => (m.folder || "inbox") === folder)
    .filter(
      (m) =>
        !query.trim() ||
        `${m.from || ""} ${m.to || ""} ${m.subject || ""} ${m.body || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => (b.at || 0) - (a.at || 0));
  const cur = view.find((m) => m.id === sel);

  const openMail = async (m) => {
    setSel(m.id);
    setCompose(null);
    if (!m.read) await save({ ...m, read: true });
  };
  const startCompose = (preset = {}) => {
    setSel(null);
    setCompose({ to: preset.to || "", subject: preset.subject || "", body: preset.body || "" });
  };
  const doSend = async () => {
    if (!compose || (!compose.to.trim() && !compose.body.trim())) return;
    const rec = {
      id: uid("ml"),
      folder: "sent",
      read: true,
      from: person || "Me",
      ...compose,
      at: Date.now(),
    };
    await save(rec);
    setCompose(null);
    setSel(rec.id);
    setFolder("sent");
    notify({
      app: title,
      title: "Message queued",
      body: "This PC has no mail server, so the message stays in your Sent folder on this machine.",
      kind: "info",
      life: 5,
    });
  };
  const saveDraft = async () => {
    if (!compose) return;
    await save({
      id: uid("ml"),
      folder: "drafts",
      read: true,
      from: person || "Me",
      ...compose,
      at: Date.now(),
    });
    setCompose(null);
    setFolder("drafts");
  };
  const del = async (m) => {
    await remove(m.id);
    setSel(null);
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify({
        app: "Mail",
        title: "Address copied",
        body: "Just a placeholder — this is a local address, real mail can't reach it.",
        kind: "info",
        life: 4,
      });
    } catch (e) {}
  };

  const folders = [
    ["inbox", "Inbox", unread("inbox"), MAIL_ICONS.Inbox],
    ["sent", "Sent", 0, MAIL_ICONS.Send],
    ["drafts", "Drafts", draftCount, MAIL_ICONS.Draft],
  ];
  const day = (t) => {
    const d = new Date(t || Date.now());
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <WinApp id={id} title={title}>
      <div className="mailApp">
        {/* ── RAIL ── */}
        <div className="mailRail">
          <div className="mailRailHead">
            <button className="winBtn accent mailNew" onClick={() => startCompose()}>
              {MAIL_ICONS.Plus}
              New mail
            </button>
          </div>

          <div className="mailAddr">
            <div className="mailAddrLabel">Your address</div>
            <button className="mailAddrRow" onClick={copyAddress} title="Click to copy">
              <span className="mailAddrTxt">{address}</span>
              <span className={`mailAddrIcon ${copied ? "ok" : ""}`}>
                {copied ? MAIL_ICONS.Check : MAIL_ICONS.Copy}
              </span>
            </button>
          </div>

          <div className="mailSearch">
            {MAIL_ICONS.Search}
            <input
              className="mailSearchInput"
              placeholder="Search mail"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <nav className="mailNav">
            {folders.map(([f, label, n, icon]) => (
              <button
                key={f}
                className={`mailFolder ${folder === f && !compose ? "on" : ""}`}
                onClick={() => {
                  setFolder(f);
                  setCompose(null);
                  setSel(null);
                }}
              >
                <span className="mailFolderIcon">{icon}</span>
                <span className="mailFolderLabel">{label}</span>
                {n > 0 && <span className="mailBadge">{n}</span>}
              </button>
            ))}
          </nav>

          <button
            className="mailRailAction"
            onClick={() =>
              placeholder(
                "Refresh from server",
                "No server to sync — every message lives on this PC.",
              )
            }
          >
            {MAIL_ICONS.Sync}
            Sync
          </button>

          <div className="mailFoot">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M8 5v3.5M8 11h.01"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Local storage only
          </div>
        </div>

        {/* ── LIST ── */}
        <div className="mailList">
          <div className="mailListHead">
            <span className="mailListFolder">
              {folder.charAt(0).toUpperCase() + folder.slice(1)}
            </span>
            <span className="winMuted">
              {view.length} message{view.length === 1 ? "" : "s"}
            </span>
          </div>
          {ready && view.length === 0 ? (
            <div className="mailListEmpty winMuted">
              {query ? "No messages match your search." : `Nothing in ${folder}.`}
            </div>
          ) : (
            view.map((m) => (
              <div
                key={m.id}
                className={`mailRow ${cur?.id === m.id ? "on" : ""} ${m.read ? "" : "unread"}`}
                onClick={() => openMail(m)}
              >
                <div className="mailRowTop">
                  <b className="mailFrom">{m.from || m.to || "Me"}</b>
                  <span className="winMuted mailDate">{day(m.at)}</span>
                </div>
                <div className="mailSubj">{m.subject || "(no subject)"}</div>
                <div className="winMuted mailPrev">
                  {String(m.body || "")
                    .replace(/\s+/g, " ")
                    .slice(0, 90)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── BODY ── */}
        <div className="mailBody">
          {compose ? (
            <div className="mailCompose">
              <div className="mailComposeBar">
                <button
                  className="winBtn accent"
                  onClick={doSend}
                  disabled={!compose.to.trim() && !compose.body.trim()}
                >
                  {MAIL_ICONS.Send}
                  Send
                </button>
                <button className="winBtn ghost" onClick={saveDraft}>
                  Save draft
                </button>
                <div style={{ flex: 1 }} />
                <button className="winBtn ghost" onClick={() => setCompose(null)} title="Discard">
                  Discard
                </button>
              </div>
              <div className="mailComposeFields">
                <div className="mailComposeField">
                  <span className="mailComposeLabel">To</span>
                  <input
                    className="mailComposeInput"
                    placeholder="name@example.com"
                    value={compose.to}
                    onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  />
                </div>
                <div className="mailComposeField">
                  <span className="mailComposeLabel">Subject</span>
                  <input
                    className="mailComposeInput"
                    placeholder="Add a subject"
                    value={compose.subject}
                    onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  />
                </div>
              </div>
              <textarea
                className="mailComposeBody"
                placeholder="Write your message…"
                value={compose.body}
                onChange={(e) => setCompose({ ...compose, body: e.target.value })}
              />
            </div>
          ) : cur ? (
            <div className="mailRead">
              <div className="mailReadBar">
                <button
                  className="winBtn ghost"
                  onClick={() =>
                    startCompose({
                      to: cur.from === (person || "Me") ? cur.to : cur.from,
                      subject: /^Re: /i.test(cur.subject || "")
                        ? cur.subject
                        : `Re: ${cur.subject || ""}`,
                      body: `\n\n> ${String(cur.body || "")
                        .split("\n")
                        .join("\n> ")}`,
                    })
                  }
                >
                  {MAIL_ICONS.Reply} Reply
                </button>
                <button
                  className="winBtn ghost"
                  onClick={() =>
                    placeholder(
                      "Reply all",
                      "Reply all needs a real mail server — this PC only stores mail locally.",
                    )
                  }
                >
                  {MAIL_ICONS.ReplyAll} Reply all
                </button>
                <button
                  className="winBtn ghost"
                  onClick={() =>
                    placeholder(
                      "Forward",
                      "Forwarding needs a real mail server — this PC only stores mail locally.",
                    )
                  }
                >
                  {MAIL_ICONS.Forward} Forward
                </button>
                <div style={{ flex: 1 }} />
                <button
                  className="winBtn ghost"
                  onClick={() => placeholder("Flag")}
                  title="Flag message"
                >
                  {MAIL_ICONS.Flag}
                </button>
                <button className="winBtn ghost mailDel" onClick={() => del(cur)} title="Delete">
                  {MAIL_ICONS.Trash} Delete
                </button>
              </div>
              <h1 className="mailReadSubject">{cur.subject || "(no subject)"}</h1>
              <div className="mailReadMeta">
                <div className="mailReadAvatar">{(cur.from || "?")[0].toUpperCase()}</div>
                <div className="mailReadWho">
                  <div className="mailReadFrom">{cur.from}</div>
                  <div className="winMuted">
                    to {cur.to || "me"} · {new Date(cur.at || Date.now()).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="mailReadBody">{cur.body}</div>
            </div>
          ) : (
            <div className="mailEmpty">
              <div className="mailEmptyIcon">{MAIL_ICONS.Envelope}</div>
              <div className="mailEmptyTitle">No message selected</div>
              <div className="winMuted">Select a message, or compose something new.</div>
              <button className="winBtn accent" onClick={() => startCompose()}>
                {MAIL_ICONS.Plus} Compose
              </button>
            </div>
          )}
        </div>
      </div>
    </WinApp>
  );
};
/* Photos moved to apps/photos.jsx — the real Windows 11 viewer. */

/* ═══════════════════════════════════════════════════════════════════
   Maps — live OpenStreetMap embed + Photon live autocomplete.
   Photon (photon.komoot.io) is a free, CORS-enabled geocoder built on
   OSM data that EXPLICITLY supports live/autocomplete search — unlike
   Nominatim which forbids it. No key, no signup. We debounce the input
   and cap results to keep it fair-use clean.
   ═══════════════════════════════════════════════════════════════════ */

const PHOTON = "https://photon.komoot.io";

const MAP_LAYERS = [
  { id: "mapnik", label: "Standard" },
  { id: "cyclosm", label: "CyclOSM" },
  { id: "cyclemap", label: "Cycle Map" },
  { id: "transportmap", label: "Transport" },
  { id: "hot", label: "Humanitarian" },
];

const PHOTON_CACHE = new Map();
const PHOTON_LAST = { t: 0 };

const photonSearch = async (q, limit = 10) => {
  const key = `${q}|${limit}`;
  if (PHOTON_CACHE.has(key)) return PHOTON_CACHE.get(key);

  // gentle throttle — 250ms between requests even if user types fast
  const wait = Math.max(0, 250 - (Date.now() - PHOTON_LAST.t));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  PHOTON_LAST.t = Date.now();

  const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`photon ${r.status}`);
  const data = await r.json();
  const out = (data.features || []).map((f) => {
    const p = f.properties || {};
    const coords = (f.geometry && f.geometry.coordinates) || [0, 0];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);

    // build a human-friendly display line
    const parts = [];
    if (p.street) parts.push(p.housenumber ? `${p.housenumber} ${p.street}` : p.street);
    if (p.city && p.city !== p.name) parts.push(p.city);
    else if (p.district && p.district !== p.name) parts.push(p.district);
    if (p.state && p.state !== p.name) parts.push(p.state);
    if (p.country) parts.push(p.country);
    const display = parts.join(", ") || p.name || q;

    // extent: [west, north, east, south] → OSM bbox: [W, S, E, N]
    let bbox = null;
    if (Array.isArray(p.extent) && p.extent.length === 4) {
      bbox = [p.extent[0], p.extent[3], p.extent[2], p.extent[1]];
    }

    return {
      id: `${p.osm_type || "X"}${p.osm_id || Math.random()}`,
      name: p.name || p.city || p.street || q,
      display,
      lat,
      lon,
      bbox,
      type: p.type || p.osm_value || "place",
    };
  });
  PHOTON_CACHE.set(key, out);
  return out;
};

/* ─── Location detection (IP + timezone cross-check) ─────────
 * No single free IP geolocation service is reliable enough to trust
 * on its own — Indian ISPs in particular often register their IP
 * blocks through regional authorities that place them in the wrong
 * continent. So we:
 *   1. Ask up to three free IP services (first to answer wins).
 *   2. Cross-check the result against the browser's own timezone,
 *      which comes from the operating system — not a third party.
 *   3. If they disagree, trust the timezone. It's the honest answer.
 * Cached in sessionStorage: one lookup per browser session.
 * ─────────────────────────────────────────────────────────── */

const IP_GEO_KEY = "maps.ipgeo";

const IP_SERVICES = [
  {
    url: "https://ipapi.co/json/",
    pick: (d) =>
      d && d.latitude && d.longitude
        ? {
            name: d.city || d.region || d.country_name || "My area",
            display: [d.city, d.region, d.country_name].filter(Boolean).join(", "),
            lat: Number(d.latitude),
            lon: Number(d.longitude),
            country: String(d.country_name || "").toLowerCase(),
          }
        : null,
  },
  {
    url: "https://ipwho.is/",
    pick: (d) =>
      d && d.success !== false && d.latitude && d.longitude
        ? {
            name: d.city || d.region || d.country || "My area",
            display: [d.city, d.region, d.country].filter(Boolean).join(", "),
            lat: Number(d.latitude),
            lon: Number(d.longitude),
            country: String(d.country || "").toLowerCase(),
          }
        : null,
  },
  {
    url: "https://ippubblico.org/?api=1",
    pick: (d) =>
      d && d.status === "ok" && d.geo
        ? {
            name: d.geo.city || d.geo.region || d.geo.country || "My area",
            display: [d.geo.city, d.geo.region, d.geo.country].filter(Boolean).join(", "),
            lat: Number(d.geo.lat),
            lon: Number(d.geo.lon),
            country: String(d.geo.country || "").toLowerCase(),
          }
        : null,
  },
];

/* Timezone → a sane default city. Only the common cases are needed;
   unknown timezones simply fall through to whatever IP gave us. */
const TZ_DEFAULTS = {
  "Asia/Kolkata": {
    name: "New Delhi",
    display: "India",
    lat: 28.6139,
    lon: 77.209,
    country: "india",
  },
  "Asia/Calcutta": {
    name: "New Delhi",
    display: "India",
    lat: 28.6139,
    lon: 77.209,
    country: "india",
  },
  "Asia/Tokyo": { name: "Tokyo", display: "Japan", lat: 35.6762, lon: 139.6503, country: "japan" },
  "Asia/Shanghai": {
    name: "Beijing",
    display: "China",
    lat: 39.9042,
    lon: 116.4074,
    country: "china",
  },
  "Asia/Hong_Kong": {
    name: "Hong Kong",
    display: "Hong Kong",
    lat: 22.3193,
    lon: 114.1694,
    country: "hong kong",
  },
  "Asia/Singapore": {
    name: "Singapore",
    display: "Singapore",
    lat: 1.3521,
    lon: 103.8198,
    country: "singapore",
  },
  "Asia/Dubai": {
    name: "Dubai",
    display: "United Arab Emirates",
    lat: 25.2048,
    lon: 55.2708,
    country: "united arab emirates",
  },
  "Asia/Karachi": {
    name: "Karachi",
    display: "Pakistan",
    lat: 24.8607,
    lon: 67.0011,
    country: "pakistan",
  },
  "Asia/Dhaka": {
    name: "Dhaka",
    display: "Bangladesh",
    lat: 23.8103,
    lon: 90.4125,
    country: "bangladesh",
  },
  "Asia/Kathmandu": {
    name: "Kathmandu",
    display: "Nepal",
    lat: 27.7172,
    lon: 85.324,
    country: "nepal",
  },
  "Asia/Colombo": {
    name: "Colombo",
    display: "Sri Lanka",
    lat: 6.9271,
    lon: 79.8612,
    country: "sri lanka",
  },
  "Asia/Jakarta": {
    name: "Jakarta",
    display: "Indonesia",
    lat: -6.2088,
    lon: 106.8456,
    country: "indonesia",
  },
  "Asia/Seoul": {
    name: "Seoul",
    display: "South Korea",
    lat: 37.5665,
    lon: 126.978,
    country: "south korea",
  },
  "Europe/London": {
    name: "London",
    display: "United Kingdom",
    lat: 51.5074,
    lon: -0.1278,
    country: "united kingdom",
  },
  "Europe/Paris": {
    name: "Paris",
    display: "France",
    lat: 48.8566,
    lon: 2.3522,
    country: "france",
  },
  "Europe/Berlin": {
    name: "Berlin",
    display: "Germany",
    lat: 52.52,
    lon: 13.405,
    country: "germany",
  },
  "Europe/Madrid": {
    name: "Madrid",
    display: "Spain",
    lat: 40.4168,
    lon: -3.7038,
    country: "spain",
  },
  "Europe/Rome": { name: "Rome", display: "Italy", lat: 41.9028, lon: 12.4964, country: "italy" },
  "Europe/Moscow": {
    name: "Moscow",
    display: "Russia",
    lat: 55.7558,
    lon: 37.6173,
    country: "russia",
  },
  "America/New_York": {
    name: "New York",
    display: "United States",
    lat: 40.7128,
    lon: -74.006,
    country: "united states",
  },
  "America/Chicago": {
    name: "Chicago",
    display: "United States",
    lat: 41.8781,
    lon: -87.6298,
    country: "united states",
  },
  "America/Denver": {
    name: "Denver",
    display: "United States",
    lat: 39.7392,
    lon: -104.9903,
    country: "united states",
  },
  "America/Los_Angeles": {
    name: "Los Angeles",
    display: "United States",
    lat: 34.0522,
    lon: -118.2437,
    country: "united states",
  },
  "America/Toronto": {
    name: "Toronto",
    display: "Canada",
    lat: 43.6532,
    lon: -79.3832,
    country: "canada",
  },
  "America/Sao_Paulo": {
    name: "São Paulo",
    display: "Brazil",
    lat: -23.5505,
    lon: -46.6333,
    country: "brazil",
  },
  "America/Mexico_City": {
    name: "Mexico City",
    display: "Mexico",
    lat: 19.4326,
    lon: -99.1332,
    country: "mexico",
  },
  "Australia/Sydney": {
    name: "Sydney",
    display: "Australia",
    lat: -33.8688,
    lon: 151.2093,
    country: "australia",
  },
  "Australia/Melbourne": {
    name: "Melbourne",
    display: "Australia",
    lat: -37.8136,
    lon: 144.9631,
    country: "australia",
  },
  "Africa/Cairo": { name: "Cairo", display: "Egypt", lat: 30.0444, lon: 31.2357, country: "egypt" },
  "Africa/Lagos": {
    name: "Lagos",
    display: "Nigeria",
    lat: 6.5244,
    lon: 3.3792,
    country: "nigeria",
  },
  "Africa/Nairobi": {
    name: "Nairobi",
    display: "Kenya",
    lat: -1.2921,
    lon: 36.8219,
    country: "kenya",
  },
  "Africa/Johannesburg": {
    name: "Johannesburg",
    display: "South Africa",
    lat: -26.2041,
    lon: 28.0473,
    country: "south africa",
  },
};

const timezoneDefault = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return TZ_DEFAULTS[tz] || null;
  } catch (e) {
    return null;
  }
};

const getIpLocation = async () => {
  try {
    const cached = sessionStorage.getItem(IP_GEO_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const tzPlace = timezoneDefault();

  for (const svc of IP_SERVICES) {
    try {
      const r = await fetch(svc.url, { headers: { Accept: "application/json" } });
      if (!r.ok) continue;
      const d = await r.json();
      const place = svc.pick(d);
      if (!place || !isFinite(place.lat) || !isFinite(place.lon)) continue;

      /* cross-check: if the IP says one country but the OS timezone
         says another, the timezone wins — it's set by the user's OS,
         not a stale third-party IP database */
      let final = place;
      if (
        tzPlace &&
        place.country &&
        tzPlace.country &&
        !place.country.includes(tzPlace.country) &&
        !tzPlace.country.includes(place.country)
      ) {
        final = { ...tzPlace };
      }

      try {
        sessionStorage.setItem(IP_GEO_KEY, JSON.stringify(final));
      } catch (e) {}
      return final;
    } catch (e) {
      /* try the next service */
    }
  }

  /* every IP service failed — use the timezone default */
  if (tzPlace) {
    try {
      sessionStorage.setItem(IP_GEO_KEY, JSON.stringify(tzPlace));
    } catch (e) {}
  }
  return tzPlace;
};

const MAP_RECENT_KEY = "maps.recent";

export const MapsApp = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [sel, setSel] = useState({ name: "Locating…", display: "", lat: 20, lon: 0, bbox: null });
  const [ipBased, setIpBased] = useState(false);
  const [layer, setLayer] = useState("mapnik");
  const [recent, setRecent] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [locating, setLocating] = useState(false);

  const lastQueryRef = useRef(""); // avoid re-searching after flyTo
  const reqIdRef = useRef(0); // cancel stale responses

  useEffect(() => {
    idb
      .get(MAP_RECENT_KEY)
      .then((v) => setRecent(Array.isArray(v) ? v : []))
      .catch(() => {});
  }, []);
  /* one-shot: centre the map on the visitor's IP-based location */
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const place = await getIpLocation();
        if (dead) return;
        const d = 0.06;
        setSel({
          name: place.name,
          display: place.display,
          lat: place.lat,
          lon: place.lon,
          bbox: [place.lon - d * 1.6, place.lat - d, place.lon + d * 1.6, place.lat + d],
        });
        setIpBased(true);
      } catch (e) {
        if (dead) return;
        setSel({ name: "World", display: "", lat: 20, lon: 0, bbox: null });
        setIpBased(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);
  const persistRecent = (list) => {
    setRecent(list);
    idb.set(MAP_RECENT_KEY, list).catch(() => {});
  };
  const pushRecent = (place) => {
    const next = [place, ...recent.filter((x) => x.id !== place.id)].slice(0, 8);
    persistRecent(next);
  };
  const clearRecent = () => persistRecent([]);

  const flyTo = (place) => {
    let bbox = place.bbox;
    if (!bbox || bbox.length !== 4 || bbox.some((n) => !isFinite(n))) {
      const d = 0.08;
      bbox = [place.lon - d * 1.6, place.lat - d, place.lon + d * 1.6, place.lat + d];
    }
    setSel({ ...place, bbox });
    setResults([]);
    setShowRecent(false);
    lastQueryRef.current = place.name || "";
    setQuery(place.name || "");
    pushRecent(place);
    setIpBased(false);
  };

  /* live search — debounced, min 2 chars, cached */
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || term === lastQueryRef.current) {
      if (term.length < 2) setResults([]);
      return;
    }
    const myReq = ++reqIdRef.current;
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchErr("");
      try {
        const list = await photonSearch(term, 10);
        if (myReq !== reqIdRef.current) return; // stale response — a newer one is in flight
        setResults(list);
        lastQueryRef.current = term;
        if (!list.length) setSearchErr("No place found. Try a fuller name.");
      } catch (e) {
        if (myReq !== reqIdRef.current) return;
        setSearchErr("Search failed — " + String(e.message || e));
        setResults([]);
      }
      setSearching(false);
    }, 260);
    return () => clearTimeout(t);
  }, [query]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      notify({
        app: "Maps",
        title: "Location unavailable",
        body: "This browser does not expose geolocation.",
        kind: "error",
        life: 4,
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const d = 0.02;
        setSel({
          name: "My location",
          display: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          lat,
          lon,
          bbox: [lon - d * 1.6, lat - d, lon + d * 1.6, lat + d],
        });
        setResults([]);
        setShowRecent(false);
        setIpBased(false);
        setQuery("");
        lastQueryRef.current = "";
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        notify({
          app: "Maps",
          title: "Could not get location",
          body: String(err.message || err),
          kind: "error",
          life: 4,
        });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const bb = sel.bbox || [sel.lon - 0.05, sel.lat - 0.05, sel.lon + 0.05, sel.lat + 0.05];
  const bboxStr = `${bb[0].toFixed(4)},${bb[1].toFixed(4)},${bb[2].toFixed(4)},${bb[3].toFixed(4)}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bboxStr}&layer=${layer}&marker=${sel.lat.toFixed(5)},${sel.lon.toFixed(5)}`;

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(`${sel.lat.toFixed(6)}, ${sel.lon.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };

  const openInOsm = () => {
    const url = `https://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lon}#map=14/${sel.lat}/${sel.lon}`;
    /* "View on openstreetmap.org" leaves the OS for the real browser */
    openExternal(url);
  };

  return (
    <WinApp id="maps" title="Maps">
      <div className="mapApp">
        <iframe
          className="mapFrame"
          title="OpenStreetMap"
          src={src}
          frameBorder="0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />

        <div className="mapSearch">
          <div className="mapSearchRow">
            <span className="mapSearchIco" aria-hidden="true">
              <svg
                viewBox="0 0 16 16"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="mapSearchInput"
              placeholder="Search any place on Earth…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  setResults([]);
                  lastQueryRef.current = "";
                }
              }}
              onFocus={() => {
                if (!results.length && recent.length && query.trim().length < 2)
                  setShowRecent(true);
              }}
            />
            {searching && (
              <span className="mapSearchSpin" aria-hidden="true">
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="8" cy="8" r="6" opacity="0.25" />
                  <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round">
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 8 8"
                      to="360 8 8"
                      dur="0.9s"
                      repeatCount="indefinite"
                    />
                  </path>
                </svg>
              </span>
            )}
            {query && !searching && (
              <button
                className="mapSearchClear"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  lastQueryRef.current = "";
                }}
                aria-label="Clear"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {results.length > 0 && (
            <div className="mapDrops">
              {results.map((p) => (
                <button key={p.id} className="mapDrop" onClick={() => flyTo(p)}>
                  <b>{p.name}</b>
                  <span className="mapDropMeta">{p.display}</span>
                </button>
              ))}
            </div>
          )}

          {!results.length &&
            !searching &&
            showRecent &&
            recent.length > 0 &&
            query.trim().length < 2 && (
              <div className="mapDrops">
                <div className="mapDropHead">
                  <span>Recent</span>
                  <button className="mapDropClear" onClick={clearRecent}>
                    Clear
                  </button>
                </div>
                {recent.map((p) => (
                  <button key={p.id} className="mapDrop" onClick={() => flyTo(p)}>
                    <b>{p.name}</b>
                    <span className="mapDropMeta">{p.display}</span>
                  </button>
                ))}
              </div>
            )}

          {searchErr && !searching && (
            <div className="mapDrops">
              <div className="mapDrop mapDropErr">{searchErr}</div>
            </div>
          )}
        </div>

        <div className="mapTools">
          <button
            className="winBtn ghost mapTool"
            onClick={locateMe}
            disabled={locating}
            title="Show my location"
            aria-label="My location"
          >
            {locating ? (
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="8" cy="8" r="6" opacity="0.25" />
                <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 8 8"
                    to="360 8 8"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </path>
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="8" cy="8" r="2.6" />
                <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            className="winBtn ghost mapTool"
            onClick={copyCoords}
            title="Copy coordinates"
            aria-label="Copy coordinates"
          >
            {copied ? (
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="5" y="5" width="8" height="9" rx="1.5" />
                <path
                  d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <button
            className="winBtn ghost mapTool"
            onClick={openInOsm}
            title="Open in OpenStreetMap"
            aria-label="Open in OpenStreetMap"
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M9 3h4v4M13 3L7 9M11 9v3.5A1.5 1.5 0 0 1 9.5 14H4.5A1.5 1.5 0 0 1 3 12.5V7.5A1.5 1.5 0 0 1 4.5 6H8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="mapLayers" role="group" aria-label="Map layer">
          {MAP_LAYERS.map((l) => (
            <button
              key={l.id}
              className={`mapLayerChip ${layer === l.id ? "on" : ""}`}
              onClick={() => setLayer(l.id)}
              title={l.label}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="mapInfo">
          <div className="mapInfoTop">
            <div className="mapInfoNameRow">
              <div className="mapInfoName">{sel.name}</div>
              {ipBased && (
                <span
                  className="mapInfoBadge"
                  title="Approximate location based on your IP address"
                >
                  IP-based
                </span>
              )}
            </div>
            <div className="mapInfoCoords">
              {sel.lat.toFixed(4)}, {sel.lon.toFixed(4)}
            </div>
          </div>
          {sel.display && sel.display !== sel.name && (
            <div className="mapInfoDisplay">{sel.display}</div>
          )}
          <div className="mapInfoFoot">
            Map data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap
            </a>{" "}
            contributors · Search by{" "}
            <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">
              Photon
            </a>
          </div>
        </div>
      </div>
    </WinApp>
  );
};
/* ═══════════════════════════════════════════════════════════════════
   News — Wikipedia live feeds (Wikinews was discontinued May 2026)
   • Top stories    → Main Page "In the news"      (curated, daily)
   • On this day    → Main Page "On this day"      (historical)
   • World          → Portal:Current events        (running log)
   • Others         → Current events, keyword-filtered by topic
   No API key. No proxy. CORS via origin=*. All live.
   ═══════════════════════════════════════════════════════════════════ */

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const NEWS_CACHE = new Map();

const NEWS_CATS = [
  { id: "top", label: "Top stories" },
  { id: "world", label: "World" },
  { id: "politics", label: "Politics" },
  { id: "tech", label: "Science & tech" },
  { id: "business", label: "Business" },
  { id: "sports", label: "Sports" },
  { id: "culture", label: "Culture" },
  { id: "onthisday", label: "On this day" },
];

/* ── Curated top stories — Main Page "In the news" ───────────── */
async function fetchInTheNews() {
  const url = `${WIKI_API}?action=parse&page=Main_Page&prop=text&format=json&origin=*`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikipedia " + r.status);
  const data = await r.json();
  const html = data?.parse?.text?.["*"] || "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const itn = doc.querySelector("#mp-itn");
  if (!itn) throw new Error("in-the-news section missing");

  const items = [];
  itn.querySelectorAll("li").forEach((li) => {
    const a = li.querySelector("a[href^='/wiki/']");
    if (!a) return;
    const wikiTitle = decodeURIComponent(
      (a.getAttribute("href") || "").replace("/wiki/", ""),
    ).replace(/_/g, " ");
    if (!wikiTitle || wikiTitle.includes(":")) return;
    items.push({
      id: `itn-${wikiTitle}`,
      title: wikiTitle,
      headline: wikiTitle,
      summary: li.textContent.replace(/\s+/g, " ").trim().slice(0, 340),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
      wikiTitle,
      source: "Wikipedia · In the news",
    });
  });
  return items;
}

/* ── Historical events — Main Page "On this day" ─────────────── */
async function fetchOnThisDay() {
  const url = `${WIKI_API}?action=parse&page=Main_Page&prop=text&format=json&origin=*`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikipedia " + r.status);
  const data = await r.json();
  const html = data?.parse?.text?.["*"] || "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const otd = doc.querySelector("#mp-otd");
  if (!otd) throw new Error("on-this-day section missing");

  const items = [];
  otd.querySelectorAll("li").forEach((li) => {
    const a = li.querySelector("a[href^='/wiki/']");
    if (!a) return;
    const wikiTitle = decodeURIComponent(
      (a.getAttribute("href") || "").replace("/wiki/", ""),
    ).replace(/_/g, " ");
    if (!wikiTitle || wikiTitle.includes(":")) return;
    const text = li.textContent.replace(/\s+/g, " ").trim();
    const yearMatch = text.match(/^(\d{2,4})\s*[–—\-]/);
    items.push({
      id: `otd-${wikiTitle}`,
      title: wikiTitle,
      headline: yearMatch ? `${yearMatch[1]} — ${wikiTitle}` : wikiTitle,
      summary: text.slice(0, 340),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
      wikiTitle,
      source: "Wikipedia · On this day",
    });
  });
  return items;
}

/* ── Running world log — Portal:Current events ───────────────── */
async function fetchCurrentEvents() {
  const url = `${WIKI_API}?action=parse&page=Portal:Current_events&prop=text&format=json&origin=*`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("wikipedia " + r.status);
  const data = await r.json();
  const html = data?.parse?.text?.["*"] || "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const items = [];
  const seen = new Set();
  doc.querySelectorAll("li").forEach((li) => {
    const a = li.querySelector("a[href^='/wiki/']");
    if (!a) return;
    const wikiTitle = decodeURIComponent(
      (a.getAttribute("href") || "").replace("/wiki/", ""),
    ).replace(/_/g, " ");
    if (!wikiTitle || wikiTitle.includes(":")) return;
    const summary = li.textContent.replace(/\s+/g, " ").trim();
    if (summary.length < 50) return;
    const key = `${wikiTitle}|${summary.slice(0, 60)}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      id: `ce-${wikiTitle}-${items.length}`,
      title: wikiTitle,
      headline: wikiTitle,
      summary: summary.slice(0, 340),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
      wikiTitle,
      source: "Wikipedia · Current events",
    });
  });
  return items.slice(0, 80);
}

/* ── Topic keyword filters over the current-events pool ──────── */
const CAT_FILTERS = {
  politics:
    /politic|elect|vote|parliament|senate|congress|minister|president|prime|party|coalition|diplomat|treaty|cabinet/i,
  tech: /technolog|science|computer|software|space|NASA|research|study|discov|launch|satellite|rocket|artificial|internet|cyber|quantum|physics|chemistry|biology/i,
  business:
    /business|econom|market|trade|financ|compan|invest|industr|stock|bank|currency|merger|IPO|GDP|inflation/i,
  sports:
    /sport|game|match|champion|olympic|tournament|team|player|football|soccer|cricket|tennis|basketball|racing|league|cup|medal/i,
  culture:
    /film|movie|music|art|entertain|culture|festival|award|actor|singer|album|novel|book|exhibit|museum/i,
};

async function fetchNews(catId) {
  if (NEWS_CACHE.has(catId)) return NEWS_CACHE.get(catId);
  let out = [];
  try {
    if (catId === "top") out = await fetchInTheNews();
    else if (catId === "onthisday") out = await fetchOnThisDay();
    else if (catId === "world") out = await fetchCurrentEvents();
    else {
      const pool = await fetchCurrentEvents();
      const re = CAT_FILTERS[catId];
      out = re ? pool.filter((it) => re.test(it.summary)) : pool;
      /* if a topic is quiet today, fall back to the general pool so
         the view is never empty — the source label stays honest */
      if (out.length === 0) out = pool.slice(0, 24);
    }
  } catch (e) {
    console.warn("[News] fetch failed:", catId, e);
    out = [];
  }
  NEWS_CACHE.set(catId, out);
  return out;
}

/* ── Thumbnails + short extracts via pageimages ──────────────── */
async function fetchArticleInfo(titles) {
  const out = {};
  const batches = [];
  for (let i = 0; i < titles.length; i += 20) batches.push(titles.slice(i, i + 20));
  for (const batch of batches) {
    const t = batch.map((x) => encodeURIComponent(x.replace(/ /g, "_"))).join("|");
    const url = `${WIKI_API}?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=640&titles=${t}&format=json&origin=*&redirects=1`;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      Object.values(d?.query?.pages || {}).forEach((p) => {
        if (!p.title) return;
        out[p.title] = { image: p.thumbnail?.source || null };
      });
    } catch (e) {
      /* skip */
    }
  }
  return out;
}

/* ── Full article body — Wikipedia paragraphs only ───────────── */
async function fetchArticleBody(title) {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*&redirects=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("article " + r.status);
  const data = await r.json();
  const html = data?.parse?.text?.["*"] || "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      ".mw-editsection, .metadata, .ambox, .infobox, table.infobox, .navbox, .reflist, sup.reference, style, script, .hatnote, .toc, #toc, .mw-empty-elt, .navbox-styles, .catlinks, .printfooter",
    )
    .forEach((el) => el.remove());
  const paras = Array.from(doc.querySelectorAll("p"))
    .map((p) => p.textContent.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 60);
  return paras.slice(0, 24);
}

export const NewsApp = () => {
  const [cat, setCat] = useState("top");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [body, setBody] = useState([]);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [nonce, setNonce] = useState(0);
  const dispatch = useDispatch();

  useEffect(() => {
    idb
      .get("news.saved.v3")
      .then((v) => setSaved(Array.isArray(v) ? v : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    setErr("");
    setItems([]);
    (async () => {
      const list = await fetchNews(cat);
      if (dead) return;
      /* enrich the first 12 with Wikipedia thumbnails */
      const withWiki = list.filter((it) => it.wikiTitle).slice(0, 12);
      let enriched = list;
      if (withWiki.length) {
        const info = await fetchArticleInfo(withWiki.map((it) => it.wikiTitle));
        if (dead) return;
        enriched = list.map((it) => {
          const meta = info[it.wikiTitle];
          return meta?.image ? { ...it, image: meta.image } : it;
        });
      }
      if (dead) return;
      setItems(enriched);
      setLoading(false);
      if (!enriched.length) {
        setErr("Couldn't reach Wikipedia. Check your connection and retry.");
      }
    })();
    return () => {
      dead = true;
    };
  }, [cat, nonce]);

  const openArticle = async (article) => {
    setOpen(article);
    setBody([]);
    setBodyLoading(true);
    try {
      if (article.wikiTitle) {
        const paras = await fetchArticleBody(article.wikiTitle);
        setBody(
          paras.length ? paras : [article.summary || "Full article is not available offline."],
        );
      } else {
        setBody([article.summary || "Full article is not available offline."]);
      }
    } catch (e) {
      setBody([article.summary || "Could not load the full article."]);
    }
    setBodyLoading(false);
  };

  const isSaved = (title) => saved.includes(title);
  const toggleSave = async (title) => {
    const next = isSaved(title) ? saved.filter((t) => t !== title) : [...saved, title];
    setSaved(next);
    await idb.set("news.saved.v3", next).catch(() => {});
    notify({
      app: "News",
      title: isSaved(title) ? "Removed from saved" : "Story saved",
      body: isSaved(title) ? title : "Read it anytime from Saved.",
      kind: "info",
      life: 3,
    });
  };

  const retry = () => {
    NEWS_CACHE.clear();
    setNonce((n) => n + 1);
  };

  return (
    <WinApp id="news" title="News">
      <div className="newsApp">
        <div className="newsChips">
          {NEWS_CATS.map((c) => (
            <button
              key={c.id}
              className={`winBtn ghost chip ${cat === c.id && !showSaved ? "on" : ""}`}
              onClick={() => {
                setCat(c.id);
                setOpen(null);
                setShowSaved(false);
              }}
            >
              {c.label}
            </button>
          ))}
          {saved.length > 0 && (
            <button
              className={`winBtn ghost chip ${showSaved ? "on" : ""}`}
              onClick={() => {
                setShowSaved(!showSaved);
                setOpen(null);
              }}
            >
              ★ Saved ({saved.length})
            </button>
          )}
          <span className="calChip newsLiveChip" title="Live from en.wikipedia.org">
            <span className="newsLiveDot" />
            Live · Wikipedia
          </span>
        </div>

        {open ? (
          <div className="newsReader">
            <div className="newsReaderBar">
              <button className="winBtn ghost" onClick={() => setOpen(null)}>
                <svg viewBox="0 0 16 16" width="13" height="13">
                  <path
                    d="M10 3l-5 5 5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back
              </button>
              <span className="newsReaderTitle">{open.headline || open.title}</span>
              <button
                className={`winBtn ghost ${isSaved(open.title) ? "on" : ""}`}
                onClick={() => toggleSave(open.title)}
                title={isSaved(open.title) ? "Remove from saved" : "Save story"}
              >
                <svg viewBox="0 0 16 16" width="14" height="14">
                  <path
                    d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z"
                    fill={isSaved(open.title) ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className="winBtn accent"
                onClick={() => dispatch({ type: "EDGELINK", payload: open.url })}
              >
                Open in Edge
              </button>
            </div>
            <div className="newsReaderBody">
              {open.image && (
                <img
                  className="newsReaderHero"
                  src={open.image}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <h1 className="newsReaderHeadline">{open.headline || open.title}</h1>
              <div className="newsReaderMeta">
                <span className="newsReaderPill">{open.source || "Wikipedia"}</span>
                <span className="winMuted">the free encyclopedia</span>
              </div>
              {bodyLoading ? (
                <div className="newsReaderLoading">
                  <div className="newsSkel" />
                  <div className="newsSkel" />
                  <div className="newsSkel" />
                  <div className="newsSkel short" />
                </div>
              ) : (
                <div className="newsReaderText">
                  {body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : showSaved ? (
          <div className="newsFeed">
            <div className="newsSavedHero">
              <div className="newsHeroKicker">Saved stories</div>
              <h2>
                {saved.length} article{saved.length === 1 ? "" : "s"}
              </h2>
              <p>Read them anytime — the list is stored on this PC.</p>
            </div>
            <div className="newsGrid">
              {saved.map((title) => (
                <div
                  key={title}
                  className="newsCard"
                  onClick={() =>
                    openArticle({
                      title,
                      headline: title,
                      summary: "Saved for later reading.",
                      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
                      wikiTitle: title,
                      source: "Wikipedia",
                    })
                  }
                >
                  <div className="newsCardBody">
                    <div className="newsCardHead">
                      <b>{title}</b>
                      <button
                        className="newsStar on"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(title);
                        }}
                        title="Remove from saved"
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z"
                            fill="currentColor"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="winMuted">Tap to read on Wikipedia.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="newsFeed">
            <div className="newsGrid">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="newsCard newsCardSkel">
                  <div className="newsSkel" />
                  <div className="newsSkel" />
                  <div className="newsSkel short" />
                </div>
              ))}
            </div>
          </div>
        ) : err ? (
          <div className="newsEmpty">
            <svg
              viewBox="0 0 48 48"
              width="52"
              height="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="24" cy="24" r="20" />
              <path d="M24 14v14M24 34h.01" strokeLinecap="round" />
            </svg>
            <span className="newsEmptyTitle">Couldn't reach Wikipedia</span>
            <span className="winMuted">{err}</span>
            <button className="winBtn accent" onClick={retry} style={{ marginTop: 8 }}>
              Retry
            </button>
          </div>
        ) : (
          <div className="newsFeed">
            {items[0] && (
              <div
                className={`newsHero ${items[0].image ? "newsHero-has-img" : ""}`}
                onClick={() => openArticle(items[0])}
              >
                {items[0].image && (
                  <img
                    className="newsHeroImg"
                    src={items[0].image}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
                <div className="newsHeroScrim" />
                <div className="newsHeroOverlay">
                  <div className="newsHeroKicker">Featured · {items[0].source || "Wikipedia"}</div>
                  <h2>{items[0].headline || items[0].title}</h2>
                  {items[0].summary && <p>{items[0].summary}</p>}
                </div>
              </div>
            )}
            <div className="newsGrid wosStagger">
              {items.slice(1).map((n) => (
                <article key={n.id || n.url} className="newsCard" onClick={() => openArticle(n)}>
                  {n.image && (
                    <div className="newsCardMedia">
                      <img
                        src={n.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="newsCardBody">
                    <div className="newsCardHead">
                      <b>{n.headline || n.title}</b>
                      <button
                        className={`newsStar ${isSaved(n.title) ? "on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(n.title);
                        }}
                        title={isSaved(n.title) ? "Remove from saved" : "Save story"}
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14">
                          <path
                            d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z"
                            fill={isSaved(n.title) ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                    {n.summary && <p>{n.summary}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </WinApp>
  );
};
/* Paint moved to apps/paint.jsx — the real Windows 11 ribbon build. */

const RISKY = /\.(exe|bat|cmd|scr|msi|vbs|ps1|jar)$/i;
const fmtBytes = (n) =>
  n >= 1048576
    ? `${(n / 1048576).toFixed(1)} MB`
    : n >= 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${n || 0} B`;
export const SecurityApp = () => {
  const [scan, setScan] = useState("idle");
  const [pct, setPct] = useState(0);
  const [res, setRes] = useState(null);
  const [flags, setFlags] = useState([]);
  const [who, setWho] = useState("");
  const [disk, setDisk] = useState(null);
  useEffect(() => {
    getUser()
      .then((u) => setWho(u?.username || ""))
      .catch(() => {});
    Promise.race([
      navigator.storage?.estimate?.() ?? Promise.resolve(null),
      new Promise((r) => setTimeout(() => r(null), 500)),
    ])
      .then((q) => setDisk(q))
      .catch(() => {});
  }, []);
  const runScan = async () => {
    setScan("run");
    setPct(0);
    setFlags([]);
    setRes(null);
    const files = (await idb.getAll("files").catch(() => [])) || [];
    const stores = {};
    for (const name of ["notes", "todos", "events", "alarms", "installed"]) {
      stores[name] = ((await idb.getAll(name).catch(() => [])) || []).length;
    }
    let bytes = 0;
    const flagged = [];
    const real = files.filter((f) => f.type === "file");
    for (let i = 0; i < real.length; i++) {
      bytes += Number(real[i].size) || 0;
      if (RISKY.test(real[i].name || "")) flagged.push(real[i]);
      if (i % Math.max(1, Math.ceil(real.length / 24)) === 0 || i === real.length - 1) {
        setPct(Math.round(((i + 1) / Math.max(1, real.length)) * 100));
        await new Promise((r) => setTimeout(r, 30));
      }
    }
    setFlags(flagged);
    setRes({
      scanned: real.length,
      folders: files.filter((f) => f.type === "dir").length,
      flagged: flagged.length,
      bytes,
      stores,
    });
    setScan("done");
  };
  const cards = [
    [
      "Virus & threat protection",
      scan === "run"
        ? "Scanning…"
        : scan === "done"
          ? `${res?.flagged ?? 0} flagged for review`
          : "No action needed",
      "#107c10",
    ],
    [
      "Account protection",
      who ? `${who} · signed in on this PC` : "Local account",
      who ? "#107c10" : "#e8a300",
    ],
    [
      "Firewall & network",
      navigator.onLine ? "Connected · IndexedDB isolation active" : "Offline · isolated",
      "#107c10",
    ],
    [
      "Device performance",
      disk ? `Virtual Storage in use: ${fmtBytes(disk.usage || 0)}` : "Storage healthy",
      "#107c10",
    ],
  ];
  return (
    <WinApp id="security" title="Windows Security">
      <div className="winPad">
        <div className="secHero">
          <svg className="secOk" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
            <circle cx="36" cy="36" r="34" fill="#107c10" />
            <path
              d="M20 37l10 10 22-24"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <h2 className="winH">You're protected</h2>
            <p className="winMuted">
              Virus & threat protection is on. Firewall is on. This PC is using IndexedDB isolation.
            </p>
          </div>
        </div>
        <div className="secCards">
          {cards.map(([t, sub, dot]) => (
            <div className="secCard" key={t}>
              <span className="secDot" style={{ background: dot }} />
              <div>
                <div style={{ fontWeight: 600 }}>{t}</div>
                <div className="winMuted" style={{ fontSize: 12 }}>
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="winRow" style={{ marginTop: 16 }}>
          <button className="winBtn" onClick={runScan} disabled={scan === "run"}>
            Quick scan
          </button>
          {scan === "run" && <span className="secPct">{pct}%</span>}
        </div>
        {scan !== "idle" && (
          <div
            className="secBar"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div className="secBarFill" style={{ width: `${pct}%` }} />
          </div>
        )}
        {scan === "done" && res && (
          <div className="secRes">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Scan complete — {res.scanned} file{res.scanned === 1 ? "" : "s"} and {res.folders}{" "}
              folder{res.folders === 1 ? "" : "s"} reviewed · {fmtBytes(res.bytes)} in Virtual
              Storage
            </div>
            <div className="winMuted">
              {res.flagged === 0
                ? "No threats found. Executables are inert in this environment, but Windows Security still reviews names and sizes."
                : `${res.flagged} item${res.flagged === 1 ? "" : "s"} flagged for review (harmless here — real Windows would block them):`}
            </div>
            {flags.map((f) => (
              <div className="secFlag" key={f.path}>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.path}
                </span>
                <span className="winMuted">{fmtBytes(Number(f.size) || 0)}</span>
              </div>
            ))}
            <div className="winMuted" style={{ marginTop: 6 }}>
              Stores:{" "}
              {Object.entries(res.stores)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            </div>
          </div>
        )}
      </div>
    </WinApp>
  );
};

export const SnippingApp = () => {
  const [mode, setMode] = useState("full"); // rect | window | full (honest labels)
  const [note, setNote] = useState("");
  const [shot, setShot] = useState(false); // any raster on the canvas?
  const [pen, setPen] = useState(false);
  const [color, setColor] = useState("#e81123");
  const [size, setSize] = useState(3);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(null);
  const strokes = useRef([]); // recorded so re-renders survive
  const modes = [
    ["rect", "Rectangular", "Rectangle snip"],
    ["window", "Window", "Window snip"],
    ["full", "Fullscreen", "Full-screen snip"],
  ];
  const paintStrokes = (g) => {
    for (const st of strokes.current) {
      g.strokeStyle = st.color;
      g.lineWidth = st.size;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      st.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (st.pts.length === 1) g.lineTo(st.pts[0][0] + 0.4, st.pts[0][1]);
      g.stroke();
    }
  };
  const capture = async () => {
    setBusy(true);
    setNote("");
    strokes.current = [];
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        // honest fallback: no display stream in this environment — lay down a placeholder
        const c = canvasRef.current;
        c.width = 960;
        c.height = 540;
        const g = c.getContext("2d", { willReadFrequently: true });
        const grad = g.createLinearGradient(0, 0, 960, 540);
        grad.addColorStop(0, "#12314d");
        grad.addColorStop(1, "#0a1c2e");
        g.fillStyle = grad;
        g.fillRect(0, 0, 960, 540);
        g.fillStyle = "rgba(160,200,255,0.9)";
        g.font = "600 26px Segoe UI, sans-serif";
        g.fillText("Simulated snip", 330, 250);
        g.font = "15px Segoe UI, sans-serif";
        g.fillStyle = "rgba(160,200,255,0.65)";
        g.fillText(
          "This environment has no display stream — the canvas is a placeholder,",
          210,
          292,
        );
        g.fillText(
          "but annotation and saving to Pictures work exactly as they would on a real snip.",
          178,
          316,
        );
        setShot(true);
        setNote(
          "No display stream here — showing a placeholder snip. Annotate and save still work.",
        );
        setBusy(false);
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 120));
      const c = canvasRef.current;
      c.width = video.videoWidth || 1280;
      c.height = video.videoHeight || 720;
      c.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, c.width, c.height);
      stream.getTracks().forEach((t) => t.stop());
      setShot(true);
      if (mode !== "full")
        setNote(
          `${mode === "rect" ? "Rectangular" : "Window"} snip captured as full screen — true region/window crops need browser UI.`,
        );
    } catch (e) {
      setNote(`Capture cancelled or unavailable (${String(e?.message || e).slice(0, 80)}).`);
    }
    setBusy(false);
  };
  const toB64 = () => (canvasRef.current?.toDataURL("image/png") || "").split(",")[1] || "";
  const save = async () => {
    if (!shot || saving) return;
    setSaving(true);
    try {
      const vs = await import("../../../utils/os/vs");
      const { vsWrite, userHome } = vs;
      const d = new Date();
      const p2 = (n) => String(n).padStart(2, "0");
      const name = `Snip_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`;
      const path = `${userHome()}\\Pictures\\${name}`;
      await vsWrite(path, { __b64: true, mime: "image/png", data: toB64() }, { mime: "image/png" });
      const { mirrorFlat } = await import("../../../utils/os/vs");
      await mirrorFlat().catch(() => {});
      await idb
        .put("photos", {
          id: uid("snip"),
          name,
          dataUrl: `data:image/png;base64,${toB64()}`,
          path,
          at: Date.now(),
          size: Math.round((toB64().length * 3) / 4),
        })
        .catch(() => {});
      setNote(`Saved to ${path}`);
      notify({
        app: "Snipping Tool",
        icon: "img/icon/snip.png",
        title: "Snip saved",
        body: path,
        kind: "success",
        life: 4,
      });
    } catch (e) {
      setNote(`Could not save: ${String(e?.message || e).slice(0, 90)}`);
      notify({
        app: "Snipping Tool",
        title: "Could not save the snip",
        body: String(e?.message || e).slice(0, 120),
        kind: "error",
      });
    }
    setSaving(false);
  };
  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * c.width,
      ((e.clientY - r.top) / r.height) * c.height,
    ];
  };
  const down = (e) => {
    if (!shot || !pen) return;
    drawing.current = { color, size, pts: [pos(e)] };
    strokes.current.push(drawing.current);
    const g = canvasRef.current.getContext("2d", { willReadFrequently: true });
    g.strokeStyle = color;
    g.lineWidth = size;
    g.lineCap = "round";
    const [x, y] = drawing.current.pts[0];
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 0.4, y);
    g.stroke();
  };
  const move = (e) => {
    if (!drawing.current) return;
    const pt = pos(e);
    drawing.current.pts.push(pt);
    const g = canvasRef.current.getContext("2d", { willReadFrequently: true });
    const [x, y] = pt;
    g.beginPath();
    const prev = drawing.current.pts[drawing.current.pts.length - 2];
    g.moveTo(prev[0], prev[1]);
    g.lineTo(x, y);
    g.stroke();
  };
  const up = () => {
    drawing.current = null;
  };
  const clearInk = () => {
    if (!shot) return;
    strokes.current = [];
    const c = canvasRef.current;
    const img = new Image();
    // redraw base = everything except ink: simplest is to re-run capture fallback? keep base snapshot instead
    if (base.current) {
      const g = c.getContext("2d", { willReadFrequently: true });
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(base.current, 0, 0);
    }
  };
  const base = useRef(null); // ImageBitmap-ish snapshot before ink
  useEffect(() => {
    if (shot && canvasRef.current && !base.current) {
      try {
        const c = canvasRef.current;
        base.current = document.createElement("canvas");
        base.current.width = c.width;
        base.current.height = c.height;
        base.current.getContext("2d", { willReadFrequently: true }).drawImage(c, 0, 0);
      } catch (e) {}
    }
  }, [shot]);
  return (
    <WinApp id="snip" title="Snipping Tool">
      <div className="snipStage winPad">
        <div className="winRow">
          <div className="snipModes" role="radiogroup" aria-label="Snip mode">
            {modes.map(([mid, label, title]) => (
              <button
                key={mid}
                className={`winBtn ghost chip ${mode === mid ? "on" : ""}`}
                title={title}
                onClick={() => setMode(mid)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="winBtn" onClick={capture} disabled={busy}>
            {busy ? "Capturing…" : "+ New"}
          </button>
          <button
            className={`winBtn ghost ${pen ? "on" : ""}`}
            onClick={() => setPen(!pen)}
            disabled={!shot}
            title="Draw on the snip"
          >
            ✏ Pen
          </button>
          <div className="snipSwatches" style={{ opacity: pen ? 1 : 0.4 }}>
            {["#e81123", "#ffb900", "#0078d4", "#107c10", "#ffffff"].map((c) => (
              <button
                key={c}
                className={`swatch ${c === color ? "on" : ""}`}
                style={{ background: c }}
                aria-label={`Pen color ${c}`}
                onClick={() => {
                  setColor(c);
                  setPen(true);
                }}
              />
            ))}
          </div>
          <button className="winBtn ghost" onClick={clearInk} disabled={!shot}>
            Clear ink
          </button>
          <button
            className="winBtn"
            style={{ marginLeft: "auto" }}
            onClick={save}
            disabled={!shot || saving}
          >
            {saving ? "Saving…" : "Save to Pictures"}
          </button>
        </div>
        {note && <div className="snipNote winMuted">{note}</div>}
        <div className="snipCanvasWrap" style={{ marginTop: 10 }}>
          <canvas
            ref={canvasRef}
            className={`snipCanvas ${pen && shot ? "ink" : ""}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
          />
          {!shot && (
            <div className="snipEmpty winMuted">
              Choose a mode and press + New. The snip lands on the canvas — annotate it, then save
              straight into your Pictures folder.
            </div>
          )}
        </div>
      </div>
    </WinApp>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Sound Recorder helpers — MP3 encoding + dense waveform extraction.
   Both operate on the same decoded AudioBuffer, so we decode once.
   ═══════════════════════════════════════════════════════════════════ */

const _voiceBlobToDataUrl = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

let _lamePromise = null;
const _loadLame = () => {
  if (_lamePromise) return _lamePromise;
  _lamePromise = new Promise((resolve, reject) => {
    if (window.lamejs && window.lamejs.Mp3Encoder) return resolve(window.lamejs);
    const s = document.createElement("script");
    s.src = "vendor/lame.min.js";
    s.async = true;
    s.onload = () => {
      if (window.lamejs && window.lamejs.Mp3Encoder) resolve(window.lamejs);
      else reject(new Error("lamejs missing Mp3Encoder"));
    };
    s.onerror = () => reject(new Error("could not load lamejs"));
    document.head.appendChild(s);
  });
  return _lamePromise;
};

const _encodeMp3 = async (audioBuffer, bitrate = 128) => {
  const lame = await _loadLame();
  const ch = audioBuffer.getChannelData(0);
  const pcm = new Int16Array(ch.length);
  for (let i = 0; i < ch.length; i++) {
    const s = ch[i] < -1 ? -1 : ch[i] > 1 ? 1 : ch[i];
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const encoder = new lame.Mp3Encoder(1, audioBuffer.sampleRate, bitrate);
  const BLOCK = 1152;
  const parts = [];
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const sub = pcm.subarray(i, i + BLOCK);
    const out = encoder.encodeBuffer(sub);
    if (out.length) parts.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  const blob = new Blob(parts, { type: "audio/mpeg" });
  return await _voiceBlobToDataUrl(blob);
};

const _extractWaveform = (audioBuffer, N = 700) => {
  const data = audioBuffer.getChannelData(0);
  const chunk = Math.max(1, Math.floor(data.length / N));
  const out = new Array(N);
  for (let i = 0; i < N; i++) {
    let peak = 0;
    const start = i * chunk;
    const end = Math.min(data.length, start + chunk);
    for (let j = start; j < end; j++) {
      const v = data[j] < 0 ? -data[j] : data[j];
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  const max = Math.max.apply(null, out);
  if (max > 0) for (let i = 0; i < N; i++) out[i] = Math.max(0.015, out[i] / max);
  return out;
};

const _processAudioBlob = async (blob, { mp3 = true } = {}) => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try {
    const arr = await blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arr);
    const samples = _extractWaveform(audioBuf, 700);
    let dataUrl, ext;
    if (mp3) {
      try {
        dataUrl = await _encodeMp3(audioBuf, 128);
        ext = "mp3";
      } catch (e) {
        console.warn("[recorder] mp3 failed, keeping webm", e);
        dataUrl = await _voiceBlobToDataUrl(blob);
        ext = "webm";
      }
    } else {
      dataUrl = await _voiceBlobToDataUrl(blob);
      ext = (blob.type || "").includes("mp4")
        ? "m4a"
        : (blob.type || "").includes("ogg")
          ? "ogg"
          : "webm";
    }
    return { samples, duration: audioBuf.duration, dataUrl, ext };
  } finally {
    try {
      ctx.close();
    } catch (e) {}
  }
};

export const VoiceApp = () => {
  const [recs, save, remove] = useStore("recordings");
  const [selectedId, setSelectedId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveWave, setLiveWave] = useState([]);
  const [err, setErr] = useState("");
  const [processing, setProcessing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingTo, setSavingTo] = useState("");

  const chunksRef = useRef([]);
  const elapsedRef = useRef(0);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const waveTickRef = useRef(null);
  const waveRef = useRef([]);
  const audioRef = useRef(null);
  const recRef = useRef(null);
  const importRef = useRef(null);

  const selected = recs.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    return () => {
      try {
        recRef.current && recRef.current.state !== "inactive" && recRef.current.stop();
      } catch (e) {}
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (waveTickRef.current) clearInterval(waveTickRef.current);
      try {
        audioCtxRef.current && audioCtxRef.current.close();
      } catch (e) {}
    };
  }, []);

  /* auto-upgrade old recordings that have sparse or missing waveform */
  useEffect(() => {
    if (!selected) return;
    if (selected.waveform && selected.waveform.length >= 400) return;
    let dead = false;
    (async () => {
      try {
        const blob = await (await fetch(selected.dataUrl)).blob();
        const { samples, duration } = await _processAudioBlob(blob, { mp3: false });
        if (dead) return;
        await save({ ...selected, waveform: samples, duration: duration || selected.duration });
      } catch (e) {}
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  /* ── time helpers ── */
  const fmtTransport = (t) => {
    if (!isFinite(t) || t < 0) t = 0;
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const cs = Math.floor((t * 100) % 100);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };
  const fmtDur = (t) => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const shortDate = (ts) => {
    const d = new Date(ts || Date.now());
    const today = new Date();
    const y = new Date(today.getTime() - 86400000);
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, today)) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (same(d, y))
      return `yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const fmtSize = (bytes) => {
    if (!bytes) return "";
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  /* ── persist into Virtual Storage ── */
  const persistToVS = async (rec, folder, ext) => {
    try {
      const vs = await import("../../../utils/os/vs");
      const { vsWrite, userHome } = vs;
      const safe = (rec.name || "Recording").replace(/[^\w\-. ]+/g, "_");
      const path = `${userHome()}\\${folder}\\${safe}.${ext}`;
      const b64 = (rec.dataUrl || "").split(",")[1] || "";
      const mime = (rec.dataUrl || "").match(/^data:([^;]+)/)?.[1] || "audio/mpeg";
      await vsWrite(path, { __b64: true, mime, data: b64 }, { mime });
      const { mirrorFlat } = await import("../../../utils/os/vs");
      await mirrorFlat().catch(() => {});
      return path;
    } catch (e) {
      console.warn("[recorder] vs write failed", e);
      return null;
    }
  };

  /* ── recording ── */
  const startRecording = async () => {
    setErr("");
    waveRef.current = [];
    setLiveWave([]);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("This browser has no microphone API — recording needs a real browser.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setErr("Microphone unavailable: " + String(e?.message || e).slice(0, 90));
      return;
    }

    const mime =
      ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) =>
        window.MediaRecorder?.isTypeSupported?.(m),
      ) || "";
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (waveTickRef.current) clearInterval(waveTickRef.current);
      try {
        audioCtxRef.current && audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;

      const finalSecs = elapsedRef.current;
      setProcessing(true);

      try {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });

        /* one decode → waveform + MP3 */
        const { samples, duration, dataUrl, ext } = await _processAudioBlob(blob, { mp3: true });

        const count = recs.length + 1;
        const name = `Recording (${count})`;
        const rec = {
          id: uid("rec"),
          name,
          dataUrl,
          duration: duration || finalSecs,
          waveform: samples,
          size: Math.round((dataUrl.length * 3) / 4),
          ext,
          at: Date.now(),
        };
        await save(rec);
        setSelectedId(rec.id);

        /* autosave to Documents\Sound Recordings\ */
        const path = await persistToVS(rec, "Documents\\Sound Recordings", ext);
        notify({
          app: "Sound Recorder",
          icon: "img/icon/voice.png",
          title: "Recording saved",
          body: path
            ? `${fmtDur(rec.duration)} · ${fmtSize(rec.size)} · ${path}`
            : `${fmtDur(rec.duration)} · ${fmtSize(rec.size)}`,
          kind: "success",
          life: 7,
        });
      } catch (e) {
        setErr("Could not save the recording: " + String(e?.message || e).slice(0, 90));
      }
      setProcessing(false);
      stream.getTracks().forEach((t) => t.stop());
    };

    /* live level meter + live waveform sampling */
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtxRef.current = new AC();
        const src = audioCtxRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 512;
        src.connect(analyserRef.current);
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        const tick = () => {
          analyserRef.current.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = Math.abs(buf[i] - 128) / 128;
            if (v > peak) peak = v;
          }
          if (peak > 1) peak = 1;
          setLiveWave((w) => {
            const next = w.concat(peak * 1.8 > 1 ? 1 : peak * 1.8);
            return next.length > 700 ? next.slice(next.length - 700) : next;
          });
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch (e) {}

    mr.start(100);
    recRef.current = mr;
    setIsRecording(true);
    setIsPaused(false);
    elapsedRef.current = 0;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      if (recRef.current && recRef.current.state === "recording") {
        elapsedRef.current += 0.1;
        setElapsed(elapsedRef.current);
      }
    }, 100);
  };

  const pauseRecording = () => {
    try {
      recRef.current && recRef.current.state === "recording" && recRef.current.pause();
    } catch (e) {}
    setIsPaused(true);
  };
  const resumeRecording = () => {
    try {
      recRef.current && recRef.current.state === "paused" && recRef.current.resume();
    } catch (e) {}
    setIsPaused(false);
  };
  const stopRecording = () => {
    try {
      recRef.current && recRef.current.state !== "inactive" && recRef.current.stop();
    } catch (e) {}
    recRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
  };

  /* ── playback ── */
  const play = (rec) => {
    const a = audioRef.current;
    if (!a) return;
    if (playingId === rec.id && !a.paused) {
      a.pause();
      setIsPlaying(false);
      return;
    }
    setSelectedId(rec.id);
    if (playingId !== rec.id) {
      a.src = rec.dataUrl;
      setPos(0);
      setDur(rec.duration || 0);
    }
    a.playbackRate = speed;
    a.play()
      .then(() => {
        setPlayingId(rec.id);
        setIsPlaying(true);
      })
      .catch(() => setIsPlaying(false));
  };
  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setPos(0);
  };

  /* ── import ── */
  const importFile = async (f) => {
    if (!f) return;
    setErr("");
    setProcessing(true);
    try {
      const { samples, duration, dataUrl, ext } = await _processAudioBlob(f, { mp3: true });
      const name = (f.name || "Imported audio").replace(/\.[^.]+$/, "");
      const rec = {
        id: uid("rec"),
        name,
        dataUrl,
        duration,
        waveform: samples,
        size: Math.round((dataUrl.length * 3) / 4),
        ext,
        at: Date.now(),
        imported: true,
      };
      await save(rec);
      setSelectedId(rec.id);
      notify({
        app: "Sound Recorder",
        title: "Imported",
        body: `${name} · ${fmtDur(duration)}`,
        kind: "success",
        life: 4,
      });
    } catch (e) {
      setErr("Could not import: " + String(e?.message || e).slice(0, 90));
    }
    setProcessing(false);
  };

  /* ── delete / rename / extra saves ── */
  const del = (r) => {
    if (playingId === r.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setPlayingId(null);
      setIsPlaying(false);
    }
    remove(r.id);
    if (selectedId === r.id) setSelectedId(null);
  };
  const commitRename = async () => {
    const trimmed = editName.trim();
    if (selected && trimmed && trimmed !== selected.name) {
      await save({ ...selected, name: trimmed });
    }
    setRenaming(false);
  };
  const saveToMusic = async () => {
    if (!selected) return;
    setSavingTo("music");
    const path = await persistToVS(selected, "Music", selected.ext || "mp3");
    setSavingTo("");
    if (path)
      notify({
        app: "Sound Recorder",
        icon: "img/icon/voice.png",
        title: "Copied to Music",
        body: path,
        kind: "success",
        life: 5,
      });
    else
      notify({
        app: "Sound Recorder",
        title: "Could not copy to Music",
        body: "Virtual Storage write failed.",
        kind: "error",
        life: 5,
      });
  };
  const saveAgain = async () => {
    if (!selected) return;
    setSavingTo("docs");
    const path = await persistToVS(selected, "Documents\\Sound Recordings", selected.ext || "mp3");
    setSavingTo("");
    if (path)
      notify({
        app: "Sound Recorder",
        icon: "img/icon/voice.png",
        title: "Saved",
        body: path,
        kind: "success",
        life: 5,
      });
  };

  /* ── display waveform (live, or selected) ── */
  const displayWave = (() => {
    if (isRecording) return liveWave.length ? liveWave : [];
    if (!selected || !selected.waveform || !selected.waveform.length) return [];
    return selected.waveform;
  })();

  /* ── timeline markers ── */
  const markers = (() => {
    const total = isRecording ? elapsed : selected?.duration || dur || 0;
    if (total < 1) return [];
    const cands = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800];
    const step = cands.find((c) => total / c <= 8) || total / 8;
    const out = [];
    for (let t = 0; t <= total + 0.001; t += step) out.push(t);
    return out;
  })();

  const totalTime = isRecording ? elapsed : selected?.duration || dur || 0;
  const progress = totalTime ? Math.min(1, pos / totalTime) : 0;

  const seekFromClick = (e) => {
    if (isRecording || !selected) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newPos = frac * (selected.duration || dur || 0);
    if (audioRef.current) audioRef.current.currentTime = newPos;
    setPos(newPos);
  };

  return (
    <WinApp id="voice" title="Sound Recorder">
      <div className="voiceApp">
        {/* ── sidebar ── */}
        <aside className="voiceSide">
          <div className="voiceSideHead">
            <div className="voiceSideTitle">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 12a7 7 0 0 0 14 0M12 19v3M9 22h6" strokeLinecap="round" />
              </svg>
              Sound Recorder
            </div>
            <button
              className="voiceImport"
              onClick={() => importRef.current?.click()}
              disabled={processing}
            >
              <svg
                viewBox="0 0 16 16"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Import file
            </button>
            <input
              ref={importRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="voiceList">
            {recs.length === 0 ? (
              <div className="voiceListEmpty">
                <svg
                  viewBox="0 0 48 48"
                  width="40"
                  height="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <rect x="18" y="6" width="12" height="24" rx="6" />
                  <path d="M10 22a14 14 0 0 0 28 0M24 36v6M18 42h12" strokeLinecap="round" />
                </svg>
                <div>No recordings yet</div>
              </div>
            ) : (
              recs
                .slice()
                .sort((a, b) => (b.at || 0) - (a.at || 0))
                .map((r) => {
                  const active = r.id === selectedId;
                  const isPlayingThis = playingId === r.id && isPlaying;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`voiceListItem ${active ? "on" : ""}`}
                      onClick={() => {
                        setSelectedId(r.id);
                        setRenaming(false);
                      }}
                      onDoubleClick={() => play(r)}
                      title={r.name}
                    >
                      <span className="voiceListItemAccent" aria-hidden="true" />
                      <span className="voiceListItemBody">
                        <span className="voiceListItemName">
                          {isPlayingThis ? (
                            <span className="voiceListPlaying" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : null}
                          {r.name}
                        </span>
                        <span className="voiceListItemDate">{shortDate(r.at)}</span>
                      </span>
                      <span className="voiceListItemDur">{fmtDur(r.duration || 0)}</span>
                    </button>
                  );
                })
            )}
          </div>

          <div className="voiceSideFoot">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 12a7 7 0 0 0 14 0M12 19v3" strokeLinecap="round" />
            </svg>
            <span>Microphone (Default)</span>
            <svg
              viewBox="0 0 12 12"
              width="10"
              height="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </aside>

        {/* ── main ── */}
        <section className="voiceMain">
          <header className="voiceHeader">
            {renaming && selected ? (
              <input
                className="voiceHeaderRename"
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
              />
            ) : (
              <h1
                className="voiceHeaderTitle"
                onClick={() => {
                  if (selected) {
                    setEditName(selected.name);
                    setRenaming(true);
                  }
                }}
                title={selected ? "Click to rename" : ""}
              >
                {isRecording ? "Recording…" : selected ? selected.name : "My Audio"}
              </h1>
            )}
            <div className="voiceHeaderActions">
              {processing && (
                <span className="voiceProcessing">
                  <svg
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="8" cy="8" r="6" opacity="0.25" />
                    <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 8 8"
                        to="360 8 8"
                        dur="0.9s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </svg>
                  Saving MP3…
                </span>
              )}
              {selected && !processing && (
                <>
                  <button
                    className="voiceHeaderBtn"
                    onClick={saveAgain}
                    disabled={savingTo === "docs"}
                    title="Save to Documents\Sound Recordings"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M8 2v8M5 7l3 3 3-3M3 13h10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Save
                  </button>
                  <button
                    className="voiceHeaderBtn"
                    onClick={saveToMusic}
                    disabled={savingTo === "music"}
                    title="Save a copy into Music"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M6 12V4l6-1.5V11" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="4.5" cy="12" r="1.8" />
                      <circle cx="10.5" cy="11" r="1.8" />
                    </svg>
                    {savingTo === "music" ? "Saving…" : "Save to Music"}
                  </button>
                </>
              )}
              {selected && (
                <button
                  className="voiceHeaderBtn danger"
                  onClick={() => del(selected)}
                  title="Delete"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M4 5h8M6.5 5V3.5h3V5M5.5 5l.5 8h4l.5-8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </header>

          {err && <div className="voiceErr">{err}</div>}

          {/* ── waveform stage ── */}
          <div className="voiceStage" onClick={seekFromClick}>
            {markers.length > 0 && (
              <div className="voiceTimeline">
                {markers.map((t, i) => (
                  <span
                    key={i}
                    className="voiceTimelineMark"
                    style={{ left: `${(totalTime ? t / totalTime : 0) * 100}%` }}
                  >
                    {fmtTransport(t)}
                  </span>
                ))}
              </div>
            )}

            <div className="voiceWaveArea">
              {displayWave.length > 0 ? (
                <div className="voiceWaveBars">
                  {displayWave.map((v, i) => {
                    const isPast = !isRecording && selected && i / displayWave.length <= progress;
                    const h = Math.max(3, v * 100);
                    return (
                      <span
                        key={i}
                        className="voiceWaveBar"
                        style={{
                          height: `${h}%`,
                          background: isRecording
                            ? "var(--danger-2)"
                            : isPast
                              ? "var(--accent)"
                              : "var(--text-3)",
                          opacity: isRecording ? 0.9 : isPast ? 1 : 0.55,
                        }}
                      />
                    );
                  })}
                </div>
              ) : isRecording ? (
                <div className="voiceWaveWaiting">Speak — the waveform appears as you record.</div>
              ) : selected ? (
                <div className="voiceWaveWaiting">Preparing waveform…</div>
              ) : (
                <div className="voiceWavePlaceholder">
                  <svg
                    viewBox="0 0 64 64"
                    width="72"
                    height="72"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <rect x="24" y="8" width="16" height="30" rx="8" />
                    <path d="M14 32a18 18 0 0 0 36 0M32 50v8M24 58h16" strokeLinecap="round" />
                  </svg>
                  <div className="voiceWavePlaceholderText">Press record to capture audio</div>
                  <div className="voiceWavePlaceholderSub">Everything stays on this PC</div>
                </div>
              )}

              {totalTime > 0 && !isRecording && (
                <div className="voicePlayhead" style={{ left: `${progress * 100}%` }}>
                  <div className="voicePlayheadHead" />
                  <div className="voicePlayheadLine" />
                </div>
              )}
              {isRecording && (
                <div className="voicePlayhead voicePlayheadLive" style={{ left: "100%" }}>
                  <div className="voicePlayheadHead" />
                  <div className="voicePlayheadLine" />
                </div>
              )}
            </div>
          </div>

          {/* ── transport ── */}
          <div className="voiceTransport">
            <div className="voiceTransportLeft">
              <button className="voiceDevicePill" type="button" title="Input device">
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 12a7 7 0 0 0 14 0M12 19v3M9 22h6" strokeLinecap="round" />
                </svg>
                Microphone (Default)
                <svg
                  viewBox="0 0 12 12"
                  width="9"
                  height="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="voiceTransportCenter">
              <button
                className={`voiceRecordBtn ${isRecording ? "rec" : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={processing}
                title={isRecording ? "Stop" : "Record"}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? (
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <rect x="3.5" y="3.5" width="9" height="9" rx="1.6" fill="#fff" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.2" fill="#fff" />
                  </svg>
                )}
              </button>

              {isRecording && (
                <button
                  className="voicePauseBtn"
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  title={isPaused ? "Resume" : "Pause"}
                >
                  {isPaused ? (
                    <svg viewBox="0 0 16 16" width="14" height="14">
                      <path d="M5 3.2v9.6L13 8 5 3.2z" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" width="14" height="14">
                      <rect x="3.5" y="3.5" width="3" height="9" rx="0.8" fill="currentColor" />
                      <rect x="9.5" y="3.5" width="3" height="9" rx="0.8" fill="currentColor" />
                    </svg>
                  )}
                </button>
              )}

              <div className="voiceTime">
                <span className="voiceTimeCur">{fmtTransport(isRecording ? elapsed : pos)}</span>
                <span className="voiceTimeSep">/</span>
                <span className="voiceTimeTot">{fmtTransport(totalTime)}</span>
              </div>

              <button
                className="voicePlayToggle"
                onClick={() => selected && play(selected)}
                disabled={!selected || isRecording || processing}
                title={isPlaying ? "Pause" : "Play"}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <rect x="3.5" y="3.5" width="3" height="9" rx="0.8" fill="currentColor" />
                    <rect x="9.5" y="3.5" width="3" height="9" rx="0.8" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M5 3.2v9.6L13 8 5 3.2z" fill="currentColor" />
                  </svg>
                )}
              </button>

              <button
                className="voiceRestartBtn"
                onClick={restart}
                disabled={!selected}
                title="Restart"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <path d="M4 8h8M4 8l3-3M4 8l3 3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13 8a5 5 0 1 0-1.5 3.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="voiceTransportRight">
              <Win11Select
                value={speed}
                onChange={(v) => {
                  const s = Number(v);
                  setSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                }}
                className="voiceSpeedSelect"
                ariaLabel="Playback speed"
              >
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </Win11Select>
              <button
                className="voiceMarkBtn"
                onClick={() =>
                  notify({
                    app: "Sound Recorder",
                    title: "Marked",
                    body: `Marker added at ${fmtTransport(pos)}`,
                    kind: "info",
                    life: 3,
                  })
                }
                disabled={!selected}
                title="Mark this moment"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <path
                    d="M8 3v6M8 3l3 1.5L8 6M8 9v4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Mark
              </button>
            </div>
          </div>

          <audio
            ref={audioRef}
            onTimeUpdate={(e) => setPos(e.currentTarget.currentTime || 0)}
            onLoadedMetadata={(e) => {
              if (e.currentTarget.duration && isFinite(e.currentTarget.duration))
                setDur(e.currentTarget.duration);
            }}
            onEnded={() => {
              setIsPlaying(false);
              setPos(0);
            }}
            style={{ display: "none" }}
          />
        </section>
      </div>
    </WinApp>
  );
};
const AVATAR_HUES = ["#0067c0", "#107c10", "#c239b3", "#ca5010", "#038387", "#5c2e91"];
const hueFor = (name) =>
  AVATAR_HUES[(String(name || "?").charCodeAt(0) + String(name || "").length) % AVATAR_HUES.length];
const initialsFor = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

/* ═══════════════════════════════════════════════════════════════════
   Tips — Win11 Tips
   Hero with progress ring · filter chips · tip cards with icons.
   ═══════════════════════════════════════════════════════════════════ */

const TIPS_ICONS = {
  start: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.2" />
    </svg>
  ),
  run: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <path
        d="M6 10.5h.01M9.5 10.5h.01M13 10.5h.01M16.5 10.5h.01M6 13.5h7M16 13.5h2"
        strokeLinecap="round"
      />
    </svg>
  ),
  snap: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M12 4.5v15" />
      <path d="M6 12h3M6 15h3M15 12h3M15 15h3" strokeLinecap="round" />
    </svg>
  ),
  theme: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" strokeLinejoin="round" />
    </svg>
  ),
  store: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" strokeLinejoin="round" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" strokeLinecap="round" />
    </svg>
  ),
  terminal: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M6 10l3 2-3 2M11.5 14.5h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const TIPS_TASKS = [
  {
    id: "start",
    icon: TIPS_ICONS.start,
    t: "Open the Start menu",
    d: "The hub of everything: pinned apps, search, power. Click the Windows logo — or let me do it.",
    try: () => store.dispatch({ type: "STARTMENU", payload: null }),
  },
  {
    id: "run",
    icon: TIPS_ICONS.run,
    t: "Launch anything with Win+R",
    d: "The Run dialog knows your user folders and every app. Try 'calc' or 'shell:desktop' later.",
    try: () => store.dispatch({ type: "RUNSHOW" }),
  },
  {
    id: "snap",
    icon: TIPS_ICONS.snap,
    t: "Snap this window",
    d: "Win+Left halves the focused window against the screen edge. I'll snap Tips itself for you.",
    try: () =>
      store.dispatch({
        type: "TIPSAPP",
        payload: "resize",
        dim: { width: "50%", height: "100%", top: 0, left: 0 },
      }),
  },
  {
    id: "theme",
    icon: TIPS_ICONS.theme,
    t: "Flip dark mode",
    d: "Settings and quick toggles change the theme everywhere — it persists across refreshes.",
    try: () => applyTheme(store),
  },
  {
    id: "store",
    icon: TIPS_ICONS.store,
    t: "Install a real app",
    d: "The Store catalog installs PWAs that land on your desktop and survive refreshes.",
    try: () => store.dispatch({ type: "WNSTORE", payload: "full" }),
  },
  {
    id: "terminal",
    icon: TIPS_ICONS.terminal,
    t: "Meet the Terminal",
    d: "Your files live in IndexedDB. Try: dir, mkdir notes, echo hi > notes\\a.txt, type notes\\a.txt.",
    try: () => store.dispatch({ type: "TERMINAL", payload: "full" }),
  },
];

export const TipsApp = () => {
  const [done, setDone] = useState([]);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    idb
      .get("tips.done")
      .then((v) => setDone(Array.isArray(v) ? v : []))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = (next) => {
    setDone(next);
    idb.set("tips.done", next).catch(() => {});
  };
  const mark = async (id) => {
    if (done.includes(id)) return;
    persist([...done, id]);
  };
  const reset = () => persist([]);

  const doAction = async (id, fn, label) => {
    try {
      await fn();
      await mark(id);
      setFlash(label);
      setTimeout(() => setFlash(""), 2200);
    } catch (e) {
      notify({
        app: "Tips",
        title: "That did not work here",
        body: String(e?.message || e).slice(0, 100),
        kind: "error",
      });
    }
  };

  const total = TIPS_TASKS.length;
  const completed = done.length;
  const pct = total ? completed / total : 0;
  const R = 42;
  const C = 2 * Math.PI * R;

  const visible = TIPS_TASKS.filter((task) => {
    const isDone = done.includes(task.id);
    if (filter === "todo") return !isDone;
    if (filter === "done") return isDone;
    return true;
  });

  return (
    <WinApp id="tips" title="Tips">
      <div className="tipsApp">
        {/* ── hero ── */}
        <header className="tipsHero">
          <div className="tipsHeroRing" aria-hidden="true">
            <svg viewBox="0 0 100 100" width="100" height="100">
              <circle cx="50" cy="50" r={R} className="tipsHeroTrack" />
              <circle
                cx="50"
                cy="50"
                r={R}
                className="tipsHeroFill"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="tipsHeroPct">
              <b>{Math.round(pct * 100)}</b>
              <span>%</span>
            </div>
          </div>
          <div className="tipsHeroCopy">
            <div className="tipsHeroKicker">Get the most out of this PC</div>
            <h1 className="tipsHeroTitle">
              {completed === 0
                ? "Start your tour"
                : completed === total
                  ? "You've tried everything — nice!"
                  : `${completed} of ${total} tried`}
            </h1>
            <p className="tipsHeroText">
              Each card below does the thing for real — no videos, no mockups. Progress is saved on
              this PC.
            </p>
            {completed > 0 && (
              <button className="winBtn ghost tipsHeroReset" onClick={reset}>
                <svg
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path
                    d="M3 8a5 5 0 1 0 1.5-3.5M3 3v3h3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Reset progress
              </button>
            )}
          </div>
        </header>

        {/* ── filter chips ── */}
        <div className="tipsChips">
          {[
            ["all", `All ${total}`],
            ["todo", `To try ${total - completed}`],
            ["done", `Tried ${completed}`],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`winBtn ghost chip ${filter === k ? "on" : ""}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── cards ── */}
        <div className="tipsGrid">
          {visible.length === 0 ? (
            <div className="tipsEmpty">
              <svg
                viewBox="0 0 48 48"
                width="48"
                height="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="24" cy="24" r="20" />
                <path d="M16 24.5l5.5 5.5L33 18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="tipsEmptyTitle">
                {filter === "todo" ? "Nothing left to try" : "Nothing tried yet"}
              </div>
              <div className="winMuted">
                {filter === "todo"
                  ? "You've tried every tip on this page."
                  : "Press a Try it button on any card to begin."}
              </div>
            </div>
          ) : (
            visible.map((task, i) => {
              const isDone = done.includes(task.id);
              return (
                <article
                  key={task.id}
                  className={`tipCard ${isDone ? "done" : ""}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="tipCardIcon" aria-hidden="true">
                    {task.icon}
                    {isDone && (
                      <span className="tipCardCheck" aria-hidden="true">
                        <svg
                          viewBox="0 0 16 16"
                          width="9"
                          height="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                        >
                          <path
                            d="M3 8.5l3.2 3.2L13 5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="tipCardBody">
                    <h2 className="tipCardTitle">{task.t}</h2>
                    <p className="tipCardText">{task.d}</p>
                  </div>
                  <div className="tipCardFoot">
                    <button
                      className={`winBtn ${isDone ? "ghost" : "accent"} tipCardBtn`}
                      onClick={() => doAction(task.id, task.try, task.t)}
                    >
                      {isDone ? (
                        <>
                          <svg
                            viewBox="0 0 16 16"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              d="M3 8.5l3.2 3.2L13 5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Try again
                        </>
                      ) : (
                        <>
                          <svg
                            viewBox="0 0 16 16"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path d="M4 3.5v9l8-4.5-8-4.5z" strokeLinejoin="round" />
                          </svg>
                          Try it
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {flash && (
          <div className="tipsFlash">
            <svg
              viewBox="0 0 16 16"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Just did it: <b>{flash}</b>
          </div>
        )}
      </div>
    </WinApp>
  );
};
/* ═══════════════════════════════════════════════════════════════════
   Help — Win11 "Get Help" reference
   Two-pane: searchable topic rail · expandable FAQ cards · contact.
   ═══════════════════════════════════════════════════════════════════ */

const HELP_ICONS = {
  start: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M12 2.5v5M12 16.5v5M4.9 4.9l3.5 3.5M15.6 15.6l3.5 3.5M2.5 12h5M16.5 12h5M4.9 19.1l3.5-3.5M15.6 8.4l3.5-3.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  files: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3l2 2h8A2.5 2.5 0 0 1 21 9.5V17a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V7.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  privacy: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M12 3l8 3.5v5c0 4.7-3.4 8.4-8 9.5-4.6-1.1-8-4.8-8-9.5v-5L12 3z"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  apps: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
};

const HELP_TOPICS = [
  {
    id: "start",
    label: "Getting started",
    icon: HELP_ICONS.start,
    faqs: [
      {
        q: "Is this really Windows 11?",
        a: "It is a faithful, open-source recreation of the Windows 11 desktop that runs entirely in your browser. It is not affiliated with Microsoft and is not Windows 365 — every app you see was built for this project.",
      },
      {
        q: "Can I use this offline?",
        a: "Mostly, yes. The desktop, apps, files and games bundled with the PC work offline. Store streaming apps, live weather and web content need a connection.",
      },
    ],
  },
  {
    id: "files",
    label: "Files & storage",
    icon: HELP_ICONS.files,
    faqs: [
      {
        q: "Where are my files stored?",
        a: "In the Virtual Storage — your browser's IndexedDB on this device. Your files, settings, installed apps and account all survive a refresh or a reboot of the tab. Clearing site data wipes the PC, exactly like reinstalling Windows.",
      },
      {
        q: "How do I reset this PC?",
        a: "Settings → System → Recovery gives you the honest version: clear this browser's storage for the site and the PC is factory-fresh on the next load.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy & network",
    icon: HELP_ICONS.privacy,
    faqs: [
      {
        q: "Is my data sent anywhere?",
        a: "No. There is no server and no telemetry. The only things that ever leave the browser are: weather requests (open-meteo.com), the Store's embedded sites, live Maps searches (Photon), News (Wikinews), and feedback you explicitly send through the formsubmit form.",
      },
    ],
  },
  {
    id: "apps",
    label: "Apps & Store",
    icon: HELP_ICONS.apps,
    faqs: [
      {
        q: "Some websites refuse to appear in Edge. Why?",
        a: "Many big sites (banking, streaming, some Google pages) send a security header that forbids being shown inside another page. That is their choice and no browser-in-a-browser can override it — Edge offers a reader view or a real browser tab instead.",
      },
      {
        q: "The Store said an app installed — where is it?",
        a: "Pinned to your Start menu and listed in All apps, like a real install. Everything the Store offers runs frameless inside the desktop; nothing else is downloaded to your device.",
      },
    ],
  },
];

export const HelpApp = () => {
  const [topicId, setTopicId] = useState(HELP_TOPICS[0].id);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? HELP_TOPICS.map((t) => ({
        ...t,
        faqs: t.faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)),
      })).filter((t) => t.faqs.length > 0)
    : HELP_TOPICS;

  const current = filtered.find((t) => t.id === topicId) || filtered[0] || null;

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      await sendFeedback({
        to: "win11webos@gmail.com",
        subject: "[Help] A question from Windows 11 WebOS",
        message: text.trim(),
      });
      setSent(true);
      setText("");
    } catch (e) {
      setErr(String(e?.message || e));
    }
    setBusy(false);
  };

  return (
    <WinApp id="help" title="Help">
      <div className="helpApp">
        {/* ── sidebar ── */}
        <aside className="helpSide">
          <div className="helpSideHead">
            <div className="helpSideTitle">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path
                  d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1.9-1.1 1.8M12 16.8h.01"
                  strokeLinecap="round"
                />
              </svg>
              Help
            </div>
            <div className="helpSearch">
              <svg
                viewBox="0 0 16 16"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" strokeLinecap="round" />
              </svg>
              <input
                className="helpSearchInput"
                placeholder="Search help"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="helpSearchClear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <svg
                    viewBox="0 0 12 12"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <nav className="helpNav">
            {filtered.length === 0 ? (
              <div className="helpNavEmpty">No topics match.</div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  className={`helpNavItem ${current && current.id === t.id ? "on" : ""}`}
                  onClick={() => {
                    setTopicId(t.id);
                    setOpenId(null);
                  }}
                >
                  <span className="helpNavIcon">{t.icon}</span>
                  <span className="helpNavLabel">{t.label}</span>
                  <span className="helpNavCount">{t.faqs.length}</span>
                </button>
              ))
            )}
          </nav>

          <div className="helpSideFoot">
            <button
              className="helpContactBtn"
              onClick={() => {
                setWriting(true);
                setSent(false);
              }}
            >
              <svg
                viewBox="0 0 20 20"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                <path d="M3.5 6l6.5 5 6.5-5" strokeLinejoin="round" />
              </svg>
              Email the builder
            </button>
          </div>
        </aside>

        {/* ── main ── */}
        <section className="helpMain">
          {!current ? (
            <div className="helpEmpty">
              <svg
                viewBox="0 0 48 48"
                width="52"
                height="52"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="21" cy="21" r="13" />
                <path d="M30.5 30.5L40 40" strokeLinecap="round" />
              </svg>
              <div className="helpEmptyTitle">No results</div>
              <div className="winMuted">Try a different search term.</div>
            </div>
          ) : (
            <>
              <header className="helpMainHead">
                <div className="helpMainIcon">{current.icon}</div>
                <div>
                  <h1 className="helpMainTitle">{current.label}</h1>
                  <div className="helpMainSub">
                    {current.faqs.length} article{current.faqs.length === 1 ? "" : "s"}
                  </div>
                </div>
              </header>

              <div className="helpList">
                {current.faqs.map((f, i) => {
                  const key = `${current.id}-${i}`;
                  const open = openId === key;
                  return (
                    <div key={key} className={`helpCard ${open ? "open" : ""}`}>
                      <button
                        className="helpCardHead"
                        onClick={() => setOpenId(open ? null : key)}
                        aria-expanded={open}
                      >
                        <span className="helpCardQ">{f.q}</span>
                        <svg
                          className="helpCardChev"
                          viewBox="0 0 12 12"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          aria-hidden="true"
                        >
                          <path d="M3 4.5L6 7.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {open && <div className="helpCardA">{f.a}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {writing && (
            <div className="helpContactCard">
              {sent ? (
                <>
                  <div className="helpContactSent">
                    <svg
                      viewBox="0 0 24 24"
                      width="42"
                      height="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M7 12.5l3.2 3.2L17 9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="helpContactSentTitle">Message sent</div>
                    <div className="winMuted">
                      It landed in win11webos@gmail.com via formsubmit.
                    </div>
                  </div>
                  <div className="helpContactActions">
                    <button
                      className="winBtn"
                      onClick={() => {
                        setSent(false);
                        setText("");
                      }}
                    >
                      Write another
                    </button>
                    <button
                      className="winBtn ghost"
                      onClick={() => {
                        setWriting(false);
                        setSent(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="helpContactHead">
                    <b>Email the builder</b>
                    <span className="winMuted">
                      Describe the problem or question — the more detail, the faster the fix.
                    </span>
                  </div>
                  <textarea
                    className="winArea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write your message…"
                  />
                  <div className="helpContactActions">
                    <button
                      className="winBtn accent"
                      onClick={send}
                      disabled={!text.trim() || busy}
                    >
                      {busy ? "Sending…" : "Send to win11webos@gmail.com"}
                    </button>
                    <button className="winBtn ghost" onClick={() => setWriting(false)}>
                      Cancel
                    </button>
                  </div>
                  {err && <div className="helpContactErr">{err}</div>}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </WinApp>
  );
};
/* ═══════════════════════════════════════════════════════════════════
   Feedback Hub — Win11 Feedback Hub rebuild
   Two-pane · category nav · feedback cards · compose form.
   Local storage + honest email dispatch through formsubmit.
   All icons are inline SVG — no emoji anywhere.
   ═══════════════════════════════════════════════════════════════════ */

const FB_ICONS = {
  feedback: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M3 6.5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9l-4 3v-3H6a3 3 0 0 1-3-3v-5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  all: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M8 8v9" />
    </svg>
  ),
  idea: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M10 2.5a5 5 0 0 1 3 9v2.5H7V11.5a5 5 0 0 1 3-9z" strokeLinejoin="round" />
      <path d="M7.5 16.5h5M8.5 18.5h3" strokeLinecap="round" />
    </svg>
  ),
  problem: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v5M10 13.8h.01" strokeLinecap="round" />
    </svg>
  ),
  praise: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5L10 14l-4.5 2.3.9-5-3.6-3.5 5-.7L10 2.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  plus: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  attach: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M10 4.5l-4.5 4.5a2.12 2.12 0 0 0 3 3L13 7.5a3.54 3.54 0 0 0-5-5L3.5 7a5 5 0 0 0 7 7L15 9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  trash: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M4 5h8M6.5 5V3.5h3V5M5.5 5l.5 8h4l.5-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  close: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  ),
  back: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M10 3l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sent: (
    <svg
      viewBox="0 0 48 48"
      width="56"
      height="56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="19" />
      <path d="M15 24.5l6 6L34 17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  empty: (
    <svg
      viewBox="0 0 48 48"
      width="52"
      height="52"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M8 15a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20l-8 6V33H12a4 4 0 0 1-4-4V15z"
        strokeLinejoin="round"
      />
      <path d="M16 20h16M16 24h11" strokeLinecap="round" />
    </svg>
  ),
};

const FB_CATS = [
  { id: "Idea", label: "Idea", icon: FB_ICONS.idea, ph: "What should this PC do better?" },
  {
    id: "Problem",
    label: "Problem",
    icon: FB_ICONS.problem,
    ph: "What went wrong? Include steps if you can.",
  },
  { id: "Praise", label: "Praise", icon: FB_ICONS.praise, ph: "What did you like?" },
];

export const FeedbackApp = () => {
  const [items, setItems] = useState([]);
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [cat, setCat] = useState("Idea");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const fileIn = useRef(null);

  const load = async () => {
    const all = ((await idb.getAll("kv").catch(() => [])) || [])
      .filter((x) => String(x.key || "").startsWith("feedback."))
      .sort((a, b) => (b.at || 0) - (a.at || 0));
    setItems(all);
  };

  useEffect(() => {
    load().finally(() => setReady(true));
  }, []);

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      // local copy always stays on this PC, even if the network fails
      await idb.put("kv", {
        key: `feedback.${Date.now()}`,
        value: { cat, text: text.trim(), title: title.trim() || "(no title)" },
        at: Date.now(),
      });
      await sendFeedback({
        subject: `[${cat}] ${title.trim() || "Windows 11 WebOS feedback"}`,
        message: text.trim(),
        file: file || undefined,
      });
      setSent(true);
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    }
    setBusy(false);
  };

  const del = async (k) => {
    await idb.del(k);
    await load();
  };

  const resetCompose = () => {
    setComposing(false);
    setSent(false);
    setCat("Idea");
    setTitle("");
    setText("");
    setFile(null);
    setErr("");
  };

  const fmtSize = (n) =>
    n >= 1048576
      ? `${(n / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round((n || 0) / 1024))} KB`;
  const fmtDate = (ts) => {
    const d = new Date(ts || Date.now());
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const filtered = items.filter((it) => {
    const c = it.value?.cat || "";
    if (view === "Idea" && c !== "Idea") return false;
    if (view === "Problem" && c !== "Problem") return false;
    if (view === "Praise" && c !== "Praise") return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const t = `${it.value?.title || ""} ${it.value?.text || ""}`.toLowerCase();
      if (!t.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: items.length,
    Idea: items.filter((i) => i.value?.cat === "Idea").length,
    Problem: items.filter((i) => i.value?.cat === "Problem").length,
    Praise: items.filter((i) => i.value?.cat === "Praise").length,
  };

  const currentCat = FB_CATS.find((c) => c.id === cat) || FB_CATS[0];
  const viewTitle =
    view === "all"
      ? "All feedback"
      : view === "Idea"
        ? "Ideas"
        : view === "Problem"
          ? "Problems"
          : "Praise";

  return (
    <WinApp id="feedback" title="Feedback Hub">
      <div className="fbApp">
        {/* ── SIDEBAR ── */}
        <aside className="fbSide">
          <div className="fbSideBrand">
            {FB_ICONS.feedback}
            <span>Feedback Hub</span>
          </div>

          <div className="fbSideNew">
            <button
              className="winBtn accent fbNewBtn"
              onClick={() => {
                resetCompose();
                setComposing(true);
              }}
            >
              {FB_ICONS.plus}
              New feedback
            </button>
          </div>

          <nav className="fbNav">
            {[
              ["all", "All feedback", FB_ICONS.all, counts.all],
              ["Idea", "Ideas", FB_ICONS.idea, counts.Idea],
              ["Problem", "Problems", FB_ICONS.problem, counts.Problem],
              ["Praise", "Praise", FB_ICONS.praise, counts.Praise],
            ].map(([id, label, icon, n]) => (
              <button
                key={id}
                className={`fbNavItem ${view === id && !composing ? "on" : ""}`}
                onClick={() => {
                  setView(id);
                  setComposing(false);
                }}
              >
                <span className="fbNavIcon">{icon}</span>
                <span className="fbNavLabel">{label}</span>
                {n > 0 && <span className="fbNavCount">{n}</span>}
              </button>
            ))}
          </nav>

          <div className="fbSideFoot">
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3.5M8 11h.01" strokeLinecap="round" />
            </svg>
            Kept on this PC · emailed via formsubmit
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="fbMain">
          {composing ? (
            sent ? (
              <div className="fbSentWrap">
                <div className="fbSentCard">
                  <div className="fbSentIcon">{FB_ICONS.sent}</div>
                  <h2 className="fbSentTitle">Thank you!</h2>
                  <p className="fbSentText">
                    Your feedback is on its way to <b>{feedbackEmail()}</b>. A copy also stays on
                    this PC — you can see it in the list.
                  </p>
                  <div className="fbSentActions">
                    <button
                      className="winBtn accent"
                      onClick={() => {
                        setSent(false);
                        setCat("Idea");
                        setTitle("");
                        setText("");
                        setFile(null);
                      }}
                    >
                      Send more feedback
                    </button>
                    <button className="winBtn ghost" onClick={resetCompose}>
                      Back to feedback
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="fbCompose">
                <header className="fbComposeHead">
                  <button
                    className="winBtn ghost fbBackBtn"
                    onClick={resetCompose}
                    aria-label="Back"
                  >
                    {FB_ICONS.back}
                    Back
                  </button>
                  <h1 className="fbComposeTitle">Send feedback</h1>
                </header>

                <div className="fbComposeBody">
                  <div className="fbField">
                    <label className="fbLabel">Category</label>
                    <div className="fbCatPicker">
                      {FB_CATS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`fbCatChip ${cat === c.id ? "on" : ""}`}
                          onClick={() => setCat(c.id)}
                        >
                          <span className="fbCatIcon">{c.icon}</span>
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="fbField">
                    <label className="fbLabel">Title</label>
                    <input
                      className="winInput fbInput"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="A one-line summary (optional)"
                      maxLength={120}
                    />
                  </div>

                  <div className="fbField">
                    <label className="fbLabel">Details</label>
                    <textarea
                      className="winArea fbArea"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={currentCat.ph}
                    />
                  </div>

                  <div className="fbField">
                    <label className="fbLabel">Attachment (optional)</label>
                    <div className="fbAttach">
                      <button
                        className="winBtn ghost fbAttachBtn"
                        onClick={() => fileIn.current?.click()}
                      >
                        {FB_ICONS.attach}
                        {file ? file.name : "Attach a file (≤ 5 MB)"}
                      </button>
                      {file && (
                        <>
                          <span className="fbAttachSize">{fmtSize(file.size)}</span>
                          <button
                            className="winBtn ghost fbAttachDel"
                            onClick={() => setFile(null)}
                            aria-label="Remove attachment"
                          >
                            {FB_ICONS.close}
                          </button>
                        </>
                      )}
                      <input
                        ref={fileIn}
                        type="file"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setFile(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>

                  {err && <div className="fbError">{err === EMAIL_ERROR ? EMAIL_ERROR : err}</div>}

                  <div className="fbComposeActions">
                    <button
                      className="winBtn accent fbSubmit"
                      onClick={send}
                      disabled={!text.trim() || busy}
                    >
                      {busy ? "Sending…" : "Submit"}
                    </button>
                    <button className="winBtn ghost" onClick={resetCompose}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <header className="fbTop">
                <h1 className="fbTopTitle">{viewTitle}</h1>
                <div className="fbSearch">
                  {FB_ICONS.search}
                  <input
                    className="fbSearchInput"
                    placeholder="Search feedback"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="fbSearchClear"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                    >
                      {FB_ICONS.close}
                    </button>
                  )}
                </div>
              </header>

              <div className="fbList">
                {!ready ? null : filtered.length === 0 ? (
                  <div className="fbEmpty">
                    <div className="fbEmptyArt">{FB_ICONS.empty}</div>
                    <div className="fbEmptyTitle">
                      {query
                        ? "No results"
                        : items.length === 0
                          ? "No feedback yet"
                          : `Nothing in ${view === "all" ? "feedback" : view}`}
                    </div>
                    <div className="winMuted">
                      {query
                        ? "Try a different search term."
                        : "Start by sending your first piece of feedback."}
                    </div>
                    {!query && (
                      <button
                        className="winBtn accent fbEmptyBtn"
                        onClick={() => {
                          resetCompose();
                          setComposing(true);
                        }}
                      >
                        {FB_ICONS.plus} New feedback
                      </button>
                    )}
                  </div>
                ) : (
                  filtered.map((it) => {
                    const c = it.value?.cat || "Idea";
                    const catIcon =
                      c === "Idea"
                        ? FB_ICONS.idea
                        : c === "Problem"
                          ? FB_ICONS.problem
                          : FB_ICONS.praise;
                    return (
                      <article key={it.key} className={`fbCard fbCard-${c.toLowerCase()}`}>
                        <header className="fbCardHead">
                          <span className={`fbCatBadge fbCatBadge-${c.toLowerCase()}`}>
                            <span className="fbCatBadgeIcon">{catIcon}</span>
                            {c}
                          </span>
                          <span className="fbCardDate">{fmtDate(it.at)}</span>
                          <button
                            className="fbCardDel"
                            onClick={() => del(it.key)}
                            title="Delete from this PC"
                            aria-label="Delete"
                          >
                            {FB_ICONS.trash}
                          </button>
                        </header>
                        {it.value?.title && it.value.title !== "(no title)" && (
                          <h3 className="fbCardTitle">{it.value.title}</h3>
                        )}
                        <p className="fbCardText">{it.value?.text}</p>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </WinApp>
  );
};
const Slide = ({ value, max = 1, onChange, className = "" }) => (
  <div
    className={`slBar ${className}`}
    onPointerDown={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const set = (ev) => {
        const r = Math.min(
          max,
          Math.max(0, ((ev.clientX - rect.left) / Math.max(1, rect.width)) * max),
        );
        onChange(r);
      };
      set(e);
      const mv = (ev) => set(ev);
      const up = () => {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", mv);
      window.addEventListener("pointerup", up);
    }}
    style={{ "--x": `${max ? (value / max) * 100 : 0}%` }}
  >
    <div
      className="slFill"
      style={{
        width: `${max ? (value / max) * 100 : 0}%`,
        "--x": `${max ? (value / max) * 100 : 0}%`,
      }}
    />
  </div>
);
const mmss = (t) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/* ═══════════════════════════════════════════════════════════════════
   Groove Music — Win11 media player
   Sidebar (Songs / Albums / Artists) · main library · now-playing bar.
   All icons inline SVG — no emoji anywhere.
   ═══════════════════════════════════════════════════════════════════ */

const GROOVE_ICONS = {
  songs: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="7" cy="13.2" r="3.1" />
      <circle cx="14.5" cy="11.2" r="3.1" />
      <path d="M10.1 13.2V4.6l7.5-1.5v8.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  albums: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <circle cx="10" cy="10" r="3.2" />
      <circle cx="10" cy="10" r="0.7" fill="currentColor" />
    </svg>
  ),
  artists: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="10" cy="7" r="3.2" />
      <path d="M3.8 17c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" strokeLinecap="round" />
    </svg>
  ),
  add: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  shuffle: (
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        d="M3 5h3l8 10h3M3 15h3l3-3.9M14 3l3 2-3 2M14 13l3 2-3 2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  repeat: (
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        d="M6 4h8a3 3 0 0 1 3 3v3M14 16H6a3 3 0 0 1-3-3v-3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 7l2-3 2 3M16 13l-2 3-2-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  repeatOne: (
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        d="M6 4h8a3 3 0 0 1 3 3v3M14 16H6a3 3 0 0 1-3-3v-3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 7l2-3 2 3M16 13l-2 3-2-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 8.4v4M9.2 9.1l.8-.7" strokeLinecap="round" />
    </svg>
  ),
  prev: (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 4v12M16 4.5v11L6.5 10 16 4.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  next: (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M15 4v12M4 4.5v11L13.5 10 4 4.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <path d="M5 3.5v13l12-6.5L5 3.5z" fill="currentColor" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <rect x="4" y="3.5" width="4.5" height="13" rx="1" fill="currentColor" />
      <rect x="11.5" y="3.5" width="4.5" height="13" rx="1" fill="currentColor" />
    </svg>
  ),
  playRow: (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M4 3v10l9-5-9-5z" fill="currentColor" />
    </svg>
  ),
  pauseRow: (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect x="3.5" y="3.5" width="3.4" height="9" rx="0.7" fill="currentColor" />
      <rect x="9.1" y="3.5" width="3.4" height="9" rx="0.7" fill="currentColor" />
    </svg>
  ),
  volume: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3v-5z" strokeLinejoin="round" />
      <path d="M13 7a4 4 0 0 1 0 6M15 5a7 7 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  ),
  volumeMute: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3v-5z" strokeLinejoin="round" />
      <path d="M13 8l4 4M17 8l-4 4" strokeLinecap="round" />
    </svg>
  ),
  empty: (
    <svg
      viewBox="0 0 64 64"
      width="80"
      height="80"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="22" cy="44" r="7.5" />
      <circle cx="50" cy="40" r="7.5" />
      <path d="M29.5 44V20l20.5-3v23" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* "Artist - Title" or "01. Title" or plain filename → { title, artist, album } */
const grooveParse = (file) => {
  const base = String(file.name || "").replace(/\.[^.]+$/, "");
  let artist = "";
  let title = base;
  const m = base.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/);
  if (m) {
    artist = m[1].trim();
    title = m[2].trim();
  }
  title = title.replace(/^\d{1,3}[.\-_\s]+/, "").trim() || base;
  return {
    ...file,
    _title: title,
    _artist: artist || "Unknown artist",
    _album: artist || "Unknown album",
  };
};

const grooveInitials = (str) => {
  const w = String(str || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return ((w[0]?.[0] || "?") + (w[1]?.[0] || "")).toUpperCase();
};

export const GrooveApp = () => {
  const [raw, setRaw] = useState([]);
  const [cur, setCur] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("songs");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off");

  const audioRef = useRef(null);
  const importRef = useRef(null);

  useEffect(() => {
    idb
      .getAll("files")
      .then((rs) => {
        const songs = (rs || []).filter(
          (r) =>
            r.type === "file" &&
            (/^audio\//.test(r.mime || "") ||
              /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(r.name || "")),
        );
        setRaw(songs);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const songs = raw.map(grooveParse);

  const filtered = songs.filter((s) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return `${s._title} ${s._artist} ${s._album}`.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a._title.localeCompare(b._title);
    if (sort === "artist") return a._artist.localeCompare(b._artist);
    if (sort === "date") return (b.at || 0) - (a.at || 0);
    return 0;
  });

  const groupBy = (arr, key) => {
    const map = new Map();
    arr.forEach((s) => {
      const k = s[key] || "Unknown";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    });
    return Array.from(map.entries())
      .map(([name, list]) => ({ name, list }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };
  const albums = groupBy(sorted, "_album");
  const artists = groupBy(sorted, "_artist");

  const srcOf = (r) =>
    r && r.content && r.content.__b64
      ? `data:${r.content.mime || r.mime || "audio/mpeg"};base64,${r.content.data}`
      : null;

  /* A file was double-clicked somewhere else: play it here. The router parks
     the request in the shared mailbox; this app picks it up on mount and on
     every later hand-off, so it works whether Groove was already running or not. */
  useEffect(() => {
    const grab = () => {
      const t = mediaBus.take("audio");
      if (!t || !t.path) return;
      const hit = songs.find((x) => x.path === t.path);
      if (hit) playSong(hit);
      else
        notify({
          app: "Groove Music",
          icon: "img/icon/groove.png",
          title: "Not in your library",
          body: `${t.name} is not a playable audio file yet.`,
          kind: "warn",
          life: 5,
        });
    };
    if (loaded) grab();
    window.addEventListener("wos:openMedia", grab);
    return () => window.removeEventListener("wos:openMedia", grab);
  }, [loaded, songs]);

  const playSong = (s) => {
    const src = srcOf(s);
    if (!src) return;
    setCur(s);
    setPlaying(true);
    setPos(0);
    setDur(0);
    setTimeout(() => {
      const a = audioRef.current;
      if (!a) return;
      a.src = src;
      a.volume = muted ? 0 : vol;
      a.play().catch(() => setPlaying(false));
    }, 0);
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !cur) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const step = (delta) => {
    const pool = shuffle ? [...sorted].sort(() => Math.random() - 0.5) : sorted;
    if (!pool.length) return;
    if (!cur) {
      playSong(pool[0]);
      return;
    }
    const i = pool.findIndex((x) => x.path === cur.path);
    const nextIdx = (i + delta + pool.length) % pool.length;
    playSong(pool[nextIdx]);
  };

  const seek = (v) => {
    if (audioRef.current) audioRef.current.currentTime = v;
    setPos(v);
  };

  const changeVol = (v) => {
    setVol(v);
    setMuted(false);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.volume = next ? 0 : vol;
  };

  const onEnded = () => {
    if (repeat === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }
    step(1);
  };

  const addFiles = async (files) => {
    for (const f of files) {
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(f);
      });
      const b64 = String(dataUrl).split(",")[1] || "";
      try {
        const vs = await import("../../../utils/os/vs");
        const { vsWrite, userHome } = vs;
        await vsWrite(
          `${userHome()}\\Music\\${f.name}`,
          { __b64: true, mime: f.type, data: b64 },
          { mime: f.type },
        );
        const { mirrorFlat } = await import("../../../utils/os/vs");
        await mirrorFlat().catch(() => {});
      } catch (e) {}
    }
    const rs = await idb.getAll("files");
    const next = (rs || []).filter(
      (r) =>
        r.type === "file" &&
        (/^audio\//.test(r.mime || "") || /\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(r.name || "")),
    );
    setRaw(next);
    notify({
      app: "Groove Music",
      title: "Added to Music",
      body: `${files.length} file${files.length === 1 ? "" : "s"} copied to your Music folder`,
      kind: "success",
      life: 4,
    });
  };

  const curIndex = cur ? sorted.findIndex((s) => s.path === cur.path) : -1;
  const curArt = cur ? cur._album : "";

  return (
    <WinApp id="groove" title="Groove Music" invert bg="#111">
      <div className="grooveApp">
        {/* ── SIDEBAR ── */}
        <aside className="grooveSide">
          <div className="grooveSideBrand">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="8" cy="16" r="3.4" />
              <circle cx="17" cy="13" r="3.4" />
              <path d="M11.4 16V6l8.6-1.6V13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Groove Music</span>
          </div>

          <nav className="grooveNav">
            {[
              ["songs", "Songs", GROOVE_ICONS.songs, songs.length],
              ["albums", "Albums", GROOVE_ICONS.albums, albums.length],
              ["artists", "Artists", GROOVE_ICONS.artists, artists.length],
            ].map(([id, label, icon, count]) => (
              <button
                key={id}
                className={`grooveNavItem ${view === id ? "on" : ""}`}
                onClick={() => setView(id)}
              >
                <span className="grooveNavIcon">{icon}</span>
                <span className="grooveNavLabel">{label}</span>
                {count > 0 && <span className="grooveNavCount">{count}</span>}
              </button>
            ))}
          </nav>

          <div className="grooveSideFoot">
            <button className="grooveAddBtn" onClick={() => importRef.current?.click()}>
              {GROOVE_ICONS.add}
              Add from this device
            </button>
            <input
              ref={importRef}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) addFiles(files);
                e.target.value = "";
              }}
            />
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="grooveMain">
          <header className="grooveTopbar">
            <h1 className="grooveTopTitle">
              {view === "songs" ? "Songs" : view === "albums" ? "Albums" : "Artists"}
            </h1>

            <div className="grooveSearch">
              {GROOVE_ICONS.search}
              <input
                className="grooveSearchInput"
                placeholder="Filter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  className="grooveSearchClear"
                  onClick={() => setQuery("")}
                  aria-label="Clear"
                >
                  <svg
                    viewBox="0 0 12 12"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>

            {view === "songs" && (
              <div className="grooveSort">
                <span className="grooveSortLabel">Sort</span>
                <Win11Select
                  value={sort}
                  onChange={setSort}
                  className="grooveSortSelect"
                  ariaLabel="Sort songs"
                >
                  <option value="name">Title</option>
                  <option value="artist">Artist</option>
                  <option value="date">Date added</option>
                </Win11Select>
              </div>
            )}
          </header>

          <div className="grooveBody">
            {!loaded ? null : songs.length === 0 ? (
              <div className="grooveEmpty">
                <div className="grooveEmptyArt">{GROOVE_ICONS.empty}</div>
                <div className="grooveEmptyTitle">No music yet</div>
                <div className="grooveEmptySub">
                  Copy songs into <b>Music</b> with File Explorer, or
                </div>
                <button
                  className="winBtn accent grooveEmptyBtn"
                  onClick={() => importRef.current?.click()}
                >
                  {GROOVE_ICONS.add} Add from this device
                </button>
              </div>
            ) : view === "songs" ? (
              <div className="grooveList">
                <div className="grooveListHead">
                  <span className="grooveCol-ico" />
                  <span className="grooveCol-title">Title</span>
                  <span className="grooveCol-artist">Artist</span>
                  <span className="grooveCol-album">Album</span>
                  <span className="grooveCol-dur">Duration</span>
                </div>
                {sorted.map((s) => {
                  const isPlayingThis = playing && cur?.path === s.path;
                  return (
                    <div
                      key={s.path}
                      className={`grooveRow ${cur?.path === s.path ? "on" : ""}`}
                      onDoubleClick={() => playSong(s)}
                    >
                      <button
                        className="grooveRowPlay"
                        onClick={() => (cur?.path === s.path ? toggle() : playSong(s))}
                        aria-label={isPlayingThis ? "Pause" : "Play"}
                      >
                        {isPlayingThis ? (
                          <span className="groovePlaying" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        ) : (
                          GROOVE_ICONS.playRow
                        )}
                      </button>
                      <div
                        className="grooveRowArt"
                        style={{ background: s._album ? "#2e2e2e" : "transparent" }}
                      >
                        {grooveInitials(s._album)}
                      </div>
                      <div className="grooveCol-title grooveRowTitle">{s._title}</div>
                      <div className="grooveCol-artist grooveRowArtist">{s._artist}</div>
                      <div className="grooveCol-album grooveRowAlbum">{s._album}</div>
                      <div className="grooveCol-dur grooveRowDur">{mmss(s.dur || 0)}</div>
                    </div>
                  );
                })}
              </div>
            ) : view === "albums" ? (
              <div className="grooveGrid">
                {albums.map((a) => (
                  <button
                    key={a.name}
                    className="grooveCard"
                    onClick={() => {
                      const q = a.name === "Unknown album" ? "" : a.name;
                      setQuery(q);
                      setView("songs");
                    }}
                  >
                    <div className="grooveCardArt">{grooveInitials(a.name)}</div>
                    <div className="grooveCardTitle">{a.name}</div>
                    <div className="grooveCardSub">
                      {a.list.length} song{a.list.length === 1 ? "" : "s"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grooveGrid grooveGridArtists">
                {artists.map((a) => (
                  <button
                    key={a.name}
                    className="grooveCard grooveCardArtist"
                    onClick={() => {
                      const q = a.name === "Unknown artist" ? "" : a.name;
                      setQuery(q);
                      setView("songs");
                    }}
                  >
                    <div className="grooveCardArt grooveCardArtRound">{grooveInitials(a.name)}</div>
                    <div className="grooveCardTitle">{a.name}</div>
                    <div className="grooveCardSub">
                      {a.list.length} song{a.list.length === 1 ? "" : "s"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* ── NOW PLAYING ── */}
        <footer className="groovePlayer">
          <div className="grooveSeekRow">
            <span className="grooveTime grooveTimeCur">{mmss(pos)}</span>
            <Slide className="grooveSeek" value={pos} max={dur || 1} onChange={seek} />
            <span className="grooveTime grooveTimeTot">{mmss(dur)}</span>
          </div>

          <div className="groovePlayerRow">
            <div className="grooveNow">
              <div className="grooveNowArt">
                {cur ? (
                  grooveInitials(curArt)
                ) : (
                  <svg
                    viewBox="0 0 20 20"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <circle cx="10" cy="10" r="7.5" />
                    <circle cx="10" cy="10" r="2" />
                  </svg>
                )}
              </div>
              <div className="grooveNowMeta">
                <div className="grooveNowTitle">{cur ? cur._title : "Not playing"}</div>
                <div className="grooveNowArtist">
                  {cur ? cur._artist : "Pick something from your library"}
                </div>
              </div>
            </div>

            <div className="grooveTransport">
              <button
                className={`grooveTBtn ${shuffle ? "on" : ""}`}
                onClick={() => setShuffle(!shuffle)}
                title={shuffle ? "Shuffle on" : "Shuffle off"}
                aria-label="Shuffle"
              >
                {GROOVE_ICONS.shuffle}
              </button>
              <button
                className="grooveTBtn"
                onClick={() => step(-1)}
                disabled={!sorted.length}
                title="Previous"
                aria-label="Previous"
              >
                {GROOVE_ICONS.prev}
              </button>
              <button
                className="groovePlayBtn"
                onClick={toggle}
                disabled={!cur}
                title={playing ? "Pause" : "Play"}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? GROOVE_ICONS.pause : GROOVE_ICONS.play}
              </button>
              <button
                className="grooveTBtn"
                onClick={() => step(1)}
                disabled={!sorted.length}
                title="Next"
                aria-label="Next"
              >
                {GROOVE_ICONS.next}
              </button>
              <button
                className={`grooveTBtn ${repeat !== "off" ? "on" : ""}`}
                onClick={() =>
                  setRepeat(repeat === "off" ? "all" : repeat === "all" ? "one" : "off")
                }
                title={
                  repeat === "one" ? "Repeat one" : repeat === "all" ? "Repeat all" : "Repeat off"
                }
                aria-label="Repeat"
              >
                {repeat === "one" ? GROOVE_ICONS.repeatOne : GROOVE_ICONS.repeat}
              </button>
            </div>

            <div className="grooveRight">
              <button
                className="grooveTBtn"
                onClick={toggleMute}
                title={muted ? "Unmute" : "Mute"}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? GROOVE_ICONS.volumeMute : GROOVE_ICONS.volume}
              </button>
              <Slide className="grooveVol" value={muted ? 0 : vol} max={1} onChange={changeVol} />
              <span className="grooveVolPct">{Math.round((muted ? 0 : vol) * 100)}%</span>
            </div>
          </div>
        </footer>

        <audio
          ref={audioRef}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime || 0)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (d && isFinite(d)) {
              setDur(d);
              if (cur && !cur.dur) {
                const updated = { ...cur, dur: d };
                setCur(updated);
              }
            }
          }}
          onEnded={onEnded}
          style={{ display: "none" }}
        />
      </div>
    </WinApp>
  );
};
/* ═══════════════════════════════════════════════════════════════════
   Movies & TV — Win11 media library
   Sidebar filters · video grid with real thumbnails · continue
   watching · custom player (play/seek/volume/PiP/fullscreen).
   ═══════════════════════════════════════════════════════════════════ */

const MOV_ICONS = {
  film: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18M3 15h18M7 5v14M17 5v14" />
    </svg>
  ),
  all: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  clock: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  heart: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M12 20.5l-7.5-7a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 1 1 6.5 6.5L12 20.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  long: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
    </svg>
  ),
  short: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5 12h14M8 8v8M12 8v8M16 8v8" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  ),
  close: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M6 4.5v15l14-7.5L6 4.5z" fill="currentColor" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <rect x="5.5" y="4.5" width="4.5" height="15" rx="1" fill="currentColor" />
      <rect x="14" y="4.5" width="4.5" height="15" rx="1" fill="currentColor" />
    </svg>
  ),
  skipBack: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 5v14M19 5.5v13L8.5 12 19 5.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  skipFwd: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M18 5v14M5 5.5v13L15.5 12 5 5.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  back10: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" strokeLinecap="round" />
      <path d="M4 3.5v4h4" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="12"
        y="15.2"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </svg>
  ),
  fwd10: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" strokeLinecap="round" />
      <path d="M20 3.5v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      <text
        x="12"
        y="15.2"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </svg>
  ),
  volume: (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3v-5z" strokeLinejoin="round" />
      <path d="M13 7a4 4 0 0 1 0 6M15 5a7 7 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  ),
  mute: (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3v-5z" strokeLinejoin="round" />
      <path d="M13 8l4 4M17 8l-4 4" strokeLinecap="round" />
    </svg>
  ),
  pip: (
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.8" />
      <rect x="10" y="10" width="6" height="4.5" rx="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  fullscreen: (
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M3.5 8V4h4M12.5 4h4v4M16.5 12v4h-4M7.5 16h-4v-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  fullscreenExit: (
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M7.5 4v4h-4M16.5 8h-4V4M12.5 16v-4h4M7.5 12v4h-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  heartFilled: (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M12 20.5l-7.5-7a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 1 1 6.5 6.5L12 20.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  heartOutline: (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M12 20.5l-7.5-7a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 1 1 6.5 6.5L12 20.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  back: (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M10 3l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  empty: (
    <svg
      viewBox="0 0 64 64"
      width="76"
      height="76"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="6" y="14" width="52" height="36" rx="3" />
      <path d="M22 24l16 8-16 8V24z" fill="currentColor" stroke="none" />
      <path d="M6 22h52M6 42h52" />
    </svg>
  ),
};

const isVideoFile = (name) => /\.(mp4|webm|mov|m4v|ogv|mkv|avi)$/i.test(name || "");
const isPlayableInBrowser = (name) => /\.(mp4|webm|mov|m4v|ogv)$/i.test(name || "");

const movFmt = (bytes) => {
  const n = Number(bytes) || 0;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
};

const movTime = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const movThumb = (dataUrl) =>
  new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      try {
        v.removeAttribute("src");
        v.load();
      } catch (e) {}
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), 6000);
    v.onloadedmetadata = () => {
      const seek = Math.min(Math.max(1, v.duration * 0.1), Math.max(0.15, v.duration - 0.5));
      try {
        v.currentTime = seek;
      } catch (e) {
        clearTimeout(timer);
        finish(null);
      }
    };
    v.onseeked = () => {
      clearTimeout(timer);
      try {
        const w = 480;
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || 270;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").drawImage(v, 0, 0, w, h);
        finish(c.toDataURL("image/jpeg", 0.72));
      } catch (e) {
        finish(null);
      }
    };
    v.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    v.src = dataUrl;
  });

export const MoviesApp = () => {
  const [videos, setVideos] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [progress, setProgress] = useState({});
  const [favorites, setFavorites] = useState({});
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState("User");
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date");
  const [playing, setPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [genThumbs, setGenThumbs] = useState(0);

  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimer = useRef(null);
  const saveProgressRef = useRef(null);

  /* Load videos + cached thumbs/progress/favs */
  useEffect(() => {
    (async () => {
      try {
        const u = await getUser();
        const name = u?.username || "User";
        setUser(name);
        const list = await fsList(`C:\\Users\\${name}\\Videos`).catch(() => []);
        const vids = (list || []).filter((f) => f.type === "file" && isVideoFile(f.name));
        setVideos(vids);

        const tmap = {},
          pmap = {},
          fmap = {};
        for (const v of vids) {
          const cached = await idb.get(`videos.thumb.${v.path}`).catch(() => null);
          if (cached) tmap[v.path] = cached;
          const p = await idb.get(`video.progress.${v.path}`).catch(() => null);
          if (p && p.t > 3) pmap[v.path] = p;
          const f = await idb.get(`video.fav.${v.path}`).catch(() => null);
          if (f) fmap[v.path] = true;
        }
        setThumbs(tmap);
        setProgress(pmap);
        setFavorites(fmap);
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  /* Generate missing thumbnails lazily in background */
  useEffect(() => {
    if (!ready || !videos.length) return;
    let dead = false;
    (async () => {
      for (const v of videos) {
        if (dead) return;
        if (thumbs[v.path]) continue;
        if (!isPlayableInBrowser(v.name)) continue;
        if ((Number(v.size) || 0) > 250 * 1024 * 1024) continue;
        try {
          const { vsReadDataUrl } = await import("../../../utils/os/vs");
          const rec = await vsReadDataUrl(v.path).catch(() => null);
          if (!rec?.dataUrl) continue;
          const t = await movThumb(rec.dataUrl);
          if (dead) return;
          if (t) {
            setThumbs((prev) => ({ ...prev, [v.path]: t }));
            idb.set(`videos.thumb.${v.path}`, t).catch(() => {});
            setGenThumbs((n) => n + 1);
          }
        } catch (e) {}
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, videos.length]);

  /* Filter + sort */
  const list = videos
    .filter((v) => {
      if (view === "fav" && !favorites[v.path]) return false;
      if (view === "recent" && !progress[v.path]) return false;
      if (query.trim() && !v.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return (Number(b.size) || 0) - (Number(a.size) || 0);
      return (b.at || 0) - (a.at || 0); // date
    });

  /* Open a video for playback */
  /* Same mailbox, video side: double-click an .mp4 anywhere and it starts
     here — including files outside the Videos folder, which is why the
     request carries its own name and path. */
  useEffect(() => {
    const grab = () => {
      const t = mediaBus.take("video");
      if (!t || !t.path) return;
      const hit = videos.find((x) => x.path === t.path);
      openVideo(hit || { name: t.name, path: t.path, type: "file" });
    };
    if (ready) grab();
    window.addEventListener("wos:openMedia", grab);
    return () => window.removeEventListener("wos:openMedia", grab);
  }, [ready, videos]);

  const openVideo = async (v) => {
    if (!isPlayableInBrowser(v.name)) {
      notify({
        app: "Movies & TV",
        icon: "img/icon/movies.png",
        title: "Can't play this format",
        body: `${v.name.split(".").pop().toUpperCase()} files aren't supported by the browser's built-in player.`,
        kind: "info",
        life: 5,
      });
      return;
    }
    const { vsReadDataUrl } = await import("../../../utils/os/vs");
    const rec = await vsReadDataUrl(v.path).catch(() => null);
    if (!rec?.dataUrl) {
      notify({ app: "Movies & TV", title: "Could not open", body: v.path, kind: "error", life: 4 });
      return;
    }
    setPlaying({ ...v, dataUrl: rec.dataUrl });
    setIsPlaying(true);
    setCurrentTime(progress[v.path]?.t || 0);
    setDuration(0);
    setShowInfo(false);
  };

  const closePlayer = () => {
    // save progress
    if (videoRef.current && playing) {
      const t = videoRef.current.currentTime;
      const d = videoRef.current.duration;
      if (t > 3 && d && t < d - 3) {
        const rec = { t, d, at: Date.now() };
        idb.set(`video.progress.${playing.path}`, rec).catch(() => {});
        setProgress((p) => ({ ...p, [playing.path]: rec }));
      } else if (t >= 3) {
        // finished — clear progress
        idb.del(`video.progress.${playing.path}`).catch(() => {});
        setProgress((p) => {
          const n = { ...p };
          delete n[playing.path];
          return n;
        });
      }
    }
    setPlaying(null);
    setIsPlaying(false);
    setIsFullscreen(false);
  };

  const toggleFavorite = async (v) => {
    const next = !favorites[v.path];
    setFavorites((f) => {
      const n = { ...f };
      if (next) n[v.path] = true;
      else delete n[v.path];
      return n;
    });
    if (next) await idb.set(`video.fav.${v.path}`, true).catch(() => {});
    else await idb.del(`video.fav.${v.path}`).catch(() => {});
  };

  /* Player callbacks */
  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };
  const seekBy = (sec) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + sec));
  };
  const seekTo = (frac) => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    vid.currentTime = frac * vid.duration;
  };
  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const next = !muted;
    vid.muted = next;
    setMuted(next);
  };
  const changeVolume = (v) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = v;
    vid.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  };
  const toggleFullscreen = async () => {
    const wrap = playerRef.current;
    if (!wrap) return;
    try {
      if (!document.fullscreenElement) {
        await wrap.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {}
  };
  const togglePip = async () => {
    const vid = videoRef.current;
    if (!vid) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (document.pictureInPictureEnabled) await vid.requestPictureInPicture();
    } catch (e) {}
  };

  /* Auto-hide controls in player */
  useEffect(() => {
    if (!playing) return;
    const wrap = playerRef.current;
    if (!wrap) return;
    const onMove = () => {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
      }, 2800);
    };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onMove);
    onMove();
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onMove);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing]);

  /* Fullscreen change listener (Esc key etc.) */
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /* Keyboard shortcuts in player */
  useEffect(() => {
    if (!playing) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(10);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        changeVolume(Math.min(1, volume + 0.1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        changeVolume(Math.max(0, volume - 0.1));
      } else if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "m") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "Escape") {
        if (!document.fullscreenElement) closePlayer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, volume, muted]);

  /* ══════════════ PLAYER VIEW ══════════════ */
  if (playing) {
    const prog = duration ? currentTime / duration : 0;
    return (
      <WinApp id="movies" title={playing.name}>
        <div className="movPlayer" ref={playerRef}>
          <video
            ref={videoRef}
            className="movVideo"
            src={playing.dataUrl}
            autoPlay
            playsInline
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime || 0);
              // auto-save every ~5s
              if (Math.floor(e.currentTarget.currentTime) % 5 === 0) {
                const d = e.currentTarget.duration;
                if (d && e.currentTarget.currentTime > 3) {
                  idb
                    .set(`video.progress.${playing.path}`, {
                      t: e.currentTarget.currentTime,
                      d,
                      at: Date.now(),
                    })
                    .catch(() => {});
                }
              }
            }}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (d && isFinite(d)) {
                setDuration(d);
                if (currentTime > 0 && currentTime < d - 3) {
                  try {
                    e.currentTarget.currentTime = currentTime;
                  } catch (err) {}
                }
              }
              e.currentTarget.volume = muted ? 0 : volume;
            }}
            onEnded={() => {
              setIsPlaying(false);
              idb.del(`video.progress.${playing.path}`).catch(() => {});
              setProgress((p) => {
                const n = { ...p };
                delete n[playing.path];
                return n;
              });
            }}
          />

          {/* Top bar */}
          <div className={`movTop ${controlsVisible || !isPlaying ? "on" : ""}`}>
            <button className="movTopBtn" onClick={closePlayer} aria-label="Back">
              {MOV_ICONS.back}
              Back
            </button>
            <div className="movTopTitle">{playing.name}</div>
            <button
              className={`movTopBtn movFav ${favorites[playing.path] ? "on" : ""}`}
              onClick={() => toggleFavorite(playing)}
              title={favorites[playing.path] ? "Remove from favorites" : "Add to favorites"}
              aria-label="Favorite"
            >
              {favorites[playing.path] ? MOV_ICONS.heartFilled : MOV_ICONS.heartOutline}
            </button>
            <button
              className="movTopBtn"
              onClick={() => setShowInfo(!showInfo)}
              aria-label="Info"
              title="Info"
            >
              <svg
                viewBox="0 0 20 20"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 9v5M10 6.5h.01" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Info panel */}
          {showInfo && (
            <div className="movInfoPanel">
              <div className="movInfoTitle">Video details</div>
              <div className="movInfoRow">
                <span>Name</span>
                <b>{playing.name}</b>
              </div>
              <div className="movInfoRow">
                <span>Path</span>
                <b title={playing.path}>{playing.path}</b>
              </div>
              <div className="movInfoRow">
                <span>Size</span>
                <b>{movFmt(playing.size)}</b>
              </div>
              <div className="movInfoRow">
                <span>Duration</span>
                <b>{duration ? movTime(duration) : "—"}</b>
              </div>
              {videoRef.current && (
                <div className="movInfoRow">
                  <span>Resolution</span>
                  <b>
                    {videoRef.current.videoWidth}×{videoRef.current.videoHeight}
                  </b>
                </div>
              )}
            </div>
          )}

          {/* Center play overlay */}
          {!isPlaying && (
            <button className="movCenterPlay" onClick={togglePlay} aria-label="Play">
              {MOV_ICONS.play}
            </button>
          )}

          {/* Bottom controls */}
          <div className={`movControls ${controlsVisible || !isPlaying ? "on" : ""}`}>
            <div className="movSeekRow">
              <span className="movTime">{movTime(currentTime)}</span>
              <div
                className="movSeek"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                }}
                onPointerDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const move = (ev) =>
                    seekTo(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)));
                  move(e);
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              >
                <div className="movSeekFill" style={{ width: `${prog * 100}%` }} />
                <div className="movSeekKnob" style={{ left: `${prog * 100}%` }} />
              </div>
              <span className="movTime">{duration ? movTime(duration) : "—"}</span>
            </div>

            <div className="movControlsRow">
              <div className="movControlsLeft">
                <button
                  className="movCBtn"
                  onClick={() => seekBy(-10)}
                  title="Back 10s"
                  aria-label="Back 10 seconds"
                >
                  {MOV_ICONS.back10}
                </button>
                <button
                  className="movCBtn"
                  onClick={() => seekBy(-5)}
                  title="Back 5s"
                  aria-label="Back 5 seconds"
                  style={{ display: "none" }}
                >
                  {MOV_ICONS.skipBack}
                </button>
                <button
                  className="movCBtn movPlayBtn"
                  onClick={togglePlay}
                  title={isPlaying ? "Pause" : "Play"}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? MOV_ICONS.pause : MOV_ICONS.play}
                </button>
                <button
                  className="movCBtn"
                  onClick={() => seekBy(10)}
                  title="Forward 10s"
                  aria-label="Forward 10 seconds"
                >
                  {MOV_ICONS.fwd10}
                </button>
                <button
                  className="movCBtn movVolumeBtn"
                  onClick={toggleMute}
                  title={muted ? "Unmute" : "Mute"}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? MOV_ICONS.mute : MOV_ICONS.volume}
                </button>
                <div
                  className="movVolTrack"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    changeVolume(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                  }}
                >
                  <div className="movVolFill" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
                </div>
              </div>

              <div className="movControlsRight">
                <button
                  className="movCBtn"
                  onClick={togglePip}
                  title="Picture in picture"
                  aria-label="Picture in picture"
                >
                  {MOV_ICONS.pip}
                </button>
                <button
                  className="movCBtn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit full screen" : "Full screen"}
                  aria-label="Full screen"
                >
                  {isFullscreen ? MOV_ICONS.fullscreenExit : MOV_ICONS.fullscreen}
                </button>
              </div>
            </div>
          </div>
        </div>
      </WinApp>
    );
  }

  /* ══════════════ LIBRARY VIEW ══════════════ */
  const recentList = videos.filter((v) => progress[v.path]).slice(0, 4);
  const filters = [
    ["all", "All videos", MOV_ICONS.all, videos.length],
    ["recent", "Continue watching", MOV_ICONS.clock, recentList.length],
    ["fav", "Favorites", MOV_ICONS.heart, Object.keys(favorites).length],
  ];

  return (
    <WinApp id="movies" title="Movies & TV">
      <div className="movApp">
        {/* ── SIDEBAR ── */}
        <aside className="movSide">
          <div className="movSideBrand">
            {MOV_ICONS.film}
            <span>Movies & TV</span>
          </div>

          <nav className="movNav">
            {filters.map(([id, label, icon, count]) => (
              <button
                key={id}
                className={`movNavItem ${view === id ? "on" : ""}`}
                onClick={() => setView(id)}
              >
                <span className="movNavIcon">{icon}</span>
                <span className="movNavLabel">{label}</span>
                {count > 0 && <span className="movNavCount">{count}</span>}
              </button>
            ))}
          </nav>

          <div className="movSideFoot">
            <div className="movSideHint">
              Videos in <b>C:\Users\{user}\Videos</b> appear here automatically.
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="movMain">
          <header className="movTopbar">
            <h1 className="movTopTitle">
              {view === "all"
                ? "Your videos"
                : view === "recent"
                  ? "Continue watching"
                  : "Favorites"}
            </h1>

            <div className="movSearch">
              {MOV_ICONS.search}
              <input
                className="movSearchInput"
                placeholder="Search videos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="movSearchClear" onClick={() => setQuery("")} aria-label="Clear">
                  {MOV_ICONS.close}
                </button>
              )}
            </div>

            <Win11Select
              value={sort}
              onChange={setSort}
              className="movSortSelect"
              ariaLabel="Sort videos"
            >
              <option value="date">Date added</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </Win11Select>
          </header>

          <div className="movBody">
            {!ready ? null : list.length === 0 ? (
              <div className="movEmpty">
                <div className="movEmptyArt">{MOV_ICONS.empty}</div>
                <div className="movEmptyTitle">
                  {query
                    ? "No videos match your search"
                    : view === "recent"
                      ? "Nothing to continue"
                      : view === "fav"
                        ? "No favorites yet"
                        : "Your video library is empty"}
                </div>
                <div className="movEmptySub">
                  {view === "all" && !query ? (
                    <>
                      Drop video files into <b>C:\Users\{user}\Videos</b> with File Explorer — they
                      appear here automatically.
                    </>
                  ) : (
                    "Nothing to show for this filter."
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Continue watching strip on the "all" view */}
                {view === "all" && recentList.length > 0 && !query && (
                  <section className="movSection">
                    <div className="movSectionTitle">Continue watching</div>
                    <div className="movRow">
                      {recentList.map((v) => (
                        <VideoCard
                          key={"recent-" + v.path}
                          v={v}
                          thumb={thumbs[v.path]}
                          progress={progress[v.path]}
                          fav={!!favorites[v.path]}
                          onOpen={() => openVideo(v)}
                          onFav={() => toggleFavorite(v)}
                          wide
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section className="movSection">
                  {view === "all" && recentList.length > 0 && !query && (
                    <div className="movSectionTitle">All videos</div>
                  )}
                  <div className="movGrid">
                    {list.map((v) => (
                      <VideoCard
                        key={v.path}
                        v={v}
                        thumb={thumbs[v.path]}
                        progress={progress[v.path]}
                        fav={!!favorites[v.path]}
                        onOpen={() => openVideo(v)}
                        onFav={() => toggleFavorite(v)}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </WinApp>
  );
};

/* ── Video card ── */
function VideoCard({ v, thumb, progress, fav, onOpen, onFav, wide = false }) {
  const playable = isPlayableInBrowser(v.name);
  const prog = progress && progress.d && progress.t ? Math.min(1, progress.t / progress.d) : 0;
  const remaining = progress && progress.d ? progress.d - progress.t : 0;

  return (
    <div className={`movCard ${wide ? "movCardWide" : ""} ${playable ? "" : "unplayable"}`}>
      <button className="movCardHit" onClick={onOpen} aria-label={`Play ${v.name}`}>
        <div className="movCardThumb">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" />
          ) : (
            <div className="movCardNoThumb">
              <svg
                viewBox="0 0 48 48"
                width="42"
                height="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="6" y="10" width="36" height="28" rx="3" />
                <path d="M21 19l10 5-10 5V19z" fill="currentColor" stroke="none" />
              </svg>
            </div>
          )}
          {playable && (
            <span className="movCardPlay" aria-hidden="true">
              {MOV_ICONS.play}
            </span>
          )}
          {!playable && <span className="movCardBadge">Unsupported</span>}
          {progress && progress.d && (
            <>
              <div className="movCardProgress">
                <div className="movCardProgressFill" style={{ width: `${prog * 100}%` }} />
              </div>
              {remaining > 0 && <span className="movCardRemain">-{movTime(remaining)}</span>}
            </>
          )}
        </div>
      </button>

      <div className="movCardMeta">
        <div className="movCardTitle" title={v.name}>
          {v.name.replace(/\.[^.]+$/, "")}
        </div>
        <div className="movCardSub">{movFmt(v.size)}</div>
      </div>

      <button
        className={`movCardFav ${fav ? "on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onFav();
        }}
        title={fav ? "Remove from favorites" : "Add to favorites"}
        aria-label="Favorite"
      >
        {fav ? MOV_ICONS.heartFilled : MOV_ICONS.heartOutline}
      </button>
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════
   Xbox — only what's actually on this PC.
   Home · My library · Captures. Nothing pretended.
   ═══════════════════════════════════════════════════════════════════ */

const XBOX_ICONS = {
  home: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M4 11l8-6.5 8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  library: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  captures: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <path d="M8 6l1.5-3h5L16 6" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 16 16" width="12" height="12">
      <path d="M4 3v10l9-5-9-5z" fill="currentColor" />
    </svg>
  ),
  star: (
    <svg
      viewBox="0 0 20 20"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M10 2.5l2.3 4.7 5.2.8-3.7 3.6.9 5.1L10 14.2l-4.7 2.5.9-5.1L2.5 8l5.2-.8L10 2.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  trophy: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 3h8v5a4 4 0 0 1-8 0V3z" strokeLinejoin="round" />
      <path
        d="M6 5H4a2 2 0 0 0 2 2M14 5h2a2 2 0 0 1-2 2M8 12v3H6a1.5 1.5 0 0 0 0 3h8a1.5 1.5 0 0 0 0-3h-2v-3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

/* Only games this PC actually has. */
const XBOX_GAMES = [
  {
    id: "SOLITAIREAPP",
    title: "Solitaire Collection",
    studio: "Microsoft Casual Games",
    genre: "Card · Classic",
    desc: "Klondike with real rules and real shuffles — drag or click to play, draw 1 or 3, wins tracked on this PC.",
    rating: 4.5,
    size: "—",
    hue: "#0e6b0e",
    accent: "#5bb34e",
    glyph: (
      <svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="#fff" strokeWidth="2.4">
        <rect x="10" y="10" width="24" height="34" rx="3" />
        <rect x="30" y="20" width="24" height="34" rx="3" fill="#0a4d0a" />
        <path
          d="M22 22l-5 7h4l-6 9 8-2 -2 6 6-5 -1 5 3-4"
          stroke="#5bb34e"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "MINEAPP",
    title: "Minesweeper",
    studio: "Microsoft Casual Games",
    genre: "Puzzle · Classic",
    desc: "First-click-safe. Three difficulties, real flags and chords, best times saved per tier.",
    rating: 4.7,
    size: "—",
    hue: "#1c3d5c",
    accent: "#4ab1e0",
    glyph: (
      <svg viewBox="0 0 64 64" width="52" height="52" fill="none" stroke="#fff" strokeWidth="2.4">
        <circle cx="32" cy="38" r="16" />
        <path
          d="M32 22V8M24 16l8-8 8 8M44 14l6-6M48 32h8M8 32h8"
          strokeLinecap="round"
          stroke="#4ab1e0"
        />
      </svg>
    ),
  },
];

/* Recently played — updates when you launch a game. */
const XBOX_RECENT_KEY = "xbox.recent";

export const XboxApp = () => {
  const dispatch = useDispatch();
  const [view, setView] = useState("home");
  const [recent, setRecent] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [ready, setReady] = useState(false);

  /* load recently played + real photos */
  useEffect(() => {
    (async () => {
      try {
        const r = await idb.get(XBOX_RECENT_KEY);
        if (Array.isArray(r)) setRecent(r);
        const photos = (await idb.getAll("photos").catch(() => [])) || [];
        setCaptures(
          photos
            .filter((p) => p.dataUrl)
            .slice(-12)
            .reverse(),
        );
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  const launch = async (g) => {
    /* mark as recently played */
    const next = [g.id, ...recent.filter((x) => x !== g.id)].slice(0, 3);
    setRecent(next);
    idb.set(XBOX_RECENT_KEY, next).catch(() => {});
    dispatch({ type: g.id, payload: "full" });
  };

  const featured = XBOX_GAMES[0];
  const recentGames = recent.map((id) => XBOX_GAMES.find((g) => g.id === id)).filter(Boolean);

  const viewTitle = view === "home" ? "Home" : view === "library" ? "My library" : "Captures";

  return (
    <WinApp id="xbox" title="Xbox" invert bg="#0b0b0c">
      <div className="xbApp">
        {/* ── SIDEBAR ── */}
        <aside className="xbSide">
          <div className="xbSideBrand">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#107c10" />
              <path d="M12 5c-2.5 2-4 5-4 7 0 2.3 1.8 4 4 4s4-1.7 4-4c0-2-1.5-5-4-7z" fill="#fff" />
            </svg>
            <span>Xbox</span>
          </div>

          <nav className="xbNav">
            {[
              ["home", "Home", XBOX_ICONS.home],
              ["library", "My library", XBOX_ICONS.library],
              ["captures", "Captures", XBOX_ICONS.captures],
            ].map(([id, label, icon]) => (
              <button
                key={id}
                className={`xbNavItem ${view === id ? "on" : ""}`}
                onClick={() => setView(id)}
              >
                <span className="xbNavIcon">{icon}</span>
                <span className="xbNavLabel">{label}</span>
              </button>
            ))}
          </nav>

          <div className="xbSideFoot">
            <div className="xbSideNote">{XBOX_GAMES.length} games installed on this PC</div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="xbMain">
          <header className="xbTop">
            <h1 className="xbTopTitle">{viewTitle}</h1>
          </header>

          <div className="xbBody">
            {view === "home" && (
              <>
                {/* Hero */}
                <section
                  className="xbHero"
                  style={{ "--xb-hue": featured.hue, "--xb-acc": featured.accent }}
                >
                  <div className="xbHeroArt">{featured.glyph}</div>
                  <div className="xbHeroCopy">
                    <div className="xbHeroKicker">Featured</div>
                    <h1 className="xbHeroTitle">{featured.title}</h1>
                    <p className="xbHeroDesc">{featured.desc}</p>
                    <div className="xbHeroRow">
                      <button className="xbPrimaryBtn" onClick={() => launch(featured)}>
                        {XBOX_ICONS.play} Play
                      </button>
                      <div className="xbHeroMeta">
                        <span className="xbRating">
                          {XBOX_ICONS.star} {featured.rating}
                        </span>
                        <span className="xbDot" />
                        <span>{featured.genre}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Jump back in (only shows after you've played something) */}
                {recentGames.length > 0 && (
                  <section className="xbSection">
                    <div className="xbSectionHead">
                      <h2 className="xbSectionTitle">Jump back in</h2>
                      <button className="xbSectionMore" onClick={() => setView("library")}>
                        My library
                      </button>
                    </div>
                    <div className="xbRow">
                      {recentGames.map((g) => (
                        <GameCard key={g.id} g={g} onLaunch={() => launch(g)} wide />
                      ))}
                    </div>
                  </section>
                )}

                {/* Achievements */}
                <section className="xbSection">
                  <div className="xbSectionHead">
                    <h2 className="xbSectionTitle">Your games</h2>
                  </div>
                  <div className="xbAchGrid">
                    {XBOX_GAMES.map((g) => (
                      <div key={g.id} className="xbAchCard">
                        <div className="xbAchMedal on">{XBOX_ICONS.trophy}</div>
                        <div className="xbAchBody">
                          <div className="xbAchName">{g.title}</div>
                          <div className="xbAchGame">{g.studio}</div>
                          <div className="xbAchWhen">{g.genre}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {view === "library" && (
              <>
                <div className="xbGridHead">
                  <h2 className="xbGridTitle">
                    {XBOX_GAMES.length} game{XBOX_GAMES.length === 1 ? "" : "s"} installed
                  </h2>
                </div>
                <div className="xbGrid">
                  {XBOX_GAMES.map((g) => (
                    <GameCard key={g.id} g={g} onLaunch={() => launch(g)} />
                  ))}
                </div>
              </>
            )}

            {view === "captures" && (
              <>
                {!ready ? null : captures.length === 0 ? (
                  <div className="xbCaptures">
                    <div className="xbCapturesEmpty">
                      <svg
                        viewBox="0 0 48 48"
                        width="52"
                        height="52"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <rect x="6" y="12" width="36" height="26" rx="3" />
                        <circle cx="24" cy="25" r="7" />
                        <path d="M17 12l2.5-4h9L31 12" strokeLinejoin="round" />
                      </svg>
                      <div className="xbCapturesTitle">No captures yet</div>
                      <div className="xbCapturesSub">
                        Take a snip with the Snipping Tool or a photo with Camera — they'll appear
                        here.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="xbCapturesGrid">
                    {captures.map((p) => (
                      <div key={p.id} className="xbCapture">
                        <img src={p.dataUrl} alt={p.name || "capture"} loading="lazy" />
                        <div className="xbCaptureMeta">
                          <div className="xbCaptureName" title={p.name}>
                            {p.name || "Capture"}
                          </div>
                          <div className="xbCaptureDate">
                            {new Date(p.at || Date.now()).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </WinApp>
  );
};

/* ── Game card ── */
function GameCard({ g, onLaunch, wide = false }) {
  return (
    <div
      className={`xbCard ${wide ? "xbCardWide" : ""}`}
      style={{ "--xb-hue": g.hue, "--xb-acc": g.accent }}
    >
      <button className="xbCardArt" onClick={onLaunch} aria-label={`Launch ${g.title}`}>
        <div className="xbCardGlyph">{g.glyph}</div>
        <span className="xbCardPlay">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path d="M6 4.5v15l14-7.5L6 4.5z" fill="currentColor" />
          </svg>
        </span>
      </button>
      <div className="xbCardBody">
        <div className="xbCardTitle" title={g.title}>
          {g.title}
        </div>
        <div className="xbCardStudio">{g.studio}</div>
        <div className="xbCardRow">
          <span className="xbRating">
            {XBOX_ICONS.star} {g.rating}
          </span>
          <span className="xbDot" />
          <span className="xbCardGenre">{g.genre}</span>
        </div>
      </div>
      <div className="xbCardFoot">
        <button className="xbCardBtn" onClick={onLaunch}>
          {XBOX_ICONS.play} Play
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Narrator — Win11 settings-style rebuild
   Sidebar nav · Read / Voice / Shortcuts / About · live preview ·
   settings persisted to Virtual Storage. Web Speech API under the hood.
   ═══════════════════════════════════════════════════════════════════ */

const NAR_ICONS = {
  read: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h9" strokeLinecap="round" />
    </svg>
  ),
  voice: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="8" y="2.5" width="4" height="10" rx="2" />
      <path d="M4.5 10a5.5 5.5 0 0 0 11 0M10 15.5v2M7.5 17.5h5" strokeLinecap="round" />
    </svg>
  ),
  shortcuts: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2.5" y="5.5" width="15" height="9" rx="1.8" />
      <path
        d="M5.5 8.5h.01M8 8.5h.01M10.5 8.5h.01M13 8.5h.01M5.5 11.5h.01M8 11.5h6.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  about: (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5M10 6.5h.01" strokeLinecap="round" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 16 16" width="13" height="13">
      <path d="M4 3v10l9-5-9-5z" fill="currentColor" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 16 16" width="13" height="13">
      <rect x="3.5" y="3.5" width="3.4" height="9" rx="0.7" fill="currentColor" />
      <rect x="9.1" y="3.5" width="3.4" height="9" rx="0.7" fill="currentColor" />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 16 16" width="13" height="13">
      <rect x="3.8" y="3.8" width="8.4" height="8.4" rx="1.2" fill="currentColor" />
    </svg>
  ),
  clipboard: (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="6" y="4" width="10" height="12" rx="1.6" />
      <path d="M4 6v10a1.5 1.5 0 0 0 1.5 1.5h8" strokeLinecap="round" />
      <rect x="7.5" y="2.5" width="7" height="3" rx="0.8" />
    </svg>
  ),
  clear: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M4 5h8M6.5 5V3.5h3V5M5.5 5l.5 8h4l.5-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  sample: (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3.5 15.5l3.5-3.5M7 12l2-5 8 8-5 2-5-5z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  speaker: (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 7.5h3l4-3.5v12l-4-3.5H3v-5z" strokeLinejoin="round" />
      <path d="M13 7a4 4 0 0 1 0 6M15 5a7 7 0 0 1 0 10" strokeLinecap="round" />
    </svg>
  ),
};

const NAR_PREF_KEY = "narrator.prefs";
const NAR_HIST_KEY = "narrator.history";

const NAR_PRESETS = {
  gentle: { rate: 0.9, pitch: 1.0, label: "Gentle" },
  normal: { rate: 1.0, pitch: 1.0, label: "Normal" },
  fast: { rate: 1.5, pitch: 1.0, label: "Fast" },
  robotic: { rate: 1.0, pitch: 0.6, label: "Robotic" },
};

export const NarratorApp = () => {
  const [view, setView] = useState("read");
  const [text, setText] = useState(
    "Welcome to Windows 11. This is Narrator — type anything and I'll read it aloud.",
  );
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const supported = typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined";
  const uttRef = useRef(null); // Chrome GCs utterances mid-speech without this

  /* ── Load preferences + history ─────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const prefs = await idb.get(NAR_PREF_KEY);
        if (prefs) {
          if (typeof prefs.rate === "number") setRate(prefs.rate);
          if (typeof prefs.pitch === "number") setPitch(prefs.pitch);
          if (typeof prefs.volume === "number") setVolume(prefs.volume > 0.05 ? prefs.volume : 1);
          if (prefs.voiceURI) setVoiceURI(prefs.voiceURI);
        }
        const h = await idb.get(NAR_HIST_KEY);
        if (Array.isArray(h)) setHistory(h);
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  /* ── Enumerate voices (async on Chrome/Edge) ────────────── */
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices() || [];
      if (!list.length) return;
      setVoices(list);
      setVoiceURI((cur) => {
        if (cur && list.some((v) => v.voiceURI === cur)) return cur;
        // prefer an English voice on first run
        const en = list.find((v) => /^en[-_]/.test(v.lang)) || list[0];
        return en ? en.voiceURI : "";
      });
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  /* ── Persist prefs when they change ─────────────────────── */
  useEffect(() => {
    if (!ready) return;
    idb.set(NAR_PREF_KEY, { rate, pitch, volume, voiceURI }).catch(() => {});
  }, [ready, rate, pitch, volume, voiceURI]);

  const currentVoice = voices.find((v) => v.voiceURI === voiceURI) || null;

  /* ── Speak ──────────────────────────────────────────────── */
  const speak = (content) => {
    if (!supported) return;
    const value = (content ?? text).trim();
    if (!value) return;

    const synth = window.speechSynthesis;

    /* Chromium bug 1: speak() called immediately after cancel() is often
     silently dropped. Cancel, then wait one frame before speaking. */
    try {
      synth.cancel();
    } catch (e) {}

    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(value);

      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) {
        u.voice = v;
        u.lang = v.lang || "en-US";
      } else {
        u.lang = "en-US";
      }

      u.rate = Math.max(0.5, Math.min(3, rate));
      u.pitch = Math.max(0.1, Math.min(2, pitch));
      /* Clamp volume: a persisted 0% silences every future utterance with
       no visible hint. Floor at 5% so the state is never fully muted. */
      u.volume = Math.max(0.05, Math.min(1, volume > 0 ? volume : 1));

      u.onstart = () => {
        setSpeaking(true);
        setPaused(false);
        setErr("");
      };
      u.onend = () => {
        setSpeaking(false);
        setPaused(false);
      };
      u.onerror = (e) => {
        setSpeaking(false);
        setPaused(false);
        if (e.error && e.error !== "canceled" && e.error !== "interrupted") {
          setErr(`Speech error: ${e.error}`);
        }
      };

      /* Chromium bug 2: if the utterance isn't referenced anywhere, the
       GC can collect it mid-playback and Chrome just goes silent. */
      uttRef.current = u;

      try {
        synth.speak(u);
      } catch (err) {
        setErr("Couldn't start speech: " + String(err?.message || err));
      }
    }, 80);
  };

  const pauseOrResume = () => {
    if (!supported) return;
    const s = window.speechSynthesis;
    if (s.paused) {
      s.resume();
      setPaused(false);
    } else if (s.speaking) {
      s.pause();
      setPaused(true);
    }
  };

  const stop = () => {
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
    setSpeaking(false);
    setPaused(false);
  };

  const previewVoice = (v) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const sample = `Hi, I'm ${v.name.split(" ")[0] || "a"} voice. ${v.lang}.`;
    const u = new SpeechSynthesisUtterance(sample);
    u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    window.speechSynthesis.speak(u);
  };

  const readClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t && t.trim()) {
        setText(t);
        speak(t);
      } else setErr("Clipboard is empty.");
    } catch (e) {
      setErr("Couldn't read the clipboard. The browser may be blocking it — try pasting instead.");
    }
  };

  const clearHistory = () => {
    setHistory([]);
    idb.set(NAR_HIST_KEY, []).catch(() => {});
  };

  /* ── Word/char count + estimated time at current rate ───── */
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const estSeconds = words ? Math.round((words / (150 * rate)) * 60) : 0;
  const estLabel = (() => {
    if (!estSeconds) return "—";
    if (estSeconds < 60) return `${estSeconds} sec`;
    const m = Math.floor(estSeconds / 60);
    const s = estSeconds % 60;
    return s ? `${m} min ${s} sec` : `${m} min`;
  })();

  /* ── Keyboard shortcuts inside the Read view ────────────── */
  useEffect(() => {
    if (view !== "read") return;
    const onKey = (e) => {
      const tag = e.target.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if (inField) return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        speaking ? pauseOrResume() : speak();
      } else if (e.key === "Escape") {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, speaking, text, rate, pitch, volume, voiceURI]);

  /* ── Not supported fallback ─────────────────────────────── */
  if (!supported) {
    return (
      <WinApp id="narrator" title="Narrator">
        <div className="narFallback">
          <svg
            viewBox="0 0 64 64"
            width="80"
            height="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="22" y="8" width="20" height="34" rx="10" />
            <path d="M12 30a20 20 0 0 0 40 0M32 50v8M22 58h20" strokeLinecap="round" />
            <path d="M10 10l44 44" stroke="#c42b1c" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h2>Speech synthesis unavailable</h2>
          <p className="winMuted">
            This browser doesn't expose the Web Speech API, so Narrator can't read anything aloud.
            Everything else in the PC still works.
          </p>
        </div>
      </WinApp>
    );
  }

  return (
    <WinApp id="narrator" title="Narrator">
      <div className="narApp">
        {/* ── SIDEBAR ── */}
        <aside className="narSide">
          <div className="narSideBrand">
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="8" y="2.5" width="4" height="10" rx="2" />
              <path d="M4.5 10a5.5 5.5 0 0 0 11 0M10 15.5v2M7.5 17.5h5" strokeLinecap="round" />
            </svg>
            Narrator
          </div>

          <nav className="narNav">
            {[
              ["read", "Read", NAR_ICONS.read],
              ["voice", "Voice", NAR_ICONS.voice],
              ["shortcuts", "Shortcuts", NAR_ICONS.shortcuts],
              ["about", "About", NAR_ICONS.about],
            ].map(([id, label, icon]) => (
              <button
                key={id}
                className={`narNavItem ${view === id ? "on" : ""}`}
                onClick={() => setView(id)}
              >
                <span className="narNavIcon">{icon}</span>
                <span className="narNavLabel">{label}</span>
              </button>
            ))}
          </nav>

          {speaking && (
            <div className="narLiveBadge">
              <span className="narLiveDot" />
              <span>{paused ? "Paused" : "Reading"}</span>
            </div>
          )}

          <div className="narSideFoot">
            <div
              className="narSideVoice"
              title={currentVoice ? `${currentVoice.name} (${currentVoice.lang})` : "No voice"}
            >
              <span className="narSideVoiceIcon">{NAR_ICONS.speaker}</span>
              <span className="narSideVoiceName">
                {currentVoice ? currentVoice.name.replace(/\s*\(.*\)$/, "") : "No voice"}
              </span>
            </div>
            <div className="narSideVoiceMeta">
              {currentVoice?.lang || "—"} · {rate.toFixed(1)}× · pitch {pitch.toFixed(1)}
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="narMain">
          {view === "read" && (
            <div className="narPane">
              <header className="narHead">
                <h1 className="narTitle">Read aloud</h1>
                <div className="narHeadMeta">
                  {chars} chars · {words} words · ~{estLabel} at {rate.toFixed(1)}×
                </div>
              </header>

              <textarea
                className="narTextarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste anything…"
                spellCheck="false"
              />

              <div className="narControls">
                {!speaking ? (
                  <button className="winBtn accent narBtnPrimary" onClick={() => speak()}>
                    {NAR_ICONS.play}
                    Read aloud
                  </button>
                ) : (
                  <>
                    <button className="winBtn accent narBtnPrimary" onClick={pauseOrResume}>
                      {paused ? NAR_ICONS.play : NAR_ICONS.pause}
                      {paused ? "Resume" : "Pause"}
                    </button>
                    <button className="winBtn ghost" onClick={stop}>
                      {NAR_ICONS.stop}
                      Stop
                    </button>
                  </>
                )}

                <div className="narControlsSpacer" />

                <button
                  className="winBtn ghost"
                  onClick={readClipboard}
                  title="Read text from clipboard"
                >
                  {NAR_ICONS.clipboard}
                  Read clipboard
                </button>
                <button
                  className="winBtn ghost"
                  onClick={() =>
                    setText(
                      "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!",
                    )
                  }
                  title="Load a sample"
                >
                  {NAR_ICONS.sample}
                  Sample
                </button>
                <button
                  className="winBtn ghost"
                  onClick={() => {
                    stop();
                    setText("");
                  }}
                  title="Clear"
                >
                  {NAR_ICONS.clear}
                  Clear
                </button>
              </div>

              {err && <div className="narErr">{err}</div>}

              {history.length > 0 && (
                <section className="narHistory">
                  <div className="narHistoryHead">
                    <h2 className="narHistoryTitle">Recently spoken</h2>
                    <button className="winBtn ghost narHistoryClear" onClick={clearHistory}>
                      Clear
                    </button>
                  </div>
                  <div className="narHistoryList">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        className="narHistoryItem"
                        onClick={() => {
                          setText(h.text);
                          speak(h.text);
                        }}
                        title="Click to speak again"
                      >
                        <span className="narHistoryDot" />
                        <span className="narHistoryText">{h.text}</span>
                        <span className="narHistoryWhen">
                          {new Date(h.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {view === "voice" && (
            <div className="narPane">
              <header className="narHead">
                <h1 className="narTitle">Voice</h1>
                <div className="narHeadMeta">
                  {voices.length} voice{voices.length === 1 ? "" : "s"} available on this device
                </div>
              </header>

              <section className="narCard">
                <label className="narLabel">Voice</label>
                <Win11Select
                  value={voiceURI}
                  onChange={(v) => setVoiceURI(v)}
                  className="narSelect"
                  ariaLabel="Voice"
                  placeholder="Choose a voice"
                >
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </Win11Select>
                <div className="narCardRow">
                  <button
                    className="winBtn"
                    onClick={() => speak("This is a preview of the selected voice.")}
                    disabled={!currentVoice}
                  >
                    {NAR_ICONS.play}
                    Preview
                  </button>
                  {currentVoice && (
                    <span className="narVoiceTag">
                      {currentVoice.localService
                        ? "Local voice — works offline"
                        : "Network voice — needs internet"}
                    </span>
                  )}
                </div>
              </section>

              <section className="narCard">
                <div className="narSliderRow">
                  <label className="narSliderLabel">Speed</label>
                  <Slide value={rate} max={3} onChange={setRate} className="narSlider" />
                  <span className="narSliderValue">{rate.toFixed(1)}×</span>
                </div>
                <div className="narSliderHint">0.5× → 3.0×</div>

                <div className="narSliderRow">
                  <label className="narSliderLabel">Pitch</label>
                  <Slide value={pitch} max={2} onChange={setPitch} className="narSlider" />
                  <span className="narSliderValue">{pitch.toFixed(1)}</span>
                </div>
                <div className="narSliderHint">0.5 → 2.0 (higher = more feminine/robotic)</div>

                <div className="narSliderRow">
                  <label className="narSliderLabel">Volume</label>
                  <Slide value={volume} max={1} onChange={setVolume} className="narSlider" />
                  <span className="narSliderValue">{Math.round(volume * 100)}%</span>
                </div>
                <div className="narSliderHint">Relative to system volume</div>

                <div className="narPresets">
                  <span className="narPresetsLabel">Presets</span>
                  {Object.entries(NAR_PRESETS).map(([k, p]) => (
                    <button
                      key={k}
                      className={`winBtn ghost chip ${
                        Math.abs(p.rate - rate) < 0.05 && Math.abs(p.pitch - pitch) < 0.05
                          ? "on"
                          : ""
                      }`}
                      onClick={() => {
                        setRate(p.rate);
                        setPitch(p.pitch);
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="narCardRow">
                  <button
                    className="winBtn"
                    onClick={() => speak("The quick brown fox jumps over the lazy dog.")}
                  >
                    {NAR_ICONS.play}
                    Test with current settings
                  </button>
                </div>
              </section>
            </div>
          )}

          {view === "shortcuts" && (
            <div className="narPane">
              <header className="narHead">
                <h1 className="narTitle">Shortcuts</h1>
                <div className="narHeadMeta">While the Read view has focus</div>
              </header>

              <div className="narShortcutList">
                {[
                  ["Space", "Start reading, or pause/resume"],
                  ["K", "Same as Space"],
                  ["Esc", "Stop immediately"],
                  ["Shift + Enter", "Insert a new paragraph"],
                  ["Tab", "Move between controls"],
                ].map(([key, label]) => (
                  <div key={key} className="narShortcut">
                    <span className="narKey">{key}</span>
                    <span className="narShortcutLabel">{label}</span>
                  </div>
                ))}
              </div>

              <div className="narNote">
                Real Windows Narrator uses the Caps Lock key as its modifier and reads every UI
                element. A browser cannot reach the OS accessibility tree, so this Narrator speaks
                text you give it, and only while this window is focused.
              </div>
            </div>
          )}

          {view === "about" && (
            <div className="narPane">
              <header className="narHead">
                <h1 className="narTitle">About Narrator</h1>
              </header>

              <section className="narCard">
                <div className="narAboutRow">
                  <b>Engine</b>
                  <span>
                    Web Speech API (
                    {typeof window !== "undefined" && window.speechSynthesis
                      ? "available"
                      : "unavailable"}
                    )
                  </span>
                </div>
                <div className="narAboutRow">
                  <b>Voices on this device</b>
                  <span>{voices.length}</span>
                </div>
                <div className="narAboutRow">
                  <b>Local voices</b>
                  <span>{voices.filter((v) => v.localService).length}</span>
                </div>
                <div className="narAboutRow">
                  <b>Network voices</b>
                  <span>{voices.filter((v) => !v.localService).length}</span>
                </div>
                <div className="narAboutRow">
                  <b>Settings saved to</b>
                  <span>Virtual Storage (IndexedDB)</span>
                </div>
              </section>

              <div className="narNote">
                <b>Honest limits.</b> Narrator here reads text — it does not walk the UI or announce
                buttons, tabs, or focus changes the way Windows 11's built-in Narrator does. A
                browser has no access to the operating system's accessibility tree, and Web Speech
                is a per-tab feature that stops the moment you leave this window.
                <br />
                <br />
                Everything it does do — real voice synthesis, per-voice preview, speed / pitch /
                volume, and saved preferences — works entirely on this PC.
              </div>
            </div>
          )}
        </main>
      </div>
    </WinApp>
  );
};
function ChatShell({ id, title, bot }) {
  const [lines, setLines] = useState([{ from: "them", text: bot.hello }]);
  const [v, setV] = useState("");
  const send = () => {
    if (!v.trim()) return;
    const next = [
      ...lines,
      { from: "me", text: v.trim() },
      { from: "them", text: bot.reply(v.trim()) },
    ];
    setLines(next);
    setV("");
  };
  return (
    <WinApp id={id} title={title}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="chatLog">
          {lines.map((l, i) => (
            <div key={i} className={`bubble ${l.from}`}>
              {l.text}
            </div>
          ))}
        </div>
        <div className="winRow" style={{ padding: 8 }}>
          <input
            className="winInput"
            style={{ flex: 1 }}
            value={v}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="winBtn" onClick={send}>
            Send
          </button>
        </div>
      </div>
    </WinApp>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BitBot — the local brain from bittuhere/ai, vendored into public/bitbot/.
   Loads once per session with honest progress, then answers through the
   pipeline below. Every response is cleaned and marker-resolved.
   ═══════════════════════════════════════════════════════════════════════ */

const BITBOT_FILES = [
  "brain.js",
  "math.js",
  "wordmath.js",
  "data.js",
  "data2.js",
  "data3.js",
  "data4.js",
  "weights.js",
];
const BITBOT_TOTAL_KB = 11400;
let bitbotBoot = null;

const loadBitBot = () => {
  if (bitbotBoot) return bitbotBoot;
  bitbotBoot = (async () => {
    let done = 0;
    const step = (kb) => {
      done += kb;
      try {
        window.dispatchEvent(
          new CustomEvent("bitbot-progress", { detail: done / BITBOT_TOTAL_KB }),
        );
      } catch (e) {}
      return done / BITBOT_TOTAL_KB;
    };
    for (const f of BITBOT_FILES) {
      await loadLocalScript(`bitbot/${f}`);
      step(f === "weights.js" ? 10800 : 150);
    }
    if (!window.BitBrain || !window.BITBOT_WEIGHTS)
      throw new Error("the BitBot engine did not initialise");
    const vocab = window.BITBOT_WEIGHTS.vocab;
    vocab.index = {};
    vocab.words.forEach((w, i) => {
      vocab.index[w] = i;
    });
    const net = window.BitBrain.Net.load(window.BITBOT_WEIGHTS.net);
    return { net, vocab };
  })();
  bitbotBoot.catch(() => { bitbotBoot = null; });
  return bitbotBoot;
};

const bbSteps = (steps) =>
  (steps || [])
    .map((x) =>
      typeof x === "string"
        ? `• ${x}`
        : `• ${x.why ? `${x.why}: ` : ""}${x.calc ?? x.expr ?? x.text ?? ""}`.replace(/\s+$/, ""),
    )
    .filter((l) => l !== "•")
    .join("\n");

/* ─── Template map — every __MARKER__ the brain's data files use ──────
   Fill in more here if you spot new ones in the raw responses. Any
   marker not listed falls through to a readable "skills"-style phrase,
   so a bubble is never empty. */
const BB_TEMPLATES = {
  /* ── Fallback styles for unresolved markers ── */
  __SKILLS__:
    "I can help with **maths** (every step shown), **word problems**, **science**, **general knowledge**, and questions about **this PC**. Try: `solve 2x + 5 = 17` or `what is 23 times 47`.",
  __SKILL__:
    "I can help with **maths** (every step shown), **word problems**, **science**, **general knowledge**, and questions about **this PC**. Try: `solve 2x + 5 = 17` or `what is 23 times 47`.",
  __HELP__:
    "Ask me anything about **maths, word problems, science, general knowledge**, or **this PC's features**. If I don't know, I say so — I never guess.",
  __HELPFUL__:
    "Happy to help! Ask me about **maths**, **word problems**, **science**, or anything about **this PC**.",
  __MATH__:
    "I solve maths in **BODMAS order** — brackets → orders (powers / roots) → multiplication & division left→right → addition & subtraction left→right. Every step is shown.",
  __EXAMPLE__:
    'Try: `solve 2x + 5 = 17`, `what is 15% of 240`, `23 times 47`, or a word problem like *"A train travels 120 km in 2 hours — what is its speed?"*.',
  __EXAMPLES__:
    'Try: `solve 2x + 5 = 17`, `what is 15% of 240`, `23 times 47`, or a word problem like *"A train travels 120 km in 2 hours — what is its speed?"*.',

  /* ── Small talk ── */
  __GREETING__: "Hi there!",
  __GREETING1__: "Hello!",
  __GREETING2__: "Hey, good to see you.",
  __HELLO__: "Hello!",
  __HI__: "Hi!",
  __HEY__: "Hey!",
  __THANKS__: "You're welcome.",
  __THANK__: "You're welcome.",
  __THANKYOU__: "You're very welcome.",
  __BYE__: "Goodbye — come back anytime.",
  __BYE1__: "See you soon!",
  __GOODBYE__: "Goodbye.",
  __WELCOME__: "Welcome!",
  __OK__: "Alright.",
  __OKAY__: "Okay.",
  __SURE__: "Sure.",

  /* ── Topic areas the intent pool mentions ── */
  __GAME__:
    "I don't play games myself — but the **Store**, **Solitaire**, and **Minesweeper** on this PC do. What would you like to try?",
  __GAMES__:
    "The games on this PC are **Solitaire Collection** and **Minesweeper** — both in the Store. Open the Store to see the full catalog.",
  __ACCOUNT__:
    "You can see your account in **Settings → Accounts**. Everything stays on this PC — no online sign-in needed.",
  __STUDY__:
    "I can help with study topics: **maths** (all steps shown), **word problems**, **science**, and **general knowledge**. What subject are you working on?",
  __STUDYMATERIAL__:
    'Try asking: **"what is photosynthesis"**, **"solve 3x + 5 = 20"**, or a word problem. I\'ll show the reasoning.',
  __SCIENCE__:
    'Ask me about **physics**, **chemistry**, **biology** — I know a lot of common questions. Try "what is photosynthesis" or "what is Newton\'s second law".',
  __HISTORY__:
    'I have general history — try "when did World War 2 end" or "who was the first president of India".',
  __SPORTS__:
    "Sports questions are fine — ask me about **cricket**, **football**, **Olympics**, etc.",
  __GK__:
    "General knowledge is one of my strengths. Ask me about **countries, capitals, science, history** — anything factual.",
  __MORE__: "Here's a bit more — ask a follow-up and I'll go deeper.",
  __INFO__: "I'm a local brain running on this PC — 82 lakh parameters, no internet, no telemetry.",
  __ABOUT__:
    "I'm **BitBot**, this PC's local brain. Maths, word problems, science, general knowledge — ask away.",
  __ABOUTYOU__:
    "You're using **Windows 11 WebOS** — an open-source recreation of the Windows 11 desktop that runs in your browser.",

  /* ── Pronouns / placeholders ── */
  __NAME__: "",
  __YOU__: "",
  __ME__: "you",
  __USER__: "",
};
/* Resolve markers to text; if unknown, convert "__SOME_KEY__" → "some key"
   so the response stays readable instead of dying. */
const bbResolve = (t) =>
  String(t || "").replace(/__([A-Z][A-Z0-9_]*?)__/g, (m, key) => {
    const direct = BB_TEMPLATES[`__${key}__`];
    if (direct !== undefined) return direct;
    return key.toLowerCase().replace(/_/g, " ");
  });

/* Final cleanup pass — never returns an empty string. */
const bbClean = (raw, name) => {
  let t = String(raw || "");
  t = t.replace(/\{name\}/gi, name || "friend");
  t = t.replace(/\{g\}/g, "");
  t = bbResolve(t);
  t = t.replace(/\{[a-z_][a-z0-9_]*\}/gi, "");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.trim();

  /* 1 · completely empty */
  if (!t || t.length < 2) {
    return "I don't have a good answer for that one yet. Try asking about **maths**, **word problems**, **science**, or **this PC** — I'm better at those.";
  }

  /* 2 · a bare word (like "skill") means a marker that didn't resolve —
        show an honest message instead of just echoing the word back. */
  const wordCount = t.split(/\s+/).length;
  const isBareWord = t.length < 30 && wordCount <= 3 && /^[a-z][a-z \-]+$/.test(t);
  if (isBareWord) {
    return `Hmm — that looks like a topic I recognise (*${t}*) but don't have a full answer for yet. Try **maths**, **word problems**, **science**, or ask about **this PC**.`;
  }

  return t;
};

const bbEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Rich markdown-lite: headings, lists, quotes, code, links,
   superscripts (x^2), stacked fractions (3/4), bold, italic. */
const bbMd = (t) => {
  if (!t) return "";
  let s = bbEsc(t);

  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre class="bb-pre"><code>${code.replace(/^\n|\n$/g, "")}</code></pre>`);
    return `\u0000B${blocks.length - 1}\u0000`;
  });

  const inlines = [];
  s = s.replace(/`([^`\n]+?)`/g, (_, code) => {
    inlines.push(`<code class="bb-code">${code}</code>`);
    return `\u0000I${inlines.length - 1}\u0000`;
  });

  const out = [];
  let list = null;
  let para = [];
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushPara = () => {
    if (para.length) {
      out.push(`<p class="bb-p">${para.join(" ")}</p>`);
      para = [];
    }
  };

  for (const raw of s.split("\n")) {
    let m;
    if (/^\s*---+\s*$/.test(raw)) {
      flushPara();
      closeList();
      out.push(`<hr class="bb-hr"/>`);
      continue;
    }
    if ((m = raw.match(/^(#{1,3})\s+(.+)$/))) {
      flushPara();
      closeList();
      const lvl = m[1].length;
      out.push(`<h${lvl + 2} class="bb-h bb-h${lvl}">${m[2]}</h${lvl + 2}>`);
      continue;
    }
    if ((m = raw.match(/^>\s?(.*)$/))) {
      flushPara();
      closeList();
      out.push(`<blockquote class="bb-quote">${m[1]}</blockquote>`);
      continue;
    }
    if ((m = raw.match(/^\s*[-*]\s+(.+)$/))) {
      flushPara();
      if (list !== "ul") {
        closeList();
        out.push('<ul class="bb-ul">');
        list = "ul";
      }
      out.push(`<li>${m[1]}</li>`);
      continue;
    }
    if ((m = raw.match(/^\s*\d+\.\s+(.+)$/))) {
      flushPara();
      if (list !== "ol") {
        closeList();
        out.push('<ol class="bb-ol">');
        list = "ol";
      }
      out.push(`<li>${m[1]}</li>`);
      continue;
    }
    if (!raw.trim()) {
      flushPara();
      closeList();
      continue;
    }
    closeList();
    para.push(raw);
  }
  flushPara();
  closeList();
  let html = out.join("\n");

  html = html
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a class="bb-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/\*\*([^\n]+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^\n*][^\n]*?)\*(?!\*)/g, "$1<i>$2</i>");

  html = html
    .replace(/\^\{([^}]+)\}/g, '<sup class="bb-sup">$1</sup>')
    .replace(/\^(-?\d+|[a-zA-Z])/g, '<sup class="bb-sup">$1</sup>');

  html = html.replace(
    /(?<![\w/>])(\d{1,4})\/(\d{1,4})(?![\w/])/g,
    '<span class="bb-frac"><span class="bb-frac-n">$1</span><span class="bb-frac-d">$2</span></span>',
  );

  html = html.replace(/\u0000I(\d+)\u0000/g, (_, i) => inlines[+i]);
  html = html.replace(/\u0000B(\d+)\u0000/g, (_, i) => blocks[+i]);
  return html;
};

const BITBOT_GREETING =
  "Hi, I'm **BitBot** — this PC's local brain. Ask me maths (I show every step), word problems, science, GK — or just say hi.";

/* Small "reasoning" badges — surfaces which pipeline stage produced the answer */
const BB_VIA = {
  memory: "Remembered",
  math: "Maths · step-by-step",
  equation: "Equation solver",
  word: "Word problem solver",
  brain: "Neural net",
  fallback: "Honest fallback",
};

const BitBotHost = () => {
  const [lines, setLines] = useState([
    { id: "init", from: "them", text: BITBOT_GREETING, at: Date.now(), via: null },
  ]);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [booted, setBooted] = useState(false);
  const [bootErr, setBootErr] = useState("");
  const [streamId, setStreamId] = useState(null);
  const [streamChars, setStreamChars] = useState(0);
  const [copiedId, setCopiedId] = useState(null);

  const brainRef = useRef(null);
  const memRef = useRef({ name: null, turns: [], used: {} });
  const logRef = useRef(null);
  const streamTimer = useRef(null);

  useEffect(() => {
    const onProg = (e) => setProg(e.detail || 0);
    window.addEventListener("bitbot-progress", onProg);
    loadBitBot()
      .then((b) => {
        brainRef.current = b;
        setBooted(true);
      })
      .catch((e) => setBootErr(String(e.message || e)));
    return () => {
      window.removeEventListener("bitbot-progress", onProg);
      if (streamTimer.current) clearTimeout(streamTimer.current);
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo?.({ top: 1e6, behavior: "smooth" });
  }, [lines, busy]);

  const push = (from, text, via) => {
    const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLines((ls) => [...ls, { id, from, text, at: Date.now(), via: via || null }]);
    return id;
  };

  const streamInto = (id, fullText) =>
    new Promise((resolve) => {
      const total = fullText.length;
      setStreamId(id);
      setStreamChars(0);
      let i = 0;
      const step = Math.max(1, Math.ceil(total / 90));
      const tick = () => {
        i = Math.min(total, i + step);
        setStreamChars(i);
        if (i < total) {
          streamTimer.current = setTimeout(tick, 16);
        } else {
          setStreamId(null);
          setStreamChars(0);
          resolve();
        }
      };
      tick();
    });

  /* ─── the pipeline — a small chain of reasoning, step by step ───
     Each stage either answers or passes to the next:
       1 · name memory
       2 · expression solver  (BODMAS)
       3 · symbolic equations
       4 · word problems
       5 · neural net → intent → response
       6 · honest fallback
     Returns { text, via } so the UI can show which stage fired. */
  const think = async (q) => {
    const b = brainRef.current;
    const mem = memRef.current;
    /* Strip a leading @ (force-math prefix from some users) or other
   punctuation before detection, so `@2x-2` reads as `2x-2`. */
    const t = q.trim().replace(/^[@!#]+\s*/, "");

    const nm = t.match(/(?:my name is|i am|i'm)\s+([a-z]{1,20})\b/i);
    if (nm) {
      mem.name = nm[1].charAt(0).toUpperCase() + nm[1].slice(1);
      return {
        via: "memory",
        text: `Nice to meet you, **${mem.name}**! I'll remember that. Ask me anything — maths is my favourite.`,
      };
    }
    if (/what('?s| is) my name\??/i.test(t)) {
      return {
        via: "memory",
        text: mem.name
          ? `You're **${mem.name}** — you told me yourself.`
          : "You haven't told me yet! Say \"my name is …\" and I'll remember.",
      };
    }

    const { BitBrain, BitMath, BitWords, BitData } = window;

    if (BitMath?.looksLikeMath?.(t)) {
      const r = BitMath.solve(t);
      if (r?.ok) {
        const steps = r.steps?.length ? `\n\n**Steps:**\n${bbSteps(r.steps)}` : "";
        return { via: "math", text: `**${t} = ${r.value}**${steps}` };
      }
    }
    if (BitMath?.looksLikeEquation?.(t)) {
      const r = BitMath.solveEquation(t);
      if (r?.ok) {
        const ans = r.exact?.length ? r.exact.join(", ") : (r.roots || []).join(", ");
        let out = `**${t} → ${r.variable || "x"} = ${ans}**`;
        if (r.steps?.length) out += `\n\n**Working:**\n${bbSteps(r.steps)}`;
        if (r.checks?.length) out += `\n\n✓ verified by substitution`;
        return { via: "equation", text: out };
      }
    }
    if (BitWords?.looksLikeWordProblem?.(t)) {
      try {
        const wp = BitWords.solve(t);
        if (wp) {
          let out = wp.title ? `**${wp.title}**\n\n` : "";
          if (wp.given) out += `${wp.given}\n\n`;
          const steps = wp.steps?.length ? `**Solution:**\n${bbSteps(wp.steps)}\n\n` : "";
          out += `${steps}**${wp.answer}**`;
          if (wp.check) out += `\n\n${wp.check}`;
          return { via: "word", text: out };
        }
      } catch (e) {}
    }

    if (!b) {
      return {
        via: "fallback",
        text: "My engine is still loading — give it a second, then ask again.",
      };
    }

    const x = BitBrain.bag(t, b.vocab);
    const p = b.net.forward(x).p;
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i;
    const tag = b.vocab.tags[best];
    const prob = p[best];
    const toks = BitBrain.tokenize(t).map(BitBrain.stem);
    let known = 0;
    toks.forEach((w) => {
      if (b.vocab.index[w] !== undefined) known++;
    });
    const coverage = toks.length ? known / toks.length : 0;
    mem.turns.push({ tag, t: Date.now() });
    if (mem.turns.length > 8) mem.turns.shift();

    if (prob < 0.12 || (coverage < 0.35 && prob < 0.75)) {
      return {
        via: "fallback",
        text: `I don't know that one yet${mem.name ? `, ${mem.name}` : ""} — I'm a local 82-lakh-parameter brain, not the whole internet. Try maths, word problems, science, GK, or ask about this PC.`,
      };
    }
    const intent = (BitData.INTENTS || []).find((it) => it.tag === tag);
    const pool = intent?.responses;
    if (!pool?.length) {
      return {
        via: "fallback",
        text: `Good question. Here's what I know: **${tag.replace(/_/g, " ")}** — but my notes on it are thin. Ask me maths while I study up!`,
      };
    }
    const used = mem.used[tag] || (mem.used[tag] = []);
    let fresh = pool.filter((r) => !used.includes(r));
    if (!fresh.length) {
      used.length = 0;
      fresh = pool;
    }
    const resp = fresh[Math.floor(Math.random() * fresh.length)];
    used.push(resp);
    return { via: "brain", text: String(resp) };
  };

  const send = async () => {
    const q = v.trim();
    if (!q || busy) return;
    push("me", q);
    setV("");
    setBusy(true);

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 260));

    if (!booted) {
      setBusy(false);
      push("them", "One sec — still loading my brain from this PC's disk…", "fallback");
      return;
    }
    try {
      const { text: raw, via } = await think(q);
      const cleaned = bbClean(raw, memRef.current.name);
      setBusy(false);
      const id = push("them", cleaned, via);
      await streamInto(id, cleaned);
    } catch (e) {
      setBusy(false);
      push("them", `Something misfired in my head: ${String(e?.message || e)}`, "fallback");
    }
  };

  const copyMsg = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch (e) {}
  };

  const clearChat = () => {
    if (streamTimer.current) clearTimeout(streamTimer.current);
    setLines([{ id: "init", from: "them", text: BITBOT_GREETING, at: Date.now(), via: null }]);
    setStreamId(null);
    setStreamChars(0);
    memRef.current = { name: null, turns: [], used: {} };
  };

  const pct = Math.min(100, Math.round(prog * 100));
  const booting = !booted && !bootErr;

  const AVATAR = (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--accent)" />
      <circle cx="9" cy="11" r="1.6" fill="#fff" />
      <circle cx="15" cy="11" r="1.6" fill="#fff" />
      <path
        d="M8 15.2c1.4 1.2 6.6 1.2 8 0"
        stroke="#fff"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <WinApp id="cortana" title="BitBot">
      <div className="bbApp">
        <div className="chatLog" ref={logRef}>
          {lines.map((l) => {
            const isStreaming = l.id === streamId;
            const shown = isStreaming ? l.text.slice(0, streamChars) : l.text;
            return (
              <div key={l.id} className={`bbRow bbRow-${l.from}`}>
                {l.from === "them" && <div className="bbAvatar">{AVATAR}</div>}
                <div className={`bubble ${l.from}`}>
                  {l.from === "them" && l.via && !isStreaming && (
                    <span className="bbVia" data-via={l.via}>
                      {BB_VIA[l.via] || ""}
                    </span>
                  )}
                  <span className="bbBody" dangerouslySetInnerHTML={{ __html: bbMd(shown) }} />
                  {isStreaming && <span className="bbCaret" aria-hidden="true" />}
                  {!isStreaming && l.from === "them" && (
                    <button
                      type="button"
                      className={`bbCopy ${copiedId === l.id ? "ok" : ""}`}
                      onClick={() => copyMsg(l.id, l.text)}
                      title={copiedId === l.id ? "Copied" : "Copy"}
                      aria-label="Copy message"
                    >
                      {copiedId === l.id ? (
                        <svg
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            d="M3 8.5l3.5 3.5L13 5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 16 16"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        >
                          <rect x="5" y="5" width="8" height="9" rx="1.5" />
                          <path
                            d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v7A1.5 1.5 0 0 0 3.5 12H5"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="bbRow bbRow-them">
              <div className="bbAvatar">{AVATAR}</div>
              <div className="bubble them bbTyping" aria-label="BitBot is thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {booting && (
            <div className="bbBoot" role="status">
              <span className="bbBootDot" />
              <span>Loading the BitBot engine… {pct}%</span>
            </div>
          )}
          {bootErr && (
            <div className="bbBoot bbBoot-err">
              Couldn't load my engine ({bootErr}). Refresh the PC and try again.
            </div>
          )}
        </div>

        <div className="bbComposer">
          <button
            className="bbClear"
            onClick={clearChat}
            title="Clear chat"
            aria-label="Clear chat"
            disabled={lines.length <= 1}
          >
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M4 5h8M6.5 5V3.5h3V5M5.5 5l.5 8h4l.5-8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <input
            className="winInput bbInput"
            value={v}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={booted ? "Ask BitBot — try: solve 2x + 5 = 17" : "Booting the brain…"}
            disabled={booting}
          />
          <button
            className="winBtn accent bbSend"
            onClick={send}
            disabled={busy || !v.trim() || booting}
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </WinApp>
  );
};
export const CortanaApp = () => <BitBotHost />;
/* ═══════════════════════════════════════════════════════════════════
   OneDrive — honest "cloud" for local Virtual Storage
   Sidebar nav · storage donut · folder tiles · recent files.
   ═══════════════════════════════════════════════════════════════════ */

const OD_ICONS = {
  cloud: (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a4 4 0 0 1 0 8.5H7z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  files: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3l2 2h8A2.5 2.5 0 0 1 21 9.5V17a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V7.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  recent: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shared: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
      <path d="M17 8.5a2.6 2.6 0 0 1 0 5.2M21 19c0-2.7-2-5-4.6-5.4" strokeLinecap="round" />
    </svg>
  ),
  fav: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M12 2.5l2.3 4.7 5.2.8-3.7 3.6.9 5.1L12 14.2 7.3 16.7l.9-5.1L4.5 8l5.2-.8L12 2.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  recycle: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M4 6h16M9 6V4h6v2M6 6l1 14a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  folder: (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3l2 2h8A2.5 2.5 0 0 1 21 9.5V17a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V7.5z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  open: (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        d="M9 3h4v4M13 3L7 9M11 9v3.5A1.5 1.5 0 0 1 9.5 14H4.5A1.5 1.5 0 0 1 3 12.5V7.5A1.5 1.5 0 0 1 4.5 6H8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  refresh: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const OD_FOLDERS = ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"];

export const OneDriveApp = () => {
  const [user, setUser] = useState("User");
  const [disk, setDisk] = useState(null);
  const [folders, setFolders] = useState([]);
  const [recent, setRecent] = useState([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("files");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const u = await getUser();
      const name = u?.username || "User";
      setUser(name);

      const q = await Promise.race([
        navigator.storage?.estimate?.() ?? Promise.resolve(null),
        new Promise((r) => setTimeout(() => r(null), 600)),
      ]);
      setDisk(q);

      const out = [];
      const allRecent = [];
      for (const f of OD_FOLDERS) {
        const list = await fsList(`C:\\Users\\${name}\\${f}`).catch(() => []);
        const files = (list || []).filter((x) => x.type === "file");
        const dirs = (list || []).filter((x) => x.type === "dir").length;
        const bytes = files.reduce((a, b) => a + (Number(b.size) || 0), 0);
        out.push({ name: f, count: files.length, dirs, bytes });
        files.forEach((file) => allRecent.push({ ...file, _folder: f }));
      }
      setFolders(out);
      allRecent.sort((a, b) => (b.at || 0) - (a.at || 0));
      setRecent(allRecent.slice(0, 6));
    } catch (e) {}
    setBusy(false);
  };

  useEffect(() => {
    load().finally(() => setReady(true));
  }, []);

  const openInExplorer = () => {
    store.dispatch({ type: "EXPLORER", payload: "full" });
  };

  const gb = (n) => {
    const v = Number(n) || 0;
    if (v >= 1073741824) return `${(v / 1073741824).toFixed(2)} GB`;
    if (v >= 1048576) return `${(v / 1048576).toFixed(1)} MB`;
    if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${v} B`;
  };

  const used = disk?.usage || 0;
  const quota = disk?.quota || 1;
  const pct = Math.min(100, (used / quota) * 100);
  const totalFiles = folders.reduce((a, b) => a + b.count, 0);
  const totalDirs = folders.reduce((a, b) => a + b.dirs, 0);
  const totalBytes = folders.reduce((a, b) => a + b.bytes, 0);

  /* Donut chart geometry */
  const R = 52,
    C = 2 * Math.PI * R;

  const viewItems = [
    ["files", "Files", OD_ICONS.files, totalFiles],
    ["recent", "Recent", OD_ICONS.recent, recent.length],
    ["shared", "Shared", OD_ICONS.shared, 0],
    ["fav", "Favorites", OD_ICONS.fav, 0],
    ["recycle", "Recycle Bin", OD_ICONS.recycle, 0],
  ];

  const viewTitle = {
    files: "Files",
    recent: "Recent",
    shared: "Shared with me",
    fav: "Favorites",
    recycle: "Recycle Bin",
  }[view];

  const renderEmpty = (msg, sub) => (
    <div className="odEmpty">
      <svg
        viewBox="0 0 64 64"
        width="64"
        height="64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path
          d="M14 20a6 6 0 0 1 6-6h8l4 4h18a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V20z"
          strokeLinejoin="round"
        />
      </svg>
      <div className="odEmptyTitle">{msg}</div>
      <div className="winMuted">{sub}</div>
    </div>
  );

  return (
    <WinApp id="oneDrive" title="OneDrive">
      <div className="odApp">
        {/* ── SIDEBAR ── */}
        <aside className="odSide">
          <div className="odBrand">
            <span className="odBrandIcon">{OD_ICONS.cloud}</span>
            <div>
              <div className="odBrandName">OneDrive</div>
              <div className="odBrandSub">{user}</div>
            </div>
          </div>

          <nav className="odNav">
            {viewItems.map(([id, label, icon, count]) => (
              <button
                key={id}
                className={`odNavItem ${view === id ? "on" : ""}`}
                onClick={() => setView(id)}
              >
                <span className="odNavIcon">{icon}</span>
                <span className="odNavLabel">{label}</span>
                {count > 0 && <span className="odNavCount">{count}</span>}
              </button>
            ))}
          </nav>

          <div className="odMini">
            <div className="odMiniHead">
              <span className="winMuted">Local Storage</span>
              <span className="odMiniPct">{pct.toFixed(0)}%</span>
            </div>
            <div className="odMiniBar">
              <div className="odMiniFill" style={{ width: `${Math.max(1, pct)}%` }} />
            </div>
            <div className="odMiniText winMuted">
              {gb(used)} of {gb(quota)}
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="odMain">
          <header className="odTop">
            <h1 className="odTitle">{viewTitle}</h1>
            <button
              className="winBtn ghost odRefresh"
              onClick={load}
              disabled={busy}
              title="Refresh"
            >
              {OD_ICONS.refresh}
              {busy ? "Loading…" : "Refresh"}
            </button>
            <button className="winBtn accent odOpen" onClick={openInExplorer}>
              {OD_ICONS.open}
              Open in Explorer
            </button>
          </header>

          <div className="odBody">
            {view === "files" && (
              <>
                {/* Storage overview */}
                <section className="odOverview">
                  <div className="odDonut" aria-hidden="true">
                    <svg viewBox="0 0 120 120" width="140" height="140">
                      <circle cx="60" cy="60" r={R} className="odDonutTrack" />
                      <circle
                        cx="60"
                        cy="60"
                        r={R}
                        className="odDonutFill"
                        strokeDasharray={C}
                        strokeDashoffset={C * (1 - pct / 100)}
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div className="odDonutCenter">
                      <b>
                        {pct.toFixed(0)}
                        <span>%</span>
                      </b>
                      <span className="winMuted">used</span>
                    </div>
                  </div>
                  <div className="odOverviewCopy">
                    <div className="odOverviewKicker">Local Virtual Storage</div>
                    <h2 className="odOverviewTitle">
                      {gb(used)} <span className="winMuted">of</span> {gb(quota)}
                    </h2>
                    <p className="odOverviewText">
                      Every file lives on this PC in the browser's IndexedDB — no cloud, no
                      telemetry, and it survives refreshes. Back up by exporting individual files.
                    </p>
                    <div className="odOverviewStats">
                      <div className="odStat">
                        <b>{totalFiles}</b>
                        <span>files</span>
                      </div>
                      <div className="odStat">
                        <b>{totalDirs}</b>
                        <span>folders</span>
                      </div>
                      <div className="odStat">
                        <b>{gb(totalBytes)}</b>
                        <span>in user folders</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Folder tiles */}
                <section className="odSection">
                  <div className="odSectionHead">
                    <h2 className="odSectionTitle">Folders</h2>
                    <span className="winMuted">C:\Users\{user}</span>
                  </div>
                  <div className="odGrid">
                    {folders.map((f) => (
                      <button key={f.name} className="odTile" onClick={openInExplorer}>
                        <div className="odTileIcon">{OD_ICONS.folder}</div>
                        <div className="odTileBody">
                          <div className="odTileName">{f.name}</div>
                          <div className="odTileSub">
                            {f.count} file{f.count === 1 ? "" : "s"}
                            {f.dirs > 0 ? ` · ${f.dirs} folder${f.dirs === 1 ? "" : "s"}` : ""}
                          </div>
                          <div className="odTileSize">{gb(f.bytes)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Recent files */}
                {recent.length > 0 && (
                  <section className="odSection">
                    <div className="odSectionHead">
                      <h2 className="odSectionTitle">Recent</h2>
                      <span className="winMuted">last 6 changed</span>
                    </div>
                    <div className="odRecent">
                      {recent.map((f) => (
                        <div key={f.path || f.name} className="odRecentRow">
                          <span className="odRecentIcon">
                            <svg
                              viewBox="0 0 20 20"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                            >
                              <path
                                d="M5 2.5h7l3 3V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"
                                strokeLinejoin="round"
                              />
                              <path d="M12 2.5v3h3" strokeLinejoin="round" />
                            </svg>
                          </span>
                          <span className="odRecentName">{f.name}</span>
                          <span className="odRecentFolder">{f._folder}</span>
                          <span className="odRecentSize">{gb(f.size)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {view === "recent" &&
              (recent.length === 0 ? (
                renderEmpty("No recent files", "Files you open will show up here.")
              ) : (
                <div className="odRecent" style={{ marginTop: 0 }}>
                  {recent.map((f) => (
                    <div key={f.path || f.name} className="odRecentRow">
                      <span className="odRecentIcon">
                        <svg
                          viewBox="0 0 20 20"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        >
                          <path
                            d="M5 2.5h7l3 3V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="odRecentName">{f.name}</span>
                      <span className="odRecentFolder">{f._folder}</span>
                      <span className="odRecentSize">{gb(f.size)}</span>
                    </div>
                  ))}
                </div>
              ))}

            {view === "shared" &&
              renderEmpty(
                "Nothing shared yet",
                "This PC has no cloud — nothing to share from here.",
              )}
            {view === "fav" &&
              renderEmpty("No favorites yet", "Star files in File Explorer to see them here.")}
            {view === "recycle" &&
              renderEmpty(
                "Recycle Bin is empty",
                "Deleted files wait here before they're gone for good.",
              )}

            {!ready && <div className="odLoading winMuted">Loading storage…</div>}
          </div>
        </main>
      </div>
    </WinApp>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Phone Link — honest. This PC has no way to reach a real phone, so
   every feature that would need one says so plainly. Only the photos
   view shows real content (from this PC's Photos / Camera).
   ═══════════════════════════════════════════════════════════════════ */

const YP_ICONS = {
  phone: (
    <svg
      viewBox="0 0 24 40"
      width="22"
      height="34"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="2" width="20" height="36" rx="4" />
      <circle cx="12" cy="33" r="1.6" fill="currentColor" />
      <rect x="8" y="5" width="8" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  ),
  bell: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 10a6 6 0 0 1 12 0v4l1.5 3h-15L6 14v-4z" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  ),
  msg: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-4 3v-3H6a3 3 0 0 1-3-3V7z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  photo: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="M3 17l5-5 5 5 3-3 5 5" strokeLinejoin="round" />
    </svg>
  ),
  call: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  apps: (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  ),
  refresh: (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v3h-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  link: (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8.5 11.5a3 3 0 0 0 4.2 0l3-3a3 3 0 0 0-4.2-4.2l-1.5 1.5" strokeLinecap="round" />
      <path d="M11.5 8.5a3 3 0 0 0-4.2 0l-3 3a3 3 0 0 0 4.2 4.2l1.5-1.5" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5M10 6.5h.01" strokeLinecap="round" />
    </svg>
  ),
};

export const YourPhoneApp = () => {
  const [view, setView] = useState("photos");
  const [pics, setPics] = useState([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const files = (await idb.getAll("photos").catch(() => [])) || [];
      setPics(
        files
          .filter((p) => p.dataUrl)
          .slice()
          .reverse(),
      );
    } catch (e) {}
    setBusy(false);
  };

  useEffect(() => {
    load().finally(() => setReady(true));
  }, []);

  const notifyPlaceholder = (feature) =>
    notify({
      app: "Phone Link",
      title: "Just a placeholder",
      body: `${feature} — our PC has no way to reach a real phone. Nothing is synced, sent, or received.`,
      kind: "info",
      life: 5,
    });

  const viewItems = [
    ["notifications", "Notifications", YP_ICONS.bell, 0],
    ["messages", "Messages", YP_ICONS.msg, 0],
    ["photos", "Photos", YP_ICONS.photo, pics.length],
    ["calls", "Calls", YP_ICONS.call, 0],
    ["apps", "Apps", YP_ICONS.apps, 0],
  ];

  const viewTitle = {
    notifications: "Notifications",
    messages: "Messages",
    photos: "Photos",
    calls: "Calls",
    apps: "Apps",
  }[view];

  const Placeholder = ({ icon, title, sub }) => (
    <div className="ypEmpty">
      <div className="ypEmptyArt">{icon}</div>
      <div className="ypEmptyTitle">{title}</div>
      <div className="ypEmptySub winMuted">{sub}</div>
      <div className="ypEmptyBadge">
        {YP_ICONS.info}
        Just a placeholder — our PC cannot do that
      </div>
    </div>
  );

  return (
    <WinApp id="yphone" title="Phone Link">
      <div className="ypApp">
        {/* ── SIDEBAR ── */}
        <aside className="ypSide">
          <div className="ypBrand">
            <span className="ypBrandIcon">{YP_ICONS.phone}</span>
            <div>
              <div className="ypBrandName">Phone Link</div>
              <div className="ypBrandSub">No phone connected</div>
            </div>
          </div>

          <nav className="ypNav">
            {viewItems.map(([id, label, icon, count]) => (
              <button
                key={id}
                className={`ypNavItem ${view === id ? "on" : ""}`}
                onClick={() => setView(id)}
              >
                <span className="ypNavIcon">{icon}</span>
                <span className="ypNavLabel">{label}</span>
                {count > 0 && <span className="ypNavCount">{count}</span>}
              </button>
            ))}
          </nav>

          <div className="ypSideFoot">
            <div className="ypNotice">
              {YP_ICONS.info}
              <span>
                Real phone pairing needs Bluetooth or a Microsoft account. Neither exists in this
                browser — nothing here connects to a device.
              </span>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="ypMain">
          <header className="ypTop">
            <h1 className="ypTitle">{viewTitle}</h1>
            {view === "photos" && (
              <button
                className="winBtn ghost ypRefresh"
                onClick={load}
                disabled={busy}
                title="Refresh"
              >
                {YP_ICONS.refresh}
                Refresh
              </button>
            )}
            <button
              className="winBtn accent ypLinkBtn"
              onClick={() => notifyPlaceholder("Pairing with a phone")}
            >
              {YP_ICONS.link}
              Link a phone
            </button>
          </header>

          <div className="ypBody">
            {view === "photos" &&
              (!ready ? null : pics.length === 0 ? (
                <Placeholder
                  icon={
                    <svg
                      viewBox="0 0 64 64"
                      width="64"
                      height="64"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="8" y="14" width="48" height="36" rx="4" />
                      <circle cx="22" cy="26" r="3.5" />
                      <path d="M8 42l14-12 12 12 8-8 14 12" strokeLinejoin="round" />
                    </svg>
                  }
                  title="No photos on this PC yet"
                  sub="Take a photo with Camera or save a snip with Snipping Tool — they'll show up here, on this PC."
                />
              ) : (
                <div className="ypPhotos">
                  {pics.map((p) => (
                    <div key={p.id} className="ypPhoto">
                      <img src={p.dataUrl} alt={p.name || "photo"} title={p.name} loading="lazy" />
                      <div className="ypPhotoMeta">
                        <div className="ypPhotoName">{p.name || "Photo"}</div>
                        <div className="winMuted">
                          {new Date(p.at || Date.now()).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {view === "notifications" && (
              <Placeholder
                icon={YP_ICONS.bell}
                title="No phone notifications"
                sub="This PC can't receive notifications from a real phone. Notifications fired on this PC appear in the Action Center (bottom-right), not here."
              />
            )}

            {view === "messages" && (
              <Placeholder
                icon={YP_ICONS.msg}
                title="No messages"
                sub="Syncing SMS from a phone needs Bluetooth or Microsoft account access — neither exists in a browser."
              />
            )}

            {view === "calls" && (
              <Placeholder
                icon={YP_ICONS.call}
                title="No call history"
                sub="A browser cannot place or receive phone calls. This view stays empty by design."
              />
            )}

            {view === "apps" && (
              <Placeholder
                icon={YP_ICONS.apps}
                title="No mirrored apps"
                sub="App mirroring needs Android and Microsoft Phone Link on a real device. Nothing to show here."
              />
            )}
          </div>
        </main>
      </div>
    </WinApp>
  );
};
/* Recycle Bin moved to apps/recycle.jsx — restore / delete / empty on the VS. */

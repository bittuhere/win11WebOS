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
import { useSelector } from "react-redux";
import { ToolBar } from "../../../utils/general";
import { idb, uid } from "../../../utils/idb";
import "./extras.scss";

/*
 * Microsoft Weather, for real. Live data from open-meteo.com (no key,
 * no account) fetched either directly or through the /webos-proxy relay.
 * Saved locations persist in IndexedDB.
 *
 * v3 — a living sky: the hero paints the actual conditions with animated
 * sun/moon, drifting clouds, falling rain and snow, twinkling stars and
 * sliding fog; the temperature counts up, the wind needle settles, the
 * hourly strip and the week stagger in, and even the loading state breathes.
 */

const WMO = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Storm with hail", "⛈️"],
  99: ["Storm with hail", "⛈️"],
};
const describe = (code) => WMO[code] || ["—", "🌡️"];
const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const relayGet = async (url) => {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.json();
  } catch (e) {
    /* fall through to the same-origin relay */
  }
  const r = await fetch(`/webos-proxy?url=${encodeURIComponent(url)}`);
  const data = await r.json();
  if (data.error && !data.status) throw new Error(data.error);
  return JSON.parse(data.body);
};

export const WeatherApp = () => {
  const wnapp = useSelector((s) => s.apps.weather);
  const [places, setPlaces] = useState([]);
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unit, setUnit] = useState(localStorage.getItem("weather.unit") || "c");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [now, setNow] = useState(new Date());
  const [tick, setTick] = useState(0); // bump = refetch
  const [tempShown, setTempShown] = useState(null); // the count-up value

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* saved cities */
  useEffect(() => {
    idb.get("weather.places").then((pl) => {
      const list = pl || [
        {
          id: "p_default",
          name: "Patna",
          country: "India",
          admin: "Bihar",
          lat: 25.5941,
          lon: 85.1376,
        },
      ];
      setPlaces(list);
      setSel((cur) => cur || list[0]);
    });
  }, []);

  /* the forecast */
  useEffect(() => {
    if (!sel) return;
    let alive = true;
    setBusy(true);
    setErr("");
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${sel.lat}&longitude=${sel.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max` +
      `&timezone=auto&forecast_days=7`;
    relayGet(url)
      .then((d) => {
        if (alive) {
          setData(d);
          setBusy(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setErr(String(e.message || e));
          setBusy(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [sel, tick]);

  /* auto refresh every 10 minutes */
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 600000);
    return () => clearInterval(t);
  }, []);

  /* city search */
  useEffect(() => {
    const q2 = q.trim();
    if (q2.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      relayGet(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q2)}&count=6&language=en&format=json`,
      )
        .then((d) => setHits(d.results || []))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const addPlace = async (h) => {
    const np = {
      id: uid("pl"),
      name: h.name,
      country: h.country || "",
      admin: h.admin1 || "",
      lat: h.latitude,
      lon: h.longitude,
    };
    const next = [
      ...places.filter(
        (x) => !(Math.abs(x.lat - np.lat) < 0.01 && Math.abs(x.lon - np.lon) < 0.01),
      ),
      np,
    ];
    setPlaces(next);
    await idb.set("weather.places", next);
    setSel(np);
    setQ("");
    setHits([]);
  };

  const removePlace = async (id) => {
    if (places.length <= 1) return;
    const next = places.filter((x) => x.id !== id);
    setPlaces(next);
    await idb.set("weather.places", next);
    if (sel?.id === id) setSel(next[0]);
  };

  const setU = (u) => {
    setUnit(u);
    localStorage.setItem("weather.unit", u);
  };

  const cv = (t) => (unit === "c" ? Math.round(t) : Math.round((t * 9) / 5 + 32));
  const cw = data?.current;
  const [wmoText, wmoIcon] = describe(cw?.weather_code);

  /* the temperature counts up to its value whenever the data (or the unit) lands */
  useEffect(() => {
    if (!data?.current) return;
    const target = cv(data.current.temperature_2m ?? 0);
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      const e = 1 - Math.pow(1 - p, 3); // fast in, slow out
      setTempShown(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [data, unit]); // eslint-disable-line react-hooks/exhaustive-deps

  /* the hero sky reacts to the actual conditions */
  const isDay = cw?.is_day ?? (now.getHours() >= 6 && now.getHours() < 19);
  const skyGrp = (() => {
    const c = cw?.weather_code ?? 0;
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(c)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "snow";
    if ([45, 48].includes(c)) return "fog";
    if ([1, 2, 3].includes(c)) return "cloud";
    return "clear";
  })();
  const windDir = cw?.wind_direction_10m ?? 0;
  const windName = DIRS[Math.round(windDir / 45) % 8] || "—";
  const rh = data?.current?.relative_humidity_2m ?? 0;
  const pop = data?.daily?.precipitation_probability_max?.[0] ?? 0;

  const wMin = Math.min(...(data?.daily?.temperature_2m_min || [0]));
  const wMax = Math.max(...(data?.daily?.temperature_2m_max || [1]));
  const rangePct = (lo, hi) => {
    const span = Math.max(1, wMax - wMin);
    return {
      left: `${Math.max(0, ((lo - wMin) / span) * 100)}%`,
      width: `${Math.min(100, ((hi - lo) / span) * 100)}%`,
    };
  };

  const hours = (() => {
    if (!data?.hourly?.time) return [];
    const t0 = Date.now();
    let i = data.hourly.time.findIndex((t) => new Date(t).getTime() >= t0 - 3600e3);
    if (i < 0) i = 0;
    return data.hourly.time.slice(i, i + 12).map((t, j) => ({
      t,
      temp: data.hourly.temperature_2m[i + j],
      code: data.hourly.weather_code[i + j],
      rain: data.hourly.precipitation_probability?.[i + j] ?? 0,
    }));
  })();

  if (!wnapp || !wnapp.alive) return null;

  const fmtHm = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /* the sun rides its arc between sunrise and sunset */
  const sunArc = (() => {
    if (!data?.daily?.sunrise) return null;
    const sr = new Date(data.daily.sunrise[0]).getTime();
    const ss = new Date(data.daily.sunset[0]).getTime();
    const p = Math.max(0, Math.min(1, (now.getTime() - sr) / Math.max(1, ss - sr)));
    const bx = (1 - p) * (1 - p) * 10 + 2 * (1 - p) * p * 100 + p * p * 190;
    const by = (1 - p) * (1 - p) * 40 + 2 * (1 - p) * p * 4 + p * p * 40;
    return { sr, ss, bx, by, up: p > 0 && p < 1 };
  })();

  return (
    <div
      className="floatTab dpShad extraApp"
      data-size={wnapp.size}
      data-max={wnapp.max}
      style={{ ...(wnapp.size == "cstm" ? wnapp.dim : null), zIndex: wnapp.z }}
      data-hide={wnapp.hide}
      id={wnapp.icon + "App"}
    >
      <ToolBar app={wnapp.action} icon={wnapp.icon} size={wnapp.size} name="Weather" />
      <div className="windowScreen flex flex-col" data-dock="true">
        <div className="restWindow flex-grow overflow-hidden extraFill weatherFill">
          <div className="winPad weatherPad">
            {/* --------------- sidebar --------------- */}
            <div className="wxSide">
              <input
                className="winInput"
                value={q}
                placeholder="Search city…"
                onChange={(e) => setQ(e.target.value)}
              />
              {hits.length ? (
                <div className="wxHits">
                  {hits.map((h) => (
                    <div
                      key={`${h.latitude},${h.longitude}`}
                      className="wxHit"
                      onClick={() => addPlace(h)}
                    >
                      <b>{h.name}</b>
                      <span>{[h.admin1, h.country].filter(Boolean).join(", ")}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="wxPlaces">
                {places.map((pl) => (
                  <div
                    key={pl.id}
                    className={`wxPlace ${sel?.id === pl.id ? "on" : ""}`}
                    onClick={() => setSel(pl)}
                    title={[pl.admin, pl.country].filter(Boolean).join(", ")}
                  >
                    <span className="wxPlaceName">{pl.name}</span>
                    {places.length > 1 ? (
                      <button
                        type="button"
                        className="wxPlaceX"
                        title="Remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlace(pl.id);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="wxUnits">
                <button
                  type="button"
                  className={`winBtn ghost ${unit === "c" ? "on" : ""}`}
                  onClick={() => setU("c")}
                >
                  °C
                </button>
                <button
                  type="button"
                  className={`winBtn ghost ${unit === "f" ? "on" : ""}`}
                  onClick={() => setU("f")}
                >
                  °F
                </button>
              </div>
            </div>

            {/* --------------- the sky --------------- */}
            <div className="wxMain">
              {busy && !data ? (
                <div className="wxLoadWrap" role="status">
                  <svg className="wxLoadSun" viewBox="0 0 64 64" aria-hidden>
                    <g className="wxLoadRays">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <line
                          key={i}
                          x1="32"
                          y1="6"
                          x2="32"
                          y2="13"
                          transform={`rotate(${i * 45} 32 32)`}
                        />
                      ))}
                    </g>
                    <circle className="wxLoadCore" cx="32" cy="32" r="12" />
                  </svg>
                  <div className="wxLoadTxt">
                    Reading the sky
                    <span className="wxDots" aria-hidden>
                      <i>.</i>
                      <i>.</i>
                      <i>.</i>
                    </span>
                  </div>
                  <div className="wxSkelRow" aria-hidden>
                    <i className="wxSkel big" />
                    <i className="wxSkel" />
                    <i className="wxSkel short" />
                  </div>
                </div>
              ) : err && !data ? (
                <div className="wxOff" role="alert">
                  <svg viewBox="0 0 64 40" width="84" height="52" aria-hidden>
                    <path
                      d="M14 34a10 10 0 1 1 2-19.8A14 14 0 0 1 43 10a11 11 0 0 1 7 19.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M22 39l3-5M32 39l3-5M42 39l3-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      className="wxOffRain"
                    />
                  </svg>
                  <b>Can&rsquo;t reach the weather service</b>
                  <span className="winMuted">{err}</span>
                  <button type="button" className="winBtn" onClick={() => setTick((x) => x + 1)}>
                    ⟳ Try again
                  </button>
                </div>
              ) : data ? (
                <>
                  {err ? <div className="wxErr">Refresh failed: {err}</div> : null}
                  <div className={`wxHero wxSky-${skyGrp}${isDay ? "" : " wxNight"}`}>
                    {/* the living sky */}
                    <div className="wxSkyFx" aria-hidden>
                      <i className="wxsunOrb" />
                      <i className="wxmoonOrb" />
                      <span className="wxstars">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <i
                            key={i}
                            style={{
                              left: `${(i * 71 + 9) % 96}%`,
                              top: `${(i * 43 + 6) % 64}%`,
                              animationDelay: `${((i * 0.31) % 2.2).toFixed(2)}s`,
                            }}
                          />
                        ))}
                      </span>
                      <i className="wxcloud c1" />
                      <i className="wxcloud c2" />
                      <i className="wxcloud c3" />
                      {skyGrp === "rain" ? (
                        <span className="wxrain">
                          {Array.from({ length: 26 }).map((_, i) => (
                            <i
                              key={i}
                              style={{
                                left: `${(i * 97 + 3) % 100}%`,
                                animationDelay: `${((i * 0.127) % 1.4).toFixed(2)}s`,
                              }}
                            />
                          ))}
                        </span>
                      ) : null}
                      {skyGrp === "snow" ? (
                        <span className="wxsnow">
                          {Array.from({ length: 18 }).map((_, i) => (
                            <i
                              key={i}
                              style={{
                                left: `${(i * 89 + 5) % 100}%`,
                                animationDelay: `${((i * 0.211) % 2.2).toFixed(2)}s`,
                              }}
                            />
                          ))}
                        </span>
                      ) : null}
                      {skyGrp === "fog" ? (
                        <>
                          <i className="wxfog f1" />
                          <i className="wxfog f2" />
                        </>
                      ) : null}
                    </div>

                    <div className="wxHeroLeft">
                      <div className="wxCityRow">
                        <span className="wxCity">{sel?.name}</span>
                        <span className="wxLive">
                          <i />
                          LIVE
                        </span>
                      </div>
                      <div className="wxWhen">
                        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {now.toLocaleDateString(undefined, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </div>
                      <div className="wxTemp">
                        {tempShown ?? cv(data.current?.temperature_2m ?? 0)}
                        <span>{unit === "c" ? "°C" : "°F"}</span>
                      </div>
                      <div className="wxDesc">
                        <span className="wxDescIco">{wmoIcon}</span> {wmoText}
                        <em>
                          feels like {cv(data.current?.apparent_temperature ?? 0)}
                          {unit === "c" ? "°" : "°F"}
                        </em>
                      </div>
                      <button
                        type="button"
                        className={`winBtn ghost wxRefresh ${busy ? "on" : ""}`}
                        title="Refresh forecast"
                        onClick={() => setTick((x) => x + 1)}
                      >
                        ⟳ Refresh
                      </button>
                    </div>

                    <div className="wxHeroMeta">
                      <div className="wxTile">
                        <span className="wxTileIco">💧</span>
                        <b>{rh}%</b>
                        <span className="wxTileLbl">Humidity</span>
                        <i className="wxTileBar">
                          <u style={{ width: `${rh}%` }} />
                        </i>
                      </div>
                      <div className="wxTile">
                        <span className="wxTileIco">🌬️</span>
                        <b>
                          {Math.round(data.current?.wind_speed_10m ?? 0)} <small>km/h</small>
                        </b>
                        <span className="wxTileLbl">Wind · {windName}</span>
                        <i className="wxNeedleWrap">
                          <i className="wxNeedle" style={{ transform: `rotate(${windDir}deg)` }} />
                        </i>
                      </div>
                      <div className="wxTile">
                        <span className="wxTileIco">🌧️</span>
                        <b>{pop}%</b>
                        <span className="wxTileLbl">Rain today</span>
                        <i className="wxTileBar">
                          <u style={{ width: `${pop}%` }} />
                        </i>
                      </div>
                    </div>
                  </div>

                  {hours.length ? (
                    <div className="wxHours">
                      {hours.map((h, j) => (
                        <div key={h.t} className="wxHour" style={{ "--i": j }}>
                          <div className="wxHourT">
                            {new Date(h.t).toLocaleTimeString([], { hour: "2-digit" })}
                          </div>
                          <div className="wxHourI">{describe(h.code)[1]}</div>
                          <div className="wxHourV">{cv(h.temp)}°</div>
                          <div className="wxHourBar">
                            <i style={{ height: `${Math.max(4, Math.round(h.rain * 0.36))}px` }} />
                          </div>
                          <div className="wxHourR">{h.rain}%</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="wxDays">
                    {(data.daily?.time || []).map((t, i) => (
                      <div key={t} className={`wxDay ${i === 0 ? "on" : ""}`} style={{ "--i": i }}>
                        <div className="wxDayN">
                          {i === 0
                            ? "Today"
                            : new Date(t).toLocaleDateString(undefined, { weekday: "short" })}
                        </div>
                        <div className="wxDayI">{describe(data.daily.weather_code?.[i])[1]}</div>
                        <div className="wxDayMM">
                          <span>{cv(data.daily.temperature_2m_min[i])}°</span>
                          <span className="wxDayBar">
                            <i
                              className="wxDayFill"
                              style={rangePct(
                                data.daily.temperature_2m_min[i],
                                data.daily.temperature_2m_max[i],
                              )}
                            />
                          </span>
                          <b>{cv(data.daily.temperature_2m_max[i])}°</b>
                        </div>
                        <div className="wxDayR">
                          💧 {data.daily.precipitation_probability_max?.[i] ?? 0}%
                        </div>
                      </div>
                    ))}
                  </div>

                  {sunArc ? (
                    <div className="wxSun">
                      <svg viewBox="0 0 200 46" className="wxSunArc" aria-hidden>
                        <path className="wxSunPath" d="M10 40 Q100 4 190 40" fill="none" />
                        <line x1="6" y1="40" x2="194" y2="40" className="wxSunHorizon" />
                        <circle
                          className={`wxSunDot ${sunArc.up ? "up" : ""}`}
                          cx={sunArc.bx}
                          cy={sunArc.by}
                          r="5.5"
                        />
                      </svg>
                      <span>🌅 {fmtHm(sunArc.sr)}</span>
                      <span>🌇 {fmtHm(sunArc.ss)}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="wxLoading">Pick a city to begin.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
import { Icon, LazyComponent } from "../../utils/general";
import { loadWidget } from "../../actions";
import "./widget.scss";

export const WidPane = () => {
  const widget = useSelector((state) => state.widpane);
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.setting.person.theme);
  const [now, setNow] = useState(new Date());
  const [spin, setSpin] = useState(false);

  useEffect(() => {
    // the pane refreshes itself the moment it opens — no stale cards until
    // you poke the widgets button twice
    if (widget.hide === false) loadWidget();
  }, [widget.hide]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  const refresh = async () => {
    setSpin(true);
    await loadWidget();
    setTimeout(() => setSpin(false), 600);
  };
  const inEdge = (url) => {
    // every link stays inside the OS — Edge opens it as a tab
    dispatch({ type: "EDGELINK", payload: url });
  };
  const GLYPH = {
    sun: "\u2600\uFE0F",
    cloud: "\u2601\uFE0F",
    rain: "\uD83C\uDF27\uFE0F",
    snow: "\u2744\uFE0F",
    fog: "\uD83C\uDF2B\uFE0F",
  };
  const getRandom = (x = 0) => {
    if (theme == "light") return `hsl(210 30% 88%)`;
    if (theme == "dark") return `hsl(210 30% 18%)`;
  };

  const w = widget.data?.weather || {};

  return (
    <div className="widPaneCont" data-hide={widget.hide} style={{ "--prefix": "WIDG" }}>
      <LazyComponent show={!widget.hide}>
        <div className="WidPane win11Scroll">
          <div className="widtop">
            <button
              type="button"
              className={`widRefresh ${spin ? "spin" : ""}`}
              title="Refresh widgets"
              onClick={refresh}
            >
              <Icon fafa="faRotate" width={12} />
            </button>
          </div>
          <div className="widTime">
            {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
          <div className="widDate">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div className="widgetCont">
            <div className="topWidgets">
              <div
                className="weatherCont ltShad widGo"
                title="Open the Weather app"
                onClick={() => dispatch({ type: "WEATHER", payload: "full" })}
              >
                <div className="wthtop">
                  <Icon src="weather" width={18} /> <span>Weather</span>
                </div>
                <div className="wthcity">
                  <Icon fafa="faMapMarkerAlt" width={8} />
                  {w.city || "Patna"}, {w.country || "IN"}
                </div>
                <div className="wthInfo">
                  <div className="wthTemp">
                    <span className="wglyph">{GLYPH[w.glyph] || GLYPH.sun}</span>
                    <div className="wthdeg">{w.temp ?? "--"}</div>
                    <div className="wthunit">ºC</div>
                  </div>
                  <div className="moreWinfo">
                    <div className="wcontext">{w.wstate || "Weather"}</div>
                    <div className="rainProb">
                      <div className="chanceOfRain">
                        <Icon fafa="faTint" width={10} />
                        {w.rain ?? 0}%
                      </div>
                      <div className="chanceOfRain">
                        <Icon fafa="faWind" width={10} />
                        {w.wind || "--"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="weekWthCont">
                  {(w.days || []).map((item, i) => (
                    <div key={i} className="weekDay">
                      <div>{i == 0 ? "Today" : item.day}</div>
                      <span className="wglyph sm">{GLYPH[item.glyph] || GLYPH.sun}</span>
                      <div className="tempCont">{item.min}º</div>
                      <div className="tempCont">{item.max}º</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="shortCont">
                <div className="short0 ltShad">
                  <div className="shName">
                    MONEY | MARKET <span className="demoTag">demo</span>
                  </div>
                  <div className="shEntry">
                    <div className="stockName">
                      <Icon src="google" ui width={12} />
                      <div className="stName">GOOGL</div>
                    </div>
                    <div className="stockValue">
                      <div>{widget.data.stock[0][0]}</div>
                      <div className="stRes" data-pos={widget.data.stock[0][2] == 1}>
                        {widget.data.stock[0][2] ? "+" : "-"}
                        {widget.data.stock[0][1]}%
                      </div>
                    </div>
                  </div>
                  <div className="shEntry">
                    <div className="stockName">
                      <Icon src="tesla" ui width={12} />
                      <div className="stName">TSLA</div>
                    </div>
                    <div className="stockValue">
                      <div>{widget.data.stock[1][0]}</div>
                      <div className="stRes" data-pos={widget.data.stock[1][2] == 1}>
                        {widget.data.stock[1][2] ? "+" : "-"}
                        {widget.data.stock[1][1]}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="short1 ltShad">
                  <div className="shName">
                    <div className="flex">
                      <Icon fafa="faLandmark" width={8} />
                      &nbsp;ON THIS DAY
                    </div>
                    <div>{widget.data.date}</div>
                  </div>
                  <div className="infotextCont">
                    <div className="dayInfo">{widget.data.event.text}</div>
                    {widget.data.event.pages[0]?.content_urls?.desktop?.page ? (
                      <button
                        type="button"
                        className="wikiref"
                        onClick={() => inEdge(widget.data.event.pages[0].content_urls.desktop.page)}
                      >
                        more on wiki
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="newsCont">
              <div className="topStories ltShad">
                <div className="topNewsText">TOP STORIES</div>
                <div className="topNewsCont">
                  {[...widget.data.news].splice(0, 4).map((article, i) => (
                    <div
                      className="tpNews widGo"
                      key={i}
                      onClick={() => article.url && inEdge(article.url)}
                    >
                      <div className="tpSource">{article.source.name}</div>
                      <div className="tpArticle">{article.title}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="allNewsCont">
                {[...widget.data.news].splice(4, widget.data.news.length).map((article, i) => (
                  <div
                    className="articleCont ltShad widGo"
                    style={{
                      "--backgrad": getRandom(2),
                    }}
                    key={i}
                    onClick={() => article.url && inEdge(article.url)}
                  >
                    <div className="tpNews">
                      <div className="tpSource">{article.source.name}</div>
                      <div className="tpArticle">{article.title}</div>
                      {i % 5 == 4 ? <div className="tpdesc">{article.content}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </LazyComponent>
    </div>
  );
};

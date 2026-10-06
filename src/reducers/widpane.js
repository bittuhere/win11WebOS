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

import * as history from "./history.json";
import * as news from "./news.json";

var hisTemp = history.default;

var date = new Date(),
  event = hisTemp[Math.floor(Math.random() * hisTemp.length)];
date.setYear(event.year);

var newsList = [];
for (var i = 0; i < news.default.articles.length; i++) {
  var item = {
    ...news.default.articles[i],
  };
  item.title = item.title.split("-").reverse().splice(1).reverse().join("-").trim();
  newsList.push(item);
}

var abbr = ["sn", "sl", "h", "t", "hr", "lr", "s", "hc", "lc", "c"],
  wstates = [
    "Snow",
    "Sleet",
    "Hail",
    "Thunderstorm",
    "Heavy Rain",
    "Light Rain",
    "Showers",
    "Heavy Cloud",
    "Light Cloud",
    "Clear",
  ];

var rem = null;

const getRandom = (x = 10, rm = 0) => {
  if (rem != null) {
    var tmp = rem;
    rem = null;
    return tmp;
  } else if (rm) {
    rem = Math.floor(Math.random() * x);
    return rem;
  }

  return Math.floor(Math.random() * x);
};

const defState = {
  data: {
    weather: {
      city: "New Delhi",
      country: "India",
      wstate: wstates[getRandom(10, 1)],
      icon: abbr[getRandom()],
      temp: 30 + getRandom(20),
      rain: 10 + getRandom(80),
      wind: 4 + getRandom(5),
      days: [0, 1, 2, 3].map((i) => {
        return {
          day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(new Date().getDay() + i) % 7],
          icon: abbr[getRandom(10)],
          min: 30 + getRandom(10),
          max: 40 + getRandom(10),
        };
      }),
    },
    stock: [
      [
        Number(parseFloat(2300 + Math.random() * 200).toFixed(2)).toLocaleString(),
        parseFloat(Math.random() * 2).toFixed(2),
        Math.round(Math.random()),
      ],
      [
        Number(parseFloat(600 + Math.random() * 200).toFixed(2)).toLocaleString(),
        parseFloat(Math.random() * 2).toFixed(2),
        Math.round(Math.random()),
      ],
    ],
    date: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    event: event,
    news: newsList,
  },
  hide: true,
};

const widReducer = (state = defState, action) => {
  switch (action.type) {
    case "WIDGHIDE":
      return {
        ...state,
        hide: true,
      };
    case "WIDGTOGG":
      return {
        ...state,
        hide: !state.hide,
      };
    case "WIDGREST":
      return action.payload;
    default:
      return state;
  }
};

export default widReducer;

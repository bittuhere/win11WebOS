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

import { pinnedApps, recentApps } from "../utils";

const defState = {
  pnApps: pinnedApps,
  rcApps: recentApps,
  hide: true,
  menu: false,
  showAll: false,
  alpha: false,
  pwctrl: false,
  curAlpha: "A",
  qksrch: [
    ["faClock", 1, "Today in history"],
    ["faChartLine", null, "Markets today"],
    ["faFilm", null, "New movies"],
    ["faNewspaper", 1, "Top news"],
  ],
};

const menuReducer = (state = defState, action) => {
  switch (action.type) {
    case "STARTSHW":
      return {
        ...state,
        menu: true,
        hide: false,
        pwctrl: false,
      };
    case "STARTHID":
      return {
        ...state,
        hide: true,
        showAll: false,
        pwctrl: false,
      };
    case "STARTOGG":
      return {
        ...state,
        hide: !(state.hide || !state.menu),
        menu: true,
        alpha: false,
        curAlpha: "A",
        pwctrl: false,
        showAll: state.menu && state.showAll ? true : null,
      };
    case "STARTALL":
      return {
        ...state,
        showAll: !state.showAll,
        alpha: false,
        pwctrl: false,
        curAlpha: "A",
      };
    case "STARTALPHA":
      return {
        ...state,
        alpha: !state.alpha,
        pwctrl: false,
        curAlpha: action.payload || "A",
      };
    case "STARTUNPIN":
      return {
        ...state,
        pnApps: state.pnApps.filter(
          (a) => a && a.name !== action.payload && a.icon !== action.payload,
        ),
      };
    case "STARTSRC":
      return {
        ...state,
        hide: !(state.hide || state.menu),
        menu: false,
        pwctrl: false,
      };
    case "STARTPWC":
      return {
        ...state,
        pwctrl: true,
      };
    default:
      return state;
  }
};

export default menuReducer;

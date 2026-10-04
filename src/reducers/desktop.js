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

import { desktopApps, allApps } from "../utils";

/* a name → its full app entry, so DESKADD can take either */
const byName = Object.fromEntries([...allApps, ...desktopApps].map((a) => [a.name, a]));

const defState = {
  apps: desktopApps,
  hide: false,
  size: 1,
  sort: "none",
  /* About panel: `abOpen` is its only visibility source, `abBoot` records that
     this particular appearance came from a boot (so it keeps the 5s Ok delay). */
  abOpen: false,
  abBoot: false,
};

const deskReducer = (state = defState, action) => {
  switch (action.type) {
    case "DESKREM":
      var arr = state.apps.filter((x) => x.name != action.payload);

      localStorage.setItem("desktop", JSON.stringify(arr.map((x) => x.name)));
      return { ...state, apps: arr };
    case "DESKADD":
      var arr = [...state.apps];
      arr.push(
        typeof action.payload === "string"
          ? byName[action.payload] || { name: action.payload, icon: "date" }
          : action.payload,
      );

      localStorage.setItem("desktop", JSON.stringify(arr.map((x) => x.name)));
      return { ...state, apps: arr };
    case "DESKHIDE":
      return {
        ...state,
        hide: true,
      };
    case "DESKSHOW":
      return {
        ...state,
        hide: false,
      };
    case "DESKTOGG":
      return {
        ...state,
        hide: !state.hide,
      };
    case "DESKSIZE":
      return {
        ...state,
        size: action.payload,
      };
    case "DESKSORT":
      return {
        ...state,
        sort: action.payload || "none",
      };
    case "DESKABOUT": {
      // three payload shapes arrive here: the context menu sends the DOM
      // string "true", a close sends false, and the boot sequence sends
      // { open, boot }. Normalize so visibility never depends on
      // truthy-string quirks.
      const p = action.payload;
      const fromBoot = !!(p && typeof p === "object" && p.boot);
      const open = p && typeof p === "object" ? !!p.open : !!p;
      return { ...state, abOpen: open, abBoot: open && fromBoot };
    }
    default:
      return state;
  }
};

export default deskReducer;

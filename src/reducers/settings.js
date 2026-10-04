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

import { desktopApps } from "../utils";
import {
  DEFAULT_SETTINGS,
  deepMerge,
  paintTheme,
  readStoredSettings,
  writeStoredSettings,
} from "../utils/os/theme";

/**
 * Boot straight from storage so the very first render already has the theme
 * the user picked last time. `readStoredSettings()` deep merges over the
 * defaults, so a partial blob in localStorage can never leave a branch
 * undefined (that was the root of the "dark theme comes back as light" bug).
 */
const defState = readStoredSettings();

paintTheme(defState.person.theme);

/** Immutable set by path — never mutates the incoming state. */
const setVal = (obj, path, val = "togg") => {
  const keys = String(path).split(".");
  const root = { ...obj };
  let node = root;
  for (let i = 0; i < keys.length - 1; i++) {
    node[keys[i]] = { ...(node[keys[i]] || {}) };
    node = node[keys[i]];
  }
  const last = keys[keys.length - 1];
  node[last] = val === "togg" ? !node[last] : val;
  return root;
};

const persist = (state) => {
  writeStoredSettings(state);
  // IndexedDB mirror — survives a cleared localStorage
  import("../utils/idb").then(({ idb }) => idb.set("setting", state)).catch(() => {});
};

const settReducer = (state = defState, action) => {
  let tmpState = state;
  let changed = false;

  switch (action.type) {
    case "STNGTHEME": {
      const theme = action.payload === "dark" ? "dark" : "light";
      if (state.person.theme !== theme) changed = true;
      tmpState = setVal(state, "person.theme", theme);
      paintTheme(theme);
      break;
    }
    case "STNGTOGG":
      changed = true;
      tmpState = setVal(state, action.payload);
      break;
    case "STNGSETV":
      changed = true;
      tmpState = setVal(state, action.payload.path, action.payload.value);
      break;
    case "SETTLOAD": {
      changed = true;
      tmpState = deepMerge(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), action.payload || {});
      paintTheme(tmpState.person.theme);
      break;
    }
    case "TOGGAIRPLNMD": {
      changed = true;
      const airPlaneModeStatus = state.network.airplane;
      tmpState = { ...state };
      if (tmpState.network.wifi.state === true && !airPlaneModeStatus) {
        tmpState = setVal(tmpState, "network.wifi.state");
      }
      if (tmpState.devices.bluetooth === true && !airPlaneModeStatus) {
        tmpState = setVal(tmpState, "devices.bluetooth");
      }
      tmpState = setVal(tmpState, "network.airplane");
      break;
    }
    default:
      return state;
  }

  if (changed) persist(tmpState);
  return tmpState;
};

export default settReducer;

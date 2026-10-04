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

import { allApps } from "../utils";

var dev = "";
if (import.meta.env.MODE == "development") {
  dev = "";
}

const defState = {};
for (var i = 0; i < allApps.length; i++) {
  defState[allApps[i].icon] = Object.assign({}, allApps[i], {
    size: "full",
    hide: true,
    max: null,
    z: 0,
    alive: false,
    closing: false,
    session: 0,
  });

  if (allApps[i].icon == dev) {
    defState[allApps[i].icon].size = "mini";
    defState[allApps[i].icon].hide = false;
    defState[allApps[i].icon].max = true;
    defState[allApps[i].icon].z = 1;
    defState[allApps[i].icon].alive = true;
  }
}

defState.hz = 2;

const openApp = (obj, tmpState) => {
  obj = { ...obj };
  obj.size = obj.size === "cstm" ? "cstm" : "full";
  obj.hide = false;
  obj.max = true;
  obj.alive = true;
  // reopening while the close animation is still playing must be a FRESH
  // mount: bump the session so React discards the dying instance (and its
  // stale local state) instead of reusing it
  const wasClosing = obj.closing === true;
  obj.closing = false;
  if (wasClosing) obj.session = (obj.session || 0) + 1;
  // launching always focuses: rise above every other window, even if hz was
  // decremented by earlier closes (stale z values must never tie with the new top)
  const topZ = Object.keys(tmpState).reduce(
    (m, k) => (k !== "hz" && tmpState[k] && tmpState[k].z > m ? tmpState[k].z : m),
    1,
  );
  tmpState.hz = Math.max(tmpState.hz + 1, topZ + 1);
  obj.z = tmpState.hz;
  return obj;
};

const closeApp = (obj, tmpState) => {
  obj = { ...obj };
  obj.hide = true;
  obj.max = null;
  obj.z = -1;
  obj.alive = true;
  obj.closing = true;
  // NOTE: session is NOT bumped here — the dying window must keep its React
  // instance so the close animation plays out. Freshness is guaranteed by
  // APPREAP fully unmounting it, and by openApp bumping the session when
  // someone reopens during the close window.
  tmpState.hz = Math.max(2, tmpState.hz - 1);
  return obj;
};

const appReducer = (state = defState, action) => {
  var tmpState = { ...state };
  if (action.type == "APPREAP") {
    const key = action.payload;
    if (tmpState[key] && tmpState[key].closing) {
      tmpState[key] = {
        ...tmpState[key],
        alive: false,
        closing: false,
        hide: true,
        url: null,
        dir: null,
        openDoc: null,
        openPhoto: null,
        size: "full",
        dim: null,
        session: (tmpState[key].session || 0) + 1,
      };
    }
    return tmpState;
  } else if (action.type == "EDGELINK") {
    var obj = openApp({ ...tmpState["edge"] }, tmpState);
    /* A local file opens as a blob: URL — treating only http(s) as "a real
       URL" turned every local page into a web search for the literal text
       "blob:https://…". Anything the browser can actually load is passed
       through untouched. */
    const want =
      typeof action.payload === "object" && action.payload !== null ? action.payload : null;
    const target = want ? String(want.url || "") : action.payload;
    obj.title = want && want.title ? want.title : null;
    if (target && /^(https?|blob|data|file|about|webos|filesystem):/i.test(target)) {
      obj.url = want ? { url: target, title: want.title || "" } : target;
    } else if (target && String(target).length != 0) {
      obj.url = "search:" + target;
    } else {
      obj.url = null;
    }
    tmpState["edge"] = obj;
    return tmpState;
  } else if (action.type == "OPENTXT") {
    var obj = openApp({ ...tmpState["notepad"] }, tmpState);
    obj.openDoc = action.payload;
    tmpState["notepad"] = obj;
    return tmpState;
  } else if (action.type == "PHOTOOPEN") {
    // File Explorer / Camera handing a picture to Photos
    var obj = openApp({ ...tmpState["photos"] }, tmpState);
    obj.openPhoto = action.payload;
    tmpState["photos"] = obj;
    return tmpState;
  } else if (action.type == "OPENPAINT") {
    var obj = openApp({ ...tmpState["paint"] }, tmpState);
    obj.openDoc = action.payload;
    tmpState["paint"] = obj;
    return tmpState;
  } else if (action.type == "OPENBOARD") {
    var obj = openApp({ ...tmpState["board"] }, tmpState);
    obj.openDoc = action.payload;
    tmpState["board"] = obj;
    return tmpState;
  } else if (action.type == "SHOWDSK") {
    var keys = Object.keys(tmpState);

    for (var i = 0; i < keys.length; i++) {
      var obj = tmpState[keys[i]];
      if (obj && obj.hide == false) {
        obj = { ...obj };
        obj.max = false;
        if (obj.z == tmpState.hz) {
          tmpState.hz -= 1;
        }
        obj.z = -1;
        tmpState[keys[i]] = obj;
      }
    }

    return tmpState;
  } else if (action.type == "EXTERNALTAB") {
    /* Already done: the external-link middleware opened the real browser tab
       on the way in (reducers stay pure — see utils/os/links.js). */
    return tmpState;
  } else if (action.type == "EXTERNAL") {
    var href = action.payload || "";
    if (/^(mailto|tel|sms):/i.test(String(href))) {
      /* mailto:/tel: were already handed to the OS by the middleware */
      return tmpState;
    }
    var obj = openApp({ ...tmpState["edge"] }, tmpState);
    obj.url = href;
    tmpState["edge"] = obj;
    return tmpState;
  } else if (action.type == "OPENTERM") {
    var obj = openApp({ ...tmpState["terminal"] }, tmpState);
    obj.dir = action.payload;
    tmpState["terminal"] = obj;
    return tmpState;
  } else if (action.type == "ADDAPP") {
    tmpState[action.payload.icon] = {
      ...action.payload,
      size: "full",
      hide: true,
      max: null,
      z: 0,
      alive: false,
      closing: false,
      session: 0,
    };
    return tmpState;
  } else if (action.type == "DELAPP") {
    delete tmpState[action.payload];
    return tmpState;
  } else {
    var keys = Object.keys(state);
    for (var i = 0; i < keys.length; i++) {
      var obj = state[keys[i]];
      if (obj && obj.action == action.type) {
        tmpState = { ...state };
        obj = { ...obj };

        if (action.payload == "full") {
          obj = openApp(obj, tmpState);
        } else if (action.payload == "close") {
          obj = closeApp(obj, tmpState);
        } else if (action.payload == "mxmz") {
          obj.size = ["mini", "full"][obj.size != "full" ? 1 : 0];
          obj.hide = false;
          obj.max = true;
          obj.alive = true;
          obj.closing = false;
          tmpState.hz += 1;
          obj.z = tmpState.hz;
        } else if (action.payload == "togg") {
          if (!obj.alive || obj.hide || obj.closing) {
            obj = openApp(obj, tmpState);
          } else if (obj.z != tmpState.hz) {
            /* A background window's taskbar button must BRING IT FORWARD.
               It used to minimize a maximized-but-unfocused window instead —
               Notepad on top of Explorer made clicking Explorer's button
               shrink it, which is how "double-click does nothing" reports
               start. Clicking the button of the *focused* window still
               minimizes that one (the branch below). */
            obj.hide = false;
            obj.alive = true;
            obj.closing = false;
            obj.max = true;
            tmpState.hz += 1;
            obj.z = tmpState.hz;
          } else {
            obj.max = !obj.max;
            obj.hide = false;
            obj.alive = true;
            obj.closing = false;
            if (obj.max) {
              tmpState.hz += 1;
              obj.z = tmpState.hz;
            } else {
              obj.z = -1;
              tmpState.hz -= 1;
            }
          }
        } else if (action.payload == "mnmz") {
          obj.max = false;
          obj.hide = false;
          obj.alive = true;
          obj.closing = false;
          if (obj.z == tmpState.hz) {
            tmpState.hz -= 1;
          }
          obj.z = -1;
        } else if (action.payload == "resize") {
          obj.size = "cstm";
          obj.hide = false;
          obj.max = true;
          obj.alive = true;
          obj.closing = false;
          if (obj.z != tmpState.hz) tmpState.hz += 1;
          obj.z = tmpState.hz;
          obj.dim = action.dim;
        } else if (action.payload == "front") {
          obj.hide = false;
          obj.max = true;
          obj.alive = true;
          obj.closing = false;
          if (obj.z != tmpState.hz) {
            tmpState.hz += 1;
            obj.z = tmpState.hz;
          }
        }

        tmpState[keys[i]] = obj;
        return tmpState;
      }
    }
  }

  return state;
};

export default appReducer;

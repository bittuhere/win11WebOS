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

const defState = {
  hide: true,
  top: 80,
  left: 360,
  opts: "desk",
  attr: null,
  dataset: null,
  data: {
    desk: {
      width: "310px",
      secwid: "200px",
    },
    task: {
      width: "220px",
      secwid: "120px",
      ispace: false, // show the space for icons in menu
    },
    app: {
      width: "310px",
      secwid: "200px",
    },
    taskapp: {
      width: "230px",
      secwid: "130px",
    },
    file: {
      width: "240px",
      secwid: "140px",
    },
  },
  menus: {
    desk: [
      {
        name: "View",
        icon: "view",
        type: "svg",
        opts: [
          {
            name: "Large icons",
            action: "changeIconSize",
            payload: "large",
          },
          {
            name: "Medium icons",
            action: "changeIconSize",
            payload: "medium",
          },
          {
            name: "Small icons",
            action: "changeIconSize",
            payload: "small",
            dot: true,
          },
          {
            type: "hr",
          },
          {
            name: "Show desktop icons",
            action: "deskHide",
            check: true,
          },
        ],
      },
      {
        name: "Sort by",
        icon: "sort",
        type: "svg",
        opts: [
          {
            name: "Name",
            action: "changeSort",
            payload: "name",
          },
          {
            name: "Size",
            action: "changeSort",
            payload: "size",
          },
          {
            name: "Date modified",
            action: "changeSort",
            payload: "date",
          },
        ],
      },
      {
        name: "Refresh",
        action: "refresh",
        type: "svg",
        icon: "refresh",
      },
      {
        type: "hr",
      },
      {
        name: "New",
        icon: "New",
        type: "svg",
        opts: [
          {
            name: "Folder",
            action: "newDeskFolder",
          },
          {
            name: "Text Document",
            action: "newDeskText",
          },
        ],
      },
      {
        type: "hr",
      },
      {
        name: "Display settings",
        icon: "display",
        type: "svg",
        action: "SETTINGS",
        payload: "full",
      },
      {
        name: "Personalize",
        icon: "personalize",
        type: "svg",
        action: "SETTINGS",
        payload: "full",
      },
      {
        type: "hr",
      },
      {
        name: "Next desktop background",
        action: "WALLNEXT",
      },
      {
        name: "Open in Terminal",
        icon: "terminal",
        action: "OPENTERM",
        payload: "%user%\\Desktop",
      },
      {
        name: "About",
        action: "DESKABOUT",
        icon: "win/info",
        payload: true,
      },
    ],
    task: [
      {
        name: "Align icons",
        opts: [
          {
            name: "Left",
            action: "changeTaskAlign",
            payload: "left",
          },
          {
            name: "Center",
            action: "changeTaskAlign",
            payload: "center",
            dot: true,
          },
        ],
      },
      {
        type: "hr",
      },
      {
        name: "Search",
        opts: [
          {
            name: "Show",
            action: "TASKSRCH",
            payload: true,
          },
          {
            name: "Hide",
            action: "TASKSRCH",
            payload: false,
          },
        ],
      },
      {
        name: "Widgets",
        opts: [
          {
            name: "Show",
            action: "TASKWIDG",
            payload: true,
          },
          {
            name: "Hide",
            action: "TASKWIDG",
            payload: false,
          },
        ],
      },
      {
        type: "hr",
      },
      {
        name: "Show Desktop",
        action: "SHOWDSK",
      },
    ],
    taskapp: [
      {
        name: "Open new window",
        action: "performTaskApp",
        payload: "open",
      },
      {
        name: "Close window",
        action: "performTaskApp",
        payload: "close",
      },
      {
        type: "hr",
      },
      {
        name: "Pin to desktop",
        action: "pinToDesk",
        // what a logic — never offer pinning what is already pinned
        show: (ctx) => !ctx.onDesktop,
      },
      {
        name: "Unpin from desktop",
        action: "unpinFromDesk",
        show: (ctx) => ctx.onDesktop,
      },
      {
        name: "Uninstall",
        action: "uninstallTaskApp",
        show: (ctx) => ctx.isPwa,
      },
      {
        type: "hr",
      },
      {
        name: "Taskbar settings",
        action: "SETTINGS",
        payload: "full",
      },
    ],
    file: [
      {
        name: "Open",
        action: "performFileOpen",
      },
      {
        name: "Delete",
        action: "fileMenuDel",
      },
      {
        type: "hr",
      },
      {
        name: "Properties",
        action: "fileProps",
      },
    ],
    app: [
      {
        name: "Open",
        action: "performApp",
        payload: "open",
      },
      {
        name: "Run as administrator",
        action: "performApp",
        payload: "open",
        icon: "win/shield",
      },
      {
        name: "Open file location",
        action: "openAppLocation",
      },
      {
        name: "Unpin from start",
        action: "unpinApp",
        // an app that was never pinned has nothing to unpin
        show: (ctx) => ctx.inStart,
      },
      {
        name: "Properties",
        action: "appProps",
      },
      {
        type: "hr",
      },
      {
        name: "Delete shortcut",
        action: "performApp",
        payload: "delshort",
      },
      {
        name: "Delete",
        action: "delApp",
        payload: "delete",
      },
    ],
  },
};

const menusReducer = (state = defState, action) => {
  var tmpState = {
    ...state,
  };
  if (action.type == "MENUHIDE") {
    tmpState.hide = true;
  } else if (action.type == "MENUSHOW") {
    tmpState.hide = false;
    tmpState.top = (action.payload && action.payload.top) || 272;
    tmpState.left = (action.payload && action.payload.left) || 430;
    tmpState.opts = (action.payload && action.payload.menu) || "desk";
    tmpState.attr = action.payload && action.payload.attr;
    tmpState.dataset = action.payload && action.payload.dataset;
  } else if (action.type == "MENUCHNG") {
    tmpState = {
      ...action.payload,
    };
  }

  return tmpState;
};

export default menusReducer;

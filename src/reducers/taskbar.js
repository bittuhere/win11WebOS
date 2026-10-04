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

import { taskApps } from "../utils";

const alignment = localStorage.getItem("taskbar-align") || "center";

const defState = {
  apps: taskApps,
  prev: false,
  prevApp: "",
  prevPos: 0,
  align: alignment,
  search: true,
  widgets: true,
  audio: 3,
};

const taskReducer = (state = defState, action) => {
  switch (action.type) {
    case "TASKADD":
      return state;
    case "TASKREM":
      return state;
    case "TASKCEN":
      return {
        ...state,
        align: "center",
      };
    case "TASKLEF":
      localStorage.setItem("taskbar-align", "left");
      return {
        ...state,
        align: "left",
      };
    case "TASKTOG":
      const alignment = state.align == "left" ? "center" : "left";
      localStorage.setItem("taskbar-align", alignment);
      return {
        ...state,
        align: alignment,
      };
    case "TASKPSHOW":
      return {
        ...state,
        prev: true,
        prevApp: (action.payload && action.payload.app) || "store",
        prevPos: (action.payload && action.payload.pos) || 50,
      };
    case "TASKPHIDE":
      return {
        ...state,
        prev: false,
      };
    case "TASKSRCH":
      return {
        ...state,
        search: action.payload == "true",
      };
    case "TASKWIDG":
      return {
        ...state,
        widgets: action.payload == "true",
      };
    case "TASKAUDO":
      return {
        ...state,
        audio: action.payload,
      };
    default:
      return state;
  }
};

export default taskReducer;

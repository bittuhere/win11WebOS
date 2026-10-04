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

import React from "react";
import { useSelector } from "react-redux";
import "./tabs.scss";
import "./tabs2.scss";
import "./wnapp.scss";

export * from "./apps/about";
export * from "./apps/calculator";
export * from "./apps/camera";
export * from "./apps/edge";
export * from "./apps/explorer";
export * from "./apps/getstarted";
export * from "./apps/notepad";
export * from "./apps/photos";
export * from "./apps/paint";
export * from "./apps/recycle";
export * from "./apps/settings";
export * from "./apps/store";
export * from "./apps/taskmanager";
export * from "./apps/terminal";
export * from "./apps/whiteboard";
export * from "./apps/weather";
export * from "./apps/clock";
export * from "./apps/minesweeper";
export * from "./apps/extras";

import { AboutWin } from "./apps/about";
import { Calculator } from "./apps/calculator";
import { Camera } from "./apps/camera";
import { EdgeMenu } from "./apps/edge";
import { Explorer } from "./apps/explorer";
import { Getstarted } from "./apps/getstarted";
import { Notepad } from "./apps/notepad";
import { PhotosApp } from "./apps/photos";
import { PaintApp } from "./apps/paint";
import { RecycleApp } from "./apps/recycle";
import { Settings } from "./apps/settings";
import { MicroStore } from "./apps/store";
import { Taskmanager } from "./apps/taskmanager";
import { WnTerminal } from "./apps/terminal";
import { WhiteBoard } from "./apps/whiteboard";
import { WeatherApp } from "./apps/weather";
import { HelpApp } from "./apps/extras";
import { ClockApp } from "./apps/clock";
import { MineApp } from "./apps/minesweeper";
import { SolitaireApp } from "./apps/solitaire";
import { UpdateWin } from "../../components/updates";
import {
  CalendarApp,
  CortanaApp,
  FeedbackApp,
  GrooveApp,
  MailApp,
  MapsApp,
  MoviesApp,
  NarratorApp,
  NewsApp,
  OneDriveApp,
  SecurityApp,
  SnippingApp,
  StickyNotes,
  TipsApp,
  TodoApp,
  VoiceApp,
  XboxApp,
  YourPhoneApp,
} from "./apps/extras";

export const WINDOW_APPS = [
  { icon: "settings", Comp: Settings },
  { icon: "taskmanager", Comp: Taskmanager },
  { icon: "explorer", Comp: Explorer },
  { icon: "edge", Comp: EdgeMenu },
  { icon: "store", Comp: MicroStore },
  { icon: "bin0", Comp: RecycleApp },
  { icon: "alarm", Comp: ClockApp },
  { icon: "mine", Comp: MineApp },
  { icon: "solitaire", Comp: SolitaireApp },
  { icon: "calculator", Comp: Calculator },
  { icon: "calendar", Comp: CalendarApp },
  { icon: "camera", Comp: Camera },
  { icon: "yphone", Comp: YourPhoneApp },
  { icon: "feedback", Comp: FeedbackApp },
  { icon: "getstarted", Comp: Getstarted },
  { icon: "groove", Comp: GrooveApp },
  { icon: "mail", Comp: MailApp },
  { icon: "movies", Comp: MoviesApp },
  { icon: "xbox", Comp: XboxApp },
  { icon: "narrator", Comp: NarratorApp },
  { icon: "news", Comp: NewsApp },
  { icon: "notepad", Comp: Notepad },
  { icon: "notes", Comp: StickyNotes },
  { icon: "oneDrive", Comp: OneDriveApp },
  { icon: "photos", Comp: PhotosApp },
  { icon: "paint", Comp: PaintApp },
  { icon: "security", Comp: SecurityApp },
  { icon: "snip", Comp: SnippingApp },
  { icon: "terminal", Comp: WnTerminal },
  { icon: "tips", Comp: TipsApp },
  { icon: "todo", Comp: TodoApp },
  { icon: "maps", Comp: MapsApp },
  { icon: "voice", Comp: VoiceApp },
  { icon: "weather", Comp: WeatherApp },
  { icon: "help", Comp: HelpApp },
  { icon: "board", Comp: WhiteBoard },
  { icon: "cortana", Comp: CortanaApp },
  { icon: "update", Comp: UpdateWin },
];

export { AboutWin };

export const ScreenPreview = () => {
  const tasks = useSelector((state) => state.taskbar);

  return (
    <div className="prevCont" style={{ left: tasks.prevPos + "%" }}>
      <div className="prevScreen" id="prevApp" data-show={tasks.prev && false}>
        <div id="prevsc"></div>
      </div>
    </div>
  );
};

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

import { AboutWin } from "./apps/about";
const Calculator = React.lazy(() => import("./apps/calculator").then(m => ({default: m.Calculator})));
const Camera = React.lazy(() => import("./apps/camera").then(m => ({default: m.Camera})));
const EdgeMenu = React.lazy(() => import("./apps/edge").then(m => ({default: m.EdgeMenu})));
const Explorer = React.lazy(() => import("./apps/explorer").then(m => ({default: m.Explorer})));
const Getstarted = React.lazy(() => import("./apps/getstarted").then(m => ({default: m.Getstarted})));
const Notepad = React.lazy(() => import("./apps/notepad").then(m => ({default: m.Notepad})));
const PhotosApp = React.lazy(() => import("./apps/photos").then(m => ({default: m.PhotosApp})));
const PaintApp = React.lazy(() => import("./apps/paint").then(m => ({default: m.PaintApp})));
const RecycleApp = React.lazy(() => import("./apps/recycle").then(m => ({default: m.RecycleApp})));
const Settings = React.lazy(() => import("./apps/settings").then(m => ({default: m.Settings})));
const MicroStore = React.lazy(() => import("./apps/store").then(m => ({default: m.MicroStore})));
const Taskmanager = React.lazy(() => import("./apps/taskmanager").then(m => ({default: m.Taskmanager})));
const WnTerminal = React.lazy(() => import("./apps/terminal").then(m => ({default: m.WnTerminal})));
const WhiteBoard = React.lazy(() => import("./apps/whiteboard").then(m => ({default: m.WhiteBoard})));
const WeatherApp = React.lazy(() => import("./apps/weather").then(m => ({default: m.WeatherApp})));
const HelpApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.HelpApp})));
const ClockApp = React.lazy(() => import("./apps/clock").then(m => ({default: m.ClockApp})));
const MineApp = React.lazy(() => import("./apps/minesweeper").then(m => ({default: m.MineApp})));
const SolitaireApp = React.lazy(() => import("./apps/solitaire").then(m => ({default: m.SolitaireApp})));
const UpdateWin = React.lazy(() => import("../../components/updates").then(m => ({default: m.UpdateWin})));
const CalendarApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.CalendarApp})));
const CortanaApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.CortanaApp})));
const FeedbackApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.FeedbackApp})));
const GrooveApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.GrooveApp})));
const MailApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.MailApp})));
const MapsApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.MapsApp})));
const MoviesApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.MoviesApp})));
const NarratorApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.NarratorApp})));
const NewsApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.NewsApp})));
const OneDriveApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.OneDriveApp})));
const SecurityApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.SecurityApp})));
const SnippingApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.SnippingApp})));
const StickyNotes = React.lazy(() => import("./apps/extras").then(m => ({default: m.StickyNotes})));
const TipsApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.TipsApp})));
const TodoApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.TodoApp})));
const VoiceApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.VoiceApp})));
const XboxApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.XboxApp})));
const YourPhoneApp = React.lazy(() => import("./apps/extras").then(m => ({default: m.YourPhoneApp})));

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

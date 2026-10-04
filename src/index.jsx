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

import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import store from "./reducers";
import { Provider } from "react-redux";
import { hydrateTheme } from "./utils/os/theme";
import { installShellDialogs } from "./utils/os/ui";
import { applyMobScale } from "./utils/os/mob";

// Paint the saved theme *before* the first frame so a dark-mode user never
// sees a flash of the light desktop, and swap the browser's alert/confirm/
// prompt for the Windows 11 dialogs.
hydrateTheme(store);
installShellDialogs();

// phones shrink by the ratio BEFORE the first frame (no flash of big UI),
// and follow the device — rotate, fold, plug into a desktop monitor: the
// ratio only ever exists on real phones, never on a PC
applyMobScale();
window.addEventListener("resize", applyMobScale);
window.addEventListener("orientationchange", applyMobScale);

const root = createRoot(document.getElementById("root"));

root.render(
  <Suspense
    fallback={
      <div id="sus-fallback">
        <h1>Loading</h1>
      </div>
    }
  >
    <Provider store={store}>
      <App />
    </Provider>
  </Suspense>,
);

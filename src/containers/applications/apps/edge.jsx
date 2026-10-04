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

/**
 * Microsoft Edge now lives in ./edge/ — the app grew past what a single file
 * could hold (tabs, history, downloads, favourites, internal pages, reader).
 *
 *   apps/edge/edge.jsx        the browser window itself
 *   apps/edge/edgeNav.js      the address-bar brain + all the old URL tricks
 *   apps/edge/EdgeInternal.jsx edge:// pages, the error page and the reader
 *   apps/edge/edge.scss       the Edge chrome, light and dark
 *
 * This shim keeps every existing import path working.
 */
export { EdgeMenu, default } from "./edge/edge.jsx";

/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Boot-only smoke test: loads the production bundle in jsdom and reports
 * every console error / uncaught exception.
 *
 *   node --experimental-vm-modules scripts/smoke.cjs
 */
const path = require("path");
const harness = require("./harness.cjs");

const errors = [];
const ctx = harness.boot(path.join(__dirname, "..", "build"), errors);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await harness.evaluate(ctx, errors);
  await sleep(3000);

  const doc = ctx.window.document;
  const root = doc.getElementById("root");
  const txt = (doc.body.textContent || "").replace(/\s+/g, " ").trim();

  console.log("=== root children:", root ? root.children.length : "no #root");
  console.log("=== visible text (first 500 chars) ===");
  console.log(txt.slice(0, 500));
  console.log("=== body data-theme:", doc.body.dataset.theme || "(none)");
  console.log("=== localStorage keys:", Object.keys(ctx.window.localStorage));

  console.log("\n=== errors (" + errors.length + ") ===");
  errors.slice(0, 40).forEach((e) => console.log(String(e).slice(0, 1200) + "\n"));
  process.exit(errors.length ? 1 : 0);
})();

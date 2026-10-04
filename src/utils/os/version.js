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
 * The version this PC is running — one place, so the desktop, Settings, the
 * About panel and the updater can never disagree.
 *
 * The scheme:
 *
 *   WebOS <major>            a release family ("WebOS 1")
 *   major 1.x, 2.x, …        a FEATURE update when it goes up
 *   build 01, 02, 03, …      a QUALITY update (fixes) inside that family
 *   v<major>.<build>         how a person says it out loud: v1.01, v1.02, v2.00
 *
 * Bump `build` for fixes; bump `major` and reset `build` to 0 for a feature
 * release. Nothing else needs editing — the display strings below, the
 * Settings panel, the About dialog and the updater all read from here.
 */

export const OS = {
  family: "WebOS",
  major: 1,
  build: 1,
  channel: "stable",
  released: "2026-10-04",
};

/** v1.01 — the version as a person reads it */
export const osVersion = () => `v${OS.major}.${String(OS.build).padStart(2, "0")}`;

/** WebOS 1 */
export const osFamily = () => `${OS.family} ${OS.major}`;

/** WebOS 1 · v1.01 · Build 1 — the full identity line */
export const osLabel = () => `${osFamily()} · ${osVersion()} · Build ${OS.build}`;

/** The same thing as a semver string, for package.json / npm friends. */
export const osSemver = () => `${OS.major}.${OS.build}.0`;

/**
 * Compare two {major, build} pairs.
 *   1  → `a` is newer than `b`
 *   0  → identical
 *  -1  → `a` is older than `b`
 */
export const compareVersion = (a, b) => {
  const A = { major: Number(a?.major) || 0, build: Number(a?.build) || 0 };
  const B = { major: Number(b?.major) || 0, build: Number(b?.build) || 0 };
  if (A.major !== B.major) return A.major > B.major ? 1 : -1;
  if (A.build !== B.build) return A.build > B.build ? 1 : -1;
  return 0;
};

/**
 * What kind of update is on offer?
 *   "feature" — the release family changed (1.x → 2.x): new features
 *   "quality" — same family, a newer build: fixes
 *   "none"    — nothing newer
 */
export const updateKind = (theirs, ours = OS) => {
  const cmp = compareVersion(theirs, ours);
  if (cmp <= 0) return "none";
  return Number(theirs.major) > Number(ours.major) ? "feature" : "quality";
};

/** "v2.00" → { major: 2, build: 0 }; tolerant of "1.3", "v1.03", "1.3.5" */
export const parseVersion = (text) => {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(text || ""));
  if (!m) return null;
  const major = Number(m[1]);
  // "1.03" and "1.3" both mean build 3; a third number is a patch level we fold in
  const build = Number(m[2] || 0);
  return { major, build, patch: Number(m[3] || 0) };
};

export default OS;

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
 * Keyboard ownership.
 *
 * Every app window listens on `window`, so without a rule each of them used to
 * react to — and often `preventDefault()` — keystrokes that were being typed
 * into a completely different window. That is how Ctrl+V typed in Notepad got
 * swallowed by File Explorer and pasted a file instead of text.
 *
 * The rule is Windows' rule: the frontmost visible window owns the keyboard.
 * `apps.hz` is the z-index of that window; every window carries its own `z`.
 */
export const ownsKeyboard = (wnapp, hz) =>
  !!wnapp && wnapp.alive === true && wnapp.hide === false && wnapp.z === hz;

export default ownsKeyboard;

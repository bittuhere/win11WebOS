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

/*
 * formsubmit.co helper — every "send it to the builder" surface funnels
 * through here so the email contract lives in exactly one place.
 *
 * The address comes from CONTROL.env (baked at build time as __WOS_CONTROL__).
 * Builds without it embed the maintainer's address, never an empty one.
 */

export const FALLBACK_EMAIL = "win11webos@gmail.com";

/* vite's define replaces the bare identifier at build time; the typeof guard
   keeps plain-node tooling (and any non-vite host) from exploding */
export const CONTROL = typeof __WOS_CONTROL__ !== "undefined" ? __WOS_CONTROL__ || {} : {};

export const EMAIL_ERROR =
  "Error: Failed to get email. Properly check that you have put your email (by default you should include my email).";

export const MAX_ATTACH = 5 * 1024 * 1024; // formsubmit caps attachments at 5 MB

export const feedbackEmail = (fixed) => fixed || CONTROL.EMAIL || FALLBACK_EMAIL;

/**
 * Send feedback through formsubmit's AJAX endpoint.
 * @param {object} o
 * @param {string} [o.to]      fixed recipient (Help/Feedback pin their own)
 * @param {string} o.subject
 * @param {string} o.message
 * @param {File}   [o.file]    any file, ≤ 5 MB
 * @returns {Promise<string>}  the address it was delivered to
 */
export async function sendFeedback({ to, subject, message, file }) {
  const email = feedbackEmail(to);
  if (!email) {
    // the exact string the user asked for — shown verbatim in the UI
    throw new Error(EMAIL_ERROR);
  }
  const fd = new FormData();
  fd.append("subject", subject || "Windows 11 WebOS feedback");
  fd.append("message", message || "");
  fd.append("_template", "table");
  if (file) {
    if (file.size > MAX_ATTACH) {
      throw new Error(
        `That attachment is ${(file.size / 1048576).toFixed(1)} MB — the limit is 5 MB. Attach something smaller.`,
      );
    }
    fd.append("attachment", file, file.name);
  }
  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
    method: "POST",
    body: fd,
  });
  if (!r.ok) {
    throw new Error(`formsubmit responded ${r.status} — try again in a moment.`);
  }
  return email;
}

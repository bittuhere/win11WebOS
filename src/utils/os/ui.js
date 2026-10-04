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
 * Imperative shell UI — the Win11 replacements for the browser chrome.
 *
 *   notify({...})          -> Windows 11 toast notification
 *   wosAlert(msg, opts)    -> ContentDialog, resolves true
 *   wosConfirm(msg, opts)  -> ContentDialog, resolves true/false
 *   wosPrompt(msg, opts)   -> ContentDialog, resolves string|null
 *   wosSelect(opts)        -> Win11 dropdown dialog, resolves value|null
 *   installShellDialogs()  -> swaps window.alert/confirm/prompt for the above
 *
 * Every promise is parked in `parking` (a module level Map) so the Redux
 * state stays serialisable — the reducer only ever sees plain data.
 */
import store from "../../reducers";

const parking = new Map();
let seq = 0;

const nid = (p) => `${p}_${++seq}_${Date.now().toString(36)}`;

/* ------------------------------------------------------------------ */
/*  Toasts                                                             */
/* ------------------------------------------------------------------ */

/**
 * Show a Windows 11 style toast.
 * @param {{title?:string, body?:string, app?:string, icon?:string,
 *          kind?:'info'|'success'|'warn'|'error', life?:number,
 *          hero?:string, actions?:Array<{label:string, act:string}>}} o
 */
export function notify(o = {}) {
  const payload = typeof o === "string" ? { title: o } : { ...o };
  payload.id = payload.id || nid("toast");
  // Settings → System → Notifications really mutes the OS
  try {
    if (store.getState().setting?.system?.notifications?.disabled) return payload.id;
  } catch (e) {}
  store.dispatch({ type: "UITOAST", payload });
  return payload.id;
}

export function dismissToast(id) {
  store.dispatch({ type: "UITOASTOUT", payload: id });
  // remove from the stack once the fly-out animation has played
  setTimeout(() => store.dispatch({ type: "UITOASTKILL", payload: id }), 320);
}

export function clearToasts() {
  store.dispatch({ type: "UITOASTCLEAR" });
}

/* ------------------------------------------------------------------ */
/*  Dialogs                                                            */
/* ------------------------------------------------------------------ */

function openDialog(spec) {
  const id = spec.id || nid("dlg");
  return new Promise((resolve) => {
    parking.set(id, resolve);
    store.dispatch({ type: "UIDLG", payload: { ...spec, id } });
  });
}

/** Close a dialog from anywhere and hand `result` back to whoever awaited it. */
export function closeDialog(id, result) {
  const resolve = parking.get(id);
  if (resolve) {
    parking.delete(id);
    resolve(result);
  }
  store.dispatch({ type: "UIDLGCLOSE", payload: { id } });
}

export function setDialogValue(id, value) {
  store.dispatch({ type: "UIDLGVAL", payload: { id, value } });
}

/** The dialog currently on top of the stack (the interactive one). */
export function topDialog() {
  const list = store.getState().ui.dialogs;
  return list.length ? list[list.length - 1] : null;
}

export const wosAlert = (text, opts = {}) =>
  openDialog({ kind: "alert", text: String(text ?? ""), ...opts });

export const wosConfirm = (text, opts = {}) =>
  openDialog({ kind: "confirm", text: String(text ?? ""), ...opts });

/**
 * Three-button confirm — resolves `true` (ok), `"mid"` (the middle
 * action, e.g. Don't save) or `null` (cancel). Used by Notepad's close
 * flow so "Don't save and close" is ONE click, not a second dialog.
 */
export const wosConfirmEx = (text, opts = {}) =>
  openDialog({
    kind: "confirm",
    text: String(text ?? ""),
    midText: opts.midText || "Don't save",
    ...opts,
  });

export const wosPrompt = (text, opts = {}) =>
  openDialog({
    kind: "prompt",
    text: String(text ?? ""),
    value: opts.value ?? opts.defaultValue ?? "",
    ...opts,
  });

export const wosSelect = (opts = {}) => openDialog({ kind: "select", ...opts });

/** A Win11 "Save as" sheet — resolves `{ name, path }` or null. */
/**
 * A real Save-As window: browses the Virtual Storage (quick locations,
 * folders, existing files) and resolves with the full VS path — or null.
 */
export const wosFileSave = (opts = {}) =>
  openDialog({
    kind: "saveas",
    title: opts.title || "Save as",
    text: "",
    value: opts.value || "Untitled.txt",
    dir: opts.dir || null,
    okText: "Save",
    ...opts,
  });

/** A real Win11 Open window: browse the Virtual Storage, resolve the path or null.
 *  opts.types: [{ label: "Text documents", exts: ["txt","md"] }, { label: "All files", exts: null }] */
export const wosFileOpen = (opts = {}) =>
  openDialog({
    kind: "open",
    title: opts.title || "Open",
    text: "",
    dir: opts.dir || null,
    types: opts.types || [{ label: "All files", exts: null }],
    okText: "Open",
    ...opts,
  });

export const wosSaveAs = (opts = {}) =>
  openDialog({
    kind: "prompt",
    title: opts.title || "Save as",
    text: opts.text || "File name:",
    okText: "Save",
    ...opts,
  });

/* ------------------------------------------------------------------ */
/*  Replace the native browser chrome                                  */
/* ------------------------------------------------------------------ */

let installed = false;

export function installShellDialogs() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const native = {
    alert: window.alert.bind(window),
    confirm: window.confirm.bind(window),
    prompt: window.prompt.bind(window),
  };
  window.__nativeDialogs = native;

  window.alert = function (msg) {
    // requirement 8: alerts become Windows 11 notification toasts
    notify({
      app: "Windows",
      title: "Windows",
      body: String(msg ?? ""),
      kind: "info",
    });
  };

  window.confirm = function (msg) {
    // The native confirm is synchronous and cannot be awaited, so callers that
    // still use it get `true` and a toast. Everything inside the OS uses
    // wosConfirm() instead.
    wosConfirm(msg, { title: "Windows" }).catch(() => {});
    return true;
  };

  window.prompt = function (msg, def) {
    wosPrompt(msg, { title: "Windows", value: def ?? "" }).catch(() => {});
    return def ?? "";
  };
}

/** Put the native ones back (used by tests / the error boundary). */
export function uninstallShellDialogs() {
  if (!installed) return;
  installed = false;
  const n = window.__nativeDialogs;
  if (n) {
    window.alert = n.alert;
    window.confirm = n.confirm;
    window.prompt = n.prompt;
  }
}

/* ------------------------------------------------------------------ */
/*  Convenience helpers used across the OS                             */
/* ------------------------------------------------------------------ */

export const toastSuccess = (title, body, app) =>
  notify({ title, body, kind: "success", app: app || "Windows" });

export const toastError = (title, body, app) =>
  notify({ title, body, kind: "error", app: app || "Windows", life: 7 });

export const toastInfo = (title, body, app) =>
  notify({ title, body, kind: "info", app: app || "Windows" });

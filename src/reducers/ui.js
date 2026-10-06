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
 * ui reducer — shell level UI state of this Windows.
 * Holds the notification centre (Win11 toasts), the modal dialog stack
 * (the Win11 replacements for alert / confirm / prompt / <select>)
 * and the status of the browser extension bridge.
 *
 * Nothing here holds functions — Redux state stays serialisable.
 * Dialog promises are parked in utils/os/ui.js instead.
 */

let tid = 1;

const defState = {
  toasts: [],
  /** dialog stack, only the top one takes input */
  dialogs: [],
  ext: {
    installed: false,
    id: "",
    version: "",
    browser: "",
    checkedAt: 0,
    /** the user pressed "Continue without adding" */
    skipped: false,
  },
};

const uiReducer = (state = defState, action) => {
  switch (action.type) {
    /* ---------------- notification toasts ---------------- */
    case "UITOAST": {
      const p = action.payload || {};
      const toast = {
        id: p.id || `t${tid++}_${Date.now()}`,
        app: p.app || "Windows",
        icon: p.icon || "",
        title: p.title || "",
        body: p.body || "",
        /** optional big image strip */
        hero: p.hero || "",
        /** info | success | warn | error */
        kind: p.kind || "info",
        /** seconds before it flies away — Windows keeps toasts around, so
         *  the default is 20s and anything under 15s gets raised (0 = sticky) */
        life: p.life == null ? 20 : p.life,
        actions: p.actions || [],
        at: Date.now(),
        leaving: false,
      };
      return { ...state, toasts: [...state.toasts, toast].slice(-20) };
    }

    case "UITOASTOUT":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.payload ? { ...t, leaving: true } : t)),
      };

    case "UITOASTKILL":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };

    case "UITOASTCLEAR":
      return { ...state, toasts: [] };

    /* ---------------- dialog stack ---------------- */
    case "UIDLG": {
      const p = action.payload || {};
      const id = p.id || `d${tid++}_${Date.now()}`;
      const dlg = {
        id,
        kind: p.kind || "alert", // alert | confirm | prompt | select | custom
        title: p.title || "",
        text: p.text || "",
        placeholder: p.placeholder || "",
        value: p.value == null ? "" : p.value,
        okText: p.okText || "OK",
        cancelText: p.cancelText || "Cancel",
        midText: p.midText || "",
        danger: !!p.danger,
        icon: p.icon || "",
        options: p.options || [],
        rows: p.rows || 1,
        selectAll: p.selectAll !== false,
      };
      return { ...state, dialogs: [...state.dialogs, { ...dlg, id }] };
    }

    case "UIDLGVAL":
      return {
        ...state,
        dialogs: state.dialogs.map((d) =>
          d.id === action.payload.id ? { ...d, value: action.payload.value } : d,
        ),
      };

    case "UIDLGCLOSE":
      return {
        ...state,
        dialogs: state.dialogs.filter((d) => d.id !== action.payload?.id),
      };

    /* ---------------- extension bridge ---------------- */
    case "UIEXT":
      return { ...state, ext: { ...state.ext, ...action.payload } };

    default:
      return state;
  }
};

export default uiReducer;

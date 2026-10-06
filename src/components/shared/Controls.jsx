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

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * WosSelect — the Windows 11 ComboBox.
 * Drop in replacement for the raw <select> element: same controlled API
 * (value / onChange) but with the Win11 flyout, tick marks and animation.
 */
export const WosSelect = ({
  value,
  onChange,
  options = [],
  placeholder = "",
  className = "",
  disabled = false,
  id,
  name,
}) => {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [pos, setPos] = useState(null); // viewport coords for the portaled flyout
  const rootRef = useRef(null);
  const popRef = useRef(null);

  const norm = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const current = norm.find((o) => o.value === value);

  /* the flyout is rendered at the TOP of the DOM (document.body) so no
     toolbar, pane or overflow container can ever cover it */
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const place = () => {
      const r = rootRef.current.getBoundingClientRect();
      const space = window.innerHeight - r.bottom;
      const openUp = space < 260 && r.top > space;
      setUp(openUp);
      setPos({ left: r.left, top: openUp ? r.top : r.bottom + 4, width: r.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (rootRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const key = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = norm.findIndex((o) => o.value === value);
        const n = e.key === "ArrowDown" ? Math.min(norm.length - 1, i + 1) : Math.max(0, i - 1);
        if (norm[n]) onChange?.(norm[n].value);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open, value, norm.length]);

  return (
    <div
      ref={rootRef}
      className={`wosSelect ${open ? "open" : ""} ${up ? "up" : ""} ${className}`}
      id={id}
    >
      <button
        type="button"
        name={name}
        className="wosSelectBtn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span>{current ? current.label : placeholder}</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
          <path
            d="M2 4.5L6 8.5l4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="wosSelectPop"
              role="listbox"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 180),
                transform: up ? "translateY(-100%)" : "none",
                zIndex: 99990,
              }}
            >
              {norm.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  className={`wosSelectItem ${o.value === value ? "on" : ""}`}
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                >
                  <svg className="tick" viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                    <path
                      d="M2 6.4l2.6 2.6L10 3.6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {o.icon ? <img src={o.icon} alt="" width="16" height="16" /> : null}
                  {o.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

/**
 * WosFlyout — a Win11 acrylic popup menu anchored to a trigger element.
 *   items: [{ label, icon, kbd, onClick, sep, head, disabled }]
 */
export const WosFlyout = ({ trigger, items = [], align = "left", width, className = "" }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const show = (e) => {
    const r = (e.currentTarget || ref.current).getBoundingClientRect();
    const w = width || 220;
    let left = align === "right" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 4;
    setPos({ left, top, w });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (e.target.closest?.(".wosFlyout")) return;
      setOpen(false);
    };
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className={`wosFlyWrap ${className}`} ref={ref} style={{ position: "relative" }}>
      <div onClick={show}>{trigger}</div>
      {open && pos ? (
        <div
          className="wosFlyout"
          style={{
            position: "fixed",
            left: pos.left,
            top: Math.min(pos.top, window.innerHeight - 40),
            width: pos.w,
          }}
        >
          {items.map((it, i) => {
            if (it.sep) return <div className="wosFlySep" key={i} />;
            if (it.head)
              return (
                <div className="wosFlyHead" key={i}>
                  {it.head}
                </div>
              );
            return (
              <button
                type="button"
                key={i}
                className="wosFlyItem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                <span className="glyph">{it.icon || null}</span>
                <span className="lbl">{it.label}</span>
                {it.kbd ? <span className="kbd">{it.kbd}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

/** Tiny Win11 toggle switch. */
export const WosToggle = ({ on, onChange, label, disabled }) => (
  <button
    type="button"
    className="wosToggle"
    data-on={on}
    disabled={disabled}
    aria-pressed={!!on}
    onClick={() => onChange?.(!on)}
  >
    <i />
    {label ? <span>{label}</span> : null}
  </button>
);

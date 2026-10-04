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

import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { OS, osFamily, osVersion } from "../../../utils/os/version";

/*
 * The About dialog — shown once at first boot and from desktop right-click
 * ▸ About. The wording below is the project's exact statement, matching the
 * OOBE "About this PC" screen word for word.
 */

export const AboutWin = () => {
  /* Visibility comes from ONE place: the desktop reducer's `abOpen`.
     The boot sequence (App.jsx) dispatches { open: true, boot: true } on every
     boot — cold start AND the in-OS Restart — so the panel can no longer go
     missing on a reboot, which is what happened when the panel kept its own
     one-shot local flag: the component never remounts inside a session, so
     "shown once" quietly meant "shown once per page load, never again". */
  const { abOpen, abBoot } = useSelector((state) => state.desktop);
  const [timer, setTimer] = useState(0);
  const dispatch = useDispatch();

  useEffect(() => {
    // the 5-second countdown belongs to the boot appearance only; a
    // right-click open is immediately dismissible.
    setTimer(abOpen && abBoot ? 5 : 0);
  }, [abOpen, abBoot]);

  useEffect(() => {
    // NO lock/boot gating here — a frozen gate (never-booted smoke envs, lock
    // states) used to freeze the Ok button forever.
    if (!abOpen || timer <= 0) return;
    const t = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [abOpen, timer]);

  const open = !!abOpen;
  const counting = !!abOpen && timer > 0;

  const action = () => {
    /* closes either source — boot appearance or the right-click menu */
    dispatch({ type: "DESKABOUT", payload: false });
  };

  return open ? (
    <div className="aboutApp floatTab dpShad">
      <div className="content p-6">
        <div className="text-xl font-semibold" style={{ textAlign: "center", marginBottom: 10 }}>
          Win11 WebOS
        </div>
        <div className="aboutVersion">
          <span className="aboutVerFamily">{osFamily()}</span>
          <span className="aboutVerNum">{osVersion()}</span>
          <span className="aboutVerBuild">Build {OS.build}</span>
        </div>
        <p>
          Win11 WebOS is an open source project made in the hope to replicate the Windows 11 desktop
          experience on web, using standard web technologies like React, CSS, and JavaScript.
        </p>
        <p>This project is licensed under Apache License 2.0.</p>
        <p>
          contact :&nbsp;
          <a target="_blank" href="mailto:anurag670singh@gmail.com" rel="noreferrer">
            anurag670singh@gmail.com
          </a>
        </p>
        <p className="aboutUpdLine">
          Updates are published in the release channel <b>{OS.channel}</b> — Windows Update has the
          details.
        </p>
        <p>
          This project is not in anyway affiliated with Microsoft and should not be confused with
          Microsoft's Operating System or Products.
        </p>
        <p>This is also not Windows 365 cloud PC.</p>
        <p>
          Microsoft, Windows and Other demonstrated Products in this project are trademarks of the
          Microsoft group of companies.
        </p>
      </div>
      <div className="okbtn px-6 py-4">
        <div data-allow={!counting} onClick={counting ? undefined : action}>
          Ok, I understand {counting ? <span>{`( ${timer} )`}</span> : null}
        </div>
      </div>
    </div>
  ) : null;
};

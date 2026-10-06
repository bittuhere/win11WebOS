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

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Icon } from "../../utils/general";
import "./menu.scss";

import * as Actions from "../../actions";

export const ActMenu = () => {
  const menu = useSelector((state) => state.menus);
  const menudata = menu.data[menu.opts];
  /* the dynamic items (pin/unpin/uninstall) read the LIVE machine state */
  const apps = useSelector((state) => state.apps);
  const desk = useSelector((state) => state.desktop);
  const start = useSelector((state) => state.startmenu);

  const menuCtx = (() => {
    const ds = menu.dataset || {};
    let name = ds.name || null;
    let app = null;
    if (ds.icon && apps[ds.icon]) app = apps[ds.icon];
    else if (ds.action) {
      const key = Object.keys(apps).find((x) => x !== "hz" && apps[x]?.action === ds.action);
      if (key) app = apps[key];
    }
    if (!name && app) name = app.name;
    return {
      name,
      isPwa: !!app?.pwa,
      onDesktop: !!name && desk.apps.some((x) => x.name === name),
      inStart: !!name && start.pnApps.some((x) => x?.name === name),
    };
  })();

  const visItem = (opt) => (typeof opt.show === "function" ? opt.show(menuCtx) : true);
  const { abpos, isLeft } = useSelector((state) => {
    var acount = state.menus.menus[state.menus.opts].length;
    var tmpos = {
        top: state.menus.top,
        left: state.menus.left,
      },
      tmpleft = false;

    var wnwidth = window.innerWidth,
      wnheight = window.innerHeight;

    var ewidth = 312,
      eheight = acount * 28;

    tmpleft = wnwidth - tmpos.left > 504;
    if (wnwidth - tmpos.left < ewidth) {
      tmpos.left = wnwidth - ewidth;
    }

    if (wnheight - tmpos.top < eheight) {
      tmpos.bottom = wnheight - tmpos.top;
      tmpos.top = null;
    }

    return {
      abpos: tmpos,
      isLeft: tmpleft,
    };
  });

  const dispatch = useDispatch();

  const clickDispatch = (event) => {
    event.stopPropagation();
    if (event.currentTarget?.dataset?.dsb === "true") return;
    // the user clicks the LABEL (.nopt) or the icon — the data-action lives
    // on this .menuopt. Walk up so every part of the row is clickable.
    const host =
      event.currentTarget?.dataset?.action != null
        ? event.currentTarget
        : event.target?.closest?.("[data-action]") || event.currentTarget;
    var action = {
      type: host?.dataset?.action,
      payload: host?.dataset?.payload,
    };

    if (action.type) {
      if (action.type != action.type.toUpperCase()) {
        Actions[action.type](action.payload, menu);
      } else {
        dispatch(action);
      }
      dispatch({ type: "MENUHIDE" });
    }
  };

  const menuobj = (data) => {
    var mnode = [];
    data = data.filter(visItem);
    data.map((opt, i) => {
      if (opt.type == "hr") {
        mnode.push(<div key={i} className="menuhr"></div>);
      } else {
        mnode.push(
          <div
            key={i}
            className="menuopt"
            data-dsb={opt.dsb}
            onClick={clickDispatch}
            data-action={opt.action}
            data-payload={opt.payload}
          >
            {menudata.ispace != false ? (
              <div className="spcont">
                {opt.icon && opt.type == "svg" ? <Icon icon={opt.icon} width={16} /> : null}
                {opt.icon && opt.type == "fa" ? <Icon fafa={opt.icon} width={16} /> : null}
                {opt.icon && opt.type == null ? <Icon src={opt.icon} width={16} /> : null}
              </div>
            ) : null}
            <div className="nopt">{opt.name}</div>
            {opt.opts ? (
              <Icon className="micon rightIcon" fafa="faChevronRight" width={10} color="#999" />
            ) : null}
            {opt.dot ? (
              <Icon className="micon dotIcon" fafa="faCircle" width={4} height={4} />
            ) : null}
            {opt.check ? (
              <Icon className="micon checkIcon" fafa="faCheck" width={8} height={8} />
            ) : null}
            {opt.opts ? (
              <div
                className="minimenu"
                style={{
                  minWidth: menudata.secwid,
                }}
              >
                {menuobj(opt.opts)}
              </div>
            ) : null}
          </div>,
        );
      }
    });

    return mnode;
  };

  return (
    <div
      className="actmenu"
      id="actmenu"
      style={{
        ...abpos,
        "--prefix": "MENU",
        width: menudata.width,
      }}
      data-hide={menu.hide}
      data-left={isLeft}
    >
      {menuobj(menu.menus[menu.opts])}
    </div>
  );
};

export default ActMenu;

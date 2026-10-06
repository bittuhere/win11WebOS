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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useSelector, useDispatch } from "react-redux";
import "./general.scss";
import { LazyLoadImage } from "react-lazy-load-image-component";

import * as FaIcons from "@fortawesome/free-solid-svg-icons";
import * as FaRegIcons from "@fortawesome/free-regular-svg-icons";
import * as AllIcons from "./icons";

String.prototype.strip = function (c) {
  var i = 0,
    j = this.length - 1;
  while (this[i] === c) i++;
  while (this[j] === c) j--;
  return this.slice(i, j + 1);
};

String.prototype.count = function (c) {
  var result = 0,
    i = 0;
  for (i; i < this.length; i++) if (this[i] == c) result++;
  return result;
};

/** Any image source on earth can be an icon: http(s) URLs of any type
    (svg/png/jpg/webp/gif/avif/ico), data:/blob: URLs, files with an image
    extension at any path, and Virtual Storage paths (C:\... or vs:Folder/x). */
const UNIVERSAL_SRC = (src) =>
  !!src &&
  (/^https?:\/\//i.test(src) ||
    /^(data|blob):/i.test(src) ||
    /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)([?#]|$)/i.test(src) ||
    /^[a-zA-Z]:[\\/]/.test(src) ||
    /^vs:/i.test(src));

const BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const BS = "\\";

/** Resolve ANY icon/image source: http(s), data:, blob:, extension-bearing
    paths, and Virtual Storage paths (C:\... or vs:Folder/name). VS paths
    load async and come back as data URLs. */
export const useUniversalSrc = (raw) => {
  const [resolved, setResolved] = useState(() =>
    raw && /^(vs:|[a-zA-Z]:[\\/])/.test(raw) ? BLANK_IMG : raw,
  );
  const vsPath = raw && (/^vs:/i.test(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) ? raw : null;
  useEffect(() => {
    let alive = true;
    if (!vsPath) {
      setResolved(raw);
      return undefined;
    }
    (async () => {
      try {
        const vs = await import("./os/vs");
        const p = /^vs:/i.test(vsPath)
          ? "C:" +
            BS +
            "Users" +
            BS +
            (vs.getUserName() || "User") +
            BS +
            vsPath.replace(/^vs:/i, "").replace(/\//g, BS)
          : vsPath;
        let url = null;
        if (/\.svg$/i.test(p)) {
          const rec = await vs.vsRead(p); // svg is text — btoa chokes on unicode
          if (rec)
            url =
              "data:image/svg+xml;charset=utf-8," + encodeURIComponent(String(rec.content ?? ""));
        } else {
          const rec = await vs.vsReadDataUrl(p);
          url = rec?.dataUrl || null;
        }
        if (alive) setResolved(url || BLANK_IMG);
      } catch (e) {
        if (alive) setResolved(BLANK_IMG);
      }
    })();
    return () => {
      alive = false;
    };
  }, [vsPath, raw]);
  return resolved;
};

export const Icon = (props) => {
  const sidepane = useSelector((state) => state.sidepane);

  const dispatch = useDispatch();
  /* Virtual Storage icons resolve async — hooks MUST run before any bail */
  const universalSrc = useUniversalSrc(props.src || null);
  const vsPath =
    props.src && (/^vs:/i.test(props.src) || /^[a-zA-Z]:[\\/]/.test(props.src)) ? props.src : null;

  // never request img/icon/undefined.png: only bail when no renderer branch can apply
  if (!props.src && props.fafa == null && props.icon == null) return null;
  var src = `img/icon/${props.ui != null ? "ui/" : ""}${props.src}.png`;
  if (vsPath) {
    src = universalSrc;
  } else if (props.ext != null || UNIVERSAL_SRC(props.src)) {
    src = props.src;
  }

  var prtclk = "";
  if (props.src) {
    if (props.onClick != null || props.pr != null) {
      prtclk = "prtclk";
    }
  }

  const clickDispatch = (event) => {
    if (!sidepane.banhide) dispatch({ type: "BANDHIDE" });

    // The data-action attribute lives on the wrapper this handler is bound to,
    // but the real click target is usually the <img>/<svg> inside it. Walk up
    // so every Icon in the OS actually reports what it was asked to report.
    const host =
      event.currentTarget?.dataset?.action != null
        ? event.currentTarget
        : event.target?.closest?.("[data-action]") || event.currentTarget;

    var action = {
      type: host?.dataset?.action,
      payload: host?.dataset?.payload,
    };

    if (action.type) {
      dispatch(action);
    }
  };

  if (props.fafa != null) {
    return (
      <div
        className={`uicon prtclk ${props.className || ""}`}
        onClick={props.onClick || (props.click && clickDispatch) || null}
        data-action={props.click}
        data-payload={props.payload}
        data-menu={props.menu}
        data-icon={props["data-icon"]}
      >
        <FontAwesomeIcon
          data-flip={props.flip != null}
          data-invert={props.invert != null ? "true" : "false"}
          data-rounded={props.rounded != null ? "true" : "false"}
          style={{
            width: props.width,
            height: props.height || props.width,
            color: props.color || null,
            margin: props.margin || null,
          }}
          icon={props.reg == null ? FaIcons[props.fafa] : FaRegIcons[props.fafa]}
        />
      </div>
    );
  } else if (props.icon != null) {
    var CustomIcon = AllIcons[props.icon];
    return (
      <div
        className={`uicon prtclk ${props.className || ""}`}
        onClick={props.onClick || (props.click && clickDispatch) || null}
        data-action={props.click}
        data-payload={props.payload}
        data-menu={props.menu}
        data-icon={props["data-icon"]}
      >
        <CustomIcon
          data-flip={props.flip != null}
          data-invert={props.invert != null ? "true" : "false"}
          data-rounded={props.rounded != null ? "true" : "false"}
          style={{
            width: props.width,
            height: props.height || props.width,
            fill: props.color || null,
            margin: props.margin || null,
          }}
        />
      </div>
    );
  } else {
    return (
      <div
        className={`uicon ${props.className || ""} ${prtclk}`}
        data-open={props.open}
        data-action={props.click}
        data-active={props.active}
        data-payload={props.payload}
        onClick={props.onClick || (props.pr && clickDispatch) || null}
        data-menu={props.menu}
        data-pr={props.pr}
        data-icon={props["data-icon"]}
      >
        {props.className == "tsIcon" ? (
          <div
            onClick={props.click != null ? clickDispatch : null}
            style={{ width: props.width, height: props.width }}
            data-action={props.click}
            data-payload={props.payload}
            data-click={props.click != null}
            data-flip={props.flip != null}
            data-invert={props.invert != null ? "true" : "false"}
            data-rounded={props.rounded != null ? "true" : "false"}
          >
            <img
              width={props.width}
              height={props.height}
              data-action={props.click}
              data-payload={props.payload}
              data-click={props.click != null}
              data-flip={props.flip != null}
              data-invert={props.invert != null ? "true" : "false"}
              data-rounded={props.rounded != null ? "true" : "false"}
              src={src}
              style={{
                margin: props.margin || null,
              }}
              alt=""
            />
          </div>
        ) : (
          <img
            width={props.width}
            height={props.height}
            onClick={props.click != null ? clickDispatch : null}
            data-action={props.click}
            data-payload={props.payload}
            data-click={props.click != null}
            data-flip={props.flip != null}
            data-invert={props.invert != null ? "true" : "false"}
            data-rounded={props.rounded != null ? "true" : "false"}
            src={src}
            style={{
              margin: props.margin || null,
            }}
            alt=""
          />
        )}
      </div>
    );
  }
};

export const Image = (props) => {
  const dispatch = useDispatch();
  const raw = props.ext != null ? props.src : null;
  const universalSrc = useUniversalSrc(raw);
  var src = `img/${(props.dir ? props.dir + "/" : "") + props.src}.png`;
  if (props.ext != null) {
    src = universalSrc; // any URL / data: / vs: path, resolved
  }

  const errorHandler = (e) => {
    if (props.err) {
      e.currentTarget.src = props.err;
    }
  };

  const clickDispatch = (event) => {
    const host =
      event.currentTarget?.dataset?.action != null
        ? event.currentTarget
        : event.target?.closest?.("[data-action]") || event.currentTarget;
    var action = {
      type: host?.dataset?.action,
      payload: host?.dataset?.payload,
    };

    if (action.type) {
      dispatch(action);
    }
  };

  return (
    <div
      className={`imageCont prtclk ${props.className || ""}`}
      id={props.id}
      style={{
        backgroundImage: props.back && `url(${src})`,
      }}
      data-back={props.back != null}
      onClick={props.onClick || (props.click ? clickDispatch : undefined)}
      data-action={props.click}
      data-payload={props.payload}
      data-var={props.var}
    >
      {!props.back ? (
        props.lazy ? (
          <LazyLoadImage
            width={props.w}
            height={props.h}
            data-free={props.free != null}
            data-var={props.var}
            loading={props.lazy ? "lazy" : null}
            src={src}
            alt=""
            onError={errorHandler}
          />
        ) : (
          <img
            width={props.w}
            height={props.h}
            data-free={props.free != null}
            data-var={props.var}
            loading={props.lazy ? "lazy" : null}
            src={src}
            alt=""
            onError={errorHandler}
          />
        )
      ) : null}
    </div>
  );
};

export const SnapScreen = (props) => {
  const dispatch = useDispatch();
  const [delay, setDelay] = useState(false);
  const lays = useSelector((state) => state.globals.lays);

  const vr = "var(--radii)";

  const clickDispatch = (event) => {
    var action = {
      type: event.currentTarget.dataset.action,
      payload: event.currentTarget.dataset.payload,
      dim: JSON.parse(event.currentTarget.dataset.dim),
    };

    if (action.dim && action.type) {
      dispatch(action);
      props.closeSnap();
    }
  };

  useEffect(() => {
    if (delay && props.snap) {
      setTimeout(() => {
        setDelay(false);
      }, 500);
    } else if (props.snap) {
      setDelay(true);
    }
  });

  return props.snap || delay ? (
    <div className="snapcont mdShad" data-dark={props.invert != null}>
      {lays.map((x, i) => {
        return (
          <div key={i} className="snapLay">
            {x.map((y, j) => (
              <div
                key={j}
                className="snapper"
                style={{
                  borderTopLeftRadius: (y.br % 2 == 0) * 4,
                  borderTopRightRadius: (y.br % 3 == 0) * 4,
                  borderBottomRightRadius: (y.br % 5 == 0) * 4,
                  borderBottomLeftRadius: (y.br % 7 == 0) * 4,
                }}
                onClick={clickDispatch}
                data-dim={JSON.stringify(y.dim)}
                data-action={props.app}
                data-payload="resize"
              ></div>
            ))}
          </div>
        );
      })}
    </div>
  ) : null;
};

export const ToolBar = (props) => {
  const dispatch = useDispatch();
  const [snap, setSnap] = useState(false);

  const openSnap = () => {
    setSnap(true);
  };

  const closeSnap = () => {
    setSnap(false);
  };

  const toolClick = () => {
    dispatch({
      type: props.app,
      payload: "front",
    });
  };

  var posP = [0, 0],
    dimP = [0, 0],
    posM = [0, 0],
    wnapp = {},
    op = 0,
    vec = [0, 0];

  const toolDrag = (e) => {
    e = e || window.event;
    e.preventDefault();
    posM = [e.clientY, e.clientX];
    op = e.currentTarget.dataset.op;

    if (op == 0) {
      wnapp = e.currentTarget.parentElement && e.currentTarget.parentElement.parentElement;
    } else {
      vec = e.currentTarget.dataset.vec.split(",");
      wnapp =
        e.currentTarget.parentElement &&
        e.currentTarget.parentElement.parentElement &&
        e.currentTarget.parentElement.parentElement.parentElement;
    }

    if (wnapp) {
      wnapp.classList.add("notrans");
      wnapp.classList.add("z9900");
      posP = [wnapp.offsetTop, wnapp.offsetLeft];
      dimP = [
        parseFloat(getComputedStyle(wnapp).height.replaceAll("px", "")),
        parseFloat(getComputedStyle(wnapp).width.replaceAll("px", "")),
      ];
    }

    document.onmouseup = closeDrag;
    document.onmousemove = eleDrag;
  };

  const setPos = (pos0, pos1) => {
    wnapp.style.top = pos0 + "px";
    wnapp.style.left = pos1 + "px";
  };

  const setDim = (dim0, dim1) => {
    wnapp.style.height = dim0 + "px";
    wnapp.style.width = dim1 + "px";
  };

  const eleDrag = (e) => {
    e = e || window.event;
    e.preventDefault();

    var pos0 = posP[0] + e.clientY - posM[0],
      pos1 = posP[1] + e.clientX - posM[1],
      dim0 = dimP[0] + vec[0] * (e.clientY - posM[0]),
      dim1 = dimP[1] + vec[1] * (e.clientX - posM[1]);

    if (op == 0) setPos(pos0, pos1);
    else {
      dim0 = Math.max(dim0, 320);
      dim1 = Math.max(dim1, 320);
      pos0 = posP[0] + Math.min(vec[0], 0) * (dim0 - dimP[0]);
      pos1 = posP[1] + Math.min(vec[1], 0) * (dim1 - dimP[1]);
      setPos(pos0, pos1);
      setDim(dim0, dim1);
    }
  };

  const closeDrag = () => {
    document.onmouseup = null;
    document.onmousemove = null;

    var action = {
      type: props.app,
      payload: "resize",
      dim: {
        width: getComputedStyle(wnapp).width,
        height: getComputedStyle(wnapp).height,
        top: getComputedStyle(wnapp).top,
        left: getComputedStyle(wnapp).left,
      },
    };

    dispatch(action);

    /* keep transitions OFF until the reducer's dim has actually landed on
       the window — restoring them before the state commit made the 250ms
       window transition replay the final size change, so every resize
       ended with a visible jump/"animation". Two frames: commit, paint,
       then transitions are safe again (snap/maximize still animates). */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        wnapp.classList.remove("notrans");
        wnapp.classList.remove("z9900");
      }),
    );
  };

  return (
    <>
      <div
        className="toolbar"
        data-float={props.float != null}
        data-noinvert={props.noinvert != null}
        style={{
          background: props.bg,
        }}
      >
        <div
          className="topInfo flex flex-grow items-center"
          data-float={props.float != null}
          onClick={toolClick}
          onMouseDown={toolDrag}
          data-op="0"
        >
          <Icon src={props.icon} width={14} />
          <div className="appFullName text-xss" data-white={props.invert != null}>
            {props.name}
          </div>
        </div>
        <div className="actbtns flex items-center">
          <Icon
            invert={props.invert}
            click={props.app}
            payload="mnmz"
            pr
            src="minimize"
            ui
            width={12}
          />
          <div
            className="snapbox h-full"
            data-hv={snap}
            onMouseOver={openSnap}
            onMouseLeave={closeSnap}
          >
            <Icon
              invert={props.invert}
              click={props.app}
              ui
              pr
              width={12}
              payload="mxmz"
              src={props.size == "full" ? "maximize" : "maxmin"}
            />
            <SnapScreen invert={props.invert} app={props.app} snap={snap} closeSnap={closeSnap} />
            {/* {snap?<SnapScreen app={props.app} closeSnap={closeSnap}/>:null} */}
          </div>
          <Icon
            className="closeBtn"
            invert={props.invert}
            click={props.app}
            payload="close"
            pr
            src="close"
            ui
            width={14}
            onClick={
              props.onClose
                ? (e) => {
                    e.stopPropagation();
                    props.onClose();
                  }
                : undefined
            }
          />
        </div>
      </div>
      <div className="resizecont topone">
        <div className="flex">
          <div
            className="conrsz cursor-nw-resize"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="-1,-1"
          ></div>
          <div
            className="edgrsz cursor-n-resize wdws"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="-1,0"
          ></div>
        </div>
      </div>
      <div className="resizecont leftone">
        <div className="h-full">
          <div
            className="edgrsz cursor-w-resize hdws"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="0,-1"
          ></div>
        </div>
      </div>
      <div className="resizecont rightone">
        <div className="h-full">
          <div
            className="edgrsz cursor-w-resize hdws"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="0,1"
          ></div>
        </div>
      </div>
      <div className="resizecont bottomone">
        <div className="flex">
          <div
            className="conrsz cursor-ne-resize"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="1,-1"
          ></div>
          <div
            className="edgrsz cursor-n-resize wdws"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="1,0"
          ></div>
          <div
            className="conrsz cursor-nw-resize"
            data-op="1"
            onMouseDown={toolDrag}
            data-vec="1,1"
          ></div>
        </div>
      </div>
    </>
  );
};

export const LazyComponent = ({ show, children }) => {
  const [loaded, setLoad] = useState(false);

  useEffect(() => {
    if (show && !loaded) setLoad(true);
  }, [show]);

  return show || loaded ? <>{children}</> : null;
};

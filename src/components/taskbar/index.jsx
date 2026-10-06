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

import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Icon } from "../../utils/general";
import Battery from "../shared/Battery";
import "./taskbar.scss";

const Taskbar = () => {
  const tasks = useSelector((state) => {
    return state.taskbar;
  });
  const rawApps = useSelector(state => state.apps);
  const apps = useMemo(() => {
    const pinned = new Set(tasks.apps.map(app => app.icon));
    return Object.fromEntries(Object.entries(rawApps).map(([key, app]) =>
      [key, typeof app === "object" && app ? {...app, task: pinned.has(key)} : app]));
  }, [rawApps, tasks.apps]);
  const dispatch = useDispatch();

  const showPrev = (event) => {
    var ele = event.target;
    while (ele && ele.getAttribute("value") == null) {
      ele = ele.parentElement;
    }

    var appPrev = ele.getAttribute("value");
    var xpos = window.scrollX + ele.getBoundingClientRect().left;

    var offsetx = Math.round((xpos * 10000) / window.innerWidth) / 100;

    dispatch({
      type: "TASKPSHOW",
      payload: {
        app: appPrev,
        pos: offsetx,
      },
    });
  };

  const hidePrev = () => {
    dispatch({ type: "TASKPHIDE" });
  };

  const clickDispatch = (event) => {
    var action = {
      type: event.target.dataset.action,
      payload: event.target.dataset.payload,
    };

    if (action.type) {
      dispatch(action);
    }
  };

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="taskbar">
      <div className="taskcont">
        <div className="tasksCont" data-menu="task" data-side={tasks.align}>
          <div className="tsbar" onMouseOut={hidePrev}>
            <Icon className="tsIcon" src="home" width={24} click="STARTOGG" />
            {tasks.search ? (
              <Icon click="STARTSRC" className="tsIcon searchIcon" icon="taskSearch" />
            ) : null}
            {tasks.widgets ? (
              <Icon className="tsIcon widget" src="widget" width={24} click="WIDGTOGG" />
            ) : null}
            {tasks.apps.map((task, i) => {
              var isHidden = apps[task.icon].hide;
              var isActive = apps[task.icon].z == apps.hz;
              return (
                <div
                  key={i}
                  onMouseOver={(!isActive && !isHidden && showPrev) || null}
                  value={task.icon}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/x-wos-app",
                      apps[task.icon]?.name || task.icon,
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <Icon
                    className="tsIcon"
                    width={24}
                    open={isHidden ? null : true}
                    click={task.action}
                    active={isActive}
                    payload="togg"
                    src={task.icon}
                    menu="taskapp"
                    data-action={task.action}
                    data-icon={task.icon}
                  />
                </div>
              );
            })}
            {Object.keys(apps).map((key, i) => {
              if (key != "hz") {
                var isActive = apps[key].z == apps.hz;
              }
              return key != "hz" && key != "undefined" && !apps[key].task && !apps[key].hide ? (
                <div key={i} onMouseOver={(!isActive && showPrev) || null} value={apps[key].icon}>
                  <Icon
                    className="tsIcon"
                    width={24}
                    active={isActive}
                    click={apps[key].action}
                    payload="togg"
                    open="true"
                    src={apps[key].icon}
                    menu="taskapp"
                    data-action={apps[key].action}
                    data-icon={apps[key].icon}
                  />
                </div>
              ) : null;
            })}
          </div>
        </div>
        <div className="taskright">
          <div
            className="px-2 prtclk handcr hvlight flex"
            onClick={clickDispatch}
            data-action="BANDTOGG"
          >
            <Icon fafa="faChevronUp" width={10} />
          </div>
          <div
            className="prtclk handcr my-1 px-1 hvlight flex rounded"
            onClick={clickDispatch}
            data-action="PANETOGG"
          >
            <Icon className="taskIcon" src="wifi" ui width={16} />
            <Icon className="taskIcon" src={"audio" + tasks.audio} ui width={16} />
            <Battery />
          </div>

          <div
            className="taskDate m-1 handcr prtclk rounded hvlight"
            onClick={clickDispatch}
            data-action="CALNTOGG"
          >
            <div>
              {time.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "numeric",
              })}
            </div>
            <div>
              {time.toLocaleDateString("en-US", {
                year: "2-digit",
                month: "2-digit",
                day: "numeric",
              })}
            </div>
          </div>
          <Icon className="graybd my-4" ui width={6} click="SHOWDSK" pr />
        </div>
      </div>
    </div>
  );
};

export default Taskbar;

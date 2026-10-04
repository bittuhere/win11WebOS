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

const defState = {
  quicks: [
    {
      ui: true,
      src: "wifi",
      name: "WiFi",
      state: "network.wifi.state",
      action: "STNGTOGG",
    },
    {
      ui: true,
      src: "bluetooth",
      name: "Bluetooth",
      state: "devices.bluetooth",
      action: "STNGTOGG",
    },
    {
      ui: true,
      src: "airplane",
      name: "Flight Mode",
      state: "network.airplane",
      action: "flightMode",
    },
    {
      ui: true,
      src: "saver",
      name: "Battery Saver",
      state: "system.power.saver.state",
      action: "STNGTOGG",
    },
    {
      ui: true,
      src: "sun",
      name: "Theme",
      state: "person.theme",
      action: "changeTheme",
    },
    {
      ui: true,
      src: "nightlight",
      name: "Night Light",
      state: "system.display.nightlight.state",
      action: "STNGTOGG",
    },
  ],
  hide: true,
  banhide: true,
  calhide: true,
};

const paneReducer = (state = defState, action) => {
  if (action.type == "PANETHEM") {
    var tmpState = { ...state };
    tmpState.quicks[4].src = action.payload;
    return tmpState;
  } else if (action.type == "BANDTOGG") {
    return { ...state, banhide: !state.banhide };
  } else if (action.type == "BANDHIDE") {
    return { ...state, banhide: true };
  } else if (action.type == "PANETOGG") {
    return { ...state, hide: !state.hide };
  } else if (action.type == "PANEHIDE") {
    return { ...state, hide: true };
  } else if (action.type == "CALNTOGG") {
    return { ...state, calhide: !state.calhide };
  } else if (action.type == "CALNHIDE") {
    return { ...state, calhide: true };
  } else {
    return state;
  }
};

export default paneReducer;

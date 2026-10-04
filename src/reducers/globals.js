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
  run: false,
  lays: [
    [
      {
        dim: {
          width: "50%",
          height: "100%",
          top: 0,
          left: 0,
        },
        br: 14,
      },
      {
        dim: {
          width: "50%",
          height: "100%",
          top: 0,
          left: "50%",
        },
        br: 15,
      },
    ],
    [
      {
        dim: {
          width: "66%",
          height: "100%",
          top: 0,
          left: 0,
        },
        br: 14,
      },
      {
        dim: {
          width: "34%",
          height: "100%",
          top: 0,
          left: "66%",
        },
        br: 15,
      },
    ],
    [
      {
        dim: {
          width: "33%",
          height: "100%",
          top: 0,
          left: 0,
        },
        br: 14,
      },
      {
        dim: {
          width: "34%",
          height: "100%",
          top: 0,
          left: "33%",
        },
        br: 1,
      },
      {
        dim: {
          width: "33%",
          height: "100%",
          top: 0,
          left: "67%",
        },
        br: 15,
      },
    ],
    [
      {
        dim: {
          width: "50%",
          height: "100%",
          top: 0,
          left: 0,
        },
        br: 14,
      },
      {
        dim: {
          width: "50%",
          height: "50%",
          top: 0,
          left: "50%",
        },
        br: 3,
      },
      {
        dim: {
          width: "50%",
          height: "50%",
          top: "50%",
          left: "50%",
        },
        br: 5,
      },
    ],
    [
      {
        dim: {
          width: "50%",
          height: "50%",
          top: 0,
          left: 0,
        },
        br: 2,
      },
      {
        dim: {
          width: "50%",
          height: "50%",
          top: 0,
          left: "50%",
        },
        br: 3,
      },
      {
        dim: {
          width: "50%",
          height: "50%",
          top: "50%",
          left: 0,
        },
        br: 7,
      },
      {
        dim: {
          width: "50%",
          height: "50%",
          top: "50%",
          left: "50%",
        },
        br: 5,
      },
    ],
    [
      {
        dim: {
          width: "25%",
          height: "100%",
          top: 0,
          left: 0,
        },
        br: 14,
      },
      {
        dim: {
          width: "50%",
          height: "100%",
          top: 0,
          left: "25%",
        },
        br: 1,
      },
      {
        dim: {
          width: "25%",
          height: "100%",
          top: 0,
          left: "75%",
        },
        br: 15,
      },
    ],
  ],
  ribbon: [
    "luca",
    "essential apps",
    "xbox gamepass",
    "social media",
    "security",
    "utility apps",
    "forza horizon",
    "kids apps",
  ],
  apprib: ["netflix", "whatsApp", "telegram", "facebook", "amazon prime", "office", "lightroom"],
  gamerib: [
    "call of duty",
    "cyberpunk 2077",
    "minecraft",
    "battle field v",
    "far cry 5",
    "hitman 3",
    "residental evil",
  ],
  movrib: [
    "antman",
    "godzilla vs kong",
    "tom and jerry",
    "wrath of man",
    "john wick",
    "wonder woman 1984",
    "nobody",
  ],
};

const globalReducer = (state = defState, action) => {
  switch (action.type) {
    case "RUNSHOW":
      return { ...state, run: true };
    case "RUNHIDE":
      return { ...state, run: false };
    default:
      return state;
  }
};

export default globalReducer;

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

/**
 * Hand-drawn SVG marks for the four browsers the OOBE offers.
 * Kept inline (no network, no binary assets) so they render in every theme
 * and survive an offline install.
 */

export const ChromeLogo = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Google Chrome">
    <defs>
      <clipPath id="chr-clip">
        <circle cx="24" cy="24" r="22" />
      </clipPath>
      <linearGradient id="chr-red" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f06b59" />
        <stop offset="100%" stopColor="#df4a32" />
      </linearGradient>
      <linearGradient id="chr-green" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3aa84f" />
        <stop offset="100%" stopColor="#189b3b" />
      </linearGradient>
      <linearGradient id="chr-yellow" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffd245" />
        <stop offset="100%" stopColor="#f7c617" />
      </linearGradient>
    </defs>
    <g clipPath="url(#chr-clip)">
      <path d="M2 2h44v14H27.5L16 24z" fill="url(#chr-red)" />
      <path d="M2 16h24l-8 14L24 46H2z" fill="url(#chr-green)" />
      <path d="M26 16h20v30H24l6-16z" fill="url(#chr-yellow)" />
    </g>
    <circle cx="24" cy="24" r="11" fill="#fff" />
    <circle cx="24" cy="24" r="8.6" fill="#1a73e8" />
    <circle cx="24" cy="24" r="8.6" fill="url(#chr-blue)" />
    <defs>
      <radialGradient id="chr-blue" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#4c9bf5" />
        <stop offset="100%" stopColor="#1558d6" />
      </radialGradient>
    </defs>
  </svg>
);

export const EdgeLogo = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Microsoft Edge">
    <defs>
      <linearGradient id="edg-a" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stopColor="#35c1f1" />
        <stop offset="45%" stopColor="#0f82d4" />
        <stop offset="100%" stopColor="#0b5aa8" />
      </linearGradient>
      <linearGradient id="edg-b" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#0a4f92" />
        <stop offset="60%" stopColor="#1f7ec2" />
        <stop offset="100%" stopColor="#41b6e6" />
      </linearGradient>
      <linearGradient id="edg-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#b8f0ff" />
        <stop offset="100%" stopColor="#4cc7f0" />
      </linearGradient>
    </defs>
    <path
      d="M24 3C12.4 3 3 12.4 3 24c0 5.4 2 10.3 5.4 14C6.6 34 6.9 27.6 12 23.4c4.6-3.8 11.4-4.2 15.6-.6-3.4-4.6-9.6-6.6-15.4-4.6C15.6 8.6 24.4 5.6 31.8 9.4 36.4 11.8 39.6 16 41 21c1.3-2 2-4.4 2-7C43 8.4 34.6 3 24 3z"
      fill="url(#edg-a)"
    />
    <path
      d="M44.6 22.4c-.4 8.2-5.4 14.4-13.2 17.2-6.6 2.4-14.6 1.2-19.6-3.6-3-2.9-4.6-6.6-4.4-10.6.4 6.6 5.8 11.4 12.4 11.4 4.4 0 8.4-2 11.2-5.4 2.6-3.2 4.2-7 5-11.4 1.6 2.4 4.4 3.4 6.6 2.6.9-.3 1.5-.8 2-1.6z"
      fill="url(#edg-b)"
    />
    <path
      d="M42.8 20.8c-2.6 1.6-5.8 1-7.4-1.4-1-1.5-1.2-3.4-.6-5-1.8 3.2-5 5.4-8.8 5.8-4.6.5-8.8-2.2-10.4-6.4 2.4 3.4 6.8 4.8 10.8 3.4 4.4-1.6 7.4-5.8 8.4-10.4 1.6 4.4 5.6 7.4 10.2 7.6 1.6 2 2.6 4.2 2.8 6.4z"
      fill="url(#edg-c)"
      opacity="0.95"
    />
  </svg>
);

export const FirefoxLogo = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Mozilla Firefox">
    <defs>
      <radialGradient id="ff-tail" cx="30%" cy="80%" r="85%">
        <stop offset="0%" stopColor="#ffe063" />
        <stop offset="38%" stopColor="#f5952a" />
        <stop offset="72%" stopColor="#e2521c" />
        <stop offset="100%" stopColor="#8a1f6b" />
      </radialGradient>
      <radialGradient id="ff-globe" cx="38%" cy="34%" r="72%">
        <stop offset="0%" stopColor="#63d3ff" />
        <stop offset="55%" stopColor="#2a86e6" />
        <stop offset="100%" stopColor="#1b3fa0" />
      </radialGradient>
      <linearGradient id="ff-flame" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff3a3" />
        <stop offset="55%" stopColor="#ffb03a" />
        <stop offset="100%" stopColor="#f2621f" />
      </linearGradient>
    </defs>
    <path
      d="M40.8 17.4C38.6 11.4 32.6 6.4 25 6.4c-1.4 0-2.8.2-4.1.5 1.5.6 3 1.5 4.3 2.6-8-1-13.6 2.6-16.2 8.2C7 15.2 6.2 12 6.2 12s-2 4.6-2 10.4c0 1.4.1 2.7.3 4C4.2 25.6 4 24.8 4 24c0 11 9 20 20 20s20-9 20-20c0-2.3-.4-4.5-1.1-6.6z"
      fill="url(#ff-tail)"
    />
    <path
      d="M24 12.4c6.4 0 11.6 5.2 11.6 11.6S30.4 35.6 24 35.6 12.4 30.4 12.4 24 17.6 12.4 24 12.4z"
      fill="url(#ff-globe)"
    />
    <path
      d="M33.4 15.6c1.6 2.6 2.6 5.6 2.6 8.8 0 6.6-5.4 12-12 12-4.6 0-8.6-2.6-10.6-6.4.2 6.6 5.6 11.8 12.2 11.8 6.8 0 12.2-5.4 12.2-12.2 0-5.2-3.2-9.6-7.8-11.4 1.4-.4 2.4-1.4 3.4-2.6z"
      fill="url(#ff-flame)"
      opacity="0.92"
    />
    <path
      d="M18.6 8.6c1.8.4 3.4 1.2 4.8 2.2-2.2.4-4 1.4-5.4 2.8-2-1.4-2.6-3.6-2.2-5.4 1 .2 1.9.3 2.8.4z"
      fill="#fff2b0"
      opacity="0.85"
    />
  </svg>
);

export const SafariLogo = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Apple Safari">
    <defs>
      <radialGradient id="sf-bg" cx="50%" cy="38%" r="70%">
        <stop offset="0%" stopColor="#4dd2ff" />
        <stop offset="60%" stopColor="#1a9ce8" />
        <stop offset="100%" stopColor="#0b62c4" />
      </radialGradient>
      <linearGradient id="sf-face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e7f3fb" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="#f2f4f6" />
    <circle cx="24" cy="24" r="19.6" fill="url(#sf-bg)" />
    <circle cx="24" cy="24" r="15" fill="url(#sf-face)" />
    <g stroke="#8fb6cf" strokeWidth="1" strokeLinecap="round">
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * Math.PI) / 12;
        const r1 = i % 2 === 0 ? 12.4 : 13.4;
        return (
          <line
            key={i}
            x1={24 + Math.sin(a) * r1}
            y1={24 - Math.cos(a) * r1}
            x2={24 + Math.sin(a) * 14.4}
            y2={24 - Math.cos(a) * 14.4}
          />
        );
      })}
    </g>
    <g transform="rotate(45 24 24)">
      <path d="M24 12.6L27 24L24 35.4L21 24Z" fill="#ff3b30" />
      <path d="M24 12.6L27 24H21Z" fill="#ff3b30" />
      <path d="M24 35.4L21 24H27Z" fill="#f2f4f6" />
    </g>
    <circle cx="24" cy="24" r="1.5" fill="#3a4a55" />
  </svg>
);

export const BROWSER_LOGOS = {
  chrome: ChromeLogo,
  edge: EdgeLogo,
  firefox: FirefoxLogo,
  safari: SafariLogo,
};

export default BROWSER_LOGOS;

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

import { readFileSync } from "fs";
import { defineConfig } from "vite";

/* CONTROL.env — the user's build-time switches (colon format: `KEY: VALUE`).
   Defaults ship OFF/empty so a fork without the file behaves politely. */
const readControl = () => {
  const out = { ES: "OFF", EMAIL: "" };
  try {
    for (const line of readFileSync("CONTROL.env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch (e) {}
  return out;
};
import react from "@vitejs/plugin-react";

const config = ({ mode }) => {
  return defineConfig({
    define: {
      __WOS_BRAND_SVG__: JSON.stringify(readFileSync("public/favicon.svg", "utf8")),
      __WOS_CONTROL__: JSON.stringify(readControl()),
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    plugins: [
      react(),

      {
        /* ----------------------------------------------------------------
         * /webos-proxy — same-origin page relay (dev server only).
         *
         * The Edge app prefers the WebOS Browser Helper extension, but when
         * it is absent (or the user still has the old v1.0 folder loaded)
         * browsing should still work: the dev server has no CORS limits, so
         * it fetches the page and hands it back as JSON — same shape the
         * extension's background returns.
         * ---------------------------------------------------------------- */
        name: "webos-proxy",
        configureServer(server) {
          server.middlewares.use("/webos-proxy", async (req, res) => {
            const q = new URL(req.url, "http://x");
            const target = q.searchParams.get("url");
            const asB64 = q.searchParams.get("b64") === "1";
            if (!target || !/^https?:\/\//i.test(target)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, status: 0, error: "bad url" }));
              return;
            }
            const ac = new AbortController();
            const kill = setTimeout(() => ac.abort(), 20000);
            try {
              const upstream = await fetch(target, {
                redirect: "follow",
                signal: ac.signal,
                headers: {
                  Accept: "*/*",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
                },
              });
              const ctype = upstream.headers.get("content-type") || "";
              const isText = /text\/|json|xml|javascript|html|svg|csv/i.test(ctype) && !asB64;
              const MAX = 8 * 1024 * 1024;
              let body;
              let binary = false;
              if (isText) {
                const text = await upstream.text();
                body = text.length > MAX ? text.slice(0, MAX) : text;
              } else {
                binary = true;
                const buf = Buffer.from(await upstream.arrayBuffer()).subarray(0, MAX);
                body = buf.toString("base64");
              }
              const csp = upstream.headers.get("content-security-policy") || "";
              const frameAncestors = (csp.match(/frame-ancestors[^;]*/i) || [""])[0];
              const xfo = upstream.headers.get("x-frame-options") || "";
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: upstream.ok,
                  status: upstream.status,
                  statusText: upstream.statusText,
                  contentType: ctype,
                  finalUrl: upstream.url || target,
                  binary,
                  body,
                  headers: { xfo, csp: frameAncestors },
                  frameBlocked:
                    /deny|sameorigin/i.test(xfo) ||
                    /frame-ancestors\s+'none'|frame-ancestors\s+'self'/i.test(csp),
                  relay: "webos-proxy",
                }),
              );
            } catch (err) {
              const msg = String((err && err.message) || err);
              const cause = String(
                (err && err.cause && (err.cause.code || err.cause.message)) || "",
              );
              const all = (msg + " " + cause).toLowerCase();
              let kind = "network";
              if (/enotfound|err_name_not_resolved|nxdomain|dns/.test(all)) kind = "dns";
              else if (/econnrefused|err_connection_refused|refused/.test(all)) kind = "refused";
              else if (/timeout|abort|timedout/i.test(all)) kind = "timeout";
              let code = cause || msg;
              if (/enotfound/i.test(all)) code = "ERR_NAME_NOT_RESOLVED";
              else if (/econnrefused/i.test(all)) code = "ERR_CONNECTION_REFUSED";
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  status: 0,
                  error: msg,
                  kind,
                  code: String(code).slice(0, 120),
                  relay: "webos-proxy",
                }),
              );
            } finally {
              clearTimeout(kill);
            }
          });
        },
      },
    ],
    /* relative base: the same build works at the domain root, on a GitHub
       Pages project path (/win11WebOS/) and inside a folder on any host */
    base: "./",
    server: {
      host: "0.0.0.0",
      allowedHosts: ["localhost", ".e2b.app"],
      port: 5173,
      proxy: {
        "/api/bing-search": {
          target: "https://www.bing.com",
          changeOrigin: true,
          rewrite: (path) => {
            const q = new URLSearchParams(path.split("?")[1] || "").get("q") || "";
            return "/search?format=rss&q=" + encodeURIComponent(q);
          },
        },
        "/api/gsuggest": {
          target: "https://suggestqueries.google.com",
          changeOrigin: true,
          rewrite: (path) => {
            const q = new URLSearchParams(path.split("?")[1] || "").get("q") || "";
            return "/complete/search?client=firefox&q=" + encodeURIComponent(q);
          },
        },
        "/api/bing-suggest": {
          target: "https://api.bing.com",
          changeOrigin: true,
          rewrite: (path) => {
            const q = new URLSearchParams(path.split("?")[1] || "").get("q") || "";
            return "/osjson.aspx?query=" + encodeURIComponent(q);
          },
        },
      },
    },
    build: {
      outDir: "build",
      /* no production source maps: they expose the whole tree for no benefit */
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name].[hash].js",
          chunkFileNames: "assets/[name].[hash].js",
          assetFileNames: "assets/[name].[hash][extname]",
          manualChunks: (id) => id.includes("node_modules") ? "vendor" : undefined,
        },
      },
    },
  });
};

export default config;

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

const { chromium } = require('playwright-core');
const EXE = '/home/user/.local/share/choreographer/deps/chrome-linux64/chrome';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 800 } });
  page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 250)));
  await page.goto('http://localhost:8001/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const out = {};
    // step 1: what does parseInput say?
    out.parsed = X.parseInput('=4.3-4.2');
    // step 2: instrument commitCell internals via a manual clone of its logic
    let captured = null;
    const origEnsure = X.cellEnsure;
    X.cellEnsure = (r, c) => { const cd = origEnsure(r, c); captured = cd; return cd; };
    out.ret = X.commitCell(1, 0, '=4.3-4.2');
    X.cellEnsure = origEnsure;
    out.afterCommit = captured && JSON.stringify({ v: captured.v, t: captured.t, num: captured.num });
    // step 3: same-cell follow-up read back
    const cd = X.cellGet(1, 0);
    out.readBack = cd && JSON.stringify({ v: cd.v, t: cd.t, num: cd.num });
    out.disp = (X.cellDisplay(1, 0) || {}).text;
    out.recalcType = typeof X.recalcAll;
    // step 4: try with another fresh cell
    out.ret2 = X.commitCell(5, 0, '=1+1');
    const cd2 = X.cellGet(5, 0);
    out.readBack2 = cd2 && JSON.stringify({ v: cd2.v, t: cd2.t, num: cd2.num });
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });

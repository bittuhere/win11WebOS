/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ==========================================================================
   New-document templates (File > New)
   ========================================================================== */
window.TEMPLATES = [
  {
    id: 'blank', name: 'Blank document', sub: 'A clean slate',
    thumb: '',
    html: '<p><br></p>',
  },
  {
    id: 'notes', name: 'Take a tour', sub: 'See what this editor can do',
    thumb: 'tour',
    html:
      '<h1>Welcome to your document</h1>' +
      '<p>This document behaves like the real thing. Try a few things:</p>' +
      '<ul><li>Select this line and press <b>Bold</b>, <i>Italic</i> or <u>Underline</u>.</li>' +
      '<li>Use the <b>Styles gallery</b> to turn a line into Heading 1 or Title.</li>' +
      '<li>Press <b>Ctrl+F</b> to search, or <b>Ctrl+H</b> to replace text.</li>' +
      '<li>Insert a table from the Insert tab, then press Tab to add rows.</li>' +
      '<li>Open File, then Save As to download a real Word (.docx) file.</li></ul>' +
      '<h2>Everything is editable</h2>' +
      '<blockquote>This is a Quote style. It handles margins, page breaks and printing just like Word.</blockquote>' +
      '<p>Type past the bottom of the page and a new page appears automatically.</p>',
  },
  {
    id: 'report', name: 'Executive report', sub: 'Title, headings and a table',
    thumb: 'report',
    html:
      '<p class="sty-title">Quarterly Business Review</p>' +
      '<p class="sty-subtitle">Prepared for the leadership team</p>' +
      '<h1>Overview</h1>' +
      '<p>This report summarizes performance across all regions for the current quarter. Revenue grew steadily while operating costs remained flat.</p>' +
      '<h1>Key Results</h1>' +
      '<table><tbody>' +
      '<tr><td>Region</td><td>Revenue</td><td>Growth</td></tr>' +
      '<tr><td>North</td><td>1,240,000</td><td>8.2%</td></tr>' +
      '<tr><td>South</td><td>980,000</td><td>5.1%</td></tr>' +
      '<tr><td>West</td><td>1,420,000</td><td>11.4%</td></tr>' +
      '</tbody></table>' +
      '<h2>Next Steps</h2>' +
      '<p>Continue investment in the West region and review the supply chain plan for Q3.</p>',
  },
  {
    id: 'resume', name: 'Resume', sub: 'A simple, clean resume',
    thumb: 'resume',
    html:
      '<p class="sty-title" style="font-size:28px">Alex Morgan</p>' +
      '<p style="margin-bottom:2px">Patna, Bihar &nbsp;|&nbsp; alex@example.com &nbsp;|&nbsp; +91 90000 00000</p>' +
      '<h2 style="border-bottom:1px solid #A6A6A6;padding-bottom:2px">Experience</h2>' +
      '<p style="margin-bottom:2px"><b>Product Designer</b> — Example Corp</p>' +
      '<p style="margin-bottom:6px;color:#5A5A5A">2021 — Present</p>' +
      '<ul><li>Led redesign of the core editor, raising retention 18%.</li><li>Built a design system used by 6 teams.</li></ul>' +
      '<h2 style="border-bottom:1px solid #A6A6A6;padding-bottom:2px">Education</h2>' +
      '<p><b>B.Tech, Computer Science</b> — IIT Patna</p>',
  },
];

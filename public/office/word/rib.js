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
   Ribbon model: tabs -> groups -> items (pure data; app.js binds behavior)
   Item types:
     big      large 32px button, optional menu (whole-button or split)
     sm       small button in a stack
     stack    vertical stack of sm items
     rows     custom rows of compact icon buttons (Font/Paragraph groups)
     combo    font/size combos
     color    icon button with color bar + palette dropdown
     gallery  styles quick gallery
     custom   app.js custom builders
   ========================================================================== */
window.RIBBON = [
  {
    id: 'home', label: 'Home',
    groups: [
      { label: 'Clipboard', items: [
        { t: 'big', id: 'paste', icon: 'paste', label: 'Paste', menu: 'pasteMenu', split: true },
        { t: 'stack', items: [
          { t: 'sm', id: 'cut', icon: 'cut', label: 'Cut' },
          { t: 'sm', id: 'copy', icon: 'copy', label: 'Copy' },
          { t: 'sm', id: 'fpainter', icon: 'fpainter', label: 'Format Painter' },
        ]},
      ]},
      { label: 'Font', launch: 'fontDlg', items: [
        { t: 'rows', rows: [
          [
            { t: 'combo', id: 'font' },
            { t: 'combo', id: 'size' },
            { t: 'ic', id: 'growfont', icon: 'growfont', label: 'Grow Font' },
            { t: 'ic', id: 'shrinkfont', icon: 'shrinkfont', label: 'Shrink Font' },
            { t: 'ic', id: 'changecase', icon: 'fonts', label: 'Change Case', menu: 'caseMenu' },
            { t: 'ic', id: 'clearfmt', icon: 'clearfmt', label: 'Clear All Formatting' },
          ],
          [
            { t: 'ic', id: 'bold', icon: 'bold', label: 'Bold (Ctrl+B)', toggle: 'bold' },
            { t: 'ic', id: 'italic', icon: 'italic', label: 'Italic (Ctrl+I)', toggle: 'italic' },
            { t: 'ic', id: 'under', icon: 'under', label: 'Underline (Ctrl+U)', toggle: 'underline', menu: 'underMenu', split: true },
            { t: 'ic', id: 'strike', icon: 'strike', label: 'Strikethrough', toggle: 'strikeThrough' },
            { t: 'ic', id: 'sub', icon: 'sub', label: 'Subscript', toggle: 'subscript' },
            { t: 'ic', id: 'sup', icon: 'sup', label: 'Superscript', toggle: 'superscript' },
            { t: 'ic', id: 'effects', icon: 'effects', label: 'Text Effects and Typography', menu: 'effectsMenu' },
            { t: 'color', id: 'highlight', icon: 'marker', label: 'Text Highlight Color', def: '#FFFF00' },
            { t: 'color', id: 'fontcolor', icon: 'achar', label: 'Font Color', def: '#C00000' },
          ],
        ]},
      ]},
      { label: 'Paragraph', launch: 'paraDlg', items: [
        { t: 'rows', rows: [
          [
            { t: 'ic', id: 'bullets', icon: 'bullets', label: 'Bullets', menu: 'bulletMenu' },
            { t: 'ic', id: 'numbering', icon: 'numbering', label: 'Numbering', menu: 'numberMenu' },
            { t: 'ic', id: 'multilevel', icon: 'multilevel', label: 'Multilevel List', menu: 'multiMenu' },
            { t: 'ic', id: 'outdent', icon: 'outdent', label: 'Decrease Indent' },
            { t: 'ic', id: 'indent', icon: 'indent', label: 'Increase Indent' },
            { t: 'ic', id: 'sort', icon: 'sort', label: 'Sort' },
            { t: 'ic', id: 'pilcrow', icon: 'pilcrow', label: 'Show/Hide Paragraph Marks (Ctrl+Shift+8)', toggle: 'pilcrow' },
          ],
          [
            { t: 'ic', id: 'alignl', icon: 'alignl', label: 'Align Left (Ctrl+L)', toggle: 'justifyLeft' },
            { t: 'ic', id: 'alignc', icon: 'alignc', label: 'Center (Ctrl+E)', toggle: 'justifyCenter' },
            { t: 'ic', id: 'alignr', icon: 'alignr', label: 'Align Right (Ctrl+R)', toggle: 'justifyRight' },
            { t: 'ic', id: 'alignj', icon: 'alignj', label: 'Justify (Ctrl+J)', toggle: 'justifyFull' },
            { t: 'ic', id: 'linesp', icon: 'linesp', label: 'Line and Paragraph Spacing', menu: 'lineSpaceMenu' },
            { t: 'color', id: 'shading', icon: 'bucket', label: 'Shading', def: '#FBE2D5' },
            { t: 'ic', id: 'border', icon: 'border', label: 'Borders', menu: 'borderMenu' },
          ],
        ]},
      ]},
      { label: 'Styles', launch: 'stylesMore', items: [
        { t: 'gallery' },
      ]},
      { label: 'Editing', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'find', icon: 'search', label: 'Find' },
          { t: 'sm', id: 'findreplace', icon: 'replace', label: 'Replace' },
          { t: 'sm', id: 'sele', icon: 'selectall', label: 'Select', menu: 'selectMenu' },
        ]},
      ]},
    ],
  },
  {
    id: 'insert', label: 'Insert',
    groups: [
      { label: 'Pages', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'coverpage', icon: 'coverpage', label: 'Cover Page' },
          { t: 'sm', id: 'blankpage', icon: 'blankpage', label: 'Blank Page' },
          { t: 'sm', id: 'pagebreak', icon: 'pagebreak', label: 'Page Break' },
        ]},
      ]},
      { label: 'Tables', items: [
        { t: 'big', id: 'table', icon: 'table', label: 'Table', menu: 'tableMenu' },
      ]},
      { label: 'Illustrations', items: [
        { t: 'big', id: 'pictures', icon: 'picture', label: 'Pictures' },
        { t: 'big', id: 'shapes', icon: 'shapeset', label: 'Shapes', menu: 'shapesMenu' },
      ]},
      { label: 'Links', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'link', icon: 'link', label: 'Link', },
          { t: 'sm', id: 'bookmark', icon: 'bookmark', label: 'Bookmark' },
        ]},
      ]},
      { label: 'Comments', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'comment', icon: 'comment', label: 'Comment' },
        ]},
      ]},
      { label: 'Header & Footer', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'header', icon: 'header', label: 'Header', menu: 'headerMenu' },
          { t: 'sm', id: 'footer', icon: 'footer', label: 'Footer', menu: 'footerMenu' },
          { t: 'sm', id: 'pageno', icon: 'pageno', label: 'Page Number', menu: 'pageNoMenu' },
        ]},
      ]},
      { label: 'Text', items: [
        { t: 'big', id: 'textbox', icon: 'textbox', label: 'Text Box' },
        { t: 'stack', items: [
          { t: 'sm', id: 'datetime', icon: 'datetime', label: 'Date & Time' },
          { t: 'sm', id: 'textfromfile', icon: 'txtfile', label: 'Text from File' },
        ]},
      ]},
      { label: 'Symbols', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'symbol', icon: 'symbol', label: 'Symbol', menu: 'symbolMenu' },
        ]},
      ]},
    ],
  },
  {
    id: 'draw', label: 'Draw',
    groups: [
      { label: 'Drawing Tools', items: [
        { t: 'custom', id: 'drawtools' },
      ]},
      { label: 'Edit', items: [
        { t: 'big', id: 'inkclear', icon: 'remove', label: 'Clear All Ink' },
      ]},
    ],
  },
  {
    id: 'design', label: 'Design',
    groups: [
      { label: 'Document Formatting', items: [
        { t: 'big', id: 'themes', icon: 'themes', label: 'Themes', menu: 'themesMenu' },
        { t: 'stack', items: [
          { t: 'sm', id: 'themecolors', icon: 'colors', label: 'Colors', menu: 'designColorsMenu' },
          { t: 'sm', id: 'themefonts', icon: 'fonts', label: 'Fonts', menu: 'designFontsMenu' },
        ]},
        { t: 'big', id: 'paraspacing', icon: 'paraspacing', label: 'Paragraph Spacing', menu: 'paraSpacingMenu' },
      ]},
      { label: 'Page Background', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'watermark', icon: 'watermark', label: 'Watermark' },
          { t: 'color', id: 'pagecolor', icon: 'pagecolor', label: 'Page Color', def: '#FFFFFF', labeled: true },
          { t: 'sm', id: 'pageborders', icon: 'pageborders', label: 'Page Borders' },
        ]},
      ]},
    ],
  },
  {
    id: 'layout', label: 'Layout',
    groups: [
      { label: 'Page Setup', launch: 'pageSetupDlg', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'margins', icon: 'margins', label: 'Margins', menu: 'marginsMenu' },
          { t: 'sm', id: 'orient', icon: 'orient', label: 'Orientation', menu: 'orientMenu' },
          { t: 'sm', id: 'size', icon: 'size', label: 'Size', menu: 'sizeMenu' },
        ]},
        { t: 'stack', items: [
          { t: 'sm', id: 'columns', icon: 'columns2', label: 'Columns', menu: 'columnsMenu' },
          { t: 'sm', id: 'breaks', icon: 'breaks', label: 'Breaks', menu: 'breaksMenu' },
        ]},
      ]},
      { label: 'Paragraph', items: [
        { t: 'custom', id: 'paraset' },
      ]},
    ],
  },
  {
    id: 'references', label: 'References',
    groups: [
      { label: 'Table of Contents', items: [
        { t: 'big', id: 'toc', icon: 'toc', label: 'Table of Contents', menu: 'tocMenu' },
        { t: 'stack', items: [
          { t: 'sm', id: 'updatetoc', icon: 'update', label: 'Update Table' },
        ]},
      ]},
      { label: 'Footnotes', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'footnote', icon: 'footnote', label: 'Insert Footnote' },
          { t: 'sm', id: 'shownotes', icon: 'search', label: 'Show Notes' },
        ]},
      ]},
      { label: 'Captions', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'caption', icon: 'caption', label: 'Insert Caption' },
        ]},
      ]},
    ],
  },
  {
    id: 'review', label: 'Review',
    groups: [
      { label: 'Proofing', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'spelling', icon: 'spelling', label: 'Spelling & Grammar' },
          { t: 'sm', id: 'wordcount', icon: 'wordcount', label: 'Word Count' },
        ]},
      ]},
      { label: 'Comments', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'newcomment', icon: 'comment', label: 'New Comment' },
          { t: 'sm', id: 'delcomment', icon: 'remove', label: 'Delete', menu: 'delCommentMenu' },
          { t: 'sm', id: 'prevcomment', icon: 'chev-up', label: 'Previous' },
          { t: 'sm', id: 'nextcomment', icon: 'chev-d', label: 'Next' },
        ]},
      ]},
    ],
  },
  {
    id: 'view', label: 'View',
    groups: [
      { label: 'Views', items: [
        { t: 'big', id: 'vread', icon: 'readmode', label: 'Read Mode' },
        { t: 'big', id: 'vprint', icon: 'printlayout', label: 'Print Layout' },
        { t: 'big', id: 'vweb', icon: 'weblayout', label: 'Web Layout' },
      ]},
      { label: 'Show', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'ruler', icon: 'ruler', label: 'Ruler', toggle: 'ruler' },
          { t: 'sm', id: 'navi', icon: 'navpane', label: 'Navigation Pane', toggle: 'navpane' },
        ]},
      ]},
      { label: 'Zoom', items: [
        { t: 'stack', items: [
          { t: 'sm', id: 'zoomdlg', icon: 'zoom', label: 'Zoom' },
          { t: 'sm', id: 'zoom100', icon: 'zoom100', label: '100%' },
          { t: 'sm', id: 'zoomwidth', icon: 'pagewidth', label: 'Page Width' },
        ]},
      ]},
    ],
  },
  {
    id: 'help', label: 'Help',
    groups: [
      { label: 'Help', items: [
        { t: 'big', id: 'help', icon: 'help', label: 'Help' },
        { t: 'stack', items: [
          { t: 'sm', id: 'feedback', icon: 'feedback', label: 'Give Feedback' },
          { t: 'sm', id: 'about', icon: 'about', label: 'About' },
        ]},
      ]},
    ],
  },
];

/* Quick-styles definitions (used by gallery + Styles commands) */
window.STYLES = [
  { id: 'normal',  name: 'Normal',       sel: 'p',  cls: '',            sample: 'AaBbCcDdEe' },
  { id: 'nosp',    name: 'No Spacing',   sel: 'p',  cls: 'sty-nosp',    sample: 'AaBbCcDdEe' },
  { id: 'h1',      name: 'Heading 1',    sel: 'h1', cls: '',            sample: 'AaBbCcDdEe' },
  { id: 'h2',      name: 'Heading 2',    sel: 'h2', cls: '',            sample: 'AaBbCcDdEe' },
  { id: 'h3',      name: 'Heading 3',    sel: 'h3', cls: '',            sample: 'AaBbCcDdEe' },
  { id: 'title',   name: 'Title',        sel: 'h1', cls: 'sty-title',   sample: 'AaBbCc' },
  { id: 'subtitle',name: 'Subtitle',     sel: 'h2', cls: 'sty-subtitle',sample: 'AaBbCcDdEe' },
  { id: 'quote',   name: 'Quote',        sel: 'blockquote', cls: '',    sample: 'AaBbCcDdEe' },
  { id: 'iquote',  name: 'Intense Quote',sel: 'blockquote', cls: 'sty-iquote', sample: 'AaBbCcDdEe' },
];

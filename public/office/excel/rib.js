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

/* Ribbon configuration: Excel 2016 tabs → groups → controls */
window.RIBBON = [
  { id: 'home', label: 'Home', groups: [
    { label: 'Clipboard', items: [
      { t: 'big', id: 'paste', icon: 'paste', label: 'Paste', split: true, menu: 'pasteMenu' },
      { t: 'stack', items: [
        { t: 'sm', id: 'cut', icon: 'cut', label: 'Cut' },
        { t: 'sm', id: 'copy', icon: 'copy', label: 'Copy' },
        { t: 'sm', id: 'painter', icon: 'fpainter', label: 'Format Painter' },
      ]},
    ]},
    { label: 'Font', custom: 'fontgrp' },
    { label: 'Alignment', custom: 'aligngrp' },
    { label: 'Number', custom: 'numgrp' },
    { label: 'Styles', items: [
      { t: 'big', id: 'condfmt', icon: 'condfmt', label: 'Conditional\nFormatting', menu: 'condFmtMenu' },
      { t: 'big', id: 'formattbl', icon: 'formattbl', label: 'Format as\nTable', menu: 'tableStyleMenu' },
      { t: 'big', id: 'cellstyles', icon: 'cellstyles', label: 'Cell\nStyles', menu: 'cellStyleMenu' },
    ]},
    { label: 'Cells', items: [
      { t: 'big', id: 'insertcells', icon: 'insertcells', label: 'Insert', split: true, menu: 'insertMenu' },
      { t: 'big', id: 'deletecells', icon: 'deletecells', label: 'Delete', split: true, menu: 'deleteMenu' },
      { t: 'big', id: 'formatcellsbtn', icon: 'formatcells', label: 'Format', menu: 'formatMenu' },
    ]},
    { label: 'Editing', items: [
      { t: 'big', id: 'autosum', icon: 'autosum', label: 'AutoSum', split: true, menu: 'autosumMenu' },
      { t: 'big', id: 'fill', icon: 'fill', label: 'Fill', menu: 'fillMenu' },
      { t: 'big', id: 'clear', icon: 'clear', label: 'Clear', menu: 'clearMenu' },
      { t: 'big', id: 'sortfilter', icon: 'sortdlg', label: 'Sort &\nFilter', menu: 'sortFilterMenu' },
      { t: 'big', id: 'findselect', icon: 'find', label: 'Find &\nSelect', split: true, menu: 'findMenu' },
    ]},
  ]},
  { id: 'insert', label: 'Insert', groups: [
    { label: 'Tables', items: [
      { t: 'big', id: 'pivot', icon: 'pivot', label: 'PivotTable' },
      { t: 'big', id: 'table', icon: 'table', label: 'Table' },
    ]},
    { label: 'Illustrations', items: [
      { t: 'big', id: 'picture', icon: 'picture', label: 'Pictures' },
      { t: 'big', id: 'shapes', icon: 'shapes', label: 'Shapes', menu: 'shapesMenu' },
    ]},
    { label: 'Charts', items: [
      { t: 'big', id: 'chartcol', icon: 'chartcol', label: 'Insert Column\nor Bar Chart', menu: 'chartColMenu' },
      { t: 'big', id: 'chartline', icon: 'chartline', label: 'Insert Line\nor Area Chart', menu: 'chartLineMenu' },
      { t: 'big', id: 'chartpie', icon: 'chartpie', label: 'Insert Pie\nor Doughnut', menu: 'chartPieMenu' },
      { t: 'big', id: 'chartscatter', icon: 'scatter', label: 'Insert Scatter\n(X, Y)', menu: 'chartXYMenu' },
    ]},
    { label: 'Sparklines', items: [
      { t: 'stack', items: [
        { t: 'sm', id: 'sparkline', icon: 'sparkline', label: 'Line' },
        { t: 'sm', id: 'sparkcol', icon: 'chartcol', label: 'Column' },
      ]},
    ]},
    { label: 'Text', items: [
      { t: 'big', id: 'textbox', icon: 'textbox', label: 'Text\nBox' },
      { t: 'big', id: 'symbol', icon: 'symbol', label: 'Symbols', menu: 'symbolsMenu' },
    ]},
    { label: 'Links', items: [
      { t: 'big', id: 'link', icon: 'link', label: 'Link' },
    ]},
  ]},
  { id: 'layout', label: 'Page Layout', groups: [
    { label: 'Themes', items: [
      { t: 'stack', items: [
        { t: 'sm', id: 'themecolors', icon: 'themes', label: 'Colors', menu: 'themeColorsMenu' },
        { t: 'sm', id: 'themefonts', icon: 'growfont', label: 'Fonts', menu: 'themeFontsMenu' },
      ]},
    ]},
    { label: 'Page Setup', items: [
      { t: 'big', id: 'margins', icon: 'margins', label: 'Margins', menu: 'marginsMenu' },
      { t: 'big', id: 'orient', icon: 'orient', label: 'Orientation', menu: 'orientMenu' },
      { t: 'stack', items: [
        { t: 'sm', id: 'size', icon: 'size', label: 'Size', menu: 'sizeMenu' },
        { t: 'sm', id: 'printarea', icon: 'printarea', label: 'Print Area', menu: 'printAreaMenu' },
        { t: 'sm', id: 'breaks', icon: 'breaks', label: 'Breaks', menu: 'breaksMenu' },
      ]},
    ]},
    { label: 'Sheet Options', items: [
      { t: 'stack', items: [
        { t: 'chk', id: 'gridview', label: 'Gridlines: View' },
        { t: 'chk', id: 'gridprint', label: 'Gridlines: Print' },
        { t: 'chk', id: 'headview', label: 'Headings: View' },
      ]},
    ]},
  ]},
  { id: 'formulas', label: 'Formulas', groups: [
    { label: 'Function Library', items: [
      { t: 'big', id: 'insertfx', icon: 'fx', label: 'Insert\nFunction' },
      { t: 'big', id: 'autosum2', icon: 'autosum', label: 'AutoSum', split: true, menu: 'autosumMenu' },
    ]},
    { label: 'Function Categories', items: [
      { t: 'stack', items: [
        { t: 'sm', id: 'flogical', icon: 'logical', label: 'Logical', menu: 'logicalMenu' },
        { t: 'sm', id: 'ftext', icon: 'formtext', label: 'Text', menu: 'textMenu' },
        { t: 'sm', id: 'fdatetime', icon: 'datetime', label: 'Date & Time', menu: 'dateTimeMenu' },
      ]},
      { t: 'stack', items: [
        { t: 'sm', id: 'flookup', icon: 'lookup', label: 'Lookup & Reference', menu: 'lookupMenu' },
        { t: 'sm', id: 'fmath', icon: 'math', label: 'Math & Trig', menu: 'mathMenu' },
        { t: 'sm', id: 'fmore', icon: 'morefuncs', label: 'More Functions', menu: 'moreFuncsMenu' },
      ]},
    ]},
    { label: 'Defined Names', items: [
      { t: 'big', id: 'namemgr', icon: 'namemgr', label: 'Name\nManager' },
      { t: 'big', id: 'definename', icon: 'definename', label: 'Define\nName', split: true, menu: 'defineNameMenu' },
    ]},
    { label: 'Formula Auditing', items: [
      { t: 'stack', items: [
        { t: 'sm', id: 'showform', icon: 'showform', label: 'Show Formulas', toggle: true },
        { t: 'sm', id: 'errorcheck', icon: 'errorcheck', label: 'Error Checking' },
        { t: 'sm', id: 'calcnow', icon: 'calcnow', label: 'Calculate Now' },
      ]},
      { t: 'stack', items: [
        { t: 'sm', id: 'traceprec', icon: 'traceprec', label: 'Trace Precedents' },
        { t: 'sm', id: 'tracedep', icon: 'tracedep', label: 'Trace Dependents' },
        { t: 'sm', id: 'rmvarrows', icon: 'rmvarrows', label: 'Remove Arrows' },
      ]},
    ]},
    { label: 'Calculation', items: [
      { t: 'big', id: 'calcopts', icon: 'calcnow', label: 'Calculation\nOptions', menu: 'calcOptsMenu' },
    ]},
  ]},
  { id: 'data', label: 'Data', groups: [
    { label: 'Sort & Filter', items: [
      { t: 'big', id: 'sortaz', icon: 'sortaz', label: 'Sort A to Z' },
      { t: 'big', id: 'sortza', icon: 'sortza', label: 'Sort Z to A' },
      { t: 'big', id: 'sortdlg', icon: 'sortdlg', label: 'Sort' },
      { t: 'big', id: 'filter', icon: 'filter', label: 'Filter', toggle: true },
    ]},
    { label: 'Data Tools', items: [
      { t: 'big', id: 'texttocols', icon: 'texttocols', label: 'Text to\nColumns' },
      { t: 'big', id: 'dataval', icon: 'dataval', label: 'Data\nValidation', menu: 'dataValMenu' },
      { t: 'big', id: 'filterclr', icon: 'filterclr', label: 'Clear' },
    ]},
    { label: 'Outline', items: [
      { t: 'stack', items: [
        { t: 'sm', id: 'group', icon: 'group', label: 'Group', menu: 'groupMenu' },
        { t: 'sm', id: 'ungroup', icon: 'ungroup', label: 'Ungroup', menu: 'ungroupMenu' },
        { t: 'sm', id: 'subtotal', icon: 'subtotal', label: 'Subtotal' },
      ]},
    ]},
    { label: 'Refresh', items: [
      { t: 'big', id: 'refresh', icon: 'refresh', label: 'Recalculate\nWorkbook' },
    ]},
  ]},
  { id: 'review', label: 'Review', groups: [
    { label: 'Comments', items: [
      { t: 'big', id: 'newnote', icon: 'note', label: 'New\nComment' },
      { t: 'stack', items: [
        { t: 'sm', id: 'prevnote', icon: 'chev-up', label: 'Previous' },
        { t: 'sm', id: 'nextnote', icon: 'chev-d', label: 'Next' },
        { t: 'sm', id: 'shownotes', icon: 'note', label: 'Show All Comments', toggle: true },
      ]},
    ]},
    { label: 'Protect', items: [
      { t: 'big', id: 'protect', icon: 'protect', label: 'Protect\nSheet', split: true, menu: 'protectMenu' },
    ]},
  ]},
  { id: 'view', label: 'View', groups: [
    { label: 'Workbook Views', items: [
      { t: 'big', id: 'vnormal', icon: 'normview', label: 'Normal', toggle: true },
      { t: 'big', id: 'vpbreak', icon: 'pbreak', label: 'Page Break\nPreview', toggle: true },
    ]},
    { label: 'Show', items: [
      { t: 'stack', items: [
        { t: 'chk', id: 'showfx', label: 'Formula Bar' },
        { t: 'chk', id: 'showgrid', label: 'Gridlines' },
        { t: 'chk', id: 'showhead', label: 'Headings' },
        { t: 'chk', id: 'darkmode', label: 'Dark Mode' },
      ]},
    ]},
    { label: 'Zoom', items: [
      { t: 'big', id: 'zoom', icon: 'zoom', label: 'Zoom' },
      { t: 'big', id: 'zoom100', icon: 'numfmt', label: '100%' },
      { t: 'big', id: 'zoomsel', icon: 'zoomsel', label: 'Zoom to\nSelection' },
    ]},
    { label: 'Window', items: [
      { t: 'big', id: 'freeze', icon: 'freeze', label: 'Freeze\nPanes', split: true, menu: 'freezeMenu' },
      { t: 'big', id: 'newwin', icon: 'newwin', label: 'New\nWindow' },
    ]},
  ]},
  { id: 'help', label: 'Help', groups: [
    { label: 'Help', items: [
      { t: 'big', id: 'help', icon: 'help', label: 'Help' },
      { t: 'big', id: 'feedback', icon: 'note', label: 'Feedback' },
    ]},
  ]},
];
window.SHTPLS = [
  { id: 'blank', name: 'Blank workbook', sub: 'An empty grid, ready for data' },
  { id: 'budget', name: 'Monthly budget', sub: 'Income, expenses and totals' },
  { id: 'calendar', name: 'Monthly calendar', sub: 'A month grid with weekdays' },
  { id: 'todo', name: 'To-do list', sub: 'Tasks with status and dates' },
  { id: 'invoice', name: 'Invoice', sub: 'Items, quantities and totals' },
];

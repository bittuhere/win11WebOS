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
   PowerPoint clone — ribbon definition (declarative; app2.js builds it)
   t: 'big' = tall button · 'small' = stacked 3/col · 'host' = custom builder
   ========================================================================== */
window.RIBBON = [
  {
    id: 'home', label: 'Home', groups: [
      { nm: 'Clipboard', items: [
        { id: 'paste', t: 'big', icon: 'paste', lab: 'Paste', caret: true },
        { id: 'cut', t: 'small', icon: 'cut', lab: 'Cut' },
        { id: 'copy', t: 'small', icon: 'copy', lab: 'Copy' },
        { id: 'fmtpaint', t: 'small', icon: 'fmtpaint', lab: 'Format Painter' },
      ] },
      { nm: 'Slides', items: [
        { id: 'newslide', t: 'big', icon: 'newslide', lab: 'New\nSlide', caret: true },
        { id: 'layout', t: 'big', icon: 'layout', lab: 'Layout', caret: true },
        { id: 'resetph', t: 'small', icon: 'reset', lab: 'Reset' },
      ] },
      { nm: 'Font', host: 'font' },
      { nm: 'Paragraph', items: [
        { id: 'bullets', t: 'small', icon: 'bullets', caret: true },
        { id: 'numbering', t: 'small', icon: 'numbering', caret: true },
        { id: 'inddec', t: 'small', icon: 'inddec' },
        { id: 'indinc', t: 'small', icon: 'indinc' },
        { id: 'lspacing', t: 'small', icon: 'lspacing', caret: true },
        { id: 'al', t: 'small', icon: 'al' },
        { id: 'ac', t: 'small', icon: 'ac' },
        { id: 'ar', t: 'small', icon: 'ar' },
        { id: 'aj', t: 'small', icon: 'aj' },
        { id: 'twocont', t: 'small', icon: 'twocont', caret: true, lab: '' },
        { id: 'textdir', t: 'small', icon: 'textdir', caret: true },
        { id: 'aligntext', t: 'small', icon: 'aligntext', caret: true },
      ] },
      { nm: 'Drawing', host: 'drawing' },
      { nm: 'Editing', items: [
        { id: 'find', t: 'small', icon: 'find', lab: 'Find' },
        { id: 'replace', t: 'small', icon: 'replace', lab: 'Replace' },
        { id: 'selmenu', t: 'small', icon: 'select', lab: 'Select', caret: true },
      ] },
    ],
  },
  {
    id: 'insert', label: 'Insert', groups: [
      { nm: 'Slides', items: [
        { id: 'newslide2', t: 'big', icon: 'newslide', lab: 'New\nSlide', caret: true },
      ] },
      { nm: 'Tables', items: [
        { id: 'intable', t: 'big', icon: 'table', lab: 'Table', caret: true },
      ] },
      { nm: 'Images', items: [
        { id: 'inpictures', t: 'big', icon: 'pictures', lab: 'Pictures', caret: true },
      ] },
      { nm: 'Illustrations', items: [
        { id: 'inshapes', t: 'big', icon: 'shapesIc', lab: 'Shapes', caret: true },
        { id: 'inchart', t: 'big', icon: 'chartIc', lab: 'Chart' },
      ] },
      { nm: 'Comments', items: [
        { id: 'incomment', t: 'small', icon: 'commentNew', lab: 'Comment' },
      ] },
      { nm: 'Text', items: [
        { id: 'intextbox', t: 'small', icon: 'textbox', lab: 'Text Box' },
        { id: 'inhdrftr', t: 'small', icon: 'headerfooter', lab: 'Header &&\nFooter' },
        { id: 'inwordart', t: 'small', icon: 'wordart', lab: 'WordArt', caret: true },
        { id: 'inslidenum', t: 'small', icon: 'slidenum', lab: 'Slide\nNumber' },
        { id: 'insymbol', t: 'small', icon: 'symbol', lab: 'Symbol', caret: true },
      ] },
    ],
  },
  {
    id: 'design', label: 'Design', groups: [
      { nm: 'Themes', host: 'themes' },
      { nm: 'Variants', host: 'variants' },
      { nm: 'Customize', items: [
        { id: 'slidesize', t: 'small', icon: 'slidesize', lab: 'Slide Size', caret: true },
        { id: 'formatbg', t: 'big', icon: 'formatbg', lab: 'Format\nBackground' },
      ] },
    ],
  },
  {
    id: 'transitions', label: 'Transitions', groups: [
      { nm: 'Preview', items: [
        { id: 'trpreview', t: 'big', icon: 'playall', lab: 'Preview' },
      ] },
      { nm: 'Transition to This Slide', host: 'transitions' },
      { nm: 'Timing', host: 'trtiming' },
    ],
  },
  {
    id: 'animations', label: 'Animations', groups: [
      { nm: 'Preview', items: [
        { id: 'anpreview', t: 'big', icon: 'playall', lab: 'Preview' },
      ] },
      { nm: 'Animation', host: 'animations' },
      { nm: 'Advanced Animation', items: [
        { id: 'addanimbtn', t: 'big', icon: 'addanim', lab: 'Add\nAnimation', caret: true },
        { id: 'animpanebtn', t: 'big', icon: 'animpane', lab: 'Animation\nPane' },
      ] },
      { nm: 'Timing', host: 'antiming' },
    ],
  },
  {
    id: 'slideshow', label: 'Slide Show', groups: [
      { nm: 'Start Slide Show', items: [
        { id: 'showbegin', t: 'big', icon: 'slideshow', lab: 'From\nBeginning' },
        { id: 'showcurrent', t: 'big', icon: 'slideshow', lab: 'From Current\nSlide' },
      ] },
      { nm: 'Set Up', items: [
        { id: 'setupshow', t: 'small', icon: 'setup', lab: 'Set Up Slide\nShow' },
        { id: 'hideslidebtn', t: 'small', icon: 'hideSlide', lab: 'Hide Slide' },
      ] },
    ],
  },
  {
    id: 'review', label: 'Review', groups: [
      { nm: 'Proofing', items: [
        { id: 'spelling', t: 'big', icon: 'spelling', lab: 'Spelling' },
      ] },
      { nm: 'Comments', items: [
        { id: 'cmnew', t: 'small', icon: 'commentNew', lab: 'New Comment' },
        { id: 'cmdel', t: 'small', icon: 'commentDel', lab: 'Delete' },
        { id: 'cmprev', t: 'small', icon: 'back', lab: 'Previous' },
        { id: 'cmnext', t: 'small', icon: 'dd', lab: 'Next' },
        { id: 'cmshow', t: 'small', icon: 'commentShow', lab: 'Show\nComments', toggle: true },
      ] },
    ],
  },
  {
    id: 'view', label: 'View', groups: [
      { nm: 'Presentation Views', items: [
        { id: 'vnormal', t: 'small', icon: 'vNormal', lab: 'Normal' },
        { id: 'vsorter', t: 'small', icon: 'vSorter', lab: 'Slide\nSorter' },
        { id: 'vreading', t: 'small', icon: 'vReading', lab: 'Reading\nView' },
      ] },
      { nm: 'Show', host: 'showchk' },
      { nm: 'Zoom', items: [
        { id: 'vzdialog', t: 'small', icon: 'zoom', lab: 'Zoom' },
        { id: 'v100', t: 'small', icon: 'hundred', lab: '100%' },
        { id: 'vfit', t: 'small', icon: 'fit', lab: 'Fit to\nWindow' },
      ] },
    ],
  },
];

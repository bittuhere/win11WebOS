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
import i18next from "i18next";
import { WosSelect } from "../../../../components/shared/Controls";

const LANGS = [
  { value: "da", label: "Danish", native: "Dansk" },
  { value: "de", label: "German", native: "Deutsch" },
  { value: "en", label: "English", native: "English" },
  { value: "es", label: "Spanish", native: "Español" },
  { value: "fr", label: "French", native: "Français" },
  { value: "hi", label: "Hindi", native: "हिन्दी" },
  { value: "hu", label: "Hungarian", native: "Magyar" },
  { value: "ja", label: "Japanese", native: "日本語" },
  { value: "ko", label: "Korean", native: "한국어" },
  { value: "nl", label: "Dutch", native: "Nederlands" },
  { value: "ru", label: "Russian", native: "Русский" },
  { value: "tr", label: "Turkish", native: "Türkçe" },
  { value: "zh", label: "Chinese", native: "中文" },
  { value: "si", label: "Sinhala", native: "සිංහල" },
];

/** The Windows 11 display-language picker — no native <select> anywhere. */
function LangSwitch() {
  const cur = String(i18next.language || "en").slice(0, 2);
  return (
    <div className="langSwitcher">
      <WosSelect
        value={cur}
        onChange={(v) => i18next.changeLanguage(v)}
        options={LANGS.map((l) => ({ value: l.value, label: `${l.native} — ${l.label}` }))}
        placeholder="English"
      />
    </div>
  );
}

export default LangSwitch;

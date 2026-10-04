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

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

/* keep <html lang> in step with the interface language — screen readers and
   search engines both read it */
const syncLang = (lng) => {
  try {
    document.documentElement.setAttribute("lang", String(lng || "en").split("-")[0]);
  } catch (e) {}
};

const fallbackLng = ["en"];
const availableLanguages = [
  "en",
  "da",
  "de",
  "es",
  "fr",
  "hi",
  "hu",
  "ja",
  "ko",
  "nl",
  "ru",
  "tr",
  "zh",
  "si",
];

/* translation-check reports missing keys while developing. It is imported
   dynamically so the production bundle never contains it. */
if (import.meta.env?.DEV) {
  import("translation-check").then(({ i18nextPlugin }) => i18n.use(i18nextPlugin));
}

i18n
  .use(Backend) // loads public/locales/<lng>/translate.json
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // pass the i18n instance to react-i18next.
  .init({
    fallbackLng, // fallback language is english.
    supportedLngs: availableLanguages,
    nonExplicitSupportedLngs: false,
    load: "languageOnly", // en-GB browsers load "en" — no 404 for locales/en-GB

    backend: {
      loadPath: "locales/{{lng}}/translate.json",
    },

    detection: {
      checkWhitelist: true, // options for language detection
    },

    debug: false,

    whitelist: availableLanguages,

    interpolation: {
      escapeValue: false, // no need for react. it escapes by default
    },
  });

syncLang(i18n.language);
i18n.on("languageChanged", syncLang);

export default i18n;

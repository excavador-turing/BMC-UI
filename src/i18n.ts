import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { resources } from "@/locale";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: ["de", "en", "es", "nl", "pl", "zh-Hans"],
    resources,
    fallbackLng: {
      "zh-CN": ["zh-Hans"],
      default: ["en"],
    },
    interpolation: {
      // React escapes every text node it renders, so i18next escaping
      // interpolated values as well is a SECOND pass over the same string --
      // and the second pass is the one the reader sees. A daemon message
      // naming a path came out as
      // "&#x2F;mnt&#x2F;sdcard&#x2F;firmware is not a directory", because
      // i18next turned each slash into an entity and React then rendered the
      // entity as literal text rather than as a slash.
      //
      // Safe to switch off here, and checked rather than assumed: nothing in
      // this application renders a translated string as HTML -- no
      // `dangerouslySetInnerHTML`, no `<Trans>`. If either ever arrives, this
      // decision has to be revisited with it.
      escapeValue: false,
    },
  });

document.documentElement.lang = i18n.language;

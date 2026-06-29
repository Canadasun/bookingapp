import type { Locale } from "./config";

// Dictionaries are loaded on the server only (dynamic import keeps each locale's
// JSON out of the client bundle). Add new locales here as they're translated.
const dictionaries = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (dictionaries[locale] ?? dictionaries.en)() as Promise<Dictionary>;
}

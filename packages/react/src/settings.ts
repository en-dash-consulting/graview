import type { SettingDeclaration } from "@graview/core";

/**
 * WHAT A READER SET FOR THEMSELVES, KEPT IN THEIR OWN BROWSER.
 *
 * Not in the graph: text size is not a fact about the installation, it is a
 * fact about this person at this screen, and putting it in the op log would
 * make one reader's eyesight everybody's history. So: `localStorage`, one
 * key per setting, and every read wrapped — a private window, blocked site
 * data or a thumbnail capture must leave the app working on the
 * declaration's own starting values rather than throwing on the way up.
 */
const KEY = (name: string) => `graview:setting:${name}`;

/**
 * WHERE A READER'S CHOICES ARE KEPT, when the page is not the place (FR-13).
 * A chat's widget runs in a sandboxed frame whose `localStorage` throws on
 * being touched, and a host may keep a reader's choices itself — in memory
 * for the visit, or in its own account. Any object with these two methods.
 */
export interface ReaderMemory {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The page's own storage, or a throw the caller catches: a sandboxed frame refuses even the reading of it. */
function pageMemory(): ReaderMemory {
  return localStorage;
}

export function loadSetting(setting: SettingDeclaration, memory?: ReaderMemory): string {
  try {
    const stored = (memory ?? pageMemory()).getItem(KEY(setting.name));
    if (stored !== null && setting.options.some((option) => option.value === stored)) return stored;
  } catch {
    // Not being able to remember is not a reason to fail.
  }
  return setting.initial;
}

export function rememberSetting(setting: SettingDeclaration, value: string, memory?: ReaderMemory): void {
  try {
    (memory ?? pageMemory()).setItem(KEY(setting.name), value);
  } catch {
    // The choice still applies for this visit.
  }
}

/**
 * Carries one answer to EVERY surface at once.
 *
 * Two ways, and the checker refuses a third. A root font size is a length on
 * `<html>`: the whole framework is sized in `rem`, so one assignment resizes
 * the scene, the strip, the routed face and an embed together — there is no
 * component to tell. Anything else lands as `data-graview-<name>` on the
 * same element, which is where the theme's own stylesheet looks.
 *
 * Idempotent and reversible: THE STARTING VALUE STAMPS NOTHING. That is what
 * makes "as your browser has it" and "as your system has it" honest answers
 * rather than a guess at what those are — the root keeps the size the person
 * set, and the media query underneath is what answers about motion.
 */
export function honorSetting(setting: SettingDeclaration, value: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (setting.honored === "root-font-size") {
    root.style.fontSize = value === setting.initial ? "" : value;
    return;
  }
  const attribute = `graview${setting.name.replace(/-([a-z0-9])/g, (_, next: string) => next.toUpperCase()).replace(/^[a-z]/, (first) => first.toUpperCase())}`;
  if (value === setting.initial) delete root.dataset[attribute];
  else root.dataset[attribute] = value;
}

/**
 * Every declared setting, read and applied — ONCE, at the edge, before
 * anything renders.
 *
 * The provider does this too, for the surface it wraps. An app has more than
 * one surface: the scene and the routed face are separate React roots on
 * separate paths, and a reader's text size is a fact about the reader rather
 * than about which face they happened to open. Calling this in `main` is the
 * same shape as applying the scheme there, and for the same reason.
 */
export function applySettings(settings: readonly SettingDeclaration[]): void {
  for (const setting of settings) honorSetting(setting, loadSetting(setting));
}

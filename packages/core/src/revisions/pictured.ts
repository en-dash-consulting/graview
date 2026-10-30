/*
 * A PICTURE SAYS WHAT IT DID NOT SHOW (Roadmap f-revisions-say-what-broke).
 *
 * A picture of the first screen of a taller page looks whole. Homeflow's
 * home lost the style of its "This week" section below the first screen,
 * and the picture a chat was shown looked as it had. So wherever a page is
 * pictured headless — `graview shots`, a host's own picture of a place —
 * the page is measured as it is pictured (`MEASURE_PICTURED_PAGE`), and
 * `picturedCoverage` says how much of it the picture held and names the
 * sections above and below it: "First screen only (900 of 5,100px); not
 * shown: This week, Dinner."
 */
import type { DrawnSection } from "./sections.js";

/** A section of a page where it stands, in CSS pixels from the top of what scrolls. */
export interface PlacedSection extends DrawnSection {
  readonly top: number;
  readonly bottom: number;
}

/** A page as `MEASURE_PICTURED_PAGE` measured it. */
export interface PageMeasure {
  /** How tall the whole place is: the height of what scrolls. */
  readonly height: number;
  /** How far it was scrolled when measured. */
  readonly top: number;
  /** How much of it a window shows: what a picture of the window holds. */
  readonly window: number;
  readonly sections: readonly PlacedSection[];
}

/** How much of a page a picture held, and what it left out. */
export interface PictureCoverage {
  /** True when the picture held the whole page. */
  readonly whole: boolean;
  readonly height: number;
  /** The part of the page pictured, top and bottom, in CSS pixels. */
  readonly pictured: { readonly top: number; readonly bottom: number };
  /** Sections wholly above the picture, and wholly below it. */
  readonly above: readonly PlacedSection[];
  readonly below: readonly PlacedSection[];
  /** In a sentence: "First screen only (900 of 5,100px); not shown: This week, Dinner." */
  readonly said: string;
}

/**
 * MEASURE THE PAGE AS IT IS PICTURED: evaluate it in the page (Playwright's
 * `page.evaluate`, a host's own browser) right before the picture is taken,
 * and hand what it answers to `picturedCoverage`. It reads the box the
 * place scrolls in — an embed's `[data-embed-content]`, the tallest box that
 * scrolls, or the document — and every section on it, a worker view's
 * among them (each view draws into an open shadow root).
 */
export const MEASURE_PICTURED_PAGE = `(() => {
  const scrolls = (el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1;
  const content = document.querySelector("[data-embed-content]");
  const box = content && scrolls(content)
    ? content
    : [...document.querySelectorAll("body *")].filter((el) => scrolls(el) && el.clientHeight >= innerHeight / 2).sort((a, b) => b.clientHeight - a.clientHeight)[0];
  const doc = document.scrollingElement || document.documentElement;
  const height = box ? box.scrollHeight : Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const top = box ? box.scrollTop : scrollY;
  const windowHeight = box ? box.clientHeight : innerHeight;
  const origin = box ? box.getBoundingClientRect().top - box.scrollTop : -scrollY;
  const LANDMARKS = { section: null, article: null, form: null, region: null, nav: "navigation", navigation: "navigation", main: "main content", header: "header", banner: "header", footer: "footer", contentinfo: "footer", aside: "aside", complementary: "aside", search: "search" };
  const said = (text) => (text || "").replace(/\\s+/g, " ").trim();
  const tagOf = (el) => (el.getAttribute("data-graview-as") || el.localName || "").toLowerCase();
  const level = (el) => /^h[1-6]$/.test(tagOf(el)) ? 1 : el.getAttribute("role") === "heading" ? 1 : 0;
  const all = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      all.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  const sections = [];
  const seen = new Set();
  for (const el of all) {
    if (el.closest("[data-testid=app-bar], [role=dialog]")) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0 || getComputedStyle(el).visibility === "hidden") continue;
    let name = "";
    let as = "";
    if (level(el)) {
      name = said(el.textContent);
      as = "heading";
    } else {
      const role = (el.getAttribute("role") || "").toLowerCase();
      const tag = tagOf(el);
      const what = role in LANDMARKS ? role : tag in LANDMARKS ? tag : "";
      if (!what) continue;
      const root = el.getRootNode();
      const labelled = (el.getAttribute("aria-labelledby") || "").split(/\\s+/).map((id) => id && root.getElementById ? root.getElementById(id) : null).filter(Boolean).map((one) => said(one.textContent)).join(" ");
      const heading = [...el.querySelectorAll("*")].find(level);
      name = said(el.getAttribute("aria-label")) || labelled || (heading ? said(heading.textContent) : "") || LANDMARKS[what] || "";
      as = what === "region" ? "section" : what;
    }
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    sections.push({ name: name.length > 80 ? name.slice(0, 79) + "…" : name, as, top: Math.round(rect.top - origin), bottom: Math.round(rect.bottom - origin) });
  }
  return { height: Math.ceil(height), top: Math.round(top), window: Math.round(windowHeight), sections };
})()`;

const MOST_NAMED = 8;
const px = (n: number) => Math.round(n).toLocaleString("en-US");
const names = (sections: readonly PlacedSection[]) => (sections.length <= MOST_NAMED ? sections.map((one) => one.name).join(", ") : `${sections.slice(0, MOST_NAMED).map((one) => one.name).join(", ")} and ${sections.length - MOST_NAMED} more`);

/**
 * HOW MUCH OF A PAGE A PICTURE HELD. `pictured` is the part of the page in
 * the picture, from the top of what scrolls; left out, it is the window
 * where the page was measured. A section is shown when any of it is in the
 * picture; one wholly above or below is named as not shown.
 */
export function picturedCoverage(measure: PageMeasure, pictured?: { readonly top: number; readonly height: number }): PictureCoverage {
  const top = Math.max(0, pictured?.top ?? measure.top);
  const bottom = Math.min(measure.height, top + (pictured?.height ?? measure.window));
  const whole = top <= 0 && bottom >= measure.height - 1;
  const above = measure.sections.filter((one) => one.bottom <= top);
  const below = measure.sections.filter((one) => one.top >= bottom);
  let said: string;
  if (whole) said = `The whole page is pictured (${px(measure.height)}px).`;
  else {
    const part = top <= 0 ? `First screen only (${px(bottom)} of ${px(measure.height)}px)` : `Only ${px(top)}–${px(bottom)} of ${px(measure.height)}px`;
    const left = [...(above.length > 0 ? [`above it, ${names(above)}`] : []), ...(below.length > 0 ? [`${above.length > 0 ? "below it, " : ""}${names(below)}`] : [])];
    said = left.length > 0 ? `${part}; not shown: ${left.join("; ")}.` : `${part}; no named section is wholly outside it.`;
  }
  return { whole, height: measure.height, pictured: { top, bottom }, above, below, said };
}

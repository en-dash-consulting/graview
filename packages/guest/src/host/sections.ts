import type { FileValue } from "@graview/core";
import type { GuestDomEvent } from "../protocol.js";
import { storedFilesOf } from "./marks.js";

/*
 * A VIEW'S OWN SECTIONS, AND A RECORD'S FILES (Roadmap
 * f-views-scroll-and-anchors): fetched the first time a view draws a jump,
 * a section to watch or a file link.
 *
 * A view runs in a worker with no DOM of the page's: it cannot scroll, hear
 * a scroll, observe what is in sight or ask for a frame. A long page — a
 * workshop's agenda, a discography's eras — wanted three things of the host,
 * and the host does them:
 *
 *   · A JUMP. `<a href="#eras">` is drawn (an `href` that names an element
 *     of the view, and nothing else: it goes to no address), and a press on
 *     it — a click, a tap, Enter — scrolls that element to the top of what
 *     scrolls, below whatever the host holds stuck to the top of the window
 *     (the one bar, a sticky header of the face's), then gives it the
 *     keyboard. The element's own `scroll-margin-top` is kept, so a view
 *     that draws a sticky header of its own holds its sections clear of it.
 *     The page's address does not change: the face's router owns it.
 *
 *   · WHAT IS IN SIGHT. The elements a jump names, and any marked
 *     `data-sight`, are watched as the page scrolls. The one whose top has
 *     passed a line a quarter of the way down the window — below what is
 *     stuck to the top — is in sight: it is marked `data-in-sight`, each
 *     jump to it `aria-current="location"`, and the view hears `sight` on it
 *     (`graview.on("sight", "section", (e) => …)`), once each time it moves.
 *     A sticky timeline lights the section the person is reading.
 *
 *   · A FILE, TO VIEW OR TO DOWNLOAD. `<a data-file="<record id>"
 *     data-field="contract">` (and `data-index` in a list) is given the
 *     address the host serves that record's file at, from a record the view
 *     was shown, read as the viewer sees it; with `data-download` it
 *     downloads under the file's own name, without it it opens in a tab of
 *     its own. The view is never handed the path: it names the record and
 *     the field. One that names nothing it was shown, or no file, is drawn
 *     with no address and said.
 */

export interface GuestSectionsOptions {
  readonly shadow: ShadowRoot;
  /** The view's id for an element it drew. */
  readonly idOf: (element: Node) => string | undefined;
  readonly send: (event: GuestDomEvent) => void;
  /** A record the view was last shown, as the viewer sees it; undefined for any other. */
  readonly record: (id: string) => Readonly<Record<string, unknown>> | undefined;
  /** Where the page fetches a record's file (`FileValue.href`), as the view's host says it. */
  readonly file?: (href: string) => string | undefined;
  readonly onProblem?: (said: string) => void;
}

export interface GuestSections {
  /** A person's press at `at` (the host took the click's default): a jump there is followed, and true said. The view still hears the click. */
  jump(at: Element, root: Element): boolean;
  /** After each batch the view draws: what to watch, and each file link's address. */
  refresh(): void;
  dispose(): void;
}

/** Whether a view's drawing holds anything this module does: worth fetching it. */
export const WANTS_SECTIONS = 'a[href^="#"], [data-sight], [data-file]';

const STUCK = new Set(["fixed", "sticky"]);

/**
 * HOW MUCH OF THE TOP OF WHAT SCROLLS THE HOST HOLDS: the bottom of whatever
 * stays put over it — a fixed or sticky element of the page's, outside the
 * view's region: the one bar, a face's sticky header — from `top`, where
 * what scrolls begins on the screen (0 for the window). Found by what is
 * drawn there, a few points across the region, so a bar of any face counts
 * and the view's own sticky header (inside its region) does not.
 */
export function stuckOver(window: Window, region: Element, top = 0): number {
  const document = window.document;
  const box = region.getBoundingClientRect();
  const left = Math.max(0, box.left);
  const right = Math.min(window.innerWidth || document.documentElement.clientWidth, box.right);
  let bottom = top;
  for (let pass = 0; pass < 3; pass += 1) {
    let found = bottom;
    for (const x of [0.2, 0.5, 0.8].map((at) => left + (right - left) * at)) {
      const hits = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(x, bottom + 1) : [];
      for (const hit of hits) {
        if (hit === region || region.contains(hit) || hit.contains(region)) continue;
        for (let on: Element | null = hit; on && on !== document.documentElement; on = on.parentElement) {
          if (on.contains(region)) break;
          if (!STUCK.has(window.getComputedStyle(on).position)) continue;
          const rect = on.getBoundingClientRect();
          if (rect.top <= bottom + 1 && rect.bottom > found) found = rect.bottom;
          break;
        }
      }
    }
    if (found <= bottom) break;
    bottom = found;
  }
  return Math.min(bottom, top + (window.innerHeight || 0) / 2);
}

/** The nearest box at or above an element that scrolls, crossing the region's shadow; the window's when none does. */
function scrollerOf(window: Window, element: Element): Element | undefined {
  for (let at: Node | null = element.parentNode; at; at = at.nodeType === 11 && (at as ShadowRoot).host ? (at as ShadowRoot).host : at.parentNode) {
    if (at.nodeType !== 1) continue;
    const on = at as Element;
    if (on === window.document.documentElement || on === window.document.body) return undefined;
    const style = window.getComputedStyle(on);
    if (/(auto|scroll)/.test(style.overflowY) && on.scrollHeight > on.clientHeight + 1) return on;
  }
  return undefined;
}

const reducedMotion = (window: Window) => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createGuestSections(window: Window & typeof globalThis, options: GuestSectionsOptions): GuestSections {
  const { shadow } = options;
  const region = shadow.host;
  const told = new Set<string>();
  const say = (said: string) => {
    if (told.has(said)) return;
    told.add(said);
    options.onProblem?.(said);
  };
  const byId = (id: string): Element | null => {
    try {
      return shadow.getElementById(id);
    } catch {
      return null;
    }
  };

  /* ── what is in sight ── */
  let watched: Element[] = [];
  let current: Element | undefined;
  /* The jumps the host marked current: only those are unmarked. */
  const marked = new Set<Element>();
  let due = 0;
  const light = (next: Element | undefined) => {
    if (next === current) return;
    current?.removeAttribute("data-in-sight");
    for (const one of marked) one.removeAttribute("aria-current");
    marked.clear();
    current = next;
    if (!next) return;
    next.setAttribute("data-in-sight", "");
    const id = next.getAttribute("id");
    if (id) {
      for (const jump of shadow.querySelectorAll('a[href^="#"]')) {
        if (jump.getAttribute("href") !== `#${id}` || jump.hasAttribute("aria-current")) continue;
        jump.setAttribute("aria-current", "location");
        marked.add(jump);
      }
    }
    const target = options.idOf(next);
    if (target !== undefined) options.send({ type: "dom-event", target, event: "sight" });
  };
  const look = () => {
    due = 0;
    const live = watched.filter((one) => one.isConnected);
    if (live.length === 0) return light(undefined);
    /* What the sections scroll in: a box of the face's, or the window. */
    const inner = scrollerOf(window, live[0]!);
    const box = inner ? inner.getBoundingClientRect() : { top: 0, height: window.innerHeight || window.document.documentElement.clientHeight };
    const line = stuckOver(window, region, box.top) + box.height * 0.25;
    const end = box.top + box.height;
    let next: Element | undefined;
    for (const one of live) if (one.getBoundingClientRect().top <= line) next = one;
    /* At the foot, the last one that shows is in sight: a short last section is never passed by the line. */
    const scroller = inner ?? window.document.scrollingElement;
    if (scroller && scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
      const showing = live.filter((one) => one.getBoundingClientRect().top < end);
      if (showing.length > 0) next = showing[showing.length - 1];
    }
    next ??= live[0]!.getBoundingClientRect().top < end ? live[0] : undefined;
    light(next);
  };
  const soon = () => {
    if (due !== 0) return;
    due = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(look) : (window.setTimeout(look, 16) as unknown as number);
  };
  window.addEventListener("scroll", soon, { capture: true, passive: true });
  window.addEventListener("resize", soon, { passive: true });

  /* ── a record's files ── */
  const at = (href: string): string | undefined => {
    const given = options.file ? options.file(href) : href;
    if (given === undefined) return undefined;
    try {
      const url = new window.URL(given, window.document.baseURI);
      return url.origin === window.location.origin && /^https?:$/.test(url.protocol) ? given : undefined;
    } catch {
      return undefined;
    }
  };
  const linkFile = (element: Element) => {
    const record = element.getAttribute("data-file") ?? "";
    const field = element.getAttribute("data-field") ?? "";
    const index = Number(element.getAttribute("data-index") ?? "0");
    const drop = () => {
      element.removeAttribute("href");
      element.removeAttribute("download");
    };
    if (element.localName !== "a") {
      drop();
      return say(`A file link is an <a data-file="${record}" data-field="${field}">: a <${element.localName}> is not followed.`);
    }
    const node = record ? options.record(record) : undefined;
    const file: FileValue | undefined = node && field ? storedFilesOf(node[field])[Number.isInteger(index) && index >= 0 ? index : 0] : undefined;
    const href = file ? at(file.href) : undefined;
    if (!node) {
      drop();
      return say(`The file link to "${record}" goes nowhere: it names no record this view was shown.`);
    }
    if (!file || !href) {
      drop();
      return say(`The file link to "${record}" goes nowhere: its ${field ? `"${field}"` : "data-field"} holds no file${file ? " this page serves" : ""}.`);
    }
    if (element.getAttribute("href") !== href) element.setAttribute("href", href);
    element.setAttribute("rel", "noopener noreferrer");
    if (element.hasAttribute("data-download")) {
      element.setAttribute("download", file.name ?? "");
      element.removeAttribute("target");
    } else {
      element.removeAttribute("download");
      element.setAttribute("target", "_blank");
    }
  };

  return {
    jump(at, root) {
      const jump = at.closest('a[href^="#"]');
      if (!jump || !root.contains(jump)) return false;
      const id = (jump.getAttribute("href") ?? "").slice(1);
      const target = id ? byId(id) : null;
      if (!target || !root.contains(target)) {
        say(`The jump "#${id}" goes nowhere: the view drew no element with that id.`);
        return true;
      }
      /* At once, where the person asked for less motion; as the view's own `scroll-behavior` says, elsewhere. */
      const behavior: ScrollBehavior = reducedMotion(window) ? "instant" : "auto";
      target.scrollIntoView({ block: "start", behavior });
      /* Below what the host holds stuck over the top of what scrolled: the window, or a box of the face's. */
      const scroller = scrollerOf(window, target);
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const stuck = stuckOver(window, region, top);
      const margin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
      const off = target.getBoundingClientRect().top - (stuck + margin);
      if (stuck > top && off < -0.5) (scroller ?? window).scrollBy({ top: off, behavior });
      if (!(target as HTMLElement).hasAttribute("tabindex") && !["a", "button", "input", "select", "textarea", "summary"].includes(target.localName)) target.setAttribute("tabindex", "-1");
      (target as HTMLElement).focus?.({ preventScroll: true });
      light(watched.includes(target) ? target : current);
      soon();
      return true;
    },
    refresh() {
      const ids = new Set<string>();
      for (const jump of shadow.querySelectorAll('a[href^="#"]')) {
        const id = (jump.getAttribute("href") ?? "").slice(1);
        if (id) ids.add(id);
        /* It goes nowhere outside the view: no tab of its own, as a link out has. */
        jump.removeAttribute("target");
        jump.removeAttribute("rel");
      }
      const next: Element[] = [];
      for (const one of shadow.querySelectorAll("[id], [data-sight]")) {
        if (one.hasAttribute("data-sight") || ids.has(one.getAttribute("id") ?? "")) next.push(one);
      }
      watched = next;
      for (const one of shadow.querySelectorAll("[data-file]")) linkFile(one);
      soon();
    },
    dispose() {
      window.removeEventListener("scroll", soon, { capture: true });
      window.removeEventListener("resize", soon);
      if (due !== 0 && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(due);
    },
  };
}

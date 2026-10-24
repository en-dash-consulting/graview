import type { GuestDomEvent } from "../protocol.js";
import { sanitizeStylesheets, type CssRefusal } from "./css.js";
import type { OpenNamespace, OpenRefusal } from "./open-judge.js";
import { createOpenRenderer, type OpenRenderer } from "./open-render.js";

/* A view's link out, judged and said: fetched with the drawing, so a page that draws no open-kit view loads none of it. */
export { handedLinks, judgeLink, linkRefusedWords } from "./external-links.js";

/*
 * A WORKER VIEW'S REGION, DRAWN (FR-90): the open kit's renderer and
 * stylesheet in a shadow root the host owns, and the viewer's clicks,
 * typing and choices on what was drawn told to the view. This module is
 * what `mountWorkerView` fetches when it first draws an open-kit view, so a
 * page that draws none loads none of the sanitizer.
 */

/**
 * The host's own rules for the region: what a view's stylesheet cannot reach, because it cannot write `:host`.
 * A link or a press the host made — a card as much as an `<a>`, a `<span role="button">` as much as a button — looks pressable, which is what iOS makes a tap a click on,
 * is not held for a double tap's zoom, and flashes faintly under the finger (pressable.ts).
 *
 * KEYBOARD AND PLAIN CONTROLS BY DEFAULT (0.1.47). Whatever takes the keyboard shows a ring when it has it — a whole
 * outline at least 2px wide, set off from it, in the app's accent (which the brand is held to against its grounds) — and
 * it is `!important`, so a view's `outline: none` does not take it away: a view restyles it with `--graview-focus-color`,
 * `--graview-focus-width` (never under 2px) and `--graview-focus-offset`. A `<button>` and a link the host made are
 * reset to the words around them with no specificity at all (`:where`), so a view's own class always wins and a button
 * is the semantic choice with nothing to undo. `.graview-sr` is said to assistive technology and not drawn. A link out
 * says it opens a new tab; a link the host made, now with an address of the app's, does not.
 *
 * THE RING IS WHOLE AT THE REGION'S EDGE. The region clips what the view draws to its box, and a control flush with
 * that edge lost the half of its ring outside it. While something in it holds the keyboard the region lets the ring's
 * reach — its width and its offset, 2px and 2px unless the app or the view says wider — paint past its edge
 * (`overflow-clip-margin`), and nothing else: the region is still the box it clips to, contained and isolated. The
 * reach is the ring's as the control that took the keyboard draws it, measured as it takes it and handed to the rule
 * as a plain length (`--graview-ring-reach`: Chromium takes no calc() in `overflow-clip-margin`), never past 16px. Where the engine cannot (WebKit), a control that takes the
 * keyboard within that reach of the edge has its ring drawn inside its own edge (`data-graview-ring-inside`).
 *
 * LESS MOTION, WHERE A PERSON ASKS FOR IT (2026-10-23). Under `prefers-reduced-motion: reduce` every animation in a
 * view runs once in a millisecond, to where it ends, on no scroll (a scroll-driven one included), and every transition
 * is as short. It is `!important` in a layer of the host's: an important declaration in a layer wins over every
 * unlayered one whatever its specificity, and a view's stylesheet can write no `@layer`.
 */
export const REGION_CSS = `
:host { display: block; position: relative; contain: layout paint style; isolation: isolate; overflow: clip; min-width: 0; }
:host(:focus-within) { overflow-clip-margin: var(--graview-ring-reach, 4px); }
[data-graview-view-root] { display: flow-root; color: var(--graview-ink, CanvasText); font-family: var(--graview-font-body, system-ui, sans-serif); line-height: 1.45; }
:where([data-graview-view-root]) :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; text-align: inherit; appearance: none; cursor: pointer; }
:where([data-graview-view-root]) :where(a[data-graview-link]) { color: inherit; text-decoration: none; }
[data-graview-view-root] :is([data-graview-link], [data-graview-press]) { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: rgb(128 128 128 / 0.16); }
[data-graview-view-root] :focus-visible { outline: max(2px, var(--graview-focus-width, 2px)) solid var(--graview-focus-color, var(--graview-accent, Highlight)) !important; outline-offset: var(--graview-focus-offset, 2px) !important; }
[data-graview-view-root] [data-graview-ring-inside]:focus-visible { outline-offset: calc(-1 * max(2px, var(--graview-focus-width, 2px))) !important; }
[data-graview-view-root] .graview-sr { position: absolute !important; width: 1px !important; height: 1px !important; margin: -1px !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; clip-path: inset(50%) !important; white-space: nowrap !important; }
[data-graview-view-root] a[href]:not([data-graview-link])::after { content: " ↗" !important; content: " ↗" / " (opens in a new tab)" !important; }
@layer graview-motion { @media (prefers-reduced-motion: reduce) { [data-graview-view-root] *, [data-graview-view-root] ::before, [data-graview-view-root] ::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; animation-timeline: auto !important; transition-duration: 1ms !important; scroll-behavior: auto !important; } } }
`;

/** How far the ring reaches past a control's edge by default — its 2px and its 2px offset — and the most the region lets any ring paint past its own. */
const RING_REACH = 4;
const RING_REACH_MOST = 16;

/** How far a control's ring reaches past its edge, as it draws it now: its outline's width and its offset outward, held to 4–16px. */
export function ringReach(control: Element): number {
  const style = control.ownerDocument.defaultView?.getComputedStyle(control);
  if (!style) return RING_REACH;
  const width = Number.parseFloat(style.outlineWidth) || 0;
  const offset = Math.max(0, Number.parseFloat(style.outlineOffset) || 0);
  return Math.min(RING_REACH_MOST, Math.max(RING_REACH, Math.ceil(width + offset)));
}

/** The keys a view hears: enough to move and choose, never what the viewer types into the app elsewhere. */
const KEYS = new Set(["Enter", " ", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
const EVENTS = ["click", "input", "change", "keydown"] as const;

export interface OpenDrawingOptions {
  /** The host page's origin, for a `blob:` image of its own. */
  readonly origin: string;
  /** Where an image the app holds is loaded from (JudgeContext.asset). */
  readonly asset?: (path: string) => string | undefined;
  /** The origins an image may be loaded from by its `https:` address (JudgeContext.imageOrigins). */
  readonly imageOrigins?: readonly string[];
  /** What the page draws for a record's picture the host handed the view (JudgeContext.picture). */
  readonly picture?: (value: string) => string | undefined;
  /** The address the page draws for a view's link out, where the host allows it (JudgeContext.link). */
  readonly link?: (value: string) => string | undefined;
  /** Something the view drew was refused, as it was. */
  readonly onRefused?: (refusal: OpenRefusal) => void;
  readonly maxNodes?: number;
  readonly onOverBudget?: () => void;
  /** Tell the view what the viewer did. */
  readonly send: (message: GuestDomEvent) => void;
  readonly decorate?: (element: Element, name: string, namespace: OpenNamespace) => void;
  readonly onFieldSet?: (field: Element) => void;
  readonly onAttribute?: (element: Element, name: string) => void;
  /**
   * The viewer did something on what the view drew, before the view is
   * told: the host's own handling (a press bound to an act, a link), in the
   * event's own handler. What it returns goes with what the view is told
   * (`pressed`); `false` keeps the view from being told.
   */
  readonly before?: (event: Event, element: Element, root: Element) => Partial<GuestDomEvent> | false | void;
}

export type ViewRefusal = OpenRefusal | { readonly reason: "css"; readonly name: "stylesheet"; readonly css: CssRefusal };

export interface OpenDrawing {
  /** Draw one batch of the view's mutation records; false if `spent` stopped it partway (OpenRenderer.apply). */
  apply(records: unknown, spent?: () => boolean): boolean;
  /** Draw the view's stylesheets, every one it gave, in order, as the open kit allows them. */
  style(sheets: readonly string[]): void;
  readonly renderer: OpenRenderer;
  /** What was refused of the drawing and the stylesheet (the last 200 of each). */
  readonly refused: readonly ViewRefusal[];
  /** The view's stylesheets as drawn, one after another. */
  readonly css: string;
  dispose(): void;
}

/** Draw into `shadow`: the host's region rules, the view's stylesheet, and the view's drawing under one root. */
export function createOpenDrawing(shadow: ShadowRoot, options: OpenDrawingOptions): OpenDrawing {
  const document = shadow.ownerDocument;
  const base = document.createElement("style");
  base.setAttribute("data-graview-region", "");
  base.textContent = REGION_CSS;
  const sheet = document.createElement("style");
  sheet.setAttribute("data-graview-view-style", "");
  const into = document.createElement("div");
  into.setAttribute("data-graview-view-root", "");
  shadow.append(base, sheet, into);

  const renderer = createOpenRenderer(into, {
    origin: options.origin,
    ...(options.asset ? { asset: options.asset } : {}),
    ...(options.imageOrigins ? { imageOrigins: options.imageOrigins } : {}),
    ...(options.picture ? { picture: options.picture } : {}),
    ...(options.link ? { link: options.link } : {}),
    ...(options.onRefused ? { onRefused: options.onRefused } : {}),
    ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
    ...(options.onOverBudget ? { onOverBudget: options.onOverBudget } : {}),
    decorate: (element, name, namespace) => {
      /* A button presses, and never submits; a field is never filled from what the browser remembers of the viewer. */
      if (namespace === "html" && name === "button") element.setAttribute("type", "button");
      if (namespace === "html" && (name === "input" || name === "textarea" || name === "select")) element.setAttribute("autocomplete", "off");
      options.decorate?.(element, name, namespace);
    },
    ...(options.onFieldSet ? { onFieldSet: options.onFieldSet } : {}),
    ...(options.onAttribute ? { onAttribute: options.onAttribute } : {}),
  });
  const cssRefused: ViewRefusal[] = [];
  let css = "";

  /** The nearest element the view drew, at or above where it happened. */
  const drawnAt = (event: Event): Element | undefined => {
    for (let at = event.composedPath()[0] as Node | null | undefined; at && at !== into && at !== shadow; at = at.parentNode) {
      if (at.nodeType === 1 && renderer.idOf(at) !== undefined) return at as Element;
    }
    return undefined;
  };
  const hear = (event: Event) => {
    const element = drawnAt(event);
    if (!element) return;
    if (event.type === "keydown" && !KEYS.has((event as KeyboardEvent).key)) return;
    const said = options.before?.(event, element, into);
    if (said === false) return;
    const field = element as HTMLInputElement;
    const isField = element.namespaceURI === "http://www.w3.org/1999/xhtml" && ["input", "select", "textarea"].includes(element.localName);
    options.send({
      type: "dom-event",
      target: renderer.idOf(element)!,
      event: event.type,
      ...(isField ? { value: String(field.value ?? "") } : {}),
      ...(isField && (field.type === "checkbox" || field.type === "radio") ? { checked: field.checked } : {}),
      ...(event.type === "keydown" ? { key: (event as KeyboardEvent).key } : {}),
      ...(said ?? {}),
    });
    /*
     * ENTER AND SPACE PRESS WHAT THE HOST MADE A PRESS (0.1.47): on a
     * control that does not press of itself — a `<div role="button">`, a
     * tab, a toggle, an element bound to an act — the key is told to the
     * view, and then a click, as a button's is; the page does not scroll
     * under Space.
     */
    const key = event.type === "keydown" ? (event as KeyboardEvent).key : undefined;
    if ((key === "Enter" || key === " ") && element.hasAttribute("data-graview-press") && event.composedPath()[0] === element) {
      event.preventDefault();
      options.send({ type: "dom-event", target: renderer.idOf(element)!, event: "click" });
    }
  };
  for (const type of EVENTS) shadow.addEventListener(type, hear);
  /* `toggle` does not bubble: heard on the way down. */
  shadow.addEventListener("toggle", hear, true);
  /*
   * THE RING AT THE EDGE, WHERE THE REGION CANNOT LET IT PAST (an engine with
   * no `overflow-clip-margin`): a control that takes the keyboard within the
   * ring's reach of the region's edge draws its ring inside its own edge,
   * measured in the layout's pixels (a Scene's plane scales the region).
   */
  const clipsPast = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("overflow-clip-margin", "4px");
  /*
   * A RING WIDER THAN THE DEFAULT: a view that sets `--graview-focus-width` or
   * `--graview-focus-offset` inside its own drawing, where the region's rule
   * cannot read it, has its ring measured as a control takes the keyboard,
   * and the region lets that much past its edge (`--graview-ring-reach`).
   */
  shadow.addEventListener("focusin", (event) => {
    const at = event.composedPath()[0] as Element | undefined;
    const host = shadow.host as HTMLElement;
    if (!at || at.nodeType !== 1 || !into.contains(at)) return;
    const reach = ringReach(at);
    if (clipsPast) {
      host.style.setProperty("--graview-ring-reach", `${reach}px`);
      return;
    }
    const region = host.getBoundingClientRect();
    const box = at.getBoundingClientRect();
    const scaled = reach * (host.offsetWidth > 0 ? region.width / host.offsetWidth : 1);
    const flush = box.left - region.left < scaled || region.right - box.right < scaled || box.top - region.top < scaled || region.bottom - box.bottom < scaled;
    at.toggleAttribute("data-graview-ring-inside", flush);
  });

  return {
    /*
     * THE KEYBOARD STAYS WHERE IT WAS (0.1.47): what had it before a batch
     * has it after, though the view moved it among its siblings (a keyed
     * element, `data-key`, drawn again in another place) — moving an element
     * in a page takes its focus away, so it is given back.
     */
    apply(records, spent) {
      const had = shadow.activeElement;
      const id = had ? renderer.idOf(had) : undefined;
      const done = renderer.apply(records, spent);
      if (id !== undefined && shadow.activeElement !== had) {
        const now = renderer.elementOf(id) as HTMLElement | undefined;
        if (now?.isConnected && typeof now.focus === "function") now.focus({ preventScroll: true });
      }
      return done;
    },
    style(given) {
      const judged = sanitizeStylesheets(given);
      cssRefused.length = 0;
      for (const one of judged.refused) {
        cssRefused.push({ reason: "css", name: "stylesheet", css: one });
        if (cssRefused.length > 200) cssRefused.shift();
      }
      css = judged.css;
      sheet.textContent = css;
    },
    renderer,
    get refused() {
      return [...renderer.refused, ...cssRefused];
    },
    get css() {
      return css;
    },
    dispose() {
      for (const type of EVENTS) shadow.removeEventListener(type, hear);
      shadow.removeEventListener("toggle", hear, true);
      renderer.dispose();
      shadow.replaceChildren();
    },
  };
}

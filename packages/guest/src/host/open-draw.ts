import type { GuestDomEvent } from "../protocol.js";
import { sanitizeStylesheet, type CssRefusal } from "./css.js";
import type { OpenNamespace, OpenRefusal } from "./open-judge.js";
import { createOpenRenderer, type OpenRenderer } from "./open-render.js";

/*
 * A WORKER VIEW'S REGION, DRAWN (FR-90): the open kit's renderer and
 * stylesheet in a shadow root the host owns, and the viewer's clicks,
 * typing and choices on what was drawn told to the view. This module is
 * what `mountWorkerView` fetches when it first draws an open-kit view, so a
 * page that draws none loads none of the sanitiser.
 */

/** The host's own rules for the region: what a view's stylesheet cannot reach, because it cannot write `:host`. */
export const REGION_CSS = `
:host { display: block; position: relative; contain: layout paint style; isolation: isolate; overflow: clip; min-width: 0; }
[data-graview-view-root] { color: var(--graview-ink, CanvasText); font-family: var(--graview-font-body, system-ui, sans-serif); line-height: 1.45; }
[data-graview-view-root] [data-graview-link] { cursor: pointer; }
`;

/** The keys a view hears: enough to move and choose, never what the viewer types into the app elsewhere. */
const KEYS = new Set(["Enter", " ", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
const EVENTS = ["click", "input", "change", "keydown"] as const;

export interface OpenDrawingOptions {
  /** The host page's origin, for a `blob:` image of its own. */
  readonly origin: string;
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
  /** Draw one batch of the view's mutation records. */
  apply(records: unknown): void;
  /** Draw the view's one stylesheet, as the open kit allows it. */
  style(css: string): void;
  readonly renderer: OpenRenderer;
  /** What was refused of the drawing and the stylesheet (the last 200 of each). */
  readonly refused: readonly ViewRefusal[];
  /** The stylesheet as drawn. */
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
  };
  for (const type of EVENTS) shadow.addEventListener(type, hear);
  /* `toggle` does not bubble: heard on the way down. */
  shadow.addEventListener("toggle", hear, true);

  return {
    apply: (records) => renderer.apply(records),
    style(given) {
      const judged = sanitizeStylesheet(given);
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

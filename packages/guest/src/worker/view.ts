/*
 * A WORKER VIEW'S RUNTIME (FR-90): `@graview/guest/worker/view`.
 *
 * The open kit's half in the worker. Like the kit's guest entry
 * (worker/index.ts) it keeps how to hear the host, boots Remote DOM's
 * polyfill and hardens the worker before a line of the view runs; unlike
 * it, it defines no components. A view draws plain HTML and SVG, and gives
 * one stylesheet, and the host draws what the open kit allows of them
 * (open-kit.ts, host/open-render.ts, host/css.ts).
 *
 * What a view is handed is one global, `graview`, kept through hardening
 * and frozen with the rest:
 *
 *   graview.props            what the host last pushed: the viewer's sight
 *   graview.onProps(fn)      called with every push (and at once, if there is one)
 *   graview.render(markup)   draw: a string of HTML, `graview.html`…`` or nodes
 *   graview.style(css)       the view's one stylesheet
 *   graview.on(type, selector, fn)   hear the viewer: click, input, change, keydown, toggle
 *   graview.act(name, args)  ask for an act; resolves with the host's answer
 *   graview.navigate(to)     go to a record (its id) or a place ({ place: slug })
 *   graview.html``           markup, with every value put in it escaped
 *
 * `render` keeps what is already drawn where it can — same element, same
 * key (`data-key` or `id`) — and changes only what moved, so a field the
 * viewer is typing in keeps its text and its focus across a push.
 */
import { natives } from "./natives.js";
import "@remote-dom/core/polyfill";
import { RemoteRootElement, remoteId } from "@remote-dom/core/elements";
import { openGuest } from "../channel.js";
import { HTML_ELEMENTS, UNNAMED_ELEMENTS, openAttribute, svgElementName } from "../open-kit.js";
import type { GuestAnswer, GuestDomEvent, GuestPressed, GuestProps, HostMessage } from "../protocol.js";
import { harden, type Hardening } from "./harden.js";
import { createListenerLedger } from "./listeners.js";

/** The element a view's drawing hangs from; the host's region stands for it. */
export const VIEW_ROOT = "graview-view-root";
customElements.define(VIEW_ROOT, RemoteRootElement as unknown as CustomElementConstructor);

/** Markup made by `graview.html`: drawn as it is, where a plain string put in it is escaped. */
export interface Html {
  readonly html: string;
  toString(): string;
}

/** What a view hears when the viewer acts on what it drew. */
export interface ViewEvent {
  readonly type: string;
  /** The element it happened on. */
  readonly target: Element;
  /** The element `on`'s selector matched, at or above the target. */
  readonly element: Element;
  /** A field's value, as the viewer left it. */
  readonly value?: string;
  readonly checked?: boolean;
  /** A key's name, for `keydown`. */
  readonly key?: string;
  /** What became of the act this press was bound to (`data-act`): the host applied it, or refused it, before the view heard (FR-92). */
  readonly pressed?: GuestPressed;
}

export type Drawable = string | Html | Node | readonly (string | Html | Node)[] | null | undefined;

export interface GraviewView {
  readonly props: GuestProps | undefined;
  onProps(listener: (props: GuestProps) => void): () => void;
  render(content: Drawable): void;
  style(css: string): void;
  on(type: string, selector: string, listener: (event: ViewEvent) => void): () => void;
  act(name: string, args?: Readonly<Record<string, unknown>>): Promise<GuestAnswer>;
  navigate(to: string | { readonly place: string }): void;
  html(strings: TemplateStringsArray, ...values: unknown[]): Html;
  /** What the host will not draw of the last render, as the open kit says it: an author's early word, not the host's judgement. */
  readonly refused: readonly string[];
  readonly hardening: Hardening;
}

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const markup = (html: string): Html => Object.freeze({ html, toString: () => html });
const isHtml = (value: unknown): value is Html => typeof value === "object" && value !== null && typeof (value as Html).html === "string" && Object.isFrozen(value);
const piece = (value: unknown): string => {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(piece).join("");
  if (isHtml(value)) return value.html;
  return escape(String(value));
};

/* ── the connection ──────────────────────────────────────────────────────── */

/* Kept as the runtime found them: a view's own code cannot swap what the runtime builds with. */
const DomEvent = Event;
const ledger = createListenerLedger();
const propsListeners = new Set<(props: GuestProps) => void>();
const delegated = new Set<{ readonly type: string; readonly selector: string; readonly listener: (event: ViewEvent) => void }>();
let current: GuestProps | undefined;
let refusedLast: string[] = [];

const root = document.createElement(VIEW_ROOT) as unknown as RemoteRootElement & Element;

const byId = (id: string): Element | undefined => {
  const walk = (node: Node): Element | undefined => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      if (remoteId(child) === id) return child as Element;
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  };
  return walk(root as unknown as Node);
};

const heard = (message: GuestDomEvent) => {
  const target = byId(message.target);
  if (!target) return;
  const event = new DomEvent(message.event, { bubbles: true });
  for (const key of ["value", "checked", "key", "pressed"] as const) if (message[key] !== undefined) Object.defineProperty(event, key, { value: message[key], enumerable: true });
  target.dispatchEvent(event);
  for (const one of delegated) {
    if (one.type !== message.event) continue;
    let matching: Set<Element>;
    try {
      matching = new Set(Array.from(root.querySelectorAll(one.selector)));
    } catch {
      continue;
    }
    for (let at: Element | null = target; at && at !== (root as unknown as Element); at = at.parentNode as Element | null) {
      if (!matching.has(at)) continue;
      one.listener(Object.freeze({ type: message.event, target, element: at, ...(message.value !== undefined ? { value: message.value } : {}), ...(message.checked !== undefined ? { checked: message.checked } : {}), ...(message.key !== undefined ? { key: message.key } : {}), ...(message.pressed !== undefined ? { pressed: message.pressed } : {}) }));
      break;
    }
  }
};

const opened = openGuest(
  {
    listen(hear) {
      natives.listen(hear);
      return () => natives.unlisten(hear);
    },
    /* A dedicated worker hears only its owner: whoever posts to it is the host that started it. */
    fromHost: () => true,
    ready: (message) => natives.post(message),
  },
  {
    onMessage(message: HostMessage) {
      if (message.type === "dom-event" && typeof message.target === "string") return heard(message);
      if (message.type !== "props") return;
      /*
       * A PUSH, TIMED. The view's listeners run now; what they drew goes in
       * the next microtask; then the runtime says it has drawn this push,
       * and how long the view's own work took (FR-94). The view cannot say
       * it for itself: the port is the runtime's.
       */
      current = message.props;
      const began = natives.now();
      for (const listener of propsListeners) {
        try {
          listener(message.props);
        } catch (error) {
          console.error(error);
        }
      }
      const ms = natives.now() - began;
      const push = message.push;
      if (typeof push === "number") natives.microtask(() => natives.microtask(() => opened.send({ type: "pushed", push, ms })));
    },
  },
);

/* A microtask's mutations go as one message: a render is one message, not one per node. */
let pending: unknown[] | undefined;
root.connect({
  mutate(records: readonly unknown[]) {
    if (!pending) {
      pending = [];
      natives.microtask(() => {
        const batch = pending ?? [];
        pending = undefined;
        opened.send({ type: "render", records: ledger.encode(batch) });
      });
    }
    pending.push(...records);
  },
  call: () => undefined,
} as never);

/* ── drawing ─────────────────────────────────────────────────────────────── */

const keyOf = (node: Node) => (node.nodeType === 1 ? ((node as Element).getAttribute("data-key") ?? (node as Element).getAttribute("id")) : null);
const same = (a: Node, b: Node) =>
  a.nodeType === b.nodeType && (a.nodeType !== 1 || ((a as Element).localName === (b as Element).localName && (a as Element).namespaceURI === (b as Element).namespaceURI && keyOf(a) === keyOf(b)));

/** Make `live` hold what `next` holds, keeping every node that can stay. */
function morph(live: Node, next: Node): void {
  const wanted = Array.from(next.childNodes);
  let index = 0;
  for (const want of wanted) {
    const have = live.childNodes[index] ?? null;
    if (have && same(have, want)) {
      update(have, want);
      index += 1;
      continue;
    }
    const key = keyOf(want);
    if (key !== null) {
      const later = Array.from(live.childNodes)
        .slice(index + 1)
        .find((candidate) => same(candidate, want));
      if (later) {
        live.insertBefore(later, have);
        update(later, want);
        index += 1;
        continue;
      }
    }
    live.insertBefore(want, have);
    index += 1;
  }
  while (live.childNodes.length > index) live.removeChild(live.lastChild!);
}

function update(have: Node, want: Node): void {
  if (have.nodeType !== 1) {
    if ((have as CharacterData).data !== (want as CharacterData).data) (have as CharacterData).data = (want as CharacterData).data;
    return;
  }
  const from = have as Element;
  const to = want as Element;
  for (const name of from.getAttributeNames()) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const name of to.getAttributeNames()) {
    const value = to.getAttribute(name)!;
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
  morph(from, to);
}

/** What the host will not draw, by the open kit's tables: said at once, for the author. */
function precheck(node: Node, svg: boolean, said: Set<string>): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== 1) continue;
    const element = child as Element;
    const name = element.localName;
    const inSvg = svg || name.toLowerCase() === "svg";
    const canonical = inSvg ? svgElementName(name) : Object.prototype.hasOwnProperty.call(HTML_ELEMENTS, name.toLowerCase()) ? name.toLowerCase() : undefined;
    if (!canonical) {
      said.add(`<${name}>`);
      continue;
    }
    for (const attribute of element.getAttributeNames()) {
      if (!openAttribute(inSvg ? "svg" : "html", canonical, attribute) || (!inSvg && UNNAMED_ELEMENTS[canonical]?.includes(attribute.toLowerCase()))) said.add(`${canonical} ${attribute}`);
    }
    precheck(element, inSvg, said);
  }
}

function render(content: Drawable): void {
  const next = document.createElement("div");
  const parts = Array.isArray(content) ? content : [content];
  for (const part of parts) {
    if (part === null || part === undefined) continue;
    if (typeof part === "string" || isHtml(part)) {
      const holder = document.createElement("div");
      holder.innerHTML = typeof part === "string" ? part : part.html;
      next.append(...Array.from(holder.childNodes));
    } else next.append(part as Node);
  }
  const said = new Set<string>();
  precheck(next, false, said);
  refusedLast = [...said];
  if (refusedLast.length > 0) console.warn(`The host will not draw: ${refusedLast.join(", ")}`);
  morph(root as unknown as Node, next);
}

let styled: string | undefined;

/* ── the global ──────────────────────────────────────────────────────────── */

const view: GraviewView = Object.freeze({
  get props() {
    return current;
  },
  onProps(listener: (props: GuestProps) => void) {
    propsListeners.add(listener);
    if (current) listener(current);
    return () => void propsListeners.delete(listener);
  },
  render,
  style(css: string) {
    if (typeof css !== "string" || css === styled) return;
    styled = css;
    opened.send({ type: "style", css });
  },
  on(type: string, selector: string, listener: (event: ViewEvent) => void) {
    const one = { type, selector, listener };
    delegated.add(one);
    return () => void delegated.delete(one);
  },
  act: (name: string, args: Readonly<Record<string, unknown>> = {}) => opened.guest.act(name, args),
  navigate(to: string | { readonly place: string }) {
    if (typeof to === "string") opened.guest.navigate(to);
    else if (to && typeof to.place === "string") opened.send({ type: "navigate", place: to.place } as never);
  },
  html(strings: TemplateStringsArray, ...values: unknown[]) {
    return markup(strings.reduce((out, text, index) => out + text + (index < values.length ? piece(values[index]) : ""), ""));
  },
  get refused() {
    return refusedLast;
  },
  get hardening() {
    return hardening;
  },
});

Object.defineProperty(globalThis, "graview", { value: view, enumerable: true, configurable: true, writable: false });

/**
 * WHAT HARDENING TOOK (FR-70), with `graview` kept. As for the kit's guest:
 * a name that will not go stops the runtime before the view runs, and in a
 * test of the runtime outside a worker nothing is hardened.
 */
export const hardening: Hardening = "WorkerGlobalScope" in globalThis ? harden(globalThis, ["graview"]) : { removed: [], stuck: [], sealed: false, worker: false };
if (hardening.stuck.length > 0) throw new Error(`The view's worker could not be hardened: ${hardening.stuck.join(", ")} would not go.`);

export { view as graview };
export type { GuestAnswer, GuestPressed, GuestProps, GuestTheme } from "../protocol.js";

/*
 * THE `graview` GLOBAL, WHEREVER A VIEW RUNS (FR-90, FR-95).
 *
 * What a view is handed — `props`, `onProps`, `render`, `style`, `on`,
 * `act`, `navigate`, `html` — made over Remote DOM's polyfilled document
 * and a way out the runtime gives it: the port to the host, in a worker
 * (worker/view.ts), or the transcript of a headless run, in an isolate a
 * host chose (headless/runtime.ts). Either way the view is the same script
 * and is handed the same global, so what it draws headless is what it
 * draws in the page.
 *
 * `render` keeps what is already drawn where it can — same element, same
 * key (`data-key` or `id`) — and changes only what moved, so a field the
 * viewer is typing in keeps its text and its focus across a push.
 */
import { RemoteRootElement, remoteId, updateRemoteElementAttribute } from "@remote-dom/core/elements";
import type { Unsent } from "../channel.js";
import { HTML_ELEMENTS, UNNAMED_ELEMENTS, openAttribute, svgElementName } from "../open-kit.js";
import { PART_NAME, PART_REST_PUSHES, PART_SHARE } from "../part.js";
import { GUEST_GESTURES, navigateRequest, type GuestAnswer, type GuestDomEvent, type GuestDroppedFile, type GuestGesture, type GuestNavigateTo, type GuestPressed, type GuestProps, type HostMessage } from "../protocol.js";
import { dayIn, fromToday } from "../from-today.js";
import type { Hardening } from "./harden.js";
import { createListenerLedger } from "./listeners.js";

/** The element a view's drawing hangs from; the host's region stands for it. */
export const VIEW_ROOT = "graview-view-root";

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
  /** On `drop`: the files the person dropped on (or picked for) a `data-drop` element, as the host stored them, never their bytes (FR-193). */
  readonly files?: readonly GuestDroppedFile[];
  /** On `drop`: each file the host would not take, and why. */
  readonly refused?: readonly string[];
  /**
   * What became of the act this press was bound to (`data-act`): the host
   * applied it, or refused it, before the view heard (FR-92). On an
   * `acted` event — heard after every act a press or a field saved as it
   * is typed (`data-save`) asked for — `ok`, and `reason` and `message`
   * when it was refused (FR-191).
   */
  readonly pressed?: GuestPressed;
  /**
   * A GESTURE (0.1.42), for a view whose manifest says `gestures: true`:
   * on `wheel`, `drag` and `pinch`, where the pointer is (`x`, `y`, CSS
   * pixels from the top left of `element`) and `element`'s size (`width`,
   * `height`). On `wheel`, `deltaX`, `deltaY` and `deltaMode`, summed over
   * the frame, and `ctrlKey` and `metaKey`. On `drag`, `phase` (`start`,
   * `move`, `end`), `pointerId`, `button`, `pressure` and `dx`, `dy` since
   * the view last heard of that pointer. On `pinch`, `phase` (`start`,
   * `change`, `end`), `scale` — the factor since the view last heard — and
   * `rotation` in degrees: Safari's gesture, or a trackpad's pinch (a wheel
   * with Control held) where the view listens for `pinch`.
   */
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly deltaX?: number;
  readonly deltaY?: number;
  readonly deltaMode?: number;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly phase?: "start" | "move" | "change" | "end";
  readonly pointerId?: number;
  readonly button?: number;
  readonly pressure?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly scale?: number;
  readonly rotation?: number;
}

/** What the host tells of an event, beyond its name and target: each copied onto the view's event when it is said. */
const SAID = ["value", "checked", "key", "pressed", "files", "refused", "x", "y", "width", "height", "deltaX", "deltaY", "deltaMode", "ctrlKey", "metaKey", "phase", "pointerId", "button", "pressure", "dx", "dy", "scale", "rotation"] as const;

export type Drawable = string | Html | Node | readonly (string | Html | Node)[] | null | undefined;

/** What a part's `draw` returns: markup, as `render` takes it, without nodes. */
export type PartDrawn = string | Html | readonly (string | Html)[] | null | undefined | false;

/** The elements a part may be drawn as: one that holds what it drew, wherever it stands. */
export type PartElement = "div" | "li" | "article";
const PART_ELEMENTS: ReadonlySet<string> = new Set(["div", "li", "article"]);

/** An act's arguments, or a list of them: several of the act as one change, one undo (FR-193). */
export type ActArgs = Readonly<Record<string, unknown>> | readonly Readonly<Record<string, unknown>>[];

export interface GraviewView {
  readonly props: GuestProps | undefined;
  onProps(listener: (props: GuestProps) => void): () => void;
  render(content: Drawable): void;
  /** Add a stylesheet after the ones before it; a sheet given again is the one already there. */
  style(css: string): void;
  on(type: string, selector: string, listener: (event: ViewEvent) => void): () => void;
  /** Ask for an act; with a list of arguments, several of it as one change that one undo takes back (FR-193). */
  act(name: string, args?: ActArgs): Promise<GuestAnswer>;
  /** Go to a record, a place or a kind's list — narrowed (`where`) and to a `section`, as `GuestNavigateTo` says. */
  navigate(to: GuestNavigateTo): void;
  html(strings: TemplateStringsArray, ...values: unknown[]): Html;
  /**
   * ONE PART OF WHAT IT DRAWS, THAT FAILS ALONE (Roadmap f-view-part-fails-alone):
   * `draw`'s markup in a `<div data-part="name">` (`as: "li"` or `"article"`
   * for another element). Where `draw` throws, or takes more than its share
   * of the push's time (a quarter of `pushMs`), the part is handed on empty
   * and marked failed, the host draws a note in its place, the rest of the
   * view is drawn, and why is said in its console and to the host. A part
   * that took too long is not run again while the view is drawn.
   */
  part(name: string, draw: () => PartDrawn, options?: { readonly as?: PartElement }): Html;
  /** The app's today, `YYYY-MM-DD`, on the app's clock (`props.today`): never a day the view pins. */
  readonly today: string;
  /** A day or a moment said against today: "today", "tomorrow", "in 3 days", "2 weeks ago"; with `{ due: true }`, a past day is "overdue". */
  fromToday(day: string, options?: { readonly due?: boolean }): string;
  /**
   * WHAT THE VIEW KEEPS FOR WHOEVER IS LOOKING AT IT: strings of at most
   * 4 KB, by key, its own and no other view's, never the graph's. `props.mine`
   * holds them at draw time; a `set` the host would not keep rejects with
   * the sentence saying why.
   */
  readonly mine: { get(key: string): Promise<string | null>; set(key: string, value: string | null): Promise<void> };
  /** What the host will not draw of the last render, as the open kit says it: an author's early word, not the host's judgment. */
  readonly refused: readonly string[];
  readonly hardening: Hardening;
}

/** The runtime's way out, and what it keeps for itself: nothing here is the view's to reach. */
export interface ViewIo {
  /** A message for the host. */
  send(request: Unsent): void;
  /** Ask the host for an act, or several of it as one change, and hear its answer. */
  act(name: string, args: ActArgs): Promise<GuestAnswer>;
  /** Ask to go to a record. */
  navigate(to: string): void;
  microtask(task: () => void): void;
  /** A clock for the view's own time over a push (FR-94). */
  now(): number;
  /** A view's listener threw: the runtime carries on, and says so where the host can hear it. */
  threw(error: unknown): void;
  /** The author's early word on what the host will not draw. */
  warn(text: string): void;
  /** What hardening did, once it has. */
  hardening(): Hardening;
}

export interface ViewRuntime {
  readonly view: GraviewView;
  /** A message from the host: a push of props, or what the viewer did on what the view drew. */
  hear(message: HostMessage): void;
  /** The id of the first element drawn that a selector matches, as `graview.on` matches it: what a headless run presses (0.1.45). */
  find(selector: string): string | undefined;
  /** The ids of the elements drawn that a selector the view hears `type` on matches: what an audit holds to the keyboard (Roadmap f-view-a11y-audit). */
  listened(type: string): string[];
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

/**
 * Make the global over Remote DOM's polyfilled document, which must be in
 * place already. Once per runtime: the root element is defined here.
 */
export function createViewRuntime(io: ViewIo): ViewRuntime {
  if (!customElements.get(VIEW_ROOT)) customElements.define(VIEW_ROOT, RemoteRootElement as unknown as CustomElementConstructor);
  /* Kept as the runtime found them: a view's own code cannot swap what the runtime builds with. */
  const DomEvent = Event;
  const ledger = createListenerLedger();
  const propsListeners = new Set<(props: GuestProps) => void>();
  const delegated = new Set<{ readonly type: string; readonly selector: string; readonly listener: (event: ViewEvent) => void }>();
  let current: GuestProps | undefined;
  let refusedLast: string[] = [];
  const heardOf = new Set<string>();

  /*
   * WHAT REMOTE DOM'S ELEMENTS LACK, SAID. Its polyfill has no `closest`,
   * `matches` or `dataset`: a view that reaches for one is told the way
   * that works, rather than that undefined is not a function.
   */
  for (const name of ["closest", "matches", "dataset"]) {
    const lacks = () => {
      throw new TypeError(`A view's element has no ${name}: graview.on hands event.element, the element its selector matched; read event.element.getAttribute("data-…").`);
    };
    if (!(name in Element.prototype)) Object.defineProperty(Element.prototype, name, name === "dataset" ? { get: lacks } : { value: lacks });
  }

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
    const said: Record<string, unknown> = {};
    for (const key of SAID) if (message[key] !== undefined) said[key] = message[key];
    for (const key of Object.keys(said)) Object.defineProperty(event, key, { value: said[key], enumerable: true });
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
        one.listener(Object.freeze({ type: message.event, target, element: at, ...said }));
        break;
      }
    }
  };

  /* Kept as the runtime found it: a view's code cannot swap what a refusal is said with. */
  const Refused = Error;
  /* What `graview.mine` has asked and not yet heard. */
  const asked = new Map<number, (answer: Extract<HostMessage, { type: "mine-answer" }>) => void>();
  let askedLast = 0;
  const ask = (op: "get" | "set", key: string, value?: string | null) =>
    new Promise<Extract<HostMessage, { type: "mine-answer" }>>((resolve, reject) => {
      const id = ++askedLast;
      asked.set(id, (answer) => (answer.ok ? resolve(answer) : reject(new Refused(answer.sentence ?? "This value was not kept."))));
      /* The value as the view gave it, `undefined` too: the host refuses what is not a string or null. */
      io.send({ type: "mine", id, op, key, ...(op === "set" ? { value: value as string | null } : {}) });
    });
  /* Heard by whoever awaits it; a view that does not is told in its console by the host, and no rejection goes unhandled to stop a run. */
  const said = <T,>(answer: Promise<T>): Promise<T> => {
    answer.catch(() => undefined);
    return answer;
  };
  const mine = Object.freeze({
    get(key: string) {
      return said(ask("get", key).then((answer) => (typeof answer.value === "string" ? answer.value : null)));
    },
    set(key: string, value: string | null) {
      return said(ask("set", key, value).then(() => undefined));
    },
  });

  const hear = (message: HostMessage) => {
    if (message.type === "mine-answer") {
      const resolve = asked.get(message.id as number);
      asked.delete(message.id as number);
      return resolve?.(message);
    }
    if (message.type === "dom-event" && typeof message.target === "string") return heard(message);
    if (message.type === "notice") return io.warn(message.text);
    if (message.type !== "props") return;
    /*
     * A PUSH, TIMED. The view's listeners run now; what they drew goes in
     * the next microtask; then the runtime says it has drawn this push,
     * and how long the view's own work took (FR-94). The view cannot say
     * it for itself: the way out is the runtime's.
     */
    current = message.props;
    if (typeof message.partMs === "number" && message.partMs > 0) partMs = message.partMs;
    if (typeof message.partMark === "string") partMark = message.partMark;
    pushes += 1;
    turns.clear();
    innerMs = 0;
    const began = io.now();
    for (const listener of propsListeners) {
      try {
        listener(message.props);
      } catch (error) {
        io.threw(error);
      }
    }
    const ms = io.now() - began;
    const push = message.push;
    if (typeof push === "number") io.microtask(() => io.microtask(() => io.send({ type: "pushed", push, ms })));
  };

  /* A microtask's mutations go as one message: a render is one message, not one per node. */
  let pending: unknown[] | undefined;
  root.connect({
    mutate(records: readonly unknown[]) {
      if (!pending) {
        pending = [];
        io.microtask(() => {
          const batch = pending ?? [];
          pending = undefined;
          io.send({ type: "render", records: ledger.encode(batch) });
        });
      }
      pending.push(...records);
    },
    call: () => undefined,
  } as never);

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
    const custom = isCustom(from);
    for (const name of from.getAttributeNames()) {
      if (to.hasAttribute(name)) continue;
      from.removeAttribute(name);
      if (custom) updateRemoteElementAttribute(from, name, undefined);
    }
    for (const name of to.getAttributeNames()) {
      const value = to.getAttribute(name)!;
      if (from.getAttribute(name) !== value) from.setAttribute(name, value);
      if (custom) updateRemoteElementAttribute(from, name, value);
    }
    morph(from, to);
  }

  /*
   * AN ELEMENT THE HOST DRAWS FOR THE VIEW (`<graview-video>`, 0.1.37). Remote
   * DOM sends no attribute of an element whose name has a hyphen unless it is
   * told it as the element's own: each is told, so the host hears what the
   * view named.
   */
  const isCustom = (element: Element) => element.localName.includes("-");
  function tellCustom(node: Node): void {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      const element = child as Element;
      if (isCustom(element)) for (const name of element.getAttributeNames()) updateRemoteElementAttribute(element, name, element.getAttribute(name) ?? undefined);
      tellCustom(element);
    }
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
    if (refusedLast.length > 0) io.warn(`The host will not draw: ${refusedLast.join(", ")}`);
    tellCustom(next);
    morph(root as unknown as Node, next);
    /* The parts of the next render are counted afresh: a name's turn is its place in one render. */
    turns.clear();
  }

  /*
   * A PART THAT FAILS FALLS BACK ALONE (Roadmap f-view-part-fails-alone).
   * A view hands the host markup, so what throws is the view's own code
   * making it: `graview.part` runs one part's, catches what it throws and
   * times it, and hands on, in the part's place, an empty element marked
   * failed with why — which the host draws its note in (host/parts.ts).
   * The time is the part's own, the parts inside it not counted, as a
   * push's is the view's own: a part past its share is handed on as failed
   * for the next `PART_REST_PUSHES` pushes without running, so it cannot go
   * on to take the whole view's budget, and is tried again on the one after.
   * A part is known by its name and its turn among the parts of that name
   * in one render, so rows drawn in a loop under one name are told apart.
   * A part that never returns cannot be caught here: that is the whole
   * view's stop, as before. What the runtime marks failed carries the mark
   * the host handed it (`partMark`), so the host honors no mark the view
   * wrote itself.
   */
  let partMs = 1_000 / PART_SHARE;
  let partMark = "";
  /* The pushes heard, and when each part that took too long is tried again. */
  let pushes = 0;
  const slowParts = new Map<string, { readonly why: string; readonly until: number }>();
  /* Each name's turn in the render being made: cleared at each push and once a render is drawn. */
  const turns = new Map<string, number>();
  /* The time parts inside the one being run took: not that part's own. */
  let innerMs = 0;
  /* Said once for each part and way it failed, however its words change. */
  const toldParts = new Set<string>();
  const thrown = (error: unknown): string => {
    try {
      return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    } catch {
      return "an error";
    }
  };
  const partMarkup = (drawn: PartDrawn): string => {
    if (drawn === null || drawn === undefined || drawn === false) return "";
    if (typeof drawn === "string") return drawn;
    if (isHtml(drawn)) return drawn.html;
    if (Array.isArray(drawn)) return drawn.map((one) => partMarkup(one as PartDrawn)).join("");
    throw new TypeError("a part's draw returns markup: a string, graview.html`…` or a list of them");
  };
  function part(name: string, draw: () => PartDrawn, options?: { readonly as?: PartElement }): Html {
    if (typeof name !== "string" || !PART_NAME.test(name)) throw new TypeError(`graview.part names its part in letters, digits, - and _ ("vendors", "budget-2026"), at most 64 of them.`);
    if (typeof draw !== "function") throw new TypeError(`graview.part("${name}", draw) is handed a function that returns the part's markup.`);
    const tag = typeof options?.as === "string" && PART_ELEMENTS.has(options.as) ? options.as : "div";
    const turn = turns.get(name) ?? 0;
    turns.set(name, turn + 1);
    const key = `${name}#${turn}`;
    const failed = (reason: "threw" | "slow", why: string) => {
      const said = `The part "${name}" ${reason === "threw" ? "threw" : "took too long"}, so a note is drawn in its place and the rest of the view is drawn: ${why}`;
      if (!toldParts.has(`${name} ${reason}`) && toldParts.size < 100) {
        toldParts.add(`${name} ${reason}`);
        io.warn(said);
      }
      return markup(`<${tag} data-part="${name}" data-part-failed="${reason}" data-part-why="${escape(why.slice(0, 300))}"${partMark ? ` data-part-mark="${escape(partMark)}"` : ""}></${tag}>`);
    };
    const slow = slowParts.get(key);
    if (slow !== undefined && pushes <= slow.until) return failed("slow", slow.why);
    slowParts.delete(key);
    const outer = innerMs;
    innerMs = 0;
    const began = io.now();
    let made: string;
    let own = 0;
    try {
      made = partMarkup(draw());
    } catch (error) {
      return failed("threw", thrown(error));
    } finally {
      const spent = io.now() - began;
      own = spent - innerMs;
      innerMs = outer + spent;
    }
    if (own > partMs) {
      const why = `it took ${Math.round(own).toLocaleString("en-US")} ms, past the ${Math.round(partMs).toLocaleString("en-US")} ms a part may take of a push, and is left as a note for the next ${PART_REST_PUSHES} pushes.`;
      slowParts.set(key, { why, until: pushes + PART_REST_PUSHES });
      return failed("slow", why);
    }
    return markup(`<${tag} data-part="${name}">${made}</${tag}>`);
  }

  const sheets: string[] = [];

  /*
   * WHERE IT LISTENS FOR A GESTURE (0.1.42): every wheel, drag and pinch
   * selector, said to the host as a whole once a microtask after it moves,
   * so the host takes a wheel from the page only over what the view hears.
   */
  const gestures = new Set<string>(GUEST_GESTURES);
  let gesturesSaid = "[]";
  let gesturesDue = false;
  const sayGestures = () => {
    if (gesturesDue) return;
    gesturesDue = true;
    io.microtask(() => {
      gesturesDue = false;
      const bound = [...new Map([...delegated].filter((one) => gestures.has(one.type)).map((one) => [`${one.type} ${one.selector}`, { event: one.type as GuestGesture, selector: one.selector }])).entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, one]) => one);
      const said = JSON.stringify(bound);
      if (said === gesturesSaid) return;
      gesturesSaid = said;
      io.send({ type: "gestures", bound });
    });
  };

  /*
   * WHERE IT HEARS A CLICK (0.1.48): every selector, said to the host as a
   * whole once a microtask after it moves, so an audit of the page knows what
   * the view hears a click on without being told (`auditView`, which reads
   * it off the region).
   */
  let clicksSaid = "[[],[]]";
  let clicksDue = false;
  const sayClicks = () => {
    if (clicksDue) return;
    clicksDue = true;
    io.microtask(() => {
      clicksDue = false;
      const of = (type: string) => [...new Set([...delegated].filter((one) => one.type === type && typeof one.selector === "string").map((one) => one.selector))].sort().slice(0, 200);
      const selectors = of("click");
      /* And where it hears `acted` (Roadmap f-views-work-end-to-end): a refused press there is the view's to say; anywhere else the host says it beside the control. */
      const acted = of("acted");
      const said = JSON.stringify([selectors, acted]);
      if (said === clicksSaid) return;
      clicksSaid = said;
      io.send({ type: "clicks", selectors, ...(acted.length > 0 ? { acted } : {}) });
    });
  };

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
    /* Every sheet the view gave, in order, sent as the whole list: a design system's sheet and then the view's own are both drawn. */
    style(css: string) {
      if (typeof css !== "string" || sheets.includes(css)) return;
      sheets.push(css);
      io.send({ type: "style", sheets: [...sheets] });
    },
    on(type: string, selector: string, listener: (event: ViewEvent) => void) {
      const one = { type, selector, listener };
      delegated.add(one);
      /* The host is told each event the view hears, once: a view that hears `drop` is left the drop (FR-193). */
      if (typeof type === "string" && !heardOf.has(type)) {
        heardOf.add(type);
        io.send({ type: "hears", events: [type] });
      }
      if (gestures.has(type)) sayGestures();
      if (type === "click" || type === "acted") sayClicks();
      return () => {
        delegated.delete(one);
        if (gestures.has(type)) sayGestures();
        if (type === "click" || type === "acted") sayClicks();
      };
    },
    act: (name: string, args: ActArgs = {}) => io.act(name, args),
    mine,
    navigate(to: GuestNavigateTo) {
      if (typeof to === "string") return io.navigate(to);
      const request = navigateRequest(to);
      if (request) io.send(request);
    },
    part,
    html(strings: TemplateStringsArray, ...values: unknown[]) {
      return markup(strings.reduce((out, text, index) => out + text + (index < values.length ? piece(values[index]) : ""), ""));
    },
    get today() {
      /* Before the first push, the UTC date: a view draws from its props, which carry the app's. */
      return current?.today ?? new Date().toISOString().slice(0, 10);
    },
    fromToday(day: string, options?: { readonly due?: boolean }) {
      const on = dayIn(day, current?.timeZone);
      return on === undefined ? "" : fromToday(on, view.today, options);
    },
    get refused() {
      return refusedLast;
    },
    get hardening() {
      return io.hardening();
    },
  });

  const find = (selector: string): string | undefined => {
    try {
      const found = root.querySelectorAll(selector)[0];
      return found ? remoteId(found) : undefined;
    } catch {
      return undefined;
    }
  };

  const listened = (type: string): string[] => {
    const ids = new Set<string>();
    for (const one of delegated) {
      if (one.type !== type) continue;
      try {
        for (const element of Array.from(root.querySelectorAll(one.selector))) {
          const id = remoteId(element);
          if (id) ids.add(id);
        }
      } catch {
        /* A selector the polyfill cannot read hears nothing. */
      }
    }
    return [...ids];
  };

  return { view, hear, find, listened };
}

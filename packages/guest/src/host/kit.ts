import { GUEST_KIT, KIT_HOST_ATTRIBUTES, KIT_HOST_EVENTS, KIT_HOST_TAGS, KIT_MAX_TEXT, type Kit, type KitComponent, type KitProperty } from "../kit.js";

/*
 * THE HOST'S HALF OF THE KIT (FR-68, FR-69): Remote DOM mutation records
 * from a worker guest, drawn into the host's own document — only a
 * component the kit declares, only the properties and events it declares.
 * Anything else is refused: not drawn, and written down.
 *
 * The record format is Remote DOM's (`@remote-dom/core` constants, held to
 * these by a test), read here without the library, so a host that draws a
 * worker guest carries none of it.
 */

const INSERT_CHILD = 0;
const REMOVE_CHILD = 1;
const UPDATE_TEXT = 2;
const UPDATE_PROPERTY = 3;
const PROPERTY = 1;
const ATTRIBUTE = 2;
const EVENT_LISTENER = 3;
const ELEMENT = 1;
const TEXT = 3;
const COMMENT = 8;
const ROOT_ID = "~";

/** Why a part of what a guest drew was not drawn. */
export type KitRefusalReason =
  /** An element outside the kit. */
  | "element"
  /** A property its component does not declare. */
  | "property"
  /** An event its component does not declare. */
  | "event"
  /** A raw attribute: a kit component has properties, never attributes. */
  | "attribute"
  /** A value of the wrong type for its declaration. */
  | "value"
  /** A `url` that is not an absolute `https:` URL. */
  | "url"
  /** A child its component may not hold. */
  | "child"
  /** A record the format does not know. */
  | "record"
  /** More nodes than the guest is allowed. */
  | "budget";

export interface KitRefusal {
  readonly reason: KitRefusalReason;
  /** The element it was on or was, when there was one. */
  readonly element?: string;
  /** The property, event or attribute, when it was one. */
  readonly name?: string;
}

export interface KitRendererOptions {
  /** The kit to draw from. `GUEST_KIT` by default. */
  readonly kit?: Kit;
  /** The viewer raised a declared event on something the guest drew: call its listener. */
  readonly onEvent: (listener: number, detail?: string) => void;
  /** The most nodes a guest may have drawn at once. 2 000 by default. */
  readonly maxNodes?: number;
  /** The guest went past `maxNodes`. Called once. */
  readonly onOverBudget?: () => void;
}

export interface KitRenderer {
  /** Draw one batch of mutation records. */
  apply(records: unknown): void;
  /** What was refused, oldest first (the last 200). */
  readonly refused: readonly KitRefusal[];
  /** How many nodes are drawn. */
  readonly size: number;
  dispose(): void;
}

interface Drawn {
  readonly dom: Node;
  readonly name?: string;
  readonly component?: KitComponent;
  readonly children: Drawn[];
  /** A placeholder for something refused: it keeps the guest's indices, and draws nothing. */
  readonly refused?: true;
  readonly text?: true;
  readonly listeners: Map<string, () => void>;
  readonly id?: string;
}

const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The host attribute a property is drawn as. */
export function hostAttribute(name: string, property: KitProperty): string {
  return property.type === "url" ? "href" : (property.as ?? `data-gv-${name.toLowerCase()}`);
}

/** The longest string property, in characters. */
const MAX_PROPERTY = 2_000;

/**
 * A value as the host draws it, or a refusal: exactly the declared type —
 * a string for `string`, a finite number for `number`, a boolean for
 * `boolean`, one of the list for `oneOf` — and for a `url`, a string that
 * parses as an absolute `https:` URL with a host. `null` clears it.
 */
export function kitValue(property: KitProperty, value: unknown): { readonly ok: true; readonly value: string | boolean | null } | { readonly ok: false; readonly reason: "value" | "url" } {
  if (value === null || value === undefined) return { ok: true, value: null };
  const type = property.type;
  if (type === "boolean") return typeof value === "boolean" ? { ok: true, value } : { ok: false, reason: "value" };
  if (type === "number") return typeof value === "number" && Number.isFinite(value) ? { ok: true, value: String(value) } : { ok: false, reason: "value" };
  if (typeof value !== "string" || value.length > MAX_PROPERTY) return { ok: false, reason: type === "url" ? "url" : "value" };
  if (typeof type === "object") return type.oneOf.includes(value) ? { ok: true, value } : { ok: false, reason: "value" };
  if (type === "url") {
    /*
     * Absolute, https:, with a host, and said exactly as it parses: no
     * relative path the page's own base would resolve, no scheme-relative
     * `//`, no `javascript:` behind a space or in capitals.
     */
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return { ok: false, reason: "url" };
    }
    if (parsed.protocol !== "https:" || parsed.hostname === "" || !/^https:\/\//i.test(value)) return { ok: false, reason: "url" };
    return { ok: true, value: parsed.href };
  }
  return { ok: true, value };
}

/** Whether a kit's component draws only what the closed lists allow: a kit is held to them as a guest is. */
function sound(component: KitComponent): boolean {
  return (
    (KIT_HOST_TAGS as readonly string[]).includes(component.host) &&
    Object.values(component.properties).every((property) => property.as === undefined || (property.type !== "url" && (KIT_HOST_ATTRIBUTES as readonly string[]).includes(property.as))) &&
    Object.values(component.events).every((event) => (KIT_HOST_EVENTS as readonly string[]).includes(event.from))
  );
}

/**
 * DRAW A WORKER GUEST'S TREE into `into`, from the kit alone. Every node
 * the guest sends has a place here, so its indices stay true; a refused one
 * holds its place as an empty comment and nothing under it is drawn.
 */
export function createKitRenderer(into: HTMLElement, options: KitRendererOptions): KitRenderer {
  const kit: Kit = options.kit ?? GUEST_KIT;
  const maxNodes = options.maxNodes ?? 2_000;
  const document = into.ownerDocument;
  const refused: KitRefusal[] = [];
  const byId = new Map<string, Drawn>();
  const root: Drawn = { dom: into, name: ROOT_ID, component: { host: "div", properties: {}, events: {}, children: "any" }, children: [], listeners: new Map(), id: ROOT_ID };
  byId.set(ROOT_ID, root);
  let size = 0;
  let over = false;

  const refuse = (refusal: KitRefusal) => {
    refused.push(refusal);
    if (refused.length > 200) refused.shift();
  };
  const placeholder = (): Drawn => ({ dom: document.createComment(""), children: [], refused: true, listeners: new Map() });

  const setProperty = (drawn: Drawn, name: string, value: unknown) => {
    const component = drawn.component!;
    if (!own(component.properties, name)) return refuse({ reason: "property", element: drawn.name!, name });
    const property = component.properties[name]!;
    const judged = kitValue(property, value);
    const element = drawn.dom as HTMLElement;
    const attribute = hostAttribute(name, property);
    if (!judged.ok) {
      element.removeAttribute(attribute);
      return refuse({ reason: judged.reason, element: drawn.name!, name });
    }
    const said = judged.value;
    if (said === null || said === false) element.removeAttribute(attribute);
    else element.setAttribute(attribute, said === true ? "" : said);
    /* What the host element holds live, as well as what it says. */
    if (attribute === "value" && "value" in element) (element as HTMLInputElement).value = typeof said === "string" ? said : "";
    if (attribute === "disabled" && "disabled" in element) (element as HTMLButtonElement).disabled = said !== null && said !== false;
  };

  const setListener = (drawn: Drawn, name: string, value: unknown) => {
    const component = drawn.component!;
    if (!own(component.events, name)) return refuse({ reason: "event", element: drawn.name!, name });
    drawn.listeners.get(name)?.();
    drawn.listeners.delete(name);
    if (value === null || value === undefined) return;
    if (!isRecord(value) || typeof value["listener"] !== "number") return refuse({ reason: "value", element: drawn.name!, name });
    const listener = value["listener"];
    const event = component.events[name]!;
    const element = drawn.dom as HTMLElement;
    const raised = () => options.onEvent(listener, event.detail === "value" ? String((element as HTMLInputElement).value ?? "") : undefined);
    element.addEventListener(event.from, raised);
    drawn.listeners.set(name, () => element.removeEventListener(event.from, raised));
  };

  const forget = (drawn: Drawn) => {
    if (drawn.refused) return;
    size -= 1;
    if (drawn.id !== undefined) byId.delete(drawn.id);
    for (const off of drawn.listeners.values()) off();
    for (const child of drawn.children) forget(child);
  };

  const build = (raw: unknown, parent: Drawn): Drawn => {
    if (!isRecord(raw) || typeof raw["id"] !== "string" || byId.has(raw["id"])) {
      refuse({ reason: "record" });
      return placeholder();
    }
    if (size >= maxNodes) {
      refuse({ reason: "budget" });
      if (!over) {
        over = true;
        options.onOverBudget?.();
      }
      return placeholder();
    }
    const id = raw["id"];
    const may = parent.component!.children;
    if (raw["type"] === COMMENT) return placeholder();
    if (raw["type"] === TEXT) {
      if (may === "none") {
        refuse({ reason: "child", element: parent.name! });
        return placeholder();
      }
      const drawn: Drawn = { dom: document.createTextNode(String(raw["data"] ?? "").slice(0, KIT_MAX_TEXT)), children: [], text: true, listeners: new Map(), id };
      byId.set(id, drawn);
      size += 1;
      return drawn;
    }
    if (raw["type"] !== ELEMENT) {
      refuse({ reason: "record" });
      return placeholder();
    }
    const name = String(raw["element"]);
    if (!own(kit, name) || !sound(kit[name]!)) {
      refuse({ reason: "element", element: name });
      return placeholder();
    }
    if (may !== "any") {
      refuse({ reason: "child", element: name });
      return placeholder();
    }
    const component = kit[name]!;
    const element = document.createElement(component.host);
    element.setAttribute("data-gv", name.replace(/^gv-/, ""));
    element.className = `graview-guest-${name.replace(/^gv-/, "")}`;
    if (component.host === "a") {
      element.setAttribute("rel", "noopener noreferrer");
      element.setAttribute("target", "_blank");
      element.setAttribute("referrerpolicy", "no-referrer");
    }
    if (component.host === "button") element.setAttribute("type", "button");
    const drawn: Drawn = { dom: element, name, component, children: [], listeners: new Map(), id };
    byId.set(id, drawn);
    size += 1;
    if (isRecord(raw["properties"])) for (const [key, value] of Object.entries(raw["properties"])) setProperty(drawn, key, value);
    if (isRecord(raw["attributes"])) for (const key of Object.keys(raw["attributes"])) refuse({ reason: "attribute", element: name, name: key });
    if (isRecord(raw["eventListeners"])) for (const [key, value] of Object.entries(raw["eventListeners"])) setListener(drawn, key, value);
    if (Array.isArray(raw["children"])) {
      for (const child of raw["children"]) {
        const built = build(child, drawn);
        drawn.children.push(built);
        element.appendChild(built.dom);
      }
    }
    return drawn;
  };

  const one = (record: unknown) => {
    if (!Array.isArray(record)) return refuse({ reason: "record" });
    const [type, id] = record as [unknown, unknown];
    const target = typeof id === "string" ? byId.get(id) : undefined;
    if (!target) return refuse({ reason: "record" });
    switch (type) {
      case INSERT_CHILD: {
        if (target.text) return refuse({ reason: "record" });
        const index = Number(record[3]);
        const at = Number.isInteger(index) && index >= 0 && index <= target.children.length ? index : target.children.length;
        const built = build(record[2], target);
        target.dom.insertBefore(built.dom, target.children[at]?.dom ?? null);
        target.children.splice(at, 0, built);
        return;
      }
      case REMOVE_CHILD: {
        const index = Number(record[2]);
        const gone = target.children[index];
        if (!gone) return refuse({ reason: "record" });
        target.children.splice(index, 1);
        gone.dom.parentNode?.removeChild(gone.dom);
        forget(gone);
        return;
      }
      case UPDATE_TEXT:
        if (!target.text) return refuse({ reason: "record" });
        (target.dom as Text).data = String(record[2] ?? "").slice(0, KIT_MAX_TEXT);
        return;
      case UPDATE_PROPERTY: {
        if (target === root || target.text) return refuse({ reason: "record" });
        const name = String(record[2]);
        const kind = record[4] ?? PROPERTY;
        if (kind === PROPERTY) return setProperty(target, name, record[3]);
        if (kind === EVENT_LISTENER) return setListener(target, name, record[3]);
        if (kind === ATTRIBUTE) return refuse({ reason: "attribute", element: target.name!, name });
        return refuse({ reason: "record" });
      }
      default:
        return refuse({ reason: "record" });
    }
  };

  return {
    apply(records) {
      if (!Array.isArray(records)) return refuse({ reason: "record" });
      for (const record of records) one(record);
    },
    get refused() {
      return refused;
    },
    get size() {
      return size;
    },
    dispose() {
      for (const child of root.children) forget(child);
      root.children.length = 0;
      into.replaceChildren();
    },
  };
}

/** The stylesheet the kit is drawn with: classes over the theme's tokens, and nothing a guest can reach. */
export const GUEST_KIT_CSS = `
.graview-guest { display: flex; flex-direction: column; gap: 8px; min-width: 0; color: var(--graview-ink, inherit); font: inherit; }
.graview-guest-card { display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px solid var(--graview-edge, #d0d0d0); border-radius: 10px; background: var(--graview-panel, transparent); }
.graview-guest-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.graview-guest-group[data-gv-direction="row"] { flex-direction: row; flex-wrap: wrap; align-items: center; }
.graview-guest-title { font-weight: 600; font-size: 1rem; overflow-wrap: anywhere; }
.graview-guest-text { margin: 0; font-size: 0.875rem; line-height: 1.45; overflow-wrap: anywhere; }
.graview-guest-badge { align-self: flex-start; padding: 1px 8px; border: 1px solid currentColor; border-radius: 999px; font-size: 0.8125rem; font-weight: 600; }
.graview-guest-field { font-size: 0.875rem; overflow-wrap: anywhere; }
.graview-guest-field[data-gv-label]::before { content: attr(data-gv-label) " "; color: var(--graview-ink-muted, inherit); }
.graview-guest-progress { width: 100%; }
.graview-guest-divider { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid var(--graview-edge, #d0d0d0); }
.graview-guest-link { color: var(--graview-accent, inherit); text-decoration: underline; }
.graview-guest-button { align-self: flex-start; font: inherit; padding: 4px 12px; border-radius: 8px; border: 1px solid var(--graview-edge, #d0d0d0); background: var(--graview-panel, transparent); color: inherit; cursor: pointer; }
.graview-guest-input { font: inherit; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--graview-edge, #d0d0d0); }
.graview-guest [data-gv-tone="good"] { color: var(--graview-good, inherit); }
.graview-guest [data-gv-tone="bad"] { color: var(--graview-bad, inherit); }
.graview-guest [data-gv-tone="warn"] { color: var(--graview-warn, inherit); }
.graview-guest [data-gv-tone="accent"] { color: var(--graview-accent, inherit); }
.graview-guest [data-gv-tone="neutral"] { color: var(--graview-ink-muted, inherit); }
`;

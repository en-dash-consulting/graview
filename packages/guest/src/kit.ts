/**
 * THE COMPONENT KIT A WORKER GUEST DRAWS WITH (FR-69), declared once.
 *
 * A guest in a worker has no DOM of its own: it builds a tree of these
 * elements with Remote DOM, and the host draws it in its own document. The
 * kit is Tier 1's closed set of blocks (FR-03: title, text, badge, field,
 * progress, group, divider), plus the few a view that asks for acts needs —
 * a card to hold them, a button, an input, and a link.
 *
 * Each component says, once, its typed properties and its events. The
 * worker side defines one `RemoteElement` per component from it
 * (worker/elements.ts), and the host side draws from it (host/kit.ts): only
 * a component in the kit, only a property or event it declares, only a
 * value of the declared type, and a `url` only when it is `https:`. Adding
 * a property here makes it a property on both sides; nothing else changes.
 *
 * This module has no imports: a guest bundle carries it and nothing of the
 * framework.
 */

/** The tones a block may take: FR-03's own (`VIEW_TONES` in @graview/core/document, held to it by a test). */
export const KIT_TONES = ["good", "warn", "bad", "neutral", "accent"] as const;
export type KitTone = (typeof KIT_TONES)[number];

/**
 * A property's type. `url` is a string the host draws as a link, and only
 * when it parses as an absolute `https:` URL; `oneOf` is a string from a
 * closed list.
 */
export type KitPropertyType = "string" | "number" | "boolean" | "url" | { readonly oneOf: readonly string[] };

/**
 * The host attributes a property may be drawn as, besides the default
 * `data-gv-<name>`. A closed list: never an event handler, a style, a
 * source or a frame.
 */
export const KIT_HOST_ATTRIBUTES = ["value", "max", "aria-label", "placeholder", "disabled"] as const;
export type KitHostAttribute = (typeof KIT_HOST_ATTRIBUTES)[number];

export interface KitProperty {
  readonly type: KitPropertyType;
  /** The host attribute it is drawn as. `data-gv-<name>` by default; a `url` is always the link's `href`. */
  readonly as?: KitHostAttribute;
}

/** The DOM events a kit event may come from, on the element the host drew. */
export const KIT_HOST_EVENTS = ["click", "change"] as const;

export interface KitEvent {
  /** The DOM event on the host's element that raises it. */
  readonly from: (typeof KIT_HOST_EVENTS)[number];
  /** What the guest is handed with it: the element's `value`, or nothing. */
  readonly detail?: "value";
}

/** The host elements a component may be drawn as. */
export const KIT_HOST_TAGS = ["section", "div", "span", "strong", "p", "hr", "a", "button", "input", "progress"] as const;

export interface KitComponent {
  /** What the host draws it as. */
  readonly host: (typeof KIT_HOST_TAGS)[number];
  readonly properties: Readonly<Record<string, KitProperty>>;
  readonly events: Readonly<Record<string, KitEvent>>;
  /** What it may hold: other components and words, words alone, or nothing. */
  readonly children: "any" | "text" | "none";
}

export type Kit = Readonly<Record<string, KitComponent>>;

const tone: KitProperty = { type: { oneOf: KIT_TONES } };

/** The kit, by element name. Every name starts `gv-`. */
export const GUEST_KIT = {
  "gv-card": { host: "section", properties: { tone }, events: {}, children: "any" },
  "gv-group": { host: "div", properties: { direction: { type: { oneOf: ["row", "column"] } } }, events: {}, children: "any" },
  "gv-title": { host: "strong", properties: {}, events: {}, children: "text" },
  "gv-text": { host: "p", properties: { tone }, events: {}, children: "text" },
  "gv-badge": { host: "span", properties: { tone }, events: {}, children: "text" },
  "gv-field": { host: "div", properties: { label: { type: "string" } }, events: {}, children: "text" },
  "gv-progress": {
    host: "progress",
    properties: { value: { type: "number", as: "value" }, max: { type: "number", as: "max" }, label: { type: "string", as: "aria-label" } },
    events: {},
    children: "none",
  },
  "gv-divider": { host: "hr", properties: {}, events: {}, children: "none" },
  "gv-link": { host: "a", properties: { href: { type: "url" } }, events: {}, children: "text" },
  "gv-button": {
    host: "button",
    properties: { tone, disabled: { type: "boolean", as: "disabled" } },
    events: { press: { from: "click" } },
    children: "text",
  },
  "gv-input": {
    host: "input",
    properties: { label: { type: "string", as: "aria-label" }, value: { type: "string", as: "value" }, placeholder: { type: "string", as: "placeholder" } },
    events: { change: { from: "change", detail: "value" } },
    children: "none",
  },
} as const satisfies Kit;

export type GuestKitElement = keyof typeof GUEST_KIT;

/** The longest text a kit node may hold, in characters; longer is cut. */
export const KIT_MAX_TEXT = 10_000;

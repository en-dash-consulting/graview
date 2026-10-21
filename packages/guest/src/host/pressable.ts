/*
 * WHAT A PRESS ON A WORKER VIEW REACHES (0.1.45): which element a click, a
 * tap or a key on what the view drew is the press of — a link the host
 * follows — read the same by the live host (links.ts) and by a headless run's describer, which has no DOM
 * and so nothing here may ask for more than an element's name, its
 * attributes and its parent. Nothing is imported.
 *
 * A TAP IS A CLICK. On a phone the browser makes a tap a `click` on what
 * was tapped, and the host hears it on the view's shadow root as it hears
 * a mouse's; the element pressed is the nearest one at or above where the
 * finger landed, so a tap on a card's heading is a tap on the card. iOS
 * makes a tap a click only on what looks pressable, so the host draws
 * everything it makes a press with `cursor: pointer` (open-draw.ts), and
 * with `touch-action: manipulation`, so a tap is not held for a double
 * tap's zoom.
 *
 *   · A LINK is any element with `data-record` or `data-place` — an `<a>`,
 *     a card, a row — save a press scope of its own: a `fieldset` or
 *     `role="group"` (the record a form's acts are done to), an element
 *     bound to an act, a lightbox, a drop target, a placed video, a field,
 *     and an element that holds a field to type into or pick from (a form,
 *     where a tap between two fields must not go anywhere; a checkbox is a
 *     press of its own, and leaves its row a link). A press anywhere
 *     inside it follows it, unless it lands on something inside with a
 *     press of its own: a control, a bound act, another link. It is given
 *     the keyboard (`tabindex="0"`) and Enter follows it; it is a link to
 *     assistive technology unless it has a meaning of its own (a row, a
 *     list's item) or says another role.
 */

/** As much of an element as is read here: what a page's element and a headless tree's both have. */
export interface PressedElement {
  readonly localName: string;
  readonly namespaceURI: string | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  readonly parentElement: PressedElement | null;
}

const HTML = "http://www.w3.org/1999/xhtml";
/** An input whose own activation is a click: a press, never a field typed into. */
const CLICKING_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "image"]);
/** The roles of a control a press inside a link is its own. */
const CONTROL_ROLES = new Set(["button", "checkbox", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "slider", "spinbutton", "textbox", "combobox", "link"]);
/** HTML elements with no meaning of their own: given a role when the host makes one a link. */
const GENERIC = new Set(["div", "span", "section", "article", "aside", "header", "footer", "figure", "p", "b", "i", "em", "strong", "small", "mark", "time", "img"]);

const isHtml = (element: PressedElement, ...names: string[]) => element.namespaceURI === HTML && names.includes(element.localName);
const typeOf = (element: PressedElement) => (element.getAttribute("type") ?? "text").toLowerCase();

/** A field a person types into or picks from: a text input, a textarea, a select. */
export const isEntry = (element: PressedElement): boolean => isHtml(element, "textarea", "select") || (isHtml(element, "input") && !CLICKING_INPUTS.has(typeOf(element)));
/** A field of any sort. */
const isField = (element: PressedElement) => isHtml(element, "input", "select", "textarea");

/** Whether the host gives the element a role when it makes it a link: it has none, and none of its own. */
export const takesRole = (element: PressedElement): boolean => !element.hasAttribute("role") && (element.namespaceURI !== HTML || GENERIC.has(element.localName));

/** A press landing here is its own, not a link's around it: a control, a field, a bound act, a viewer, a drop target. */
export function ownPress(element: PressedElement): boolean {
  if (isHtml(element, "button", "input", "select", "textarea", "label", "summary", "option")) return true;
  if (element.hasAttribute("data-act") || element.hasAttribute("data-lightbox") || element.hasAttribute("data-drop")) return true;
  return CONTROL_ROLES.has(element.getAttribute("role") ?? "");
}

/**
 * Whether a press on the element goes where it says: it names a record or
 * a place, and is no press scope of its own. `holdsEntry` is whether it
 * holds a field to type into or pick from anywhere inside (`isEntry`).
 */
export function opensOnPress(element: PressedElement, holdsEntry: boolean): boolean {
  if (!element.hasAttribute("data-record") && !element.hasAttribute("data-place")) return false;
  if (element.localName === "a") return true;
  if (holdsEntry || isField(element) || isHtml(element, "fieldset", "form", "label", "option") || element.localName === "graview-video") return false;
  if (element.hasAttribute("data-act") || element.hasAttribute("data-lightbox") || element.hasAttribute("data-drop") || element.hasAttribute("data-field")) return false;
  return element.getAttribute("role") !== "group";
}

/**
 * The link a press at `at` follows: the nearest element at or above it the
 * host made a link (`isLink`), with nothing between that has a press of its
 * own; or none.
 */
export function linkPressed<E extends PressedElement>(at: E, root: E, isLink: (element: E) => boolean): E | undefined {
  for (let on: E | null = at; on && on !== root; on = on.parentElement as E | null) {
    if (isLink(on)) return on;
    if (ownPress(on)) return undefined;
  }
  return undefined;
}

/*
 * WHAT A PRESS ON A WORKER VIEW REACHES (0.1.45): which element a click, a
 * tap or a key on what the view drew is the press of — a link the host
 * follows, a bound act it judges — read the same by the live host
 * (links.ts, press.ts) and by a headless run's describer, which has no DOM
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
 *     list's item) or says another role. A card that carries its own link
 *     — an `<a>` inside it to the same record or place, on its heading —
 *     is given neither (`carriesItsLink`, 2026-10-23): the `<a>` is the
 *     keyboard's way in and the screen reader's link, and the card only a
 *     bigger target for a pointer and a finger, a `<div>` and an `<li>`
 *     alike.
 *   · A BOUND PRESS is any element with `data-act`, save what can never be
 *     pressed by itself (`notPressable`): an option, a label (whose press
 *     presses its field too), and a field to type into or pick from that
 *     does not save (a click into it is not a press). One that does not
 *     press of itself — a `<span role="button">`, a `<div>`, an SVG `<g>`
 *     — is given the keyboard (`tabindex="0"`), is a button to assistive
 *     technology unless it says another role, is drawn as something to
 *     press, and Enter or Space on it presses it, as on a button; a tap on
 *     it, or on anything inside it, is its click.
 *   · A CONTROL THE VIEW DREW ITSELF (`isKeyControl`, 0.1.47) — `role` of
 *     button, checkbox, switch or tab, or `aria-pressed` or `aria-expanded`,
 *     on what does not press of itself — is given the keyboard where it has
 *     none and drawn as something to press, and Enter or Space on it is told
 *     to the view as a click after the key, as a button's is, with the
 *     page kept from scrolling.
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
/** An input whose own activation is a click: Enter or Space on it clicks it already. */
const CLICKING_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "image"]);
/** The roles of a control a press inside a link is its own. */
const CONTROL_ROLES = new Set(["button", "checkbox", "switch", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "slider", "spinbutton", "textbox", "combobox", "link"]);
/** HTML elements with no meaning of their own: given a role when the host makes one a link or a button. */
const GENERIC = new Set(["div", "span", "section", "article", "aside", "header", "footer", "figure", "p", "b", "i", "em", "strong", "small", "mark", "time", "img"]);

const isHtml = (element: PressedElement, ...names: string[]) => element.namespaceURI === HTML && names.includes(element.localName);
const typeOf = (element: PressedElement) => (element.getAttribute("type") ?? "text").toLowerCase();

/** A field a person types into or picks from: a text input, a textarea, a select. */
export const isEntry = (element: PressedElement): boolean => isHtml(element, "textarea", "select") || (isHtml(element, "input") && !CLICKING_INPUTS.has(typeOf(element)));
/** A field of any sort. */
const isField = (element: PressedElement) => isHtml(element, "input", "select", "textarea");

/** Whether the element presses of itself: a click on it is its own, and Enter or Space on it clicks it. */
export function clicksItself(element: PressedElement): boolean {
  return isHtml(element, "button", "summary") || (isHtml(element, "input") && CLICKING_INPUTS.has(typeOf(element))) || (element.localName === "a" && element.hasAttribute("data-graview-link"));
}

/**
 * WHY AN ELEMENT BOUND TO AN ACT CAN NEVER BE PRESSED, in a sentence; or
 * nothing, when it can be. The live host leaves such an element unpressed,
 * and the describer says why.
 */
export function notPressable(element: PressedElement): string | undefined {
  if (isHtml(element, "option", "optgroup", "datalist")) return 'An option is never pressed by itself: put data-act on its select, with data-save="change", or on a button.';
  if (isHtml(element, "label")) return "A press on a label presses its field too, and would ask for the act twice: put data-act on a button, or on the field.";
  if (isEntry(element) && !element.hasAttribute("data-save")) return 'A click into a field to type or to pick is not a press: give it data-save ("input" or "change") to save it as it is typed, or put data-act on a button beside it.';
  return undefined;
}

/** Whether the host makes a press of the element: bound to an act, pressable, and not a field that saves as it is typed. */
export const isPress = (element: PressedElement): boolean => element.hasAttribute("data-act") && notPressable(element) === undefined && !(isField(element) && element.hasAttribute("data-save"));

/** The roles of a control the view drew that the host gives Enter and Space (0.1.47). */
const KEY_ROLES = new Set(["button", "checkbox", "switch", "tab"]);

/**
 * WHETHER THE ELEMENT IS A CONTROL THE VIEW DREW ITSELF (0.1.47): a
 * `<div role="button">`, a `<span role="checkbox">`, a tab, a toggle that
 * says `aria-pressed`, a disclosure that says `aria-expanded` — one the view
 * hears with `graview.on("click")` and that does not press of itself. The
 * host gives it the keyboard, and Enter or Space on it is told to the view
 * as a click, as a button's is. `role` is the role the view gave it, not one
 * the host did.
 */
export function isKeyControl(element: PressedElement, role: string | null = element.getAttribute("role")): boolean {
  if (clicksItself(element) || isField(element) || isHtml(element, "label", "option") || element.hasAttribute("data-graview-link")) return false;
  return KEY_ROLES.has(role ?? "") || element.hasAttribute("aria-pressed") || element.hasAttribute("aria-expanded");
}

/** Whether the element takes the keyboard of itself: a control, a field, a link with an address, an element that says it is to be edited. */
export function focusable(element: PressedElement): boolean {
  if (isHtml(element, "button", "input", "select", "textarea", "summary", "iframe")) return true;
  if (element.localName === "a" && element.hasAttribute("href")) return true;
  return element.hasAttribute("tabindex") || (element.getAttribute("contenteditable") ?? "false") !== "false";
}

/** Whether the host gives the element a role when it makes it a link or a button: it has none, and none of its own. */
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
 * WHETHER A CARD CARRIES ITS OWN LINK (2026-10-23): it is no `<a>` and no
 * button, and holds an `<a>` (HTML's or SVG's) to the same record or place
 * as its own. `inside` is what it holds, at any depth.
 */
export function carriesItsLink(element: PressedElement, inside: Iterable<PressedElement>): boolean {
  if (element.localName === "a" || element.localName === "button") return false;
  const record = element.getAttribute("data-record");
  const place = element.getAttribute("data-place");
  for (const one of inside) {
    if (one.localName !== "a") continue;
    if (record !== null ? one.getAttribute("data-record") === record : place !== null && one.getAttribute("data-place") === place) return true;
  }
  return false;
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

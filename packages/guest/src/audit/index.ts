/*
 * AN ACCESSIBILITY AUDIT OF A DRAWN VIEW (Roadmap f-view-a11y-audit):
 * `@graview/guest/audit`.
 *
 * Graview Cloud, `graview view check --audit` and Studio gate a view on it.
 * `auditView(root)` reads what a view drew — a page's element or shadow
 * root, or a headless run's tree of plain objects (`@graview/guest/headless`)
 * — and says what a person on a keyboard or with a screen reader would meet,
 * each problem shaped as a repair: the rule, its WCAG 2.2 criterion, how bad,
 * where (a selector from the nearest `data-key`), the one line that fixes it,
 * and whether the framework fixes it rather than the view.
 *
 * WHAT RUNS WHERE. The structural rules (`AUDIT_RULES[rule].needs ===
 * "structure"`) run wherever the drawing is. The rules that need a laid-out
 * page — the ring the keyboard shows, text contrast — run only where the
 * root is in a browser that lays it out, and are skipped, with why,
 * anywhere else. A keyboard trap needs keys pressed: a harness's Tab walk
 * (`pnpm verify a11y`) presses them; this never claims it.
 *
 * Judged as drawn: on a page the host has already given a link or a press
 * the keyboard and a role, and hidden an SVG that says nothing. A headless
 * tree has none of that, so `host: "pending"` gives the tree what the host
 * would — by the host's own reading of what a press is (host/pressable.ts) —
 * before it is judged. It is a tool, not drawing: no page loads it up front.
 */
import { clickedOf } from "../host/clicked.js";
import { clicksItself, focusable, isEntry, isKeyControl, isPress, opensOnPress, takesRole, type PressedElement } from "../host/pressable.js";
import { measureView } from "./measure.js";
import { AUDIT_RULES, type AuditImpact, type AuditProblem, type AuditRuleId, type ViewAudit } from "./rules.js";

export { AUDIT_RULES } from "./rules.js";
export type { AuditImpact, AuditProblem, AuditRule, AuditRuleId, ViewAudit } from "./rules.js";

/** As much of a node as an audit reads: what a page's node and a headless tree's both have. */
export interface AuditedNode {
  readonly nodeType: number;
  readonly childNodes: ArrayLike<AuditedNode>;
  readonly textContent: string | null;
}

/** As much of an element as an audit reads; `setAttribute` only when the host's marks are given (`host: "pending"`). */
export interface AuditedElement extends AuditedNode, PressedElement {
  readonly parentElement: AuditedElement | null;
  setAttribute(name: string, value: string): void;
}

export interface AuditViewOptions {
  /**
   * What the view hears a click on (`graview.on("click", selector)`): the
   * elements themselves, or — on a page — the selectors, matched within the
   * root. A headless run hands the elements its view listened on. Not
   * handed, it is what the live host kept on the region the view is drawn
   * in, as the view's runtime said it (0.1.48).
   */
  readonly clicked?: Iterable<AuditedElement> | readonly string[];
  /**
   * `drawn` (the default): the host has drawn it, and its links and presses
   * carry the keyboard it gave them. `pending`: give the root what the host
   * would before judging it — only for a tree the caller owns, such as a
   * headless run's, never a live page's.
   */
  readonly host?: "drawn" | "pending";
  /**
   * Run the rules that need a laid-out page. By default, when the root is in
   * a browser that lays it out; `false` skips them anywhere.
   */
  readonly measure?: boolean;
  /** What is audited is the framework's own chrome: each problem is the framework's to fix. */
  readonly chrome?: boolean;
  /** How many elements the measured rules focus or read, at most. 400 by default. */
  readonly limit?: number;
}

const HTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";
const isHtml = (element: AuditedElement, ...names: string[]) => element.namespaceURI === HTML && names.includes(element.localName);
const isElement = (node: AuditedNode): node is AuditedElement => node.nodeType === 1;
const childrenOf = (node: AuditedNode): AuditedElement[] => Array.from(node.childNodes).filter(isElement);

/** The roles of a control, each owed a name. */
const CONTROL_ROLES = new Set(["button", "link", "checkbox", "switch", "radio", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "slider", "spinbutton", "textbox", "searchbox", "combobox", "treeitem"]);
/** The roles whose children are presentational: nothing inside one may be a control of its own. */
const SOLID_ROLES = new Set(["button", "link", "checkbox", "switch", "radio", "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "img", "slider", "progressbar", "scrollbar", "separator"]);
/** The roles that say a state on or off, and the attribute they say it with. */
const STATEFUL: Readonly<Record<string, string>> = { checkbox: "aria-checked", switch: "aria-checked", radio: "aria-checked", menuitemcheckbox: "aria-checked", menuitemradio: "aria-checked", tab: "aria-selected", option: "aria-selected" };
const TRISTATE = new Set(["true", "false", "mixed"]);
/** Words a disclosure says, which a press that opens and closes something reads like. */
const DISCLOSES = /^(show|hide|expand|collapse)?\s*(more|less|all|details|everything)?$/i;

/** Every element under the root, in document order. */
function elementsOf(root: AuditedNode): AuditedElement[] {
  const out: AuditedElement[] = [];
  const walk = (node: AuditedNode) => {
    for (const child of childrenOf(node)) {
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** Hidden from assistive technology: it, or something above it within the root, says `aria-hidden="true"` or `hidden`. */
function hiddenFromAt(element: AuditedElement): boolean {
  for (let at: AuditedElement | null = element; at; at = at.parentElement) {
    if (at.getAttribute("aria-hidden") === "true" || at.hasAttribute("hidden")) return true;
  }
  return false;
}

const roleOf = (element: AuditedElement): string | null => element.getAttribute("role")?.trim().split(/\s+/)[0]?.toLowerCase() ?? null;
const tabIndexOf = (element: AuditedElement): number | undefined => {
  const given = element.getAttribute("tabindex");
  if (given === null) return undefined;
  const n = Number.parseInt(given, 10);
  return Number.isNaN(n) ? undefined : n;
};
const disabled = (element: AuditedElement) => element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
/** Reached by Tab: it takes the keyboard of itself, and no negative `tabindex` takes it away. */
const tabbable = (element: AuditedElement): boolean => {
  if (isHtml(element, "input") && (element.getAttribute("type") ?? "").toLowerCase() === "hidden") return false;
  if (isHtml(element, "button", "input", "select", "textarea") && element.hasAttribute("disabled")) return false;
  return focusable(element) && (tabIndexOf(element) ?? 0) >= 0;
};
/** A control of itself, by what it is: a button, a field, a link with an address, a summary. */
const nativeControl = (element: AuditedElement): boolean =>
  isHtml(element, "button", "select", "textarea", "summary") ||
  (isHtml(element, "input") && (element.getAttribute("type") ?? "").toLowerCase() !== "hidden") ||
  (element.localName === "a" && element.hasAttribute("href"));
/** A control, link or press a person meets: what is owed a name and may hold nothing of the same. */
const isControl = (element: AuditedElement): boolean => {
  if (nativeControl(element)) return true;
  if (element.hasAttribute("data-graview-link") || element.hasAttribute("data-graview-press")) return true;
  return CONTROL_ROLES.has(roleOf(element) ?? "");
};
/** A role, by what it is or what it says: a generic element that says none has none. */
const hasRole = (element: AuditedElement): boolean => element.hasAttribute("role") || !takesRole(element);

/** The selector of an element, from the nearest `data-key` or `id` at or above it down. */
function selectorOf(element: AuditedElement): string {
  const parts: string[] = [];
  const quote = (value: string) => JSON.stringify(value);
  for (let at: AuditedElement | null = element; at; at = at.parentElement) {
    if (at.hasAttribute("data-graview-view-root")) break;
    const key = at.getAttribute("data-key");
    if (key !== null) {
      parts.unshift(`[data-key=${quote(key)}]`);
      break;
    }
    const id = at.getAttribute("id");
    if (id) {
      parts.unshift(`[id=${quote(id)}]`);
      break;
    }
    const kind = at.getAttribute("class")?.trim().split(/\s+/)[0];
    let part = `${at.localName}${kind ? `.${kind}` : ""}`;
    const parent = at.parentElement;
    if (parent) {
      const alike = childrenOf(parent).filter((one) => one.localName === at!.localName);
      if (alike.length > 1) part += `:nth-of-type(${alike.indexOf(at) + 1})`;
    }
    parts.unshift(part);
  }
  return parts.join(" > ");
}
const keyOf = (element: AuditedElement): string | undefined => {
  for (let at: AuditedElement | null = element; at; at = at.parentElement) {
    const key = at.getAttribute("data-key");
    if (key !== null) return key;
  }
  return undefined;
};

/** What an element's own text says to assistive technology: its words, an image's alt, an SVG's title; nothing hidden. */
function textOf(node: AuditedNode): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (!isElement(node)) return "";
  if (node.getAttribute("aria-hidden") === "true" || node.hasAttribute("hidden")) return "";
  const label = node.getAttribute("aria-label")?.trim();
  if (label) return ` ${label} `;
  if (node.localName === "img") return ` ${node.getAttribute("alt") ?? ""} `;
  if (node.namespaceURI === SVG && node.localName === "svg") {
    const title = childrenOf(node).find((child) => child.localName === "title");
    return title ? ` ${textOf(title)} ` : "";
  }
  if (isHtml(node, "input", "select", "textarea")) return "";
  return Array.from(node.childNodes).map(textOf).join("");
}
const squeeze = (text: string) => text.replace(/\s+/g, " ").trim();

/** The accessible name of an element, near enough to what a browser computes for the rules here. */
function nameOf(element: AuditedElement, byId: ReadonlyMap<string, AuditedElement>, labels: readonly AuditedElement[]): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const said = squeeze(labelledBy.split(/\s+/).map((id) => (byId.get(id) ? textOf(byId.get(id)!) : "")).join(" "));
    if (said) return said;
  }
  const label = squeeze(element.getAttribute("aria-label") ?? "");
  if (label) return label;
  if (isHtml(element, "input", "select", "textarea")) {
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (isHtml(element, "input") && ["submit", "reset", "button"].includes(type)) return squeeze(element.getAttribute("value") ?? (type === "submit" ? "Submit" : type === "reset" ? "Reset" : ""));
    if (isHtml(element, "input") && type === "image") return squeeze(element.getAttribute("alt") ?? "");
    const id = element.getAttribute("id");
    const forIt = id ? labels.find((one) => one.getAttribute("for") === id) : undefined;
    if (forIt && squeeze(textOf(forIt))) return squeeze(textOf(forIt));
    for (let at = element.parentElement; at; at = at.parentElement) if (isHtml(at, "label") && squeeze(textOf(at))) return squeeze(textOf(at));
    const placeholder = squeeze(element.getAttribute("placeholder") ?? "");
    if (placeholder) return placeholder;
    return squeeze(element.getAttribute("title") ?? "");
  }
  if (element.localName === "img") return squeeze(element.getAttribute("alt") ?? element.getAttribute("title") ?? "");
  return squeeze(textOf(element)) || squeeze(element.getAttribute("title") ?? "");
}

/**
 * GIVE A TREE WHAT THE HOST GIVES A DRAWING ON A PAGE (host/links.ts,
 * host/press.ts): a link bound to a record or a place takes the keyboard
 * and, where it has no meaning of its own, a link's role; a press bound to
 * an act and a control the view drew itself take the keyboard, and a
 * generic press a button's role; an SVG that says nothing is hidden.
 */
export function markAsTheHost(root: AuditedNode): void {
  const all = elementsOf(root);
  for (const element of all) {
    const holdsEntry = elementsOf(element).some(isEntry);
    if (!opensOnPress(element, holdsEntry)) continue;
    element.setAttribute("data-graview-link", "");
    const anchor = isHtml(element, "a");
    if (!element.hasAttribute("role") && (anchor || takesRole(element))) element.setAttribute("role", "link");
    if (isHtml(element, "tr")) {
      const cell = childrenOf(element).find((child) => child.localName === "td" || child.localName === "th");
      if (cell && !cell.hasAttribute("tabindex")) cell.setAttribute("tabindex", "0");
      continue;
    }
    if (!isHtml(element, "button") && !element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
  }
  for (const element of all) {
    const bound = isPress(element) && !clicksItself(element) && !isHtml(element, "input", "select", "textarea");
    const control = !bound && isKeyControl(element);
    if (!bound && !control) continue;
    if (!focusable(element)) element.setAttribute("tabindex", "0");
    if (bound && takesRole(element)) element.setAttribute("role", "button");
    element.setAttribute("data-graview-press", "");
  }
  for (const svg of all.filter((one) => one.namespaceURI === SVG && one.localName === "svg")) {
    const says = svg.hasAttribute("role") || svg.hasAttribute("aria-label") || svg.hasAttribute("aria-labelledby") || childrenOf(svg).some((child) => child.localName === "title");
    const holds = [svg, ...elementsOf(svg)].some((one) => one.hasAttribute("tabindex") || one.hasAttribute("data-graview-link") || one.hasAttribute("data-graview-press") || one.localName === "a");
    if (!says && !holds && !svg.hasAttribute("aria-hidden")) svg.setAttribute("aria-hidden", "true");
  }
}

/** The elements a selector matches within the root, on a page: none where the root cannot be asked. */
function matching(root: AuditedNode, selectors: readonly string[]): AuditedElement[] {
  const ask = root as unknown as { querySelectorAll?: (selector: string) => ArrayLike<AuditedElement> };
  if (typeof ask.querySelectorAll !== "function") return [];
  return selectors.flatMap((selector) => {
    try {
      return Array.from(ask.querySelectorAll!(selector));
    } catch {
      return [];
    }
  });
}

/** Whether anything under the element takes Tab, within it or in an open shadow root drawn inside it. */
function holdsTabbable(element: AuditedNode): boolean {
  for (const child of childrenOf(element)) {
    if (tabbable(child) || holdsTabbable(child)) return true;
    const shadow = (child as unknown as { shadowRoot?: AuditedNode | null }).shadowRoot;
    if (shadow && holdsTabbable(shadow)) return true;
  }
  return false;
}

/** Whether the root is in a browser that lays it out: an element in it has a box. */
function laidOut(root: AuditedNode): boolean {
  const view = (root as unknown as { ownerDocument?: { defaultView?: { getComputedStyle?: unknown } | null } | null }).ownerDocument?.defaultView;
  if (!view || typeof view.getComputedStyle !== "function") return false;
  const host = (root as unknown as { host?: unknown }).host ?? root;
  const box = (host as { getBoundingClientRect?: () => { width: number; height: number } }).getBoundingClientRect?.();
  return Boolean(box && (box.width > 0 || box.height > 0));
}

/**
 * AUDIT A DRAWN VIEW. `root` is what it drew in: on a page, the view's
 * shadow root or an element; headless, the run's tree (`host: "pending"`).
 */
export function auditView(root: AuditedNode, options: AuditViewOptions = {}): ViewAudit {
  if (options.host === "pending") markAsTheHost(root);
  const all = elementsOf(root);
  const byId = new Map(all.flatMap((one) => (one.getAttribute("id") ? [[one.getAttribute("id")!, one] as const] : [])));
  const labels = all.filter((one) => isHtml(one, "label"));
  const given = options.clicked ? Array.from(options.clicked as Iterable<AuditedElement | string>) : [...(clickedOf(root) ?? [])];
  const clicked = new Set<AuditedElement>([...given.filter((one): one is AuditedElement => typeof one === "object"), ...matching(root, given.filter((one): one is string => typeof one === "string"))]);
  const chrome = options.chrome === true;
  const problems: AuditProblem[] = [];
  const say = (rule: AuditRuleId, element: AuditedElement, impact: AuditImpact, says: string, fix: string, automatic = false, wcag = AUDIT_RULES[rule].wcag) => {
    const key = keyOf(element);
    problems.push({ rule, wcag, impact, at: selectorOf(element), ...(key !== undefined ? { key } : {}), says, fix, automatic: automatic || chrome });
  };
  const shown = all.filter((one) => !hiddenFromAt(one));
  const named = (element: AuditedElement) => nameOf(element, byId, labels) !== "";

  /* KEYBOARD AND ROLE: what a person can click is reached by Tab, and says what it is. */
  for (const element of shown) {
    if (disabled(element)) continue;
    /* What the host made a link or a press, as it marks them (`data-graview-link`, `data-graview-press`). */
    const link = element.hasAttribute("data-graview-link");
    const press = element.hasAttribute("data-graview-press");
    const hears = clicked.has(element);
    if (!link && !press && !hears) continue;
    if (nativeControl(element) && tabbable(element)) continue;
    /* A table's row takes the keyboard on its first cell (host/links.ts). */
    if (isHtml(element, "tr") && childrenOf(element).some((cell) => (cell.localName === "td" || cell.localName === "th") && tabbable(cell))) continue;
    const reached = tabbable(element) || (hears && elementsOf(element).some((inner) => tabbable(inner) && (nativeControl(inner) || inner.hasAttribute("data-graview-press") || inner.hasAttribute("data-graview-link"))));
    if (!reached) {
      /* A link or a press the host makes is the host's to give the keyboard: missing on a page, the host has not drawn it. */
      if (link || press) say("keyboard", element, "serious", "It is a link or a press the host makes, and Tab does not reach it.", "The host gives it the keyboard when it draws the view; audit the view as the host drew it.", true);
      else
        say(
          "keyboard",
          element,
          "serious",
          `A <${element.localName}> the view hears a click on, which Tab does not reach: a mouse can press it and a keyboard cannot.`,
          'Draw it as a <button type="button"> (the host resets its look), or give it role="button" and the host gives it the keyboard, Enter and Space.',
        );
      continue;
    }
    if (tabbable(element) && !hasRole(element) && !(element.localName === "a" && element.hasAttribute("href"))) {
      say("role", element, "serious", `A <${element.localName}> that takes the keyboard says nothing of what it is: a screen reader says "group" or nothing.`, 'Draw it as a <button type="button">, or give it role="button" (or role="link" when it goes somewhere).', link || press);
    }
  }

  /* NAME: every control and link has one. */
  for (const element of shown) {
    if (!isControl(element) || named(element)) continue;
    const role = roleOf(element);
    const button = isHtml(element, "button") || role === "button" || element.hasAttribute("data-graview-press");
    const field = isHtml(element, "input", "select", "textarea") || ["textbox", "searchbox", "combobox", "slider", "spinbutton"].includes(role ?? "");
    const what = field ? "field" : button ? "button" : element.hasAttribute("data-graview-link") || element.localName === "a" || role === "link" ? "link" : "control";
    say(
      "name",
      element,
      button || field ? "critical" : "serious",
      `A ${what} with no name: a screen reader says only "${what}".`,
      field ? 'Give it a <label for> or aria-label="…".' : `Put words in it — a .graview-sr span when it shows only an icon — or aria-label="…".`,
    );
  }

  /* TOGGLE STATE: a toggle says whether it is on, open or chosen. */
  for (const element of shown) {
    const role = roleOf(element);
    const owed = role && !isHtml(element, "input") ? STATEFUL[role] : undefined;
    if (owed && !element.hasAttribute(owed)) {
      say("toggle-state", element, "serious", `It is role="${role}" and says no ${owed}: a screen reader cannot say whether it is ${owed === "aria-checked" ? "on" : "chosen"}.`, `Give it ${owed}="true" or "false", and draw it again as it changes.`);
      continue;
    }
    for (const [attribute, allowed] of [["aria-checked", TRISTATE], ["aria-pressed", TRISTATE], ["aria-expanded", new Set(["true", "false"])], ["aria-selected", new Set(["true", "false"])]] as const) {
      const value = element.getAttribute(attribute);
      if (value !== null && !allowed.has(value)) say("toggle-state", element, "serious", `${attribute}="${value}" is no state a screen reader can say.`, `Give ${attribute} "true" or "false"${allowed.has("mixed") ? ' (or "mixed")' : ""}.`);
    }
    const buttonish = isHtml(element, "button") || role === "button" || element.hasAttribute("data-graview-press");
    if (!buttonish || element.hasAttribute("aria-expanded") || element.hasAttribute("aria-pressed")) continue;
    if (element.hasAttribute("aria-controls")) say("toggle-state", element, "serious", "A button that says what it controls (aria-controls) and not whether that is open.", 'Give it aria-expanded="true" or "false", and draw it again as it opens and closes.');
    else if (clicked.has(element) && squeeze(textOf(element)) !== "" && DISCLOSES.test(squeeze(textOf(element)))) say("toggle-state", element, "moderate", `A button the view hears that reads "${squeeze(textOf(element))}" — it opens and closes something — and says no state.`, 'Give it aria-expanded="true" or "false" (or aria-pressed for a toggle), and draw it again as it changes.');
  }

  /* NESTED INTERACTIVE: nothing a person presses is inside another such thing. */
  for (const element of shown) {
    const role = roleOf(element) ?? (isHtml(element, "button") ? "button" : element.localName === "a" && element.hasAttribute("href") ? "link" : null);
    if (!role || !SOLID_ROLES.has(role) || role === "img") continue;
    const inner = elementsOf(element).find((one) => !hiddenFromAt(one) && (tabbable(one) || isControl(one)));
    if (!inner) continue;
    const card = element.hasAttribute("data-graview-link") && !isHtml(element, "a");
    say(
      "nested-interactive",
      element,
      "serious",
      `A ${role} holds a <${inner.localName}> a person presses on its own: a screen reader reads the ${role} as one thing and never reaches what is inside.`,
      card ? 'Leave the card plain and put an <a data-record> on its heading, or draw the card as an <li> (it keeps its own meaning).' : `Move the <${inner.localName}> out of the ${role}, beside it.`,
    );
  }

  /* IMAGES: an <img> says what it shows; an SVG that means something is role="img" with a name. */
  for (const element of shown) {
    if (element.localName === "img" && element.namespaceURI === HTML) {
      if (element.hasAttribute("alt") || element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || ["none", "presentation"].includes(roleOf(element) ?? "")) continue;
      say("img-alt", element, "critical", "An image with no alt: a screen reader reads its address, or nothing.", 'Give it alt="what it shows", or alt="" when it is decoration.');
      continue;
    }
    if (element.namespaceURI !== SVG || element.localName !== "svg" || element.parentElement?.namespaceURI === SVG) continue;
    const holds = [element, ...elementsOf(element)].some((one) => tabbable(one) || one.hasAttribute("data-graview-link") || one.hasAttribute("data-graview-press") || one.localName === "a");
    if (holds) continue;
    const role = roleOf(element);
    if (role === "none" || role === "presentation") continue;
    const hasName = named(element) && (element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || childrenOf(element).some((child) => child.localName === "title"));
    if (!role && !hasName) say("svg-name", element, "minor", "An SVG that says nothing, which a screen reader still meets.", "The host hides an SVG that says nothing when it draws the view.", true);
    else if (role !== "img" && role !== "graphics-document") say("svg-name", element, "minor", "An SVG with a name and no role: some screen readers skip it.", 'Give it role="img" beside its aria-label.');
    else if (!hasName) say("svg-name", element, "serious", 'An SVG that is role="img" with no name: a screen reader says "image" and nothing more.', 'Give it aria-label="what it shows", or a <title> first inside it.');
  }

  /* SCROLL REGIONS, as said in the drawing: a box that scrolls by itself (an inline overflow) takes the keyboard and has a name. */
  const scrolls = (element: AuditedElement): boolean => /overflow(-[xy])?\s*:\s*(auto|scroll)/i.test(element.getAttribute("style") ?? "");
  /*
   * A box the keyboard scrolls: it takes Tab itself and has a name, or holds
   * something Tab reaches (a drawn view's own controls, in its shadow root,
   * count) — the arrows scroll what has the keyboard, as axe holds it.
   */
  const judgeScroll = (element: AuditedElement) => {
    if ((tabbable(element) && named(element)) || holdsTabbable(element)) return;
    say("scroll-region", element, "serious", "A box that scrolls by itself and holds nothing Tab reaches: the keyboard cannot scroll it, and what is past its edge is out of reach.", 'Give it tabindex="0", role="group" and aria-label="what it holds", or let it flow with the page.');
  };
  /* Measured on a page, a box scrolls when what it holds is bigger than it; said in the drawing alone, when it says it scrolls. */
  const measure = options.measure !== false && laidOut(root);
  if (!measure) for (const element of shown) if (scrolls(element)) judgeScroll(element);

  const ran: AuditRuleId[] = ["keyboard", "role", "name", "toggle-state", "nested-interactive", "img-alt", "svg-name", "scroll-region"];
  const skipped: { rule: AuditRuleId; why: string }[] = [];
  const unmeasured: Partial<Record<AuditRuleId, number>> = {};
  const counted: Partial<Record<AuditRuleId, number>> = {};
  if (measure) {
    const measured = measureView(shown, {
      limit: options.limit ?? 400,
      tabbable,
      scrollsOnPage: judgeScroll,
      say: (rule, element, impact, says, fix, wcag, automatic) => say(rule, element, impact, says, fix, automatic === true, wcag),
    });
    ran.push("focus-visible", "contrast");
    Object.assign(unmeasured, measured.unmeasured);
    Object.assign(counted, measured.measured);
  } else {
    const why = options.measure === false ? "Asked not to measure." : "Nothing here is laid out (a headless run, or a DOM with no layout): it needs a browser's styles and boxes.";
    skipped.push({ rule: "focus-visible", why }, { rule: "contrast", why });
  }
  skipped.push({ rule: "keyboard-trap", why: "It needs keys pressed in a browser: a harness's Tab walk presses them (pnpm verify a11y)." });
  return { problems, ran, skipped, unmeasured, measured: counted };
}

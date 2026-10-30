/*
 * THE SECTION OF A VIEW UNDER THE CURSOR, NAMED AS A PERSON WOULD (Roadmap
 * f-make-this-section-better), fetched with the first right-click inside a
 * worker view (`sectionsArrive` in `view-places.ts`): the nearest part a
 * person would call a section — marked `data-section`, a landmark (drawn by
 * the host as a `<div data-graview-as>`) or a `role="region"`, by its
 * label, what labels it or its heading; else the block a heading begins —
 * named as `sectionsOfDrawing` (`@graview/core/revisions`) names one.
 */
import type { MenuViewSection } from "./view-places.js";

const LANDMARK = /* @__PURE__ */ new Set(["section", "article", "nav", "aside", "header", "footer", "main", "form", "region", "search"]);
const HEADING = /^h([1-6])$/;
const words = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const tagOf = (element: Element) => (element.getAttribute("data-graview-as") ?? element.localName).toLowerCase();
const levelOf = (element: Element): number | undefined => {
  const tag = HEADING.exec(tagOf(element));
  if (tag) return Number(tag[1]);
  return element.getAttribute("role") === "heading" ? Number(element.getAttribute("aria-level") ?? 2) : undefined;
};

/** A landmark's name: its `data-section`, its `aria-label`, what labels it, else its first heading's words. */
function nameOf(element: Element): string {
  const marked = words(element.getAttribute("data-section"));
  if (marked) return marked;
  const label = words(element.getAttribute("aria-label"));
  if (label) return label;
  const root = element.getRootNode() as ParentNode & { getElementById?: (id: string) => Element | null };
  const by = (element.getAttribute("aria-labelledby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => words(root.getElementById?.(id)?.textContent ?? (root as ParentNode).querySelector?.(`#${CSS.escape(id)}`)?.textContent))
    .filter(Boolean)
    .join(" ");
  if (by) return by;
  for (const inner of element.querySelectorAll("*")) if (levelOf(inner) !== undefined) return words(inner.textContent);
  return "";
}

/** Whether an element is a section of its own: marked, a landmark, a region. */
const isSection = (element: Element) => element.hasAttribute("data-section") || LANDMARK.has(tagOf(element)) || element.getAttribute("role") === "region";

/** A heading and the siblings after it, up to the next heading as high or higher. */
function headedBlock(heading: Element): Element[] {
  const level = levelOf(heading) ?? 6;
  const block = [heading];
  for (let at = heading.nextElementSibling; at; at = at.nextElementSibling) {
    const next = levelOf(at);
    if (next !== undefined && next <= level) break;
    block.push(at);
  }
  return block;
}

/**
 * THE SECTION OF A VIEW UNDER AN ELEMENT: the element itself under a
 * press, inside a worker view's shadow root. Nothing outside a view, and
 * nothing for a part with no name a person could say.
 */
export function sectionUnder(element: Element | null | undefined): MenuViewSection | undefined {
  if (!element) return undefined;
  const root = element.getRootNode();
  if (typeof ShadowRoot === "undefined" || !(root instanceof ShadowRoot)) return undefined;
  const view = root.host.getAttribute("data-worker-view");
  if (!view) return undefined;
  /* A section of its own around it — marked, a landmark, a region — before any heading's block inside one. */
  for (let at: Element | null = element; at; at = at.parentElement) {
    if (!isSection(at)) continue;
    const name = nameOf(at);
    if (name) return { name, view, elements: [at] };
  }
  /* Else a heading's block: the heading itself, or the nearest one before it among its siblings, up the tree. */
  for (let at: Element | null = element; at; at = at.parentElement) {
    for (let before: Element | null = at; before; before = before.previousElementSibling) {
      if (levelOf(before) === undefined) continue;
      const block = headedBlock(before);
      if (!block.includes(at)) break;
      const name = words(before.textContent);
      if (name) return { name, view, elements: block };
      break;
    }
  }
  return undefined;
}


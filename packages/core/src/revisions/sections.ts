/*
 * THE SECTIONS OF A DRAWING, BY NAME (Roadmap f-revisions-say-what-broke).
 *
 * What a person would call a part of a page: a heading's words, and a
 * landmark — a `<section>` or a `role="region"` named by its `aria-label`,
 * its `aria-labelledby` or its own first heading; a `<nav>`, a `<main>`, a
 * header, a footer or an aside, by its name or by what it is. A worker
 * view's host draws a landmark's element as a `<div>` that says what it was
 * asked to be (`data-graview-as`), and that is read as the landmark.
 *
 * Read from anything shaped like an element — a page's DOM, a headless
 * run's tree (`@graview/guest/headless`) — and nothing is laid out here.
 */

/** Anything that reads like an element: a DOM `Element`, or a headless run's `TreeElement`. */
export interface ElementLike {
  readonly localName?: string;
  readonly nodeType?: number;
  getAttribute(name: string): string | null;
  readonly childNodes: ArrayLike<unknown>;
  readonly textContent: string | null;
}

/** One section of a drawing: what a person would call it, and what it is (`heading`, `section`, `nav` …). */
export interface DrawnSection {
  readonly name: string;
  readonly as: string;
}

const HEADING = /^h([1-6])$/;
/** The landmarks a page is read by, and what one with no name of its own is called. */
const LANDMARKS: Readonly<Record<string, string | null>> = {
  section: null,
  article: null,
  form: null,
  region: null,
  nav: "navigation",
  navigation: "navigation",
  main: "main content",
  header: "header",
  banner: "header",
  footer: "footer",
  contentinfo: "footer",
  aside: "aside",
  complementary: "aside",
  search: "search",
};

const isElement = (node: unknown): node is ElementLike => typeof node === "object" && node !== null && typeof (node as ElementLike).getAttribute === "function" && ((node as ElementLike).nodeType === undefined || (node as ElementLike).nodeType === 1);
const said = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** Every element under `root`, `root` first, in document order. */
export function* elementsOf(root: ElementLike): Generator<ElementLike> {
  yield root;
  for (const child of Array.from(root.childNodes)) if (isElement(child)) yield* elementsOf(child);
}

/** What an element is asked to be: the landmark a host drew as a `<div>`, else its own name. */
const tagOf = (element: ElementLike) => (element.getAttribute("data-graview-as") ?? element.localName ?? "").toLowerCase();

/** The heading level an element is, if it is one. */
function headingLevel(element: ElementLike): number | undefined {
  const tag = HEADING.exec(tagOf(element));
  if (tag) return Number(tag[1]);
  return element.getAttribute("role") === "heading" ? Number(element.getAttribute("aria-level") ?? 2) : undefined;
}

/** The sections a drawing has, each once by name, in document order. */
export function sectionsOfDrawing(root: ElementLike): DrawnSection[] {
  const all = [...elementsOf(root)];
  const byId = new Map<string, ElementLike>();
  for (const element of all) {
    const id = element.getAttribute("id");
    if (id) byId.set(id, element);
  }
  const out: DrawnSection[] = [];
  const seen = new Set<string>();
  const add = (name: string, as: string) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ name: name.length > 80 ? `${name.slice(0, 79)}…` : name, as });
  };
  for (const element of all) {
    if (element.getAttribute("aria-hidden") === "true" || element.getAttribute("hidden") !== null) continue;
    const level = headingLevel(element);
    if (level !== undefined) {
      add(said(element.textContent), "heading");
      continue;
    }
    const tag = tagOf(element);
    const role = (element.getAttribute("role") ?? "").toLowerCase();
    const what = role in LANDMARKS ? role : tag in LANDMARKS ? tag : undefined;
    if (!what) continue;
    const labelled = (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .flatMap((id) => (byId.get(id) ? [said(byId.get(id)!.textContent)] : []))
      .join(" ");
    const heading = [...elementsOf(element)].find((one) => one !== element && headingLevel(one) !== undefined);
    const name = said(element.getAttribute("aria-label")) || labelled || (heading ? said(heading.textContent) : "") || LANDMARKS[what] || "";
    add(name, what === "region" ? "section" : what);
  }
  return out;
}

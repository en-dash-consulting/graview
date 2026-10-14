/*
 * `@graview/pages/static` — A PAGE AS A STRING, OFF THE BROWSER (FR-174).
 *
 * The pages face is React components under a browser router, which is right
 * for a person at a screen and no use to a host that wants a fixed link — a
 * team's schedule as a PDF, a roster pinned to a wall — re-rendered each
 * time the app changes, in a Worker that has no DOM. `renderPlace` says a
 * place as one self-contained HTML document: the app's look inlined as CSS,
 * no scripts, nothing to fetch, printable.
 *
 * NOT A SECOND RENDERER OF THE DECLARATION. What a place shows one seat is
 * `describePlace`'s answer (`@graview/core/describe`), which resolves the
 * home's, a lens's and each kind's card and row blocks exactly as the faces
 * do, over the graph the seat may see; a record's facts, its declared
 * sentence and its relations are read with the same helpers its routed
 * page reads (`describeNode`, `readableFields`, `pageSections`). This module
 * only writes that answer down as markup.
 *
 * WHY NOT THE COMPONENTS. Every routed page renders under
 * `renderToStaticMarkup` in Node, but each is a working page: forms, the
 * arranging line, values changed where they stand, Find, the seat — a
 * printed roster of buttons. And this entry imports no React at all, so a
 * Worker that wants a page does not load a UI library to get one; nothing
 * on the hosted page imports it, so its weight is nobody's but the caller's.
 */
import {
  humanizeField,
  isCurrent,
  labelOf,
  localeFor,
  markHref,
  pluralOf,
  recordPath,
  SCHEMES,
  shapeOf,
  typographyOf,
  violationsTouching,
  type AnySchema,
  type AppPlace,
  type Brand,
  type GraviewApp,
  type Principal,
  type Scheme,
  type Store,
  type ThemeTokens,
} from "@graview/core";
import { describeNode, readableFields } from "@graview/core/words";
import { withComputed } from "@graview/core/blocks";
import { describePlace, type DescribedItem, type DescribedPart, type PlaceDescription } from "@graview/core/describe";
import { markdownHtml } from "@graview/core/markdown";

/** How the page looks: the app's brand (its own, unsaid) in one of its two schemes. */
export interface StaticLook {
  /** The brand whose tokens, type and shape the page wears. The declaration's own when unsaid. */
  readonly brand?: Brand;
  /** Light or dark. The brand's own scheme when it names one, else light — paper is light. */
  readonly scheme?: Scheme;
}

export interface RenderPlaceOptions {
  /**
   * WHO IS LOOKING. The page holds only what this seat may see — a record
   * it may not see is never rendered, and is answered exactly as a record
   * that does not exist. An anonymous person when unsaid, as the routed
   * face reads it.
   */
  readonly viewer?: Principal;
  readonly look?: StaticLook;
  /** The day it is, for dates said relatively ("due tomorrow"); the store's day when unsaid — the day it was ticked or pinned to, else today. */
  readonly today?: string;
  /**
   * THE READER'S LOCALE (FR-178), as a host passes it to the routed face:
   * days, times and numbers are said in it, and the document says it as
   * its `lang`. Unsaid, the brand's `locale`, else en-US; a tag the
   * runtime cannot say anything in is en-US.
   */
  readonly locale?: string;
  /**
   * Put before every address a link on the page names (`/tasks/task-1`), so
   * a record's name leads to the app's own page for it — the routed face's
   * address where the app is served. Unsaid, addresses are as the routed
   * face writes them, from its root.
   */
  readonly base?: string;
}

export interface RenderedPlace {
  /** The whole document: `<!doctype html>`, the CSS in its `<style>`, no `<script>`. */
  readonly html: string;
  /** The stylesheet alone — the same one the document carries — for a host that writes its own head. */
  readonly css: string;
  /** The page's title, as its `<title>` says it: the place's, then the app's name. */
  readonly title: string;
  /**
   * Whether the place was there for this seat. A place nobody declared, a
   * record nobody has, and a record this seat may not see are all `false`,
   * alike, with a page that says nothing lives at the address.
   */
  readonly found: boolean;
}

/**
 * RENDER ONE PLACE TO STATIC HTML.
 *
 * `place` is what the routed face and `describe_place` name a place by: a
 * `placesOf(declaration)` entry, its slug (`home`, `tasks`, a lens's `as`),
 * its title, its address (`/`, `/tasks`, `/places/the-week`), a record's
 * id, or a record's address (`/tasks/task-1`).
 *
 * Runs in Node and in a Worker: no DOM, no React, no global read at import.
 */
export function renderPlace<S extends AnySchema>(
  store: Store<S>,
  declaration: GraviewApp<S>,
  place: string | AppPlace,
  options: RenderPlaceOptions = {},
): RenderedPlace {
  const viewer: Principal = options.viewer ?? { kind: "human" };
  const brand = options.look?.brand ?? declaration.brand ?? { name: declaration.name, schemes: SCHEMES };
  const scheme: Scheme = options.look?.scheme ?? (brand.scheme === "dark" || brand.scheme === "light" ? brand.scheme : "light");
  const css = staticCss(brand, scheme);
  const appName = brand.name || declaration.name;
  const base = (options.base ?? "").replace(/\/$/, "");
  const seen = store.seenBy(viewer);
  const asked = typeof place === "string" ? recordOfAddress(seen as never, place) ?? place : place;
  // Said in the reader's locale, else the brand's the page wears: the describer reads it off the app's brand, as every face does.
  const locale = localeFor(options.locale ?? brand.locale ?? declaration.brand?.locale);
  const described = describePlace(store, viewer, asked, { app: { ...declaration, brand: { ...brand, locale } }, ...(options.today ? { today: options.today } : {}) });

  /*
   * A KIND KEPT FROM THIS SEAT IS NOT THERE: an administered module's kinds
   * for a seat that does not administer it, a kind it sees none of, a
   * disabled module's — the routed face lists none of them, so a record, a
   * list or a picture of one is answered as nothing at all.
   */
  const kept = new Set<string>([...store.kindsKeptFrom(viewer), ...store.modules.disabledKinds]);
  const there = described.ok && !(described.description.place.kind !== null && kept.has(described.description.place.kind));

  const write = new Writer(base, seen.schema as AnySchema);
  let title: string;
  if (!described.ok || !there) {
    title = "Nothing lives at this address.";
    write.raw(`<h1>${esc(title)}</h1>`);
  } else {
    const d = described.description;
    title = d.place.title;
    if (d.drawnBy === "record") writeRecord(write, seen as unknown as Store<AnySchema>, d, kept);
    else if (d.place.kind !== null && d.drawnBy === "derived") writeList(write, seen as unknown as Store<AnySchema>, d, locale);
    else writePlace(write, d);
  }
  const found = there;
  const head = title === appName ? title : `${title} — ${appName}`;
  const masthead = writeMasthead(brand, appName, base);
  const html =
    `<!doctype html>\n<html lang="${esc(locale)}" data-graview-static="" data-scheme="${scheme}">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(head)}</title>\n<style>\n${css}\n</style>\n</head>\n` +
    `<body>\n<div class="gv-page">\n${masthead}\n<main>\n${write.out()}\n</main>\n</div>\n</body>\n</html>\n`;
  return { html, css, title: head, found };
}

/* ------------------------------------------------------------ the places */

/** A record's address on the routed face, `/<plural>/<id>`, as the record's id; anything else is left to `describePlace`. */
function recordOfAddress(seen: Store<AnySchema> | Store<never>, asked: string): string | undefined {
  const parts = asked.split(/[?#]/)[0]!.split("/").filter(Boolean);
  if (!asked.startsWith("/") || parts.length !== 2 || parts[0] === "places") return undefined;
  let id: string;
  try {
    id = decodeURIComponent(parts[1]!);
  } catch {
    return undefined;
  }
  const node = (seen as Store<AnySchema>).graph.getNode(id);
  // The address names the kind as well as the id: `/lists/task-1` is no record's.
  if (!node || recordPath((seen as Store<AnySchema>).schema, node.kind, id) !== `/${parts[0]}/${encodeURIComponent(id)}`) return `\u0000${asked}`;
  return id;
}

/** A record's page: its kind, its name, its declared sentence, what is wrong with it, its facts, and what it is related to. */
function writeRecord(write: Writer, seen: Store<AnySchema>, d: PlaceDescription, kept: ReadonlySet<string>): void {
  const id = d.place.slug;
  const node = seen.graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
  const kind = d.place.kind!;
  const definition = seen.schema.tryDefinition(kind);
  write.raw(`<header class="gv-head">`);
  write.raw(`<p class="gv-eyebrow"><a href="${write.href(`/${slugOf(seen, kind)}`)}">${esc(pluralOf(seen.schema, kind))}</a></p>`);
  write.raw(`<h1>${esc(d.place.title)}</h1>`);
  // THE DESCRIBE LINE, as the record's page says it under its name: the declaration's own sentence, where it says more than the name.
  const said = definition?.describe && node ? describeNode(definition, node) : null;
  if (said && said !== d.place.title) write.raw(`<p class="gv-lede">${esc(said)}</p>`);
  write.raw(`</header>`);

  const problems = violationsTouching(seen.violations(), [id]);
  if (problems.length > 0) {
    write.raw(`<section class="gv-problems" aria-label="What is wrong">`);
    for (const problem of problems) write.raw(`<p><strong>${esc(problem.label)}</strong> — ${esc(problem.message)}</p>`);
    write.raw(`</section>`);
  }

  // The kind's declared page blocks, then its facts in the sections its page declares — `describePlace` read them both.
  const facts = d.parts;
  if (facts.length > 0) {
    write.raw(`<section class="gv-part" data-testid="record-fields">`);
    write.raw(`<h2>The facts</h2>`);
    write.parts(facts, 2);
    write.raw(`</section>`);
  }

  for (const group of relationsOf(seen, id, kept)) {
    write.raw(`<section class="gv-part">`);
    write.raw(`<h2>${esc(group.heading)}</h2>`);
    write.raw(`<ul class="gv-names">`);
    for (const target of group.targets) write.raw(`<li><a href="${write.href(recordPath(seen.schema, target.kind, target.id))}">${esc(target.label)}</a></li>`);
    write.raw(`</ul></section>`);
  }
}

/** A kind's list: its plural, its declared description, how many there are, and each record as its row says it — or, with no row declared, its name and its glance. */
function writeList(write: Writer, seen: Store<AnySchema>, d: PlaceDescription, locale: string): void {
  const kind = d.place.kind!;
  const definition = seen.schema.tryDefinition(kind);
  const members = seen.graph.nodesOfKind(kind).filter((node) => isCurrent(definition, node));
  write.raw(`<header class="gv-head">`);
  write.raw(`<h1>${esc(d.place.title)}</h1>`);
  if (definition?.description) write.raw(`<p class="gv-lede">${esc(definition.description)}</p>`);
  write.raw(`<p class="gv-quiet">${members.length} ${esc(members.length === 1 ? (definition?.noun ?? humanizeField(kind)).toLowerCase() : pluralOf(seen.schema, kind).toLowerCase())}</p>`);
  write.raw(`</header>`);
  // Everything after the list's own heading, with each plain row given the glance the routed list shows beside the name.
  const rest = d.parts.filter((part, index) => !(index === 0 && part.t === "heading" && part.level === 1));
  write.parts(rest.map((part) => (part.t === "list" ? { ...part, groups: part.groups.map((group) => ({ ...group, items: group.items.map((item) => glanced(seen, item, locale)) })) } : part)), 1);
}

/** The home, or a declared place: what `describePlace` says it shows, under its own heading, a section to a page in print. */
function writePlace(write: Writer, d: PlaceDescription): void {
  const parts = d.parts;
  const titled = parts[0]?.t === "heading" && parts[0].level === 1;
  write.raw(`<header class="gv-head">`);
  write.raw(`<h1>${esc(titled ? (parts[0] as { text: string }).text : d.place.title)}</h1>`);
  if (d.place.kind === null && d.masthead?.subtitle) write.raw(`<p class="gv-lede">${esc(d.masthead.subtitle)}</p>`);
  write.raw(`</header>`);
  // A heading of the page's own (an h2) begins a section; a grouped list's groups are sections of their own.
  const body = titled ? parts.slice(1) : parts;
  const sections: DescribedPart[][] = [[]];
  for (const part of body) {
    if (part.t === "heading" && part.level <= 2 && sections[sections.length - 1]!.length > 0) sections.push([]);
    sections[sections.length - 1]!.push(part);
  }
  for (const section of sections) {
    if (section.length === 0) continue;
    write.raw(`<section class="gv-section">`);
    write.parts(section, 1);
    write.raw(`</section>`);
  }
  if (d.facts && d.facts.length > 0) {
    write.raw(`<section class="gv-section"><h2>Facts</h2><dl class="gv-fields">`);
    for (const fact of d.facts) write.raw(`<div><dt>${esc(fact.label)}</dt><dd>${esc(fact.value ?? "—")}</dd></div>`);
    write.raw(`</dl></section>`);
  }
}

/** A plain row (its name alone) given what a glance at the record says — the default card's facts, as the routed list shows them. */
function glanced(seen: Store<AnySchema>, item: DescribedItem, locale: string): DescribedItem {
  if (item.parts.length > 0) return item;
  const node = seen.graph.getNode(item.id);
  if (!node) return item;
  const definition = seen.schema.tryDefinition(node.kind);
  const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(seen.schema, seen.graph as never, node as never) : node;
  const fields = readableFields(read as Record<string, unknown>, definition, { limit: 3, said: [item.title], glance: true, locale });
  return { ...item, parts: fields.map((field) => ({ t: "text", text: field.alone })) };
}

/** A record's relations, both ways, each captioned in its declaration's own words for this end — as its routed page groups them. */
function relationsOf(seen: Store<AnySchema>, id: string, kept: ReadonlySet<string>): { heading: string; targets: { id: string; kind: string; label: string }[] }[] {
  const node = seen.graph.getNode(id);
  if (!node) return [];
  const groups = new Map<string, { heading: string; targets: { id: string; kind: string; label: string }[] }>();
  for (const edge of seen.graph.allEdges()) {
    const direction = edge.from === id ? "out" : edge.to === id ? "in" : null;
    if (!direction) continue;
    const other = seen.graph.getNode(direction === "out" ? edge.to : edge.from);
    if (!other || kept.has(other.kind)) continue;
    const declaredOn = seen.schema.tryDefinition(direction === "out" ? node.kind : other.kind);
    const words = (declaredOn?.edges as Record<string, { description?: string; inverse?: string }> | undefined)?.[edge.kind];
    const description = direction === "in" ? (words?.inverse ?? words?.description) : words?.description;
    const heading = description ? description.charAt(0).toUpperCase() + description.slice(1) : `${direction === "in" ? "← " : "→ "}${humanizeField(edge.kind)}`;
    const key = `${edge.kind}|${direction}|${heading}`;
    const group = groups.get(key) ?? { heading, targets: [] };
    groups.set(key, group);
    group.targets.push({ id: other.id, kind: other.kind, label: labelOf(seen.schema.tryDefinition(other.kind), other as never) });
  }
  return [...groups.values()].map((group) => ({ ...group, targets: group.targets.sort((a, b) => a.label.localeCompare(b.label)) }));
}

function slugOf(seen: Store<AnySchema>, kind: string): string {
  return recordPath(seen.schema, kind, "x").split("/")[1]!;
}

/** The app's name and its mark, at the head of every page. */
function writeMasthead(brand: Brand, name: string, base: string): string {
  const mark = markHref(brand.logo);
  const logo = mark && (mark.startsWith("data:image/") || /^https?:/i.test(mark) || !mark.startsWith("/") || base === "") ? `<img class="gv-mark" src="${attr(mark.startsWith("/") ? `${base}${mark}` : mark)}" alt="">` : "";
  return `<header class="gv-masthead"><a href="${attr(`${base}/`)}">${logo}<span>${esc(name)}</span></a></header>`;
}

/* ----------------------------------------------------------- the markup */

class Writer {
  private readonly lines: string[] = [];
  constructor(
    private readonly base: string,
    private readonly schema: AnySchema,
  ) {}
  raw(text: string): void {
    this.lines.push(text);
  }
  out(): string {
    return this.lines.join("\n");
  }
  href(path: string): string {
    return attr(`${this.base}${path}`);
  }

  /** Parts as the faces draw them: headings, lines, badges, facts as a list of terms, figures, lists of cards or rows. */
  parts(parts: readonly DescribedPart[], depth: number): void {
    let fields: { label: string; text: string; long?: true; markdown?: true }[] = [];
    const flush = () => {
      if (fields.length === 0) return;
      // Prose the record's width, its lines kept; Markdown drawn as prose (FR-180), its headings under the page's, no HTML of its own.
      const value = (field: (typeof fields)[number]) => (field.markdown ? `<dd class="gv-md">${markdownHtml(field.text, { headingsFrom: depth + 1 })}</dd>` : `<dd>${esc(field.text)}</dd>`);
      this.raw(`<dl class="gv-fields">${fields.map((field) => `<div${field.long || field.markdown ? ' class="gv-long"' : ""}><dt>${esc(field.label)}</dt>${value(field)}</div>`).join("")}</dl>`);
      fields = [];
    };
    for (const part of parts) {
      if (part.t === "field" || part.t === "progress") {
        fields.push(part);
        continue;
      }
      flush();
      switch (part.t) {
        case "heading": {
          const level = Math.min(6, Math.max(2, part.level + depth - 1));
          this.raw(`<h${level}>${esc(part.text)}</h${level}>`);
          break;
        }
        case "text":
          this.raw(`<p class="gv-text"${part.tone ? ` data-tone="${attr(part.tone)}"` : ""}>${esc(part.text)}</p>`);
          break;
        case "badge":
          this.raw(`<p><span class="gv-badge">${esc(part.text)}</span></p>`);
          break;
        case "figure":
          this.raw(`<p class="gv-figure"><strong>${esc(part.text)}</strong>${part.label ? ` <span>${esc(part.label)}</span>` : ""}</p>`);
          break;
        case "list":
          this.list(part, depth);
          break;
      }
    }
    flush();
  }

  private list(part: Extract<DescribedPart, { t: "list" }>, depth: number): void {
    if (part.groups.length === 0) {
      if (part.empty) this.raw(`<p class="gv-quiet">${esc(part.empty)}</p>`);
      return;
    }
    const grouped = part.groups.some((group) => group.heading);
    for (const group of part.groups) {
      // A group under a heading is a section of its own — a week of a roster, a column of a board — and a page of its own in print.
      if (grouped) this.raw(`<section class="gv-section">${group.heading ? `<h${Math.min(6, depth + 1)}>${esc(group.heading)}</h${Math.min(6, depth + 1)}>` : ""}`);
      if (part.as === "card") {
        this.raw(`<div class="gv-cards">`);
        for (const item of group.items) {
          this.raw(`<article class="gv-card"><h${Math.min(6, depth + 2)} class="gv-card-title">${this.named(item)}</h${Math.min(6, depth + 2)}>`);
          this.parts(item.parts, depth + 2);
          this.raw(`</article>`);
        }
        this.raw(`</div>`);
      } else {
        this.raw(`<ul class="${part.as === "row" ? "gv-rows" : "gv-names"}">`);
        for (const item of group.items) {
          this.raw(`<li>${this.named(item)}`);
          if (item.parts.length > 0) {
            this.raw(`<div class="gv-glance">`);
            this.parts(item.parts, depth + 2);
            this.raw(`</div>`);
          }
          this.raw(`</li>`);
        }
        this.raw(`</ul>`);
      }
      if (grouped) this.raw(`</section>`);
    }
    if (part.more) this.raw(`<p class="gv-quiet">and ${part.more} more</p>`);
  }

  private named(item: DescribedItem): string {
    return `<a href="${this.href(recordPath(this.schema, item.kind, item.id))}">${esc(item.title)}</a>`;
  }
}

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(text: string): string {
  return String(text).replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);
}
function attr(text: string): string {
  return esc(text);
}

/* ------------------------------------------------------------- the look */

/**
 * THE APP'S LOOK AS ONE STYLESHEET: the brand's tokens for the scheme, its
 * type and its shape, as the same custom properties every face reads — so a
 * host that knows the tokens can override one — and the few rules a page of
 * reading needs. Print puts each section of a place on a page of its own,
 * keeps a card, a row and a fact whole, and prints the ground it is on.
 */
export function staticCss(brand: Brand, scheme: Scheme = "light"): string {
  const tokens = brand.schemes[scheme] ?? SCHEMES[scheme];
  const type = typographyOf(brand);
  const shape = shapeOf(brand);
  const variables = (Object.keys(tokens) as (keyof ThemeTokens)[])
    .map((key) => `  --graview-${String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${tokens[key]};`)
    .join("\n");
  return `:root {
${variables}
  --graview-font-body: ${type.body};
  --graview-font-display: ${type.display};
  --graview-font-mono: ${type.mono};
  --graview-weight-display: ${type.weights.display};
  --graview-weight-body: ${type.weights.body};
  --graview-radius: ${shape.radius}px;
  --graview-gap: ${shape.gap}px;
  color-scheme: ${scheme};
}
html, body { margin: 0; background: var(--graview-ground-deep); color: var(--graview-ink); }
body { font: var(--graview-weight-body) 1rem/1.5 var(--graview-font-body); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.gv-page { max-width: 60rem; margin: 0 auto; padding: 24px 16px 48px; }
.gv-masthead a { display: inline-flex; align-items: center; gap: 10px; color: var(--graview-ink-muted); text-decoration: none; font-weight: 600; }
.gv-mark { height: 28px; width: auto; }
h1, h2, h3, h4, h5, h6 { font-family: var(--graview-font-display); font-weight: var(--graview-weight-display); line-height: 1.2; margin: 0.6em 0 0.3em; break-after: avoid-page; }
h1 { font-size: 1.728rem; margin-top: 0.4em; text-wrap: balance; }
h2 { font-size: 1.2rem; text-wrap: balance; }
h3 { font-size: 1rem; }
a { color: var(--graview-accent); text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
.gv-head { display: grid; gap: 6px; margin-bottom: 20px; }
.gv-head h1, .gv-head p { margin: 0; }
.gv-eyebrow { font-size: 0.833rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--graview-ink-muted); }
.gv-eyebrow a { color: inherit; text-decoration: none; }
.gv-lede { font-size: 1rem; color: var(--graview-ink-muted); max-width: 40rem; }
.gv-quiet { color: var(--graview-ink-muted); }
.gv-text { margin: 4px 0; }
.gv-text[data-tone="warn"], .gv-text[data-tone="bad"] { color: var(--graview-bad); }
.gv-text[data-tone="good"] { color: var(--graview-good); }
.gv-section, .gv-part { border-top: 1px solid var(--graview-edge); padding-top: 12px; margin-top: 20px; }
.gv-problems { border-left: 3px solid var(--graview-warn); background: var(--graview-panel-warning); padding: 10px 16px; border-radius: 0 var(--graview-radius) var(--graview-radius) 0; }
.gv-fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px 24px; margin: 8px 0; }
.gv-fields div { break-inside: avoid; }
.gv-fields dt { font-size: 0.833rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--graview-ink-muted); }
.gv-fields dd { margin: 0; overflow-wrap: anywhere; white-space: pre-line; }
.gv-fields .gv-long { grid-column: 1 / -1; }
.gv-fields dd.gv-md { white-space: normal; line-height: 1.6; }
.gv-md > :first-child { margin-top: 0; }
.gv-md h3, .gv-md h4, .gv-md h5, .gv-md h6 { font-size: 1em; margin: 0.9em 0 0.3em; }
.gv-md p, .gv-md ul, .gv-md ol, .gv-md blockquote, .gv-md pre { margin: 0 0 0.7em; }
.gv-md li > p { margin: 0; }
.gv-md blockquote { padding-inline-start: 0.9em; border-inline-start: 3px solid var(--graview-edge); color: var(--graview-ink-muted); }
.gv-md code { font-family: var(--graview-font-mono); font-size: 0.9em; }
.gv-md pre { overflow-x: auto; padding: 0.7em 0.9em; background: var(--graview-panel-muted, transparent); border-radius: 8px; white-space: pre; overflow-wrap: normal; }
.gv-md hr { border: 0; border-top: 1px solid var(--graview-edge); }
.gv-md [data-graview-md-table] { overflow-x: auto; }
.gv-md table { border-collapse: collapse; }
.gv-md th, .gv-md td { padding: 0.35em 0.7em; border-bottom: 1px solid var(--graview-edge); text-align: start; vertical-align: top; }
.gv-badge { display: inline-block; padding: 1px 8px; border: 1px solid var(--graview-edge-bright); border-radius: 999px; font-size: 0.833rem; }
.gv-figure strong { font-size: 1.75rem; font-family: var(--graview-font-display); }
.gv-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 10px; }
.gv-card { background: var(--graview-panel); border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); padding: 12px 14px; break-inside: avoid; }
.gv-card-title { margin: 0 0 4px; font-size: 1rem; }
.gv-card-title a, .gv-rows a, .gv-names a { color: var(--graview-ink); text-decoration: none; }
.gv-rows, .gv-names { list-style: none; margin: 0; padding: 0; }
.gv-rows > li { padding: 8px 0; border-bottom: 1px solid var(--graview-edge); break-inside: avoid; }
.gv-rows > li > a { font-weight: 500; }
.gv-names { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.gv-glance { color: var(--graview-ink-muted); font-size: 0.833rem; }
.gv-glance > .gv-text, .gv-glance > p { display: inline; margin: 0; }
.gv-glance > .gv-text:not(:last-child)::after, .gv-glance > p:not(:last-child)::after { content: " · "; }
@media print {
  .gv-page { max-width: none; padding: 0; }
  .gv-section + .gv-section { break-before: page; border-top: 0; }
  a { text-decoration: none; color: inherit; }
}`;
}

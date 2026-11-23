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
// A reader of an app that publishes is printed the last publish (Roadmap f-publishing-lifecycle).
import "@graview/core/publishing";
import {
  fileSrc,
  filesOf,
  humanizeField,
  isCurrent,
  isImage,
  isVideo,
  labelOf,
  sayingIn,
  emojiMark,
  logoOf,
  logoScheme,
  markHref,
  pluralOf,
  previewOf,
  recordPath,
  SCHEMES,
  shapeOf,
  typographyOf,
  violationsTouching,
  type AnySchema,
  type AppPlace,
  type Brand,
  type FileValue,
  type GraviewApp,
  type HostFiles,
  type Principal,
  type Scheme,
  type Store,
  type ThemeTokens,
} from "@graview/core";
import { fileFieldsOf, fileWords, firstPicture, sizeWords, typeWords, videoClock } from "@graview/core/blocks";
import { describeNode } from "@graview/core/words";
import type { DescribedItem, DescribedPart, PlaceDescription } from "@graview/core/describe";
import { markdownHtml } from "@graview/core/markdown";
import { placesOf } from "@graview/core/seat";
import { esc, glanced, readPlace, relationsOf, sightOf, slugOf } from "./static-read.js";

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
   * THE READER'S TIME ZONE (Roadmap f-app-time-zone): the IANA zone an
   * instant is said in. Unsaid, the brand's `timeZone`, else the runtime's
   * clock — which, on a server, is seldom anybody's.
   */
  readonly timeZone?: string;
  /**
   * Put before every address a link on the page names (`/tasks/task-1`), so
   * a record's name leads to the app's own page for it — the routed face's
   * address where the app is served. Unsaid, addresses are as the routed
   * face writes them, from its root.
   */
  readonly base?: string;
  /**
   * A PRODUCT'S OWN DESIGN, for the page as the routed face's registry
   * gives one (`.register(kind, "record", …)`, `.surface("shell", …)`) —
   * without React. `records[kind]` writes a record's page in the design's
   * own markup; `document` writes the whole document around what a page
   * says. Each reads only what this seat may see, and a writer that answers
   * `undefined` leaves the derived page in place.
   */
  readonly design?: StaticDesign;
  /**
   * WHERE THE HOST SERVES A FILE A RECORD HOLDS — the `files` the hosted
   * page is handed, or only its `src` (`HostFiles.src`, 0.1.36). A record's
   * pictures, videos and documents are drawn at the address it answers for
   * each `href`, as the hosted page draws them; unsaid, at the `href` the
   * record keeps.
   */
  readonly files?: StaticFiles;
}

/** What the static page asks of the host's files: only where it serves each one. */
export type StaticFiles = Pick<HostFiles, "src">;

/** A record as a design reads it: what this seat may see of it, and the way to what it relates to. */
export interface StaticRecord {
  readonly id: string;
  readonly kind: string;
  /** Its name, as its label says it. */
  readonly title: string;
  /** Its fields, as this seat may read them. */
  readonly fields: Readonly<Record<string, unknown>>;
  /** The records it relates to by one relation — outward unless said, in the order they were related — that this seat may see. */
  related(edge: string, direction?: "out" | "in"): readonly StaticRecord[];
}

/** The app as a design reads it while it writes one page: every record of a kind, one by id, an address under the base. */
export interface StaticSite {
  records(kind: string): readonly StaticRecord[];
  record(id: string): StaticRecord | undefined;
  href(path: string): string;
}

/** What `StaticDesign.document` is handed: the page as written, and what goes around it. */
export interface StaticDocument {
  /** The `<title>`: the place's, then the app's name. */
  readonly title: string;
  readonly lang: string;
  readonly scheme: Scheme;
  /** The app's look as one stylesheet, which the derived document carries in its `<style>`. */
  readonly css: string;
  /** The app's name and mark, as the derived document heads every page with. */
  readonly masthead: string;
  /** What the page says: the design's own record page, or the derived one. */
  readonly main: string;
  readonly found: boolean;
  /** The record the page is about, when it is one. */
  readonly record?: StaticRecord;
  readonly site: StaticSite;
}

/**
 * A DESIGN FOR THE STATIC PAGE: a kind's record page in the design's own
 * markup, and the document around every page. Either may be left out; a
 * record writer that answers `undefined` leaves that record's derived page.
 */
export interface StaticDesign {
  readonly records?: { readonly [kind: string]: ((record: StaticRecord, site: StaticSite) => string | undefined) | undefined };
  readonly document?: (page: StaticDocument) => string;
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
 * Every instant on it is said on the reader's clock, else the app's.
 */
export function renderPlace<S extends AnySchema>(
  store: Store<S>,
  declaration: GraviewApp<S>,
  place: string | AppPlace,
  options: RenderPlaceOptions = {},
): RenderedPlace {
  const timeZone = options.look?.brand?.timeZone ?? declaration.brand?.timeZone;
  return sayingIn({ readerTimeZone: options.timeZone, appTimeZone: timeZone }, () => {
    const base = baseOf(options.base);
    const page = pageOf(store, declaration, place, options, (path) => `${base}${path}`);
    const { head, lang, scheme, css, masthead, main, found, record, site } = page;
    const html = options.design?.document
      ? options.design.document({ title: head, lang, scheme, css, masthead, main, found, ...(record ? { record } : {}), site })
      : documentOf({ title: head, lang, scheme, css, body: `${masthead}\n<main>\n${main}\n</main>` });
    return { html, css, title: head, found };
  });
}

/** What `renderSite` is asked: a page's options, with a design's record pages but not its document — the file is one document, the framework's. */
export interface RenderSiteOptions extends Omit<RenderPlaceOptions, "design"> {
  readonly design?: Pick<StaticDesign, "records">;
}

/** One page of a site's file: where it lives on the routed face, what it is called, and the id its in-file links go to. */
export interface SitePage {
  readonly address: string;
  readonly title: string;
  readonly anchor: string;
}

export interface RenderedSite {
  /** The whole file: `<!doctype html>`, the CSS once in its `<style>`, each page an `<article>` with its own id, no `<script>`. */
  readonly html: string;
  readonly css: string;
  /** The file's title: the app's name. */
  readonly title: string;
  /** Every page it holds, in the order it holds them: the places as `placesOf` orders them, then each record the seat may see. */
  readonly pages: readonly SitePage[];
}

/**
 * RENDER THE WHOLE APP TO ONE STATIC HTML FILE: every place this seat may
 * see and every record's page it may see, one after the other in one
 * document — the app's look inlined once, a contents of its places at the
 * top, and every link a link within the file (`#page/tasks/task-1`), so a
 * host that exports the app as one file, or prints it, rewrites no address.
 * A link to a page the file does not hold is no link: its words stay. In
 * print each page begins a sheet of its own (`staticCss`).
 *
 * `base` is put before no link, since each goes within the file; it is put
 * before a path-only mark, as `renderPlace` puts it. A design's record
 * writers write their records' pages, and `site.href(path)` answers the
 * in-file link.
 */
export function renderSite<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, options: RenderSiteOptions = {}): RenderedSite {
  const timeZone = options.look?.brand?.timeZone ?? declaration.brand?.timeZone;
  return sayingIn({ readerTimeZone: options.timeZone, appTimeZone: timeZone }, () => siteRendered(store, declaration, options));
}

/** A page's id in a site's file, from its address on the routed face: `/tasks/task-1` is `page/tasks/task-1`, the home `page/`. */
export const pageAnchor = (address: string): string => `page${address.split(/[?#]/)[0]}`;

function siteRendered<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, options: RenderSiteOptions): RenderedSite {
  const viewer: Principal = options.viewer ?? { kind: "human" };
  const { seen, kept } = sightOf(store, viewer);
  const schema = seen.schema as AnySchema;
  /*
   * A LINK WRITTEN BEFORE THE FILE KNOWS WHICH PAGES IT HOLDS: a number
   * between marks made for this render, which no record's text can know,
   * said once every page is written. A mark a record's text holds anyway
   * names no link this render made, and is left as it was written.
   */
  const mark = `\u0001${Math.random().toString(36).slice(2)}:`;
  const linked: string[] = [];
  const link = (path: string) => `${mark}${linked.push(path.split(/[?#]/)[0]!) - 1}\u0002`;
  // One reading of the app for every page, so a design that reads every record reads it once.
  const site = staticSite(seen, kept, link);
  const written = new Map<string, { readonly title: string; readonly main: string; readonly place: boolean }>();
  const tried = new Set<string>();
  const write = (place: string | AppPlace, address: string, isPlace: boolean) => {
    if (tried.has(address)) return;
    tried.add(address);
    const page = pageOf(store, declaration, place, { ...options, viewer }, link, site);
    if (page.found) written.set(address, { title: page.title, main: page.main, place: isPlace });
  };
  // The places, in the order the routed face lists them; then every record this seat may see, kind by kind.
  for (const place of placesOf(declaration)) write(place, place.address, true);
  for (const kind of schema.kinds as readonly string[]) {
    if (kept.has(kind)) continue;
    for (const node of seen.graph.nodesOfKind(kind)) {
      const address = recordPath(schema, kind, node.id);
      write(address, address, false);
    }
  }
  // An address a page links that is none of those — a record set aside that a relation still reaches, say — is written too, where the seat may see it.
  for (let at = 0; at < linked.length; at++) write(linked[at]!, linked[at]!, false);

  const frame = pageOf(store, declaration, "home", { ...options, viewer }, link, site);
  const pages: SitePage[] = [...written].map(([address, page]) => ({ address, title: page.title, anchor: pageAnchor(address) }));
  const contents = pages.filter((page) => written.get(page.address)!.place);
  const nav = contents.length > 1 ? `<nav class="gv-contents" aria-label="Pages"><ul class="gv-names">${contents.map((page) => `<li><a href="#${esc(page.anchor)}">${esc(page.title)}</a></li>`).join("")}</ul></nav>\n` : "";
  const articles = pages.map((page) => `<article class="gv-site-page" id="${esc(page.anchor)}">\n${written.get(page.address)!.main}\n</article>`).join("\n");
  const said = documentOf({ title: frame.appName, lang: frame.lang, scheme: frame.scheme, css: frame.css, body: `${frame.masthead}\n${nav}<main>\n${articles}\n</main>`, site: true });
  /*
   * Each link as the file's own: to a page it holds; to one it does not, no
   * link at all — or, where a design wrote the address anywhere but a plain
   * href, an anchor that goes nowhere.
   */
  const held = (n: string): string | undefined => {
    const address = linked[Number(n)];
    return address !== undefined && written.has(address) ? `#${esc(pageAnchor(address))}` : undefined;
  };
  const html = said
    .split(` href="${mark}`)
    .map((piece, index) => {
      if (index === 0) return piece;
      const [, n = "", rest = ""] = /^(\d+)\u0002"([\s\S]*)$/.exec(piece) ?? [];
      if (!n) return ` href="${mark}${piece}`;
      const to = held(n);
      return to ? ` href="${to}"${rest}` : rest;
    })
    .join("")
    .split(mark)
    .map((piece, index) => {
      if (index === 0) return piece;
      const [, n = "", rest = ""] = /^(\d+)\u0002([\s\S]*)$/.exec(piece) ?? [];
      return n && linked[Number(n)] !== undefined ? `${held(n) ?? "#"}${rest}` : `${mark}${piece}`;
    })
    .join("");
  return { html, css: frame.css, title: frame.appName, pages };
}

/** A host's base as a prefix: no trailing slash. */
const baseOf = (base: string | undefined): string => (base ?? "").replace(/\/$/, "");

/** The document around what a page — or a site — says: the look inlined, nothing fetched to draw it, no script. */
function documentOf({ title, lang, scheme, css, body, site = false }: { title: string; lang: string; scheme: Scheme; css: string; body: string; site?: boolean }): string {
  return (
    `<!doctype html>\n<html lang="${esc(lang)}" data-graview-static=""${site ? ' data-graview-site=""' : ""} data-scheme="${scheme}">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(title)}</title>\n<style>\n${css}\n</style>\n</head>\n` +
    `<body>\n<div class="gv-page">\n${body}\n</div>\n</body>\n</html>\n`
  );
}

/** One page, written: what it says and what goes around it, every address it names put through `link`. */
function pageOf<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, place: string | AppPlace, options: RenderPlaceOptions, link: (path: string) => string, shared?: StaticSite) {
  // What the place holds for this seat, read as the device's screen reads it (`./static-read.ts`).
  const { brand, locale, seen, kept, described, there } = readPlace(store, declaration, place, { viewer: options.viewer, brand: options.look?.brand, locale: options.locale, today: options.today });
  const scheme: Scheme = options.look?.scheme ?? (brand.scheme === "dark" || brand.scheme === "light" ? brand.scheme : "light");
  const css = staticCss(brand, scheme);
  const appName = brand.name || declaration.name;
  const base = baseOf(options.base);
  const store_ = seen as unknown as Store<AnySchema>;
  const specs = (declaration.viewSpecs ?? {}) as Readonly<Record<string, { card?: unknown; row?: unknown } | undefined>>;
  // A record's first picture, small, where its kind's card or row is the derived one — a declared one draws its own `image` blocks.
  const pictureOf = (item: DescribedItem, as: "card" | "row"): FileValue | undefined => {
    if (specs[item.kind]?.[as]) return undefined;
    const node = seen.graph.getNode(item.id);
    if (!node) return undefined;
    const definition = seen.schema.tryDefinition(item.kind);
    const picture = firstPicture(node as Record<string, unknown>, definition);
    // A video with no poster is not drawn small: the next of its files that is.
    return picture && pictured(picture) ? picture : fileFieldsOf(definition).flatMap((key) => filesOf((node as Record<string, unknown>)[key])).find(pictured);
  };
  const write = new Writer(link, seen.schema as AnySchema, options.files, pictureOf);
  const site = shared ?? staticSite(store_, kept, link);
  let title: string;
  let record: StaticRecord | undefined;
  if (!described.ok || !there) {
    title = "Nothing lives at this address.";
    write.raw(`<h1>${esc(title)}</h1>`);
  } else {
    const d = described.description;
    title = d.place.title;
    record = d.drawnBy === "record" ? site.record(d.place.slug) : undefined;
    const designed = record ? options.design?.records?.[record.kind]?.(record, site) : undefined;
    if (designed !== undefined) write.raw(designed);
    else if (d.drawnBy === "record") writeRecord(write, store_, d, kept);
    else if (d.place.kind !== null && d.drawnBy === "derived") writeList(write, store_, d, locale);
    else writePlace(write, d);
  }
  const head = title === appName ? title : `${title} — ${appName}`;
  const masthead = writeMasthead(brand, appName, base, link);
  return { title, head, appName, lang: locale, scheme, css, masthead, main: write.out(), found: there, record, site };
}

/**
 * THE APP AS A DESIGN READS IT: over the graph this seat may see, with the
 * kinds kept from it gone — a record of one is answered as no record, and a
 * relation to one is not there.
 */
function staticSite(seen: Store<AnySchema>, kept: ReadonlySet<string>, link: (path: string) => string): StaticSite {
  const made = new Map<string, StaticRecord>();
  const recordOf = (id: string): StaticRecord | undefined => {
    const known = made.get(id);
    if (known) return known;
    const node = seen.graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
    if (!node || kept.has(node.kind)) return undefined;
    const { id: _id, kind, ...fields } = node;
    const one: StaticRecord = {
      id,
      kind,
      title: labelOf(seen.schema.tryDefinition(kind), node as never),
      fields,
      related(edge, direction = "out") {
        return (direction === "out" ? seen.graph.out(id, edge) : seen.graph.in(id, edge))
          .map((other) => recordOf(other.id))
          .filter((other): other is StaticRecord => other !== undefined);
      },
    };
    made.set(id, one);
    return one;
  };
  return {
    records: (kind) => (kept.has(kind) ? [] : seen.graph.nodesOfKind(kind).map((node) => recordOf(node.id)).filter((one): one is StaticRecord => one !== undefined)),
    record: recordOf,
    href: link,
  };
}

/* ------------------------------------------------------------ the places */

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

/** The app's name and its mark, at the head of every page. */
function writeMasthead(brand: Brand, name: string, base: string, link: (path: string) => string): string {
  const emoji = emojiMark(brand);
  const given = logoOf(brand);
  const image = (logo: string | undefined, more = "") => {
    const mark = markHref(logo);
    return mark && (mark.startsWith("data:image/") || /^https?:/i.test(mark) || !mark.startsWith("/") || base === "")
      ? `<img class="gv-mark" src="${attr(mark.startsWith("/") ? `${base}${mark}` : mark)}" alt=""${more}>`
      : "";
  };
  const light = image(given?.light, given?.dark ? ' data-graview-scheme-only="light"' : given?.darkFallback === "invert" ? ' data-graview-logo-fallback="invert"' : "");
  // A dark one beside the light one, each hidden by the sheet of the other scheme (`staticCss`).
  const logo = emoji ? `<span class="gv-mark" aria-hidden="true">${esc(emoji)}</span>` : light && given?.dark ? light + image(given.dark, ' data-graview-scheme-only="dark"') : light;
  return `<header class="gv-masthead"><a href="${attr(link("/"))}">${logo}<span>${esc(name)}</span></a></header>`;
}

/* ----------------------------------------------------------- the markup */

class Writer {
  private readonly lines: string[] = [];
  constructor(
    private readonly link: (path: string) => string,
    private readonly schema: AnySchema,
    private readonly files: StaticFiles | undefined,
    private readonly pictureOf: (item: DescribedItem, as: "card" | "row") => FileValue | undefined,
  ) {}
  raw(text: string): void {
    this.lines.push(text);
  }
  out(): string {
    return this.lines.join("\n");
  }
  href(path: string): string {
    return attr(this.link(path));
  }

  /**
   * Parts as the faces draw them: headings, lines, badges, facts as a list of terms, figures, lists of cards or rows.
   * `small`: a card's or a row's, where a field's pictures are drawn as its first, small, as the routed list draws them.
   */
  parts(parts: readonly DescribedPart[], depth: number, small = false): void {
    let fields: { label: string; text: string; long?: true; markdown?: true; files?: readonly FileValue[] }[] = [];
    const flush = () => {
      if (fields.length === 0) return;
      // Prose the record's width, its lines kept; Markdown drawn as prose (FR-180), its headings under the page's, no HTML of its own; files drawn (FR-162).
      const value = (field: (typeof fields)[number]) =>
        field.files ? `<dd class="gv-files">${this.filesShown(field.files, field.label)}</dd>` : field.markdown ? `<dd class="gv-md">${markdownHtml(field.text, { headingsFrom: depth + 1 })}</dd>` : `<dd>${esc(field.text)}</dd>`;
      this.raw(`<dl class="gv-fields">${fields.map((field) => `<div${field.long || field.markdown || field.files ? ' class="gv-long"' : ""}><dt>${esc(field.label)}</dt>${value(field)}</div>`).join("")}</dl>`);
      fields = [];
    };
    for (const part of parts) {
      if (part.t === "field" && part.files && small) {
        const picture = part.files.find(pictured);
        if (picture) {
          flush();
          this.raw(`<p class="gv-thumbs">${this.thumb(picture, 72)}</p>`);
          continue;
        }
      }
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
          // Its first picture, small, above its facts (FR-162), where the card is the derived one.
          const picture = this.pictureOf(item, "card");
          if (picture) this.raw(`<p class="gv-thumbs">${this.thumb(picture, 64)}</p>`);
          this.parts(item.parts, depth + 2, true);
          this.raw(`</article>`);
        }
        this.raw(`</div>`);
      } else {
        this.raw(`<ul class="${part.as === "row" ? "gv-rows" : "gv-names"}">`);
        for (const item of group.items) {
          // Its first picture, small, beside its name, where the row is the derived one.
          const picture = part.as === "row" ? this.pictureOf(item, "row") : undefined;
          this.raw(picture ? `<li><span class="gv-pictured">${this.thumb(picture, 56)}${this.named(item)}</span>` : `<li>${this.named(item)}`);
          if (item.parts.length > 0) {
            this.raw(`<div class="gv-glance">`);
            this.parts(item.parts, depth + 2, true);
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

  /* ------------------------------------------------------ a record's files */

  /** Where the host serves a path a record keeps (`HostFiles.src`), as an attribute. */
  private src(href: string): string {
    return attr(fileSrc(this.files as HostFiles | undefined, href));
  }

  /** One picture, small: a picture, a video by its poster, a document by the picture its host made of it. A video with no poster is not drawn small. */
  private thumb(file: FileValue, size: number): string {
    const preview = previewOf(file);
    const at = isVideo(file) ? file.poster : preview ? (preview.thumb ?? preview.src) : file.href;
    if (!at) return "";
    const said = isVideo(file) ? `${fileWords(file)}, a video` : fileWords(file);
    return `<img class="gv-thumb" src="${this.src(at)}" alt="${attr(said)}" width="${size}" height="${size}" loading="lazy" decoding="async"${framing(file)}>`;
  }

  /**
   * A FIELD'S FILES, AS THE RECORD'S PAGE SHOWS THEM (FR-162): its pictures
   * in a gallery, each a link to itself full size; its videos played by the
   * browser's own controls from their posters — what a printed page shows
   * of one; its documents by the picture their host made of them, where it
   * made one, then by name, type and size, linked.
   */
  private filesShown(files: readonly FileValue[], label: string): string {
    const pictures = files.filter(isImage);
    const videos = files.filter(isVideo);
    const documents = files.filter((file) => !isImage(file) && !isVideo(file));
    const out: string[] = [];
    if (pictures.length > 0) {
      out.push(`<ul class="gv-gallery" aria-label="${attr(label)}">`);
      for (const file of pictures) {
        const sized = file.width && file.height ? ` width="${file.width}" height="${file.height}"` : "";
        out.push(`<li><a href="${this.src(file.href)}"><img src="${this.src(file.href)}" alt="${attr(fileWords(file))}"${sized} loading="lazy" decoding="async"${framing(file)}></a>${file.caption ? `<span class="gv-quiet">${esc(file.caption)}</span>` : ""}</li>`);
      }
      out.push(`</ul>`);
    }
    for (const file of videos) {
      const sized = file.width && file.height ? ` width="${file.width}" height="${file.height}"` : "";
      const clock = file.duration !== undefined ? ` · ${videoClock(file.duration)}` : "";
      out.push(
        `<figure class="gv-video"><video src="${this.src(file.href)}"${file.poster ? ` poster="${this.src(file.poster)}"` : ""} controls preload="metadata" playsinline${sized} aria-label="${attr(fileWords(file))}">` +
          `${file.captions ? `<track kind="captions" src="${this.src(file.captions)}" srclang="en" label="Captions" default>` : ""}</video>` +
          `<figcaption class="gv-quiet">${esc(file.caption ?? file.name)}${clock} — <a href="${this.src(file.href)}">${esc(file.name)}</a></figcaption></figure>`,
      );
    }
    for (const file of documents) {
      const preview = previewOf(file);
      const sized = preview?.width && preview.height ? ` width="${preview.width}" height="${preview.height}"` : "";
      out.push(
        `<p class="gv-document">${preview ? `<a class="gv-preview" href="${this.src(file.href)}"><img src="${this.src(preview.src)}" alt="${attr(`${fileWords(file)}, its first page`)}"${sized} loading="lazy" decoding="async"></a>` : ""}` +
          `<a href="${this.src(file.href)}">${esc(file.name)}</a> <span class="gv-quiet">${esc(typeWords(file))} · ${esc(sizeWords(file.bytes))}</span>${file.caption ? ` <span class="gv-quiet">${esc(file.caption)}</span>` : ""}</p>`,
      );
    }
    return out.join("");
  }
}

/** Whether a file is drawn as a picture where a record's is drawn small: a picture, a video with a poster, a document with a preview. */
const pictured = (file: FileValue): boolean => isImage(file) || (isVideo(file) && file.poster !== undefined) || previewOf(file) !== undefined;

/** A picture cut around its subject (`focus`), or drawn whole where it is a cutout. */
function framing(file: FileValue): string {
  if (file.cutout) return ' style="object-fit: contain"';
  return file.focus ? ` style="object-position: ${Math.round(file.focus.x * 100)}% ${Math.round(file.focus.y * 100)}%"` : "";
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
span.gv-mark { font-size: 1.5rem; line-height: 28px; }
[data-graview-scheme-only="${logoScheme(brand, scheme) === "dark" ? "light" : "dark"}"] { display: none; }
${logoScheme(brand, scheme) === "dark" ? `[data-graview-logo-fallback="invert"] { filter: invert(1) hue-rotate(180deg); mix-blend-mode: screen; }\n` : ""}
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
.gv-problems { border: 1px solid var(--graview-edge); background: var(--graview-panel-warning); padding: 10px 16px; border-radius: var(--graview-radius); }
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
img, video { max-width: 100%; }
.gv-files { display: grid; gap: 10px; min-width: 0; }
.gv-gallery { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.gv-gallery li { display: grid; gap: 4px; min-width: 0; break-inside: avoid; }
.gv-gallery img { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; display: block; border-radius: var(--graview-radius); background: var(--graview-edge); }
.gv-video { margin: 0; display: grid; gap: 4px; break-inside: avoid; }
.gv-video video { display: block; width: 100%; height: auto; max-height: 80vh; border-radius: var(--graview-radius); background: #000; }
.gv-document { margin: 0; display: grid; gap: 6px; justify-items: start; break-inside: avoid; }
.gv-preview img { display: block; width: min(100%, 240px); height: auto; object-fit: contain; border: 1px solid var(--graview-edge); border-radius: var(--graview-radius); background: var(--graview-panel); }
.gv-thumbs { margin: 0 0 6px; }
.gv-thumb { display: block; flex: none; object-fit: cover; border-radius: var(--graview-radius); background: var(--graview-edge); }
.gv-pictured { display: inline-flex; align-items: center; gap: 14px; min-width: 0; }
.gv-contents { margin: 12px 0 0; }
.gv-site-page { border-top: 1px solid var(--graview-edge); margin-top: 32px; padding-top: 8px; }
@page { margin: 16mm; }
@media print {
  .gv-page { max-width: none; padding: 0; }
  .gv-section + .gv-section { break-before: page; border-top: 0; }
  .gv-site-page { break-before: page; border-top: 0; margin-top: 0; }
  a { text-decoration: none; color: inherit; }
}`;
}

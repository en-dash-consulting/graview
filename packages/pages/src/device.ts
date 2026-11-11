/*
 * `@graview/pages/device` — A PLACE ON A FIXED SCREEN, AND WHAT EACH PART OF
 * IT DOES (Roadmap f-eink-display-profile, f-render-tap-map, f-device-nav-bar).
 *
 * An e-ink reader on a wall shows sixteen grays, does not move, has no hover
 * and no keyboard, and is read from across a kitchen. A host photographs a
 * page for it in a browser of its own and sends the picture; when somebody
 * taps the glass, the host is handed a point. `renderScreen` writes the page
 * for that picture, and with it the rectangles of everything on it that can
 * be pressed, each saying exactly what pressing it does; `tapAt` finds the
 * rectangle under a point, and `resolveTap` says what it does now.
 *
 * A FIXED LAYOUT, WORKED OUT HERE. Every row has a height the profile sets,
 * every line of text is one line cut short by the stylesheet, and every row
 * is placed at the pixel it is drawn at — so where each press is is known
 * without a browser, exactly, and the host's browser only has to draw it.
 * What does not fit goes onto pages of the same size, turned by a press.
 *
 * NOT A SECOND RENDERER OF THE DECLARATION. What a place holds for a seat is
 * read as the printed page reads it (`./static-read.ts`: `describePlace`'s
 * answer over the graph the seat may see, the kinds kept from it, a record's
 * relations in its declaration's words); what a record offers is
 * `deriveAffordances`'s, as every face's strip; the strip of screens is
 * `deviceScreensOf`'s. This module only lays that answer out in rows.
 *
 * Runs in Node and a Worker: no DOM, no React, no global read at import.
 */
import { humanizeField, isCurrent, labelOf, pluralOf, recordPath, sayingIn, violationsTouching, type AnySchema, type AppPlace, type GraviewApp, type Principal, type Store } from "@graview/core";
import { describeNode } from "@graview/core/words";
import { answerJob, jobsFor, jobsOf } from "@graview/core/jobs";
import { deviceScreensOf, JOB_SCREEN_PREFIX } from "@graview/core/devices";
import type { DescribedItem, DescribedPart, PlaceDescription } from "@graview/core/describe";
import { deriveAffordances } from "@graview/tools/derive";
import { esc, glanced, readPlace, relationsOf, slugOf } from "./static-read.js";

/** The profiles a screen is drawn in. One now: a grayscale, motionless, touch-only reader. */
export type DeviceProfile = "eink";

/** The screen's size in CSS pixels: 758 × 1024 is a Kindle Paperwhite 3 held upright. */
export interface DeviceViewport {
  readonly width: number;
  readonly height: number;
}

export interface RenderScreenOptions {
  readonly profile: DeviceProfile;
  readonly viewport: DeviceViewport;
  /** Who is looking: the screen holds only what this seat may see, and offers only what it may do. An anonymous person when unsaid. */
  readonly viewer?: Principal;
  /** Which page of a place too long for one screen, from 0. Past the last is the last. */
  readonly page?: number;
  /** The reader's locale; unsaid, the brand's, else en-US. */
  readonly locale?: string;
  /** The reader's time zone; unsaid, the brand's, else the runtime's. */
  readonly timeZone?: string;
  /** The day it is, for dates said relatively; the store's day when unsaid. */
  readonly today?: string;
  /** Put before every address a link on the screen names, as `renderPlace` does. */
  readonly base?: string;
}

/** What pressing a region does: exactly one of these. */
export type TapDoes =
  /** Show a place: its address (`/`, `/tasks`, `/places/the-week`), or one of the app's jobs as `job:<name>`. */
  | { readonly go: string }
  /** Show a record's page: its id. */
  | { readonly open: string }
  /** Run an act this seat may run, with every argument bound. */
  | { readonly act: string; readonly args: Readonly<Record<string, unknown>> }
  /** Turn to another page of this place, from 0. */
  | { readonly page: number }
  /** Draw this screen again as the app now stands. */
  | { readonly refresh: true };

/** One pressable region, in the viewport's CSS pixels, with the words drawn on it. */
export interface TapRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly does: TapDoes;
}

export interface RenderedScreen {
  /** The whole document: its stylesheet inlined, no script, nothing to fetch. */
  readonly html: string;
  /** The stylesheet alone, the same one the document carries. */
  readonly css: string;
  /** As its `<title>` says it: the place's, then the app's name. */
  readonly title: string;
  /** Whether the place was there for this seat; a screen that says nothing lives here when not. */
  readonly found: boolean;
  /**
   * WHICH PICTURE THIS IS: made of what the screen shows — its markup and
   * its regions — and the place, page, viewport and reading it was drawn
   * for, so the same store, declaration, place, seat, profile, viewport and
   * page give the same id, and a change the screen does not show keeps it.
   * A tap is resolved against it (`resolveTap`); it says nothing the screen
   * does not.
   */
  readonly renderId: string;
  readonly page: { readonly index: number; readonly count: number };
  /** Every region of the screen that can be pressed, at least 64 px on each side. */
  readonly taps: readonly TapRegion[];
}

/* ------------------------------------------------------------ the profile */

/**
 * The profile's sixteen grays, black to white: every color the screen's sheet names is one of them. The
 * framework does not rasterize: a browser's antialiased type draws grays between them, and the host
 * quantizes the picture to its panel.
 */
export const EINK_GRAYS: readonly string[] = Array.from({ length: 16 }, (_, at) => `#${(at * 17).toString(16).padStart(2, "0").repeat(3)}`);
/** The least a press measures on each side, in CSS pixels: a finger, not a pointer. */
export const EINK_LEAST_TARGET = 64;

const INK = "#000000";
const MUTED = "#444444";
const RULE = "#888888";
const PANEL = "#eeeeee";
const PAPER = "#ffffff";

/** Each row's height, fixed: the profile sets it, so a region is where its row is drawn. */
const HEIGHT = { head: 112, heading: 64, text: 56, field: 80, item: 104, link: 88, act: 96, pager: 80, strip: 112 } as const;
/** The gutter at each side of a row's words. */
const GUTTER = 24;
/** The most acts a record's screen offers: the ones the derivation puts first. */
const MOST_ACTS = 3;
/** The smallest screen the profile lays out: a strip, a page turn and one row under the head. */
const LEAST_VIEWPORT = { width: 320, height: HEIGHT.head + HEIGHT.strip + HEIGHT.pager + HEIGHT.item } as const;

/** The profile's stylesheet: one sheet for every screen, its sizes the rows' own and every color a gray of the ramp. */
export function einkCss(): string {
  return `html, body { margin: 0; padding: 0; background: ${PAPER}; color: ${INK}; overflow: hidden; }
body { font: 400 24px/1.25 "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; font-synthesis: none; text-rendering: geometricPrecision; }
.gv-screen { position: relative; overflow: hidden; background: ${PAPER}; }
.gv-at { position: absolute; box-sizing: border-box; overflow: hidden; margin: 0; padding: 0 ${GUTTER}px; white-space: nowrap; color: ${INK}; text-decoration: none; }
.gv-line { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin: 0; }
.gv-head { border-bottom: 3px solid ${INK}; }
.gv-app { font-size: 20px; line-height: 28px; height: 28px; margin-top: 16px; color: ${MUTED}; }
.gv-title { font-size: 36px; line-height: 52px; height: 52px; font-weight: 700; }
.gv-heading { font-size: 28px; line-height: 64px; font-weight: 700; }
.gv-text { font-size: 24px; line-height: 56px; }
.gv-quiet { color: ${MUTED}; }
.gv-field .gv-label { font-size: 20px; line-height: 28px; height: 28px; margin-top: 10px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.04em; }
.gv-field .gv-value { font-size: 26px; line-height: 36px; height: 36px; }
.gv-item { border-bottom: 1px solid ${RULE}; }
.gv-item .gv-name { font-size: 28px; line-height: 40px; height: 40px; margin-top: 14px; font-weight: 700; }
.gv-item .gv-glance { font-size: 20px; line-height: 30px; height: 30px; color: ${MUTED}; }
.gv-link { font-size: 26px; line-height: 87px; border-bottom: 1px solid ${RULE}; font-weight: 700; }
.gv-act { font-size: 26px; line-height: 70px; text-align: center; font-weight: 700; border: 3px solid ${INK}; background: ${PANEL}; padding: 0 12px; }
.gv-pager { border-top: 1px solid ${RULE}; font-size: 24px; line-height: 79px; text-align: center; padding: 0 8px; }
.gv-pager-off { color: ${RULE}; }
.gv-press { font-size: 22px; line-height: 109px; text-align: center; padding: 0 8px; border-top: 3px solid ${INK}; font-weight: 700; }
.gv-press + .gv-press { border-left: 1px solid ${RULE}; }
.gv-here { background: ${INK}; color: ${PAPER}; }
img, svg { filter: grayscale(1); }`;
}

/* --------------------------------------------------------------- the rows */

type Row =
  | { readonly t: "heading"; readonly text: string }
  | { readonly t: "text"; readonly text: string; readonly quiet?: boolean }
  | { readonly t: "field"; readonly label: string; readonly text: string }
  /** `glance` is worked out only for a row on the page drawn: a list of thousands reads a dozen of them. */
  | { readonly t: "item"; readonly title: string; readonly glance: string | (() => string); readonly id: string; readonly href: string }
  | { readonly t: "link"; readonly text: string; readonly go: string; readonly href?: string }
  | { readonly t: "act"; readonly text: string; readonly act: string; readonly args: Readonly<Record<string, unknown>> };

/** What a screen says: its title, its rows, where it is, and whether it was there. */
interface ScreenContent {
  readonly title: string;
  readonly rows: readonly Row[];
  /** Its address, as a screen's press goes to it: `/tasks`, `/tasks/task-1`, `job:due-today`. */
  readonly address: string;
  /** For a record, its kind's list: the screen of the strip that holds it is marked. */
  readonly within?: string;
  readonly found: boolean;
}

/** Words a row carries beyond its title, as one line. */
const lineOf = (parts: readonly DescribedPart[]): string =>
  parts
    .flatMap((part) => (part.t === "text" || part.t === "badge" ? [part.text] : part.t === "field" || part.t === "progress" ? [`${part.label}: ${part.text}`] : part.t === "figure" ? [`${part.text}${part.label ? ` ${part.label}` : ""}`] : []))
    .join(" · ");

class Rows {
  readonly rows: Row[] = [];
  constructor(
    private readonly seen: Store<AnySchema>,
    private readonly locale: string,
    private readonly base: string,
  ) {}
  href(path: string): string {
    return `${this.base}${path}`;
  }
  item(item: DescribedItem): void {
    this.rows.push({ t: "item", title: item.title, glance: () => lineOf(glanced(this.seen, item, this.locale).parts), id: item.id, href: this.href(recordPath(this.seen.schema, item.kind, item.id)) });
  }
  /** Parts as rows: a heading a row of its own, a line a row, a fact a label over its value, each record of a list a row that opens it. */
  parts(parts: readonly DescribedPart[]): void {
    for (const part of parts) {
      switch (part.t) {
        case "heading":
          this.rows.push({ t: "heading", text: part.text });
          break;
        case "text":
        case "badge":
          this.rows.push({ t: "text", text: part.text });
          break;
        case "field":
        case "progress":
          this.rows.push({ t: "field", label: part.label, text: part.text.replace(/\s+/g, " ") });
          break;
        case "figure":
          this.rows.push({ t: "field", label: part.label ?? "", text: part.text });
          break;
        case "view":
          if (part.parts && part.parts.length > 0) this.parts(part.parts);
          else if (part.title) this.rows.push({ t: "text", text: part.title, quiet: true });
          break;
        case "list": {
          if (part.groups.length === 0 && part.empty) this.rows.push({ t: "text", text: part.empty, quiet: true });
          for (const group of part.groups) {
            if (group.heading) this.rows.push({ t: "heading", text: group.count !== undefined ? `${group.heading} (${group.count})` : group.heading });
            for (const item of group.items) this.item(item);
          }
          if (part.more) {
            // What a list leaves out is a press away, on its kind's own list.
            const kind = part.groups.flatMap((group) => group.items)[0]?.kind;
            if (kind) this.rows.push({ t: "link", text: `And ${part.more} more ›`, go: `/${slugOf(this.seen, kind)}`, href: this.href(`/${slugOf(this.seen, kind)}`) });
            else this.rows.push({ t: "text", text: `And ${part.more} more`, quiet: true });
          }
          break;
        }
      }
    }
  }
}

/** The home, a declared place or a lens: what `describePlace` says it shows, under its own heading. */
function placeRows(rows: Rows, seen: Store<AnySchema>, d: PlaceDescription, kept: ReadonlySet<string>, names: readonly string[]): string {
  const titled = d.parts[0]?.t === "heading" && d.parts[0].level === 1;
  const home = d.place.kind === null && d.place.slug === "home";
  if (home && d.masthead?.subtitle) rows.rows.push({ t: "text", text: d.masthead.subtitle, quiet: true });
  const body = titled ? d.parts.slice(1) : d.parts;
  if (home && d.drawnBy === "derived") {
    /*
     * THE DERIVED HOME SAYS HOW MANY OF EACH KIND ("12 tasks"): on a screen
     * with no bar to hunt through, each is the press that opens that kind's
     * list — the kind found by its count and its own word for that many.
     */
    for (const part of body) {
      const said = part.t === "text" ? /^(\d+) (.+)$/.exec(part.text) : null;
      const kind = said
        ? (seen.schema.kinds as readonly string[]).find((one) => {
            if (kept.has(one)) return false;
            const definition = seen.schema.tryDefinition(one);
            const words = [pluralOf(seen.schema, one), definition?.noun ?? "", humanizeField(one)].map((word) => word.toLowerCase());
            return words.includes(said[2]!.toLowerCase()) && seen.graph.nodesOfKind(one).filter((node) => isCurrent(definition, node)).length === Number(said[1]);
          })
        : undefined;
      if (kind && part.t === "text") rows.rows.push({ t: "link", text: `${part.text} ›`, go: `/${slugOf(seen, kind)}`, href: rows.href(`/${slugOf(seen, kind)}`) });
      else rows.parts([part]);
    }
  } else rows.parts(body);
  for (const fact of d.facts ?? []) rows.rows.push({ t: "field", label: fact.label, text: fact.value ?? "—" });
  const heading = titled ? (d.parts[0] as { text: string }).text : d.place.title;
  // The home's own heading is the app's name, which the head already says above it: the screen is called Home.
  return home && names.includes(heading) ? d.place.title : heading;
}

/** A kind's list: its description, how many, and each record as its row says it. */
function listRows(rows: Rows, seen: Store<AnySchema>, d: PlaceDescription): void {
  const kind = d.place.kind!;
  const definition = seen.schema.tryDefinition(kind);
  const members = seen.graph.nodesOfKind(kind).filter((node) => isCurrent(definition, node));
  if (definition?.description) rows.rows.push({ t: "text", text: definition.description, quiet: true });
  rows.rows.push({ t: "text", text: `${members.length} ${members.length === 1 ? (definition?.noun ?? humanizeField(kind)).toLowerCase() : pluralOf(seen.schema, kind).toLowerCase()}`, quiet: true });
  rows.parts(d.parts.filter((part, index) => !(index === 0 && part.t === "heading" && part.level === 1)));
}

/**
 * WHAT A RECORD OFFERS ON A SCREEN: the acts the derivation puts first for
 * it, that this seat may run, that change something, that ask nothing more
 * — every argument already bound, none a typed answer — that lose nothing a
 * person made, and that name only records this seat may see.
 */
function screenActs<S extends AnySchema>(store: Store<S>, id: string, viewer: Principal): { label: string; act: string; args: Readonly<Record<string, unknown>> }[] {
  const derived = deriveAffordances(store, [id], { principal: viewer, focus: id });
  const out: { label: string; act: string; args: Readonly<Record<string, unknown>> }[] = [];
  for (const affordance of derived.affordances) {
    if (out.length >= MOST_ACTS) break;
    if (affordance.open.length > 0 || affordance.batch || affordance.destructive || affordance.setsAside || affordance.provider === "llm") continue;
    if (out.some((one) => one.act === affordance.mutation && JSON.stringify(one.args) === JSON.stringify(affordance.args))) continue;
    const call = { name: affordance.mutation, args: { ...affordance.args } };
    const named = Object.values(affordance.args).filter((value): value is string => typeof value === "string" && store.graph.getNode(value) !== undefined);
    if (named.some((other) => !store.sees(viewer, other))) continue;
    if (!store.permits(call, viewer).ok) continue;
    // Rehearsed as the seat: an act its own rule refuses, or one that changes nothing this seat can see, is not a press it could make.
    if (store.wouldDo([call], viewer)[0] !== "changes") continue;
    out.push({ label: affordance.label, act: affordance.mutation, args: affordance.args });
  }
  return out;
}

/** A record's screen: the way back to its kind's list, its sentence, what is wrong, what it offers, its facts and what it relates to. */
function recordRows<S extends AnySchema>(rows: Rows, store: Store<S>, seen: Store<AnySchema>, d: PlaceDescription, kept: ReadonlySet<string>, viewer: Principal): void {
  const id = d.place.slug;
  const kind = d.place.kind!;
  const node = seen.graph.getNode(id) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
  const definition = seen.schema.tryDefinition(kind);
  const list = `/${slugOf(seen, kind)}`;
  rows.rows.push({ t: "link", text: `‹ ${pluralOf(seen.schema, kind)}`, go: list, href: rows.href(list) });
  const said = definition?.describe && node ? describeNode(definition, node) : null;
  if (said && said !== d.place.title) rows.rows.push({ t: "text", text: said, quiet: true });
  for (const problem of violationsTouching(seen.violations(), [id])) rows.rows.push({ t: "text", text: `${problem.label} — ${problem.message}` });
  for (const act of screenActs(store, id, viewer)) rows.rows.push({ t: "act", text: act.label, act: act.act, args: act.args });
  if (d.parts.length > 0) {
    rows.rows.push({ t: "heading", text: "The facts" });
    rows.parts(d.parts);
  }
  for (const group of relationsOf(seen, id, kept)) {
    rows.rows.push({ t: "heading", text: group.heading });
    for (const target of group.targets) rows.rows.push({ t: "item", title: target.label, glance: "", id: target.id, href: rows.href(recordPath(seen.schema, target.kind, target.id)) });
  }
}

const NOTHING = "Nothing lives at this address.";

/** What the screen says, from the place as this seat may read it. */
function contentOf<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, place: string | AppPlace, options: RenderScreenOptions, base: string): ScreenContent & { readonly appName: string; readonly locale: string; readonly kept: ReadonlySet<string> } {
  const viewer: Principal = options.viewer ?? { kind: "human" };
  if (typeof place === "string" && place.startsWith(JOB_SCREEN_PREFIX)) {
    // A JOB AS A SCREEN: its question as the title, and the records that answer it as this seat sees them, in its order.
    const { brand, locale, seen, kept } = readPlace(store, declaration, "home", { viewer, locale: options.locale, today: options.today, width: options.viewport.width });
    const appName = brand.name || declaration.name;
    const name = place.slice(JOB_SCREEN_PREFIX.length);
    const job = jobsFor(jobsOf(declaration), viewer).find((one) => one.name === name);
    if (!job || kept.has(job.kind)) return { title: NOTHING, rows: [{ t: "text", text: NOTHING }], address: place, found: false, appName, locale, kept };
    const rows = new Rows(seen, locale, base);
    const answer = answerJob(store, job, viewer);
    rows.rows.push({ t: "text", text: `${answer.count} ${answer.count === 1 ? (seen.schema.tryDefinition(job.kind)?.noun ?? humanizeField(job.kind)).toLowerCase() : job.plural.toLowerCase()}`, quiet: true });
    for (const id of answer.ids) {
      const node = seen.graph.getNode(id);
      if (node) rows.item({ id, kind: node.kind, title: labelOf(seen.schema.tryDefinition(node.kind), node as never), parts: [] });
    }
    return { title: job.ask, rows: rows.rows, address: place, found: true, appName, locale, kept };
  }
  const { brand, locale, seen, kept, described, there } = readPlace(store, declaration, place, { viewer, locale: options.locale, today: options.today, width: options.viewport.width });
  const appName = brand.name || declaration.name;
  if (!described.ok || !there) return { title: NOTHING, rows: [{ t: "text", text: NOTHING }], address: typeof place === "string" ? place : place.address, found: false, appName, locale, kept };
  const d = described.description;
  const rows = new Rows(seen, locale, base);
  if (d.drawnBy === "record") {
    recordRows(rows, store, seen, d, kept, viewer);
    return { title: d.place.title, rows: rows.rows, address: recordPath(seen.schema, d.place.kind!, d.place.slug), within: `/${slugOf(seen, d.place.kind!)}`, found: true, appName, locale, kept };
  }
  if (d.place.kind !== null && d.drawnBy === "derived") {
    listRows(rows, seen, d);
    return { title: d.place.title, rows: rows.rows, address: d.place.address, found: true, appName, locale, kept };
  }
  const title = placeRows(rows, seen, d, kept, [declaration.name, appName]);
  return { title, rows: rows.rows, address: d.place.address, found: true, appName, locale, kept };
}

/* ------------------------------------------------------------- the layout */

const rowHeight = (row: Row): number => HEIGHT[row.t];

/**
 * THE ROWS ON PAGES: as many as fit under the head and over the strip, a
 * heading never left at the foot of a page without what it heads. One page
 * when they all fit; else every page also keeps a row for turning it.
 */
function paginate(rows: readonly Row[], height: number): Row[][] {
  const single = height - HEIGHT.head - HEIGHT.strip;
  if (rows.reduce((sum, row) => sum + rowHeight(row), 0) <= single) return [[...rows]];
  const room = single - HEIGHT.pager;
  const pages: Row[][] = [[]];
  let used = 0;
  rows.forEach((row, at) => {
    const page = pages[pages.length - 1]!;
    const next = rows[at + 1];
    // A heading goes over with what it heads when the two do not fit together.
    const needs = rowHeight(row) + (row.t === "heading" && next ? rowHeight(next) : 0);
    if (page.length > 0 && used + needs > room) {
      pages.push([row]);
      used = rowHeight(row);
      return;
    }
    page.push(row);
    used += rowHeight(row);
  });
  return pages;
}

/** One element at its pixel, pressable or not: what it says, and the region it is when it does something. */
function at(box: { x: number; y: number; width: number; height: number }, className: string, inner: string, press?: { label: string; does: TapDoes; href?: string | undefined }, taps?: TapRegion[]): string {
  const style = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px`;
  if (!press || !taps) return `<div class="gv-at ${className}" style="${style}">${inner}</div>`;
  const index = taps.push({ ...box, label: press.label, does: press.does }) - 1;
  const tag = press.href ? "a" : "div";
  return `<${tag} class="gv-at ${className}" style="${style}" data-tap="${index}"${press.href ? ` href="${esc(press.href)}"` : ""}>${inner}</${tag}>`;
}

const line = (className: string, text: string) => `<span class="gv-line ${className}">${esc(text)}</span>`;

function drawRows(rows: readonly Row[], top: number, width: number, taps: TapRegion[]): string[] {
  const out: string[] = [];
  let y = top;
  for (const row of rows) {
    const h = rowHeight(row);
    const box = { x: 0, y, width, height: h };
    switch (row.t) {
      case "heading":
        out.push(at(box, "gv-heading", line("", row.text)));
        break;
      case "text":
        out.push(at(box, `gv-text${row.quiet ? " gv-quiet" : ""}`, line("", row.text)));
        break;
      case "field":
        out.push(at(box, "gv-field", line("gv-label", row.label) + line("gv-value", row.text)));
        break;
      case "item":
        out.push(at(box, "gv-item", line("gv-name", row.title) + line("gv-glance", typeof row.glance === "function" ? row.glance() : row.glance), { label: row.title, does: { open: row.id }, href: row.href }, taps));
        break;
      case "link":
        out.push(at(box, "gv-link", line("", row.text), { label: row.text, does: { go: row.go }, href: row.href }, taps));
        break;
      case "act": {
        // The press is the button drawn inside its row, inset from the row's edges.
        const button = { x: GUTTER, y: y + 10, width: width - 2 * GUTTER, height: h - 20 };
        out.push(at(button, "gv-act", line("", row.text), { label: row.text, does: { act: row.act, args: row.args } }, taps));
        break;
      }
    }
    y += h;
  }
  return out;
}

/** Cells across a width, whole pixels each, the last taking what is left. */
function cells(width: number, count: number): { x: number; width: number }[] {
  const each = Math.floor(width / count);
  return Array.from({ length: count }, (_, at) => ({ x: at * each, width: at === count - 1 ? width - at * each : each }));
}

/* ------------------------------------------------------------- the render */

/**
 * RENDER ONE PLACE FOR A FIXED SCREEN, with what each region of it does.
 *
 * `place` is what `renderPlace` takes — a slug, a title, an address, a
 * record's id or address — or one of the app's jobs as `job:<name>`. The
 * screen is the place's title, its rows, the page turn when it needs more
 * than one, and the strip of the app's device screens with Refresh, the
 * one it is on marked.
 */
export function renderScreen<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, place: string | AppPlace, options: RenderScreenOptions): RenderedScreen {
  const timeZone = declaration.brand?.timeZone;
  return sayingIn({ readerTimeZone: options.timeZone, appTimeZone: timeZone }, () => screenRendered(store, declaration, place, options));
}

function screenRendered<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, place: string | AppPlace, options: RenderScreenOptions): RenderedScreen {
  if (options.profile !== "eink") throw new RangeError(`"${String(options.profile)}" is not a device profile; the one there is is "eink".`);
  const width = Math.floor(options.viewport?.width ?? 0);
  const height = Math.floor(options.viewport?.height ?? 0);
  if (!(width >= LEAST_VIEWPORT.width && height >= LEAST_VIEWPORT.height)) {
    throw new RangeError(`A screen of ${options.viewport?.width} × ${options.viewport?.height} is too small for the e-ink profile; it lays out ${LEAST_VIEWPORT.width} × ${LEAST_VIEWPORT.height} and larger.`);
  }
  const viewer: Principal = options.viewer ?? { kind: "human" };
  const base = (options.base ?? "").replace(/\/$/, "");
  const content = contentOf(store, declaration, place, options, base);

  const pages = paginate(content.rows, height);
  const index = Math.max(0, Math.min(pages.length - 1, Number.isFinite(options.page) ? Math.floor(options.page!) : 0));
  const taps: TapRegion[] = [];
  const body: string[] = [];
  body.push(at({ x: 0, y: 0, width, height: HEIGHT.head }, "gv-head", line("gv-app", content.appName) + `<h1 class="gv-line gv-title">${esc(content.title)}</h1>`));
  body.push(...drawRows(pages[index]!, HEIGHT.head, width, taps));

  // THE PAGE TURN, over the strip: back, where it is, on.
  if (pages.length > 1) {
    const top = height - HEIGHT.strip - HEIGHT.pager;
    const [back, here, on] = cells(width, 3);
    const box = (cell: { x: number; width: number }) => ({ x: cell.x, y: top, width: cell.width, height: HEIGHT.pager });
    body.push(index > 0 ? at(box(back!), "gv-pager", line("", "‹ Back"), { label: "Back a page", does: { page: index - 1 } }, taps) : at(box(back!), "gv-pager gv-pager-off", line("", "‹ Back")));
    body.push(at(box(here!), "gv-pager gv-quiet", line("", `Page ${index + 1} of ${pages.length}`)));
    body.push(index < pages.length - 1 ? at(box(on!), "gv-pager", line("", "On ›"), { label: "On a page", does: { page: index + 1 } }, taps) : at(box(on!), "gv-pager gv-pager-off", line("", "On ›")));
  }

  // THE STRIP: the app's device screens in order, the one this is marked, and Refresh.
  const kept = content.kept;
  const screens = deviceScreensOf(declaration, { principal: viewer, kept });
  const current = screens.find((screen) => screen.go === content.address) ?? screens.find((screen) => content.within !== undefined && screen.go === content.within);
  const strip = cells(width, screens.length + 1);
  screens.forEach((screen, at_) => {
    const cell = strip[at_]!;
    const here = screen === current;
    body.push(
      at({ x: cell.x, y: height - HEIGHT.strip, width: cell.width, height: HEIGHT.strip }, `gv-press${here ? " gv-here" : ""}`, line("", screen.label), {
        label: screen.label,
        does: { go: screen.go },
        href: screen.go.startsWith(JOB_SCREEN_PREFIX) ? undefined : `${base}${screen.go}`,
      }, taps),
    );
  });
  const refresh = strip[strip.length - 1]!;
  body.push(at({ x: refresh.x, y: height - HEIGHT.strip, width: refresh.width, height: HEIGHT.strip }, "gv-press", line("", "Refresh"), { label: "Refresh", does: { refresh: true } }, taps));

  const css = einkCss();
  const head = content.title === content.appName ? content.title : `${content.title} — ${content.appName}`;
  const html =
    `<!doctype html>\n<html lang="${esc(content.locale)}" data-graview-device="eink">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=${width}, height=${height}, initial-scale=1">\n<title>${esc(head)}</title>\n<style>\n${css}\n</style>\n</head>\n` +
    `<body>\n<div class="gv-screen" style="width:${width}px;height:${height}px">\n${body.join("\n")}\n</div>\n</body>\n</html>\n`;

  const asked = typeof place === "string" ? place : place.address;
  const params: ScreenParams = { place: asked, width, height, page: index, ...(options.today ? { today: options.today } : {}), ...(options.locale ? { locale: options.locale } : {}), ...(options.timeZone ? { timeZone: options.timeZone } : {}), ...(options.base ? { base: options.base } : {}) };
  const renderId = `eink.${encodeParams(params)}.${hash(`${html}\u0000${JSON.stringify(taps)}`)}`;
  return { html, css, title: head, found: content.found, renderId, page: { index, count: pages.length }, taps };
}

/** The region under a point of the viewport, if a region is there. Regions never overlap, so there is one at most. */
export function tapAt(taps: readonly TapRegion[], x: number, y: number): TapRegion | undefined {
  return taps.find((tap) => x >= tap.x && x < tap.x + tap.width && y >= tap.y && y < tap.y + tap.height);
}

/* ------------------------------------------------------------- the render's id */

/** What a screen was drawn for, carried in its id so a tap can be judged against the same screen drawn again. */
interface ScreenParams {
  readonly place: string;
  readonly width: number;
  readonly height: number;
  readonly page: number;
  readonly today?: string;
  readonly locale?: string;
  readonly timeZone?: string;
  readonly base?: string;
}

function encodeParams(params: ScreenParams): string {
  const bytes = new TextEncoder().encode(JSON.stringify(params));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeParams(text: string): ScreenParams | undefined {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const read = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)))) as Partial<ScreenParams>;
    if (typeof read.place !== "string" || typeof read.width !== "number" || typeof read.height !== "number" || typeof read.page !== "number") return undefined;
    return read as ScreenParams;
  } catch {
    return undefined;
  }
}

/** Two 53-bit string hashes side by side (cyrb53, two seeds), as 28 hex digits: an id, not a secret. */
function hash(text: string): string {
  const one = (seed: number): string => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  };
  return one(1) + one(2);
}

/* -------------------------------------------------------------- the taps */

/**
 * What a tap does now: a screen to draw, an act done, or a refusal in words —
 * each with the screen to draw next. `place` is a place to hand back to
 * `renderScreen` (an address such as `/tasks`, a record's address, or
 * `job:<name>`), never a URL to follow: it is not checked as one.
 */
export type TapOutcome =
  | { readonly ok: true; readonly does: "go" | "open" | "page" | "refresh"; readonly place: string; readonly page: number }
  | { readonly ok: true; readonly does: "act"; readonly said: string; readonly place: string; readonly page: number }
  | { readonly ok: false; readonly refused: string; readonly place: string; readonly page: number };

export interface ResolveTapOptions {
  /** Who tapped: the seat the screen was drawn for. */
  readonly viewer?: Principal;
  /** The `renderId` of the screen the tap was on. */
  readonly renderId: string;
}

const sameDoes = (a: TapDoes, b: TapDoes): boolean => JSON.stringify(sortedDeep(a)) === JSON.stringify(sortedDeep(b));
function sortedDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedDeep);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedDeep((value as Record<string, unknown>)[key])]));
  return value;
}

/**
 * WHAT A TAP DOES NOW. A press that goes somewhere answers the place to draw
 * next — a place to hand back to `renderScreen`, never a URL to follow —
 * and only when the screen, drawn again as the seat now stands, still has
 * that press: a `go` or an `open` no screen of this place offers is refused,
 * as a forged act is. Turning a page and Refresh answer this place. An act
 * is run only when the screen it was pressed on is the screen the app draws
 * now for this seat — the same `renderId` — and the act is on it, with the
 * same arguments; when what the screen shows has changed since, the act is
 * judged again as the seat now stands and refused in words, never run on a
 * state the picture did not show.
 */
export function resolveTap<S extends AnySchema>(store: Store<S>, declaration: GraviewApp<S>, region: Pick<TapRegion, "label" | "does">, options: ResolveTapOptions): TapOutcome {
  const viewer: Principal = options.viewer ?? { kind: "human" };
  const parts = typeof options.renderId === "string" ? options.renderId.split(".") : [];
  const params = parts.length === 3 && parts[0] === "eink" ? decodeParams(parts[1]!) : undefined;
  if (!params) return { ok: false, refused: "This tap was not on a screen this app drew; draw the screen again and tap there.", place: "/", page: 0 };
  const here = { place: params.place, page: params.page };
  const does = region.does as Partial<Record<string, unknown>>;
  if (typeof does.page === "number" && Number.isFinite(does.page)) return { ok: true, does: "page", place: params.place, page: Math.max(0, Math.floor(does.page)) };
  if (does.refresh === true) return { ok: true, does: "refresh", ...here };
  if (typeof does.go !== "string" && typeof does.open !== "string" && typeof does.act !== "string") return { ok: false, refused: "This tap does nothing Graview knows.", ...here };

  // The screen as the seat now stands: a press is answered only if it is one of its own.
  const now = renderScreen(store, declaration, params.place, {
    profile: "eink",
    viewport: { width: params.width, height: params.height },
    viewer,
    page: params.page,
    ...(params.today ? { today: params.today } : {}),
    ...(params.locale ? { locale: params.locale } : {}),
    ...(params.timeZone ? { timeZone: params.timeZone } : {}),
    ...(params.base ? { base: params.base } : {}),
  });
  const shown = now.taps.find((tap) => tap.label === region.label && sameDoes(tap.does, region.does));
  if (typeof does.go === "string") {
    if (!shown) return { ok: false, refused: `“${region.label}” is not on this screen, so it goes nowhere.`, ...here };
    return { ok: true, does: "go", place: does.go, page: 0 };
  }
  if (typeof does.open === "string") {
    // A record the seat may not see — or of a kind kept from it — is answered as no record at all.
    const node = store.seenBy(viewer).graph.getNode(does.open);
    if (!node || store.kindsKeptFrom(viewer).has(node.kind) || store.modules.disabledKinds.has(node.kind)) return { ok: false, refused: NOTHING, ...here };
    if (!shown) return { ok: false, refused: `“${region.label}” is not on this screen, so it opens nothing.`, ...here };
    return { ok: true, does: "open", place: recordPath(store.schema, node.kind, node.id), page: 0 };
  }

  const act = does.act as string;
  const args = (does.args && typeof does.args === "object" ? does.args : {}) as Record<string, unknown>;
  if (now.renderId !== options.renderId) {
    // The app moved on since the picture was drawn: judged again as the seat now stands, and not run.
    const verdict = store.permits({ name: act, args }, viewer);
    const why = !verdict.ok
      ? `“${region.label}” is no longer yours to do: ${verdict.refusal.message}`
      : !shown
        ? `“${region.label}” is no longer offered here: the app changed since this screen was drawn.`
        : `The app changed since this screen was drawn, so “${region.label}” was not done.`;
    return { ok: false, refused: `${why} The screen is drawn again; look, and tap it there if it still is.`, ...here };
  }
  if (!shown) return { ok: false, refused: `“${region.label}” is not on this screen, so it was not done.`, ...here };
  try {
    store.apply({ name: act, args: { ...args } }, { author: viewer, via: "device", intent: region.label });
  } catch (error) {
    return { ok: false, refused: `“${region.label}” was not done: ${error instanceof Error ? error.message : String(error)}`, ...here };
  }
  return { ok: true, does: "act", said: `${region.label}: done.`, ...here };
}

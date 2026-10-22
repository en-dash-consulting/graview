import { lowerFirst } from "../capital.js";
import type { GraviewApp } from "../app.js";
import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import type { Principal } from "../permissions/types.js";
import type { Store } from "../store.js";
import { declaredLenses, orderKinds } from "../places.js";
import { placesOf, type AppPlace } from "../app-places.js";
import type { AnySchema } from "../schema/schema.js";
import { fieldWords, humanizeField, isCurrent, labelOf, pluralOf } from "../schema/define-node.js";
import { pageSections, readableFields } from "../schema/reading.js";
import { recordPath } from "../views/types.js";
import { isoToday } from "../days.js";
import { columnMoves, columnOf, statusColumns } from "../columns.js";
import { coverageParts } from "./describe-coverage.js";
import type { DescribedFact, DescribedHostView, DescribedItem, DescribedMasthead, DescribedPart, DescribedProblem, DescribePlaceResult, PlaceDescription } from "./described.js";
import { sortForGrid } from "../grid-sort.js";
import type { ResolvedBlock } from "./blocks.js";
import { resolveFor, type ResolveForOptions } from "./resolve-for.js";
import { computedValues, withComputed, type ComputedRecord, type PlainComputed } from "./computed-values.js";
import { computedOf } from "./computed.js";
import { isInlineSvg, logoOf, markHref } from "../theme/marks.js";
import { markdownWords } from "../excerpt-of.js";
import { visitorForm, type VisitorForm } from "../mutations/visitor-form.js";
import { creatingActs, describeActForm, describeVisitorForm, formLines } from "./describe-forms.js";
import type { DescribedForm } from "./described.js";

/*
 * WHAT A PLACE SHOWS, WITHOUT A BROWSER (FR-89).
 *
 * A chat that has just changed an app wants to know what a person now
 * sees — on a phone, as a partner — before it says "done". It cannot open
 * a browser; it can ask this. `describePlace` says what a place shows one
 * seat: its headings, its figures as they are drawn, its lists with each
 * record's title and what its card or row says, the headings of a grouped
 * list, the words an empty list says, and any problem — a block that
 * could not be worked out, an expression refused. As data, and as text.
 *
 * It is not a second renderer. A place's blocks are worked out by
 * `resolveBlocks`, which is what the faces draw from; the graph is the
 * seat's own (`store.seenBy`), so a partner is told of exactly the offers
 * the partner's face lists. What a listed record says is what the face
 * draws for it: its kind's card or row spec, resolved the same way, or —
 * for a kind with none — the default card's title and glance, or the
 * default row's title.
 *
 * Width changes layout, not content, today: no block is hidden at 390.
 * What it does change is said — a card list's columns (one on a phone).
 */

export interface DescribePlaceOptions<S extends AnySchema> {
  /** The app whose place this is: its home, lenses, views and arrangement. */
  readonly app: GraviewApp<S>;
  /** The viewport's width in CSS pixels; 390 is a phone. 1440 when unsaid. */
  readonly width?: number;
  /** The day it is, for dates said relatively; today when unsaid. */
  readonly today?: string;
  /**
   * The views the host keeps, by their manifests (`DescribedHostView`). A
   * record's page whose kind has a view of one says where it is drawn — at
   * the head, then the kind's page slot, then the facts — or, where the
   * view replaces the page, the view alone, and that the slot is not drawn.
   */
  readonly views?: readonly DescribedHostView[];
}

/**
 * A PAGE SLOT A VIEW SHADOWS: a kind whose page blocks (`views.<kind>.page`)
 * are never drawn, because the host keeps a view of one of its records that
 * replaces the page (`replaces: "page"`). A view that does not replace the
 * page draws the slot under it, so it shadows nothing. For a host's problems
 * beside `graview check`'s, which does not see the host's views.
 */
export function shadowedPageSlots(app: Pick<GraviewApp<AnySchema>, "viewSpecs" | "schema">, views: readonly DescribedHostView[]): readonly DescribedProblem[] {
  const specs = (app.viewSpecs ?? {}) as Readonly<Record<string, { page?: readonly unknown[] }>>;
  return views
    .filter((view) => view.cardinality === "one" && view.replaces === "page" && (specs[view.attach]?.page?.length ?? 0) > 0)
    .map((view) => {
      const noun = kindWord(app.schema, view.attach, 1);
      return { at: `views.${view.attach}.page`, says: `The view "${view.name}" replaces ${withArticle(noun)}'s page, so its page slot is never drawn: leave out replaces to draw the slot under the view, or draw what the slot says in the view.` };
    });
}

const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;

/** Cards are at least 15rem, with 10px between, in a column of the face's width less its gutters. */
const CARD = 240;
const GAP = 10;
const FACE = 1160;
const GUTTERS = 40;
const PHONE = 640;
/** How deep a list's records say their own lists before they are names, as the faces draw them. */
const MAX_LIST_DEPTH = 3;

const columnsAt = (width: number) => Math.max(1, Math.floor((Math.min(width, FACE) - GUTTERS + GAP) / (CARD + GAP)));

/**
 * Say what a place shows one seat. `place` is a `placesOf` entry or its
 * slug ("home", "the-offers", "offers"), or a record's id. A place nobody
 * declared is refused with the places there are.
 */
export function describePlace<S extends AnySchema>(store: Store<S>, principal: Principal, place: string | AppPlace, options: DescribePlaceOptions<S>): DescribePlaceResult {
  const { app } = options;
  const width = options.width ?? 1440;
  const today = options.today ?? store.today() ?? isoToday(app.brand?.timeZone);
  const seen = store.seenBy(principal);
  const schema = seen.schema as AnySchema;
  const graph = seen.graph as unknown as GraphReader;
  // A titled view of many the host keeps is a place of the app's, by the slug the router gives it.
  const places = placesOf(app as never, options.views ? { views: options.views } : {});
  const asked = typeof place === "string" ? place.trim() : place.slug;
  const found = typeof place === "string" ? places.find((one) => one.slug === asked || one.title === asked || one.address === asked) : places.find((one) => one.slug === place.slug && one.kind === place.kind) ?? place;
  const record = !found && typeof place === "string" ? graph.getNode(asked) : undefined;
  // A visitor's form (`forms.<name>`), by its address: `/forms/<name>`, or `forms/<name>`.
  const formName = !found && !record ? /^\/?forms\/(.+)$/.exec(asked)?.[1] : undefined;
  const visitor = formName !== undefined ? visitorForm(app, formName) : undefined;
  if (visitor) return { ok: true, description: visitorFormPlace(schema, visitor, width) };
  if (!found && !record) return { ok: false, error: `"${asked}" is not a place this app has, nor a record this seat can see.`, places: [...places.map((one) => one.slug), ...Object.keys(app.forms ?? {}).map((name) => `forms/${name}`)] };

  const problems: DescribedProblem[] = [];
  const views = (app.viewSpecs ?? {}) as Readonly<Record<string, { card?: readonly unknown[]; row?: readonly unknown[]; page?: readonly unknown[] }>>;
  const columns = columnsAt(width);
  // Resolved as every face resolves them (`resolveFor`): over the seat's graph, money in the app's brand currency (FR-100), a page's budget where drawn once and a card's where many.
  const resolved = (node: AnyGraphNode | null, options: ResolveForOptions) => resolveFor(seen, null, node, { app, today, ...options });

  /** A record as a list draws it: its kind's card or row, or the default's. */
  const item = (node: AnyGraphNode, as: "card" | "row" | "name", depth: number): DescribedItem => {
    const definition = schema.tryDefinition(node.kind);
    const title = labelOf(definition, node);
    if (as === "name") return { id: node.id, kind: node.kind, title, parts: [] };
    const spec = views[node.kind]?.[as];
    if (spec) {
      const said = resolved(node, { slot: as });
      const [first, ...rest] = said;
      /*
       * A card's first title is its panel's title; a row's — or its first
       * headline — leads its line. A row whose blocks name the record
       * nowhere is drawn with the record's name first (`blocksName`), and
       * said with it: the title is what leads the line either way.
       */
      const titled = first?.t === "title" || (as === "row" && first?.t === "headline");
      return { id: node.id, kind: node.kind, title: titled ? first.text : title, parts: say(titled ? rest : said, depth, `views.${node.kind}.${as}`, ` (${node.id})`, titled ? 1 : 0) };
    }
    if (as === "row") return { id: node.id, kind: node.kind, title, parts: [] };
    // The default card: its title, and what a glance at it says (FR-39, FR-83).
    const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(schema, graph, node) : node;
    const fields = readableFields(read as Record<string, unknown>, definition, { limit: 3, said: [title], glance: true, locale: app.brand?.locale, timeZone: app.brand?.timeZone });
    return { id: node.id, kind: node.kind, title, parts: fields.map((field) => ({ t: "text", text: field.alone })) };
  };

  /** Resolved blocks as parts, their problems noted at their paths. */
  function say(blocks: readonly ResolvedBlock[], depth: number, at: string, about = "", offset = 0): DescribedPart[] {
    const out: DescribedPart[] = [];
    blocks.forEach((block, i) => {
      const path = `${at}.${i + offset}`;
      if ("problem" in block && block.problem) problems.push({ at: `${path}${about}`, says: block.problem });
      switch (block.t) {
        case "title":
          out.push({ t: "heading", level: 3, text: block.text });
          return;
        case "text":
          // A Markdown field drawn as prose is said as its words (FR-180).
          // A line of facts with a choice in it is said as it is drawn (`runs`): each choice as it reads, a chip a space from what is beside it, two runs of words a dot apart.
          out.push({ t: "text", text: block.markdown ? markdownWords(block.text) : block.runs ? runsSaid(block.runs) : block.text, ...(block.tone ? { tone: block.tone } : {}) });
          return;
        case "badge":
          out.push({ t: "badge", text: block.text });
          return;
        case "field":
        case "image":
          out.push({ t: "field", label: block.label, text: block.text });
          return;
        case "progress":
          out.push({ t: "progress", label: block.label, text: block.text });
          return;
        case "group":
          out.push(...say(block.blocks, depth, `${path}.group`, about));
          return;
        case "when":
          out.push(...say(block.blocks, depth, `${path}.show`, about));
          return;
        case "divider":
        case "figure":
          return;
        case "headline":
          out.push({ t: "heading", level: block.level, text: block.text });
          return;
        case "number":
          out.push({ t: "figure", text: block.text, ...(block.label ? { label: block.label } : {}) });
          return;
        case "list": {
          if (block.failed) {
            out.push({ t: "text", text: "—" });
            return;
          }
          if (block.members.length === 0) {
            if (block.empty) out.push({ t: "list", as: block.as, columns: 1, groups: [], empty: block.empty });
            return;
          }
          const next = depth + 1;
          const as = next > MAX_LIST_DEPTH ? "name" : block.as;
          // A group's heading is drawn with how many it holds — every one listed, not only the page drawn — and said so.
          const groups = (block.groups ?? [{ value: null, members: block.members }]).map((group) => ({
            ...("heading" in group && group.heading ? { heading: group.heading, count: (block.everyGroup?.find((every) => every.value === group.value) ?? group).members.length } : {}),
            items: group.members.map((node) => item(node, as, next)),
          }));
          out.push({ t: "list", as, columns: as === "card" ? columns : 1, groups, ...(block.more > 0 ? { more: block.more } : {}) });
          return;
        }
      }
    });
    return out;
  }

  let parts: DescribedPart[] = [];
  let masthead: DescribedMasthead | undefined;
  let drawnBy: PlaceDescription["drawnBy"];
  let described: PlaceDescription["place"];
  let forms: readonly DescribedForm[] = [];
  if (record) {
    // A record's page: its page spec's blocks, then its facts, as the routed face lays it.
    drawnBy = "record";
    const definition = schema.tryDefinition(record.kind);
    const title = labelOf(definition, record);
    described = { slug: record.id, title, kind: record.kind, address: recordPath(schema, record.kind, record.id) };
    const page = views[record.kind]?.page;
    /* A view the host keeps of one of its records: at the head, the slot under it; or, replacing the page, alone (Roadmap feature:page-slot-blocks-…). */
    const view = options.views?.find((one) => one.attach === record.kind && one.cardinality === "one");
    if (view) parts.push({ t: "view", name: view.name, ...(view.title ? { title: view.title } : {}), ...(view.replaces === "page" ? { replaces: true as const } : {}), ...(view.parts ? { parts: view.parts } : {}) });
    if (view?.replaces === "page") {
      drawnBy = `view:${view.name}`;
      problems.push(...shadowedPageSlots(app as never, [view]));
    } else {
      if (page) parts.push(...say(resolved(record, { slot: "page" }), 1, `views.${record.kind}.page`));
      const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(schema, graph, record) : record;
      // In the order and the groups its page declares (FR-148), each value as stored: a draft's paragraphs kept (FR-146).
      for (const section of pageSections(definition, readableFields(read as Record<string, unknown>, definition, { said: [title], locale: app.brand?.locale, timeZone: app.brand?.timeZone }))) {
        if (section.title) parts.push({ t: "heading", level: 2, text: section.title });
        for (const field of section.fields) parts.push({ t: "field", label: field.label, text: field.value, ...(field.long ? { long: true as const } : {}), ...(field.markdown ? { markdown: true as const } : {}) });
      }
    }
  } else {
    const at = found!;
    described = { slug: at.slug, title: at.title, kind: at.kind, address: at.address };
    const lens = at.lens ? declaredLenses(app as never).drawn.find((one) => one.as === at.slug && (at.kind === null || one.kinds.includes(at.kind))) : undefined;
    // Where a kind's records are listed, the acts that make one are offered — unless the lens's page leaves them off (`create: false`): each form said field by field, as this seat is asked it.
    if (at.kind !== null && lens?.create !== false && at.view === undefined) forms = creatingActs(store, principal, at.kind).map((act) => describeActForm(store, principal, act));
    if (at.view !== undefined && !lens) {
      /*
       * A VIEW'S OWN PLACE (`/places/<slug>`, a titled view of many the host
       * keeps): drawn by the view alone, as a lens's place is by the lens —
       * whether it flows with the page or keeps a frame, as the host said,
       * and what it drew when the host ran it headless.
       */
      const view = options.views?.find((one) => one.name === at.view);
      drawnBy = `view:${at.view}`;
      parts.push({ t: "view", name: at.view, title: view?.title ?? at.title, ...(typeof view?.flows === "boolean" ? { flows: view.flows } : {}), ...(view?.parts ? { parts: view.parts } : {}) });
    } else if (at.kind === null) {
      const brand = app.brand;
      const name = brand?.name ?? app.name;
      const light = logoOf(brand)?.light;
      const logo = light && markHref(light) ? light : undefined;
      masthead = {
        name,
        ...(brand?.subtitle && brand.subtitleDrawn !== false ? { subtitle: brand.subtitle } : {}),
        ...(logo ? { logo: { alt: brand?.logoAlt ?? name, ...(isInlineSvg(logo) ? { drawn: "inline SVG" as const } : { drawn: "image" as const, src: logo }) } } : {}),
      };
      if (app.home) {
        drawnBy = "blocks";
        // On the routed face the home is the page: its first headline is the page's own h1.
        parts = say(resolved(null, {}), 0, "views.home");
      } else {
        drawnBy = "derived";
        // Not a kind kept from this seat (an administered module's it does not administer, one it sees none of) or a disabled module's: the routed home lists neither (FR-174).
        const kept = store.kindsKeptFrom(principal);
        const hidden = new Set([...(app.pages?.hide ?? []), ...kept, ...store.modules.disabledKinds]);
        const shown = orderKinds(schema.kinds as readonly string[], app.pages?.order).filter((kind) => !hidden.has(kind));
        parts.push({ t: "heading", level: 1, text: app.name ?? "Home" });
        for (const kind of shown) {
          const count = graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node)).length;
          if (count > 0) parts.push({ t: "text", text: `${count} ${kindWord(schema, kind, count)}` });
        }
      }
    } else if (lens?.lens === "blocks") {
      drawnBy = "lens:blocks";
      parts = say(resolved(null, { blocks: (lens.options["blocks"] as readonly unknown[]) ?? [] }), 0, `lenses.${lens.index}.options.blocks`);
    } else if (lens?.lens === "columns") {
      /*
       * A STATUS BOARD (FR-97) is groups in words: each column a heading with
       * how many it holds, in the field's declared order, and under it each
       * record by its card — the seat's own records, so a count is what that
       * seat's board shows.
       */
      drawnBy = "lens:columns";
      const bindings = (lens.options["bindings"] ?? {}) as Readonly<Record<string, { readonly column?: string }>>;
      for (const kind of Object.keys(bindings)) {
        const field = bindings[kind]?.column;
        if (!field) continue;
        const columns = statusColumns(schema, kind, field);
        // In the order the lens draws its cards (`options.sort`), as they were written where it says none.
        const members = sortForGrid(graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node)), lens.options["sort"], (node, key) => (key === "label" ? labelOf(schema.tryDefinition(node.kind), node) : (node as Record<string, unknown>)[key]));
        if (Object.keys(bindings).length > 1) parts.push({ t: "heading", level: 2, text: kindWord(schema, kind, 2).replace(/^./, (c) => c.toUpperCase()) });
        parts.push({ t: "text", text: `${members.length} ${kindWord(schema, kind, members.length)} in columns by ${fieldWords(schema.tryDefinition(kind), field).toLowerCase()}.` });
        const groups = columns
          .map((column) => ({ column, items: members.filter((node) => columnOf(node as Record<string, unknown>, field, columns) === column.value).map((node) => item(node, "card", 1)) }))
          // The column of records with no value is there only while something is in it.
          .filter(({ column, items }) => column.value !== null || items.length > 0)
          .map(({ column, items }) => ({ heading: `${column.label} (${items.length})`, items }));
        parts.push({ t: "list", as: "card", columns: 1, groups });
        // The moves this seat's board offers (FR-108), column by column, each by the act it runs — read from its own cards, so a step's condition counts.
        const by = new Map<string, Set<string>>();
        for (const node of members) for (const move of columnMoves(store, principal, node as never, field, columns)) by.set(move.to, (by.get(move.to) ?? new Set()).add(`"${move.title}"`));
        const ways = columns.filter((column) => column.value !== null && by.has(column.value)).map((column) => `to ${column.label} by ${[...by.get(column.value!)!].join(" or ")}`);
        parts.push({ t: "text", text: ways.length > 0 ? `Moves: ${ways.join("; ")}.` : "Moves: none for this seat." });
      }
    } else if (lens?.lens === "coverage") {
      // A coverage grid (FR-112): each row's columns and through what, each column's count, and who has none.
      drawnBy = "lens:coverage";
      parts = coverageParts(schema, graph, lens.options as unknown as Parameters<typeof coverageParts>[2]);
    } else if (lens) {
      // A picture's geometry is not words: say what it is over, and the records it draws.
      drawnBy = `lens:${lens.lens}`;
      const members = lens.kinds.flatMap((kind) => graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node)));
      parts.push({ t: "text", text: `A ${lens.lens} of ${members.length} ${lens.kinds.map((kind) => kindWord(schema, kind, members.length)).join(" and ")}.` });
      parts.push({ t: "list", as: "name", columns: 1, groups: [{ items: members.map((node) => item(node, "name", 1)) }] });
    } else {
      // A kind's list page: each current record by its row.
      drawnBy = "derived";
      const members = graph.nodesOfKind(at.kind).filter((node) => isCurrent(schema.tryDefinition(at.kind!), node));
      parts.push({ t: "heading", level: 1, text: at.title });
      if (members.length === 0) parts.push({ t: "list", as: "row", columns: 1, groups: [], empty: `No ${kindWord(schema, at.kind, 0)} yet.` });
      else parts.push({ t: "list", as: "row", columns: 1, groups: [{ items: members.map((node) => item(node, "row", 1)) }] });
    }
  }
  const seat = principal.kind === "system" ? "the system" : (principal.roles ?? []).length > 0 ? (principal.roles ?? []).join(", ") : principal.kind;
  const variant = width < PHONE ? "phone" : "wide";
  // The home is about no one record, and so are the app's facts: said beside it, worked out over this seat's graph.
  const facts = described.kind === null ? factsOf(schema, graph) : [];
  const description: Omit<PlaceDescription, "text"> = { ...(masthead ? { masthead } : {}), ...(facts.length > 0 ? { facts } : {}), place: described, seat, width, variant, drawnBy: drawnBy!, parts, ...(forms.length > 0 ? { forms } : {}), problems };
  return { ok: true, description: { ...description, text: placeText(description) } };
}

/** A visitor's form's own place (`/forms/<name>`): its title, its words, and what it asks — as the visitor the host mints is asked it, whoever asks. */
function visitorFormPlace(schema: AnySchema, form: VisitorForm, width: number): PlaceDescription {
  const parts: DescribedPart[] = [{ t: "heading", level: 1, text: form.title }, ...(form.intro ? [{ t: "text" as const, text: form.intro }] : [])];
  const description: Omit<PlaceDescription, "text"> = {
    place: { slug: `forms/${form.name}`, title: form.title, kind: null, address: `/forms/${form.name}` },
    seat: `a visitor (${form.role})`,
    width,
    variant: width < PHONE ? "phone" : "wide",
    drawnBy: "form",
    parts,
    forms: [describeVisitorForm(schema, form)],
    problems: [],
  };
  return { ...description, text: placeText(description) };
}

/**
 * The whole graph's facts, each as words, worked out over `graph` — read
 * as `factValues` reads them, from the record-less computed values, so the
 * module that exports it is reached only by what asks for it.
 */
function factsOf(schema: AnySchema, graph: GraphReader): DescribedFact[] {
  const worked = computedValues(schema, graph, null);
  const said = (value: PlainComputed): string =>
    Array.isArray(value) ? value.map(said).join(", ") : value === null ? "nothing" : typeof value === "boolean" ? (value ? "yes" : "no") : typeof value === "object" ? (value as ComputedRecord).label : String(value);
  return [...computedOf(schema)].map(([name, entry]) => {
    const label = entry.label ?? humanizeField(name);
    return Object.hasOwn(worked.values, name) ? { name, label, value: said(worked.values[name]!) } : { name, label, refused: worked.refused[name] ?? "it could not be worked out" };
  });
}

function kindWord(schema: AnySchema, kind: string, count: number): string {
  const definition = schema.tryDefinition(kind) as { noun?: string; plural?: string } | undefined;
  if (count === 1) return definition?.noun ?? kind;
  const plural = pluralOf(schema, kind);
  return lowerFirst(plural);
}

/** A description as plain text: a heading as `#`s, a list's records as bullets under their group's heading, indented by depth. */
export function placeText(description: Omit<PlaceDescription, "text">): string {
  const lines: string[] = [`${description.place.title} (${description.place.address}) — as ${description.seat}, ${description.width} wide (${description.variant}).`];
  const top = description.masthead;
  if (top) lines.push(`Masthead: ${top.logo ? `the logo ("${top.logo.alt}", ${top.logo.drawn === "image" ? top.logo.src : "inline SVG"}), ` : ""}${top.name}${top.subtitle ? ` — ${top.subtitle}` : ""}`);
  const walk = (parts: readonly DescribedPart[], indent: string) => {
    for (const part of parts) {
      switch (part.t) {
        case "heading":
          lines.push(`${indent}${"#".repeat(part.level)} ${part.text}`);
          break;
        case "text":
          lines.push(`${indent}${part.text}`);
          break;
        case "badge":
          lines.push(`${indent}[${part.text}]`);
          break;
        case "field":
        case "progress":
          lines.push(`${indent}${part.label}: ${part.text}`);
          break;
        case "figure":
          lines.push(`${indent}${part.text}${part.label ? ` — ${part.label}` : ""}`);
          break;
        case "list":
          if (part.groups.length === 0) {
            if (part.empty) lines.push(`${indent}(${part.empty})`);
            break;
          }
          for (const group of part.groups) {
            if (group.heading) lines.push(`${indent}${group.heading}${group.count !== undefined ? ` (${group.count})` : ""}:`);
            for (const one of group.items) {
              lines.push(`${indent}${group.heading ? "  " : ""}- ${one.title}`);
              walk(one.parts, `${indent}${group.heading ? "    " : "  "}`);
            }
          }
          if (part.as === "card" && part.columns > 1) lines.push(`${indent}(cards, ${part.columns} across)`);
          if (part.more) lines.push(`${indent}and ${part.more} more`);
          break;
        case "view":
          lines.push(`${indent}[the view "${part.title ?? part.name}"${part.replaces ? ", in place of the page" : ""}${part.flows === true ? ", flowing with the page" : part.flows === false ? ", in a frame of its own" : ""}]`);
          if (part.parts) walk(part.parts, `${indent}  `);
          break;
      }
    }
  };
  walk(description.parts, "");
  // Each form it offers, field by field in the order asked; a star is one that must be answered.
  for (const form of description.forms ?? []) lines.push(...formLines(form));
  if (description.facts) {
    lines.push("Facts of the whole graph (what fact('<name>') reads):");
    for (const fact of description.facts) lines.push(`- ${fact.label} (${fact.name}): ${fact.value ?? `not worked out — ${fact.refused}`}`);
  }
  if (description.problems.length > 0) {
    lines.push("Problems:");
    for (const problem of description.problems) lines.push(`- ${problem.at}: ${problem.says}`);
  }
  return lines.join("\n");
}

/** A line of facts as its face draws it: a chip a space from what is beside it, two runs of words a dot apart. */
function runsSaid(runs: readonly { readonly text: string; readonly field?: string }[]): string {
  return runs.map((run, at) => (at === 0 ? "" : run.field === undefined && runs[at - 1]!.field === undefined ? " · " : " ") + run.text).join("");
}

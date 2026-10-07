import type { AnyGraphNode, GraphReader, GraviewApp, Principal, Store } from "../index.js";
import { declaredLenses, orderKinds, placesOf, type AppPlace } from "../places.js";
import type { AnySchema } from "../schema/schema.js";
import { fieldWords, isCurrent, labelOf, readableFields } from "../schema/define-node.js";
import { columnMoves, columnOf, statusColumns } from "../columns.js";
import { coverageParts } from "./describe-coverage.js";
import { compileBlocks, fieldSpecsOf, resolveBlocks, type BlockContext, type ResolvedBlock } from "./blocks.js";
import { withComputed } from "./computed-values.js";
import { shapesOfSchema } from "./rules.js";
import type { KindShape } from "./expr/evaluate.js";
import { isInlineSvg, markHref } from "../theme/marks.js";

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
}

/** One record in a list, as its card or row says it. */
export interface DescribedItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  /** What its card or row says beyond its title, in order. */
  readonly parts: readonly DescribedPart[];
}

export type DescribedPart =
  | { readonly t: "heading"; readonly level: number; readonly text: string }
  | { readonly t: "text"; readonly text: string; readonly tone?: string }
  | { readonly t: "badge"; readonly text: string }
  | { readonly t: "field"; readonly label: string; readonly text: string }
  | { readonly t: "figure"; readonly text: string; readonly label?: string }
  | { readonly t: "progress"; readonly label: string; readonly text: string }
  | {
      readonly t: "list";
      readonly as: "card" | "row" | "name";
      /** The columns a card list makes at this width; a row list is one. */
      readonly columns: number;
      readonly groups: readonly { readonly heading?: string; readonly items: readonly DescribedItem[] }[];
      /** What it says when it lists nothing. */
      readonly empty?: string;
      readonly more?: number;
    };

export interface DescribedProblem {
  /** Where: the block's path in the declaration (`views.home.3`, `lenses.1.options.blocks.0`, `views.offer.card.5`), with the record it was about. */
  readonly at: string;
  readonly says: string;
}

/**
 * THE APP'S MASTHEAD, as the home draws it on both faces (FR-124, FR-125):
 * its name, the line under it, and its logo — said by its alt text, and
 * whether it is drawn from SVG written inline or from a path.
 */
export interface DescribedMasthead {
  readonly name: string;
  readonly subtitle?: string;
  readonly logo?: { readonly alt: string; readonly drawn: "inline SVG" | "image"; readonly src?: string };
}

export interface PlaceDescription {
  /** On the home: what its masthead says (FR-125). */
  readonly masthead?: DescribedMasthead;
  readonly place: { readonly slug: string; readonly title: string; readonly kind: string | null; readonly address: string };
  /** Who it was described for: the seat's roles, or "the system". */
  readonly seat: string;
  readonly width: number;
  readonly variant: "phone" | "wide";
  /** What draws it: the app's blocks, the framework's derived page, a shipped lens, a record's page, or a worker view run headless (FR-95). */
  readonly drawnBy: "blocks" | "derived" | "record" | `lens:${string}` | `view:${string}`;
  readonly parts: readonly DescribedPart[];
  readonly problems: readonly DescribedProblem[];
  /** The same, as plain text a chat can quote. */
  readonly text: string;
}

export type DescribePlaceResult = { readonly ok: true; readonly description: PlaceDescription } | { readonly ok: false; readonly error: string; readonly places: readonly string[] };

/** Cards are at least 15rem, with 10px between, in a column of the face's width less its gutters. */
const CARD = 240;
const GAP = 10;
const FACE = 1160;
const GUTTERS = 40;
const PHONE = 640;
/** How deep a list's records say their own lists before they are names, as the faces draw them. */
const MAX_LIST_DEPTH = 3;
/** The steps a list or a figure about no one record may take: it sweeps whole kinds. */
const SWEEP_BUDGET = 5_000;

const columnsAt = (width: number) => Math.max(1, Math.floor((Math.min(width, FACE) - GUTTERS + GAP) / (CARD + GAP)));

/**
 * Say what a place shows one seat. `place` is a `placesOf` entry or its
 * slug ("home", "the-offers", "offers"), or a record's id. A place nobody
 * declared is refused with the places there are.
 */
export function describePlace<S extends AnySchema>(store: Store<S>, principal: Principal, place: string | AppPlace, options: DescribePlaceOptions<S>): DescribePlaceResult {
  const { app } = options;
  const width = options.width ?? 1440;
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const seen = store.seenBy(principal);
  const schema = seen.schema as AnySchema;
  const graph = seen.graph as unknown as GraphReader;
  const kinds = shapesOfSchema(schema);
  const places = placesOf(app as never);
  const asked = typeof place === "string" ? place.trim() : place.slug;
  const found = typeof place === "string" ? places.find((one) => one.slug === asked || one.title === asked || one.address === asked) : places.find((one) => one.slug === place.slug && one.kind === place.kind) ?? place;
  const record = !found && typeof place === "string" ? graph.getNode(asked) : undefined;
  if (!found && !record) return { ok: false, error: `"${asked}" is not a place this app has, nor a record this seat can see.`, places: places.map((one) => one.slug) };

  const problems: DescribedProblem[] = [];
  const views = (app.viewSpecs ?? {}) as Readonly<Record<string, { card?: readonly unknown[]; row?: readonly unknown[]; page?: readonly unknown[] }>>;
  const columns = columnsAt(width);
  const base = (node: AnyGraphNode | null, heading: number, firstHeading?: number): BlockContext => ({
    node,
    graph,
    schema,
    kinds: kinds as ReadonlyMap<string, KindShape>,
    fields: node ? fieldSpecsOf(schema, node.kind) : {},
    ...(node && schema.tryDefinition(node.kind) ? { definition: schema.tryDefinition(node.kind) as BlockContext["definition"] } : {}),
    today,
    // Money is said as the faces say it: in the app's brand currency (FR-100).
    ...(app.brand ? { money: app.brand } : {}),
    heading,
    ...(firstHeading !== undefined ? { firstHeading } : {}),
    ...(node ? {} : { budget: SWEEP_BUDGET }),
  });

  /** A record as a list draws it: its kind's card or row, or the default's. */
  const item = (node: AnyGraphNode, as: "card" | "row" | "name", depth: number): DescribedItem => {
    const definition = schema.tryDefinition(node.kind);
    const title = labelOf(definition, node);
    if (as === "name") return { id: node.id, kind: node.kind, title, parts: [] };
    const spec = views[node.kind]?.[as];
    if (spec) {
      const resolved = resolveBlocks(compileBlocks(spec), base(node, 3));
      const [first, ...rest] = resolved;
      // A card's first title is its panel's title; a row's leads its line.
      const titled = first?.t === "title";
      return { id: node.id, kind: node.kind, title: titled ? first.text : title, parts: say(titled ? rest : resolved, depth, `views.${node.kind}.${as}`, ` (${node.id})`, titled ? 1 : 0) };
    }
    if (as === "row") return { id: node.id, kind: node.kind, title, parts: [] };
    // The default card: its title, and what a glance at it says (FR-39, FR-83).
    const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(schema, graph, node) : node;
    const fields = readableFields(read as Record<string, unknown>, definition, { limit: 3, said: [title], glance: true });
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
          out.push({ t: "text", text: block.text, ...(block.tone ? { tone: block.tone } : {}) });
          return;
        case "badge":
          out.push({ t: "badge", text: block.text });
          return;
        case "field":
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
          const groups = (block.groups ?? [{ value: null, members: block.members }]).map((group) => ({
            ...("heading" in group && group.heading ? { heading: group.heading } : {}),
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
  if (record) {
    // A record's page: its page spec's blocks, then its facts, as the routed face lays it.
    drawnBy = "record";
    const definition = schema.tryDefinition(record.kind);
    const title = labelOf(definition, record);
    described = { slug: record.id, title, kind: record.kind, address: `/${record.kind}/${record.id}` };
    const page = views[record.kind]?.page;
    if (page) parts.push(...say(resolveBlocks(compileBlocks(page), base(record, 2)), 1, `views.${record.kind}.page`));
    const read = (definition as { computed?: object } | undefined)?.computed ? withComputed(schema, graph, record) : record;
    for (const field of readableFields(read as Record<string, unknown>, definition, { said: [title] })) parts.push({ t: "field", label: field.label, text: field.value });
  } else {
    const at = found!;
    described = { slug: at.slug, title: at.title, kind: at.kind, address: at.address };
    const lens = at.lens ? declaredLenses(app as never).drawn.find((one) => one.as === at.slug && (at.kind === null || one.kinds.includes(at.kind))) : undefined;
    if (at.kind === null) {
      const brand = app.brand;
      const name = brand?.name ?? app.name;
      const logo = brand?.logo && markHref(brand.logo) ? brand.logo : undefined;
      masthead = {
        name,
        ...(brand?.subtitle ? { subtitle: brand.subtitle } : {}),
        ...(logo ? { logo: { alt: brand?.logoAlt ?? name, ...(isInlineSvg(logo) ? { drawn: "inline SVG" as const } : { drawn: "image" as const, src: logo }) } } : {}),
      };
      if (app.home) {
        drawnBy = "blocks";
        // On the routed face the home is the page: its first headline is the page's own h1.
        parts = say(resolveBlocks(compileBlocks(app.home as readonly unknown[]), base(null, 2, 1)), 0, "views.home");
      } else {
        drawnBy = "derived";
        const hidden = new Set(app.pages?.hide ?? []);
        const shown = orderKinds(schema.kinds as readonly string[], app.pages?.order).filter((kind) => !hidden.has(kind));
        parts.push({ t: "heading", level: 1, text: app.name ?? "Home" });
        for (const kind of shown) {
          const count = graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node)).length;
          if (count > 0) parts.push({ t: "text", text: `${count} ${pluralOf(schema, kind, count)}` });
        }
      }
    } else if (lens?.lens === "blocks") {
      drawnBy = "lens:blocks";
      parts = say(resolveBlocks(compileBlocks((lens.options["blocks"] as readonly unknown[]) ?? []), base(null, 2)), 0, `lenses.${lens.index}.options.blocks`);
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
        const members = graph.nodesOfKind(kind).filter((node) => isCurrent(schema.tryDefinition(kind), node));
        if (Object.keys(bindings).length > 1) parts.push({ t: "heading", level: 2, text: pluralOf(schema, kind, 2).replace(/^./, (c) => c.toUpperCase()) });
        parts.push({ t: "text", text: `${members.length} ${pluralOf(schema, kind, members.length)} in columns by ${fieldWords(schema.tryDefinition(kind), field).toLowerCase()}.` });
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
      parts.push({ t: "text", text: `A ${lens.lens} of ${members.length} ${lens.kinds.map((kind) => pluralOf(schema, kind, members.length)).join(" and ")}.` });
      parts.push({ t: "list", as: "name", columns: 1, groups: [{ items: members.map((node) => item(node, "name", 1)) }] });
    } else {
      // A kind's list page: each current record by its row.
      drawnBy = "derived";
      const members = graph.nodesOfKind(at.kind).filter((node) => isCurrent(schema.tryDefinition(at.kind!), node));
      parts.push({ t: "heading", level: 1, text: at.title });
      if (members.length === 0) parts.push({ t: "list", as: "row", columns: 1, groups: [], empty: `No ${pluralOf(schema, at.kind, 0)} yet.` });
      else parts.push({ t: "list", as: "row", columns: 1, groups: [{ items: members.map((node) => item(node, "row", 1)) }] });
    }
  }
  const seat = principal.kind === "system" ? "the system" : (principal.roles ?? []).length > 0 ? (principal.roles ?? []).join(", ") : principal.kind;
  const variant = width < PHONE ? "phone" : "wide";
  const description: Omit<PlaceDescription, "text"> = { ...(masthead ? { masthead } : {}), place: described, seat, width, variant, drawnBy: drawnBy!, parts, problems };
  return { ok: true, description: { ...description, text: placeText(description) } };
}

function pluralOf(schema: AnySchema, kind: string, count: number): string {
  const definition = schema.tryDefinition(kind) as { noun?: string; plural?: string } | undefined;
  if (count === 1) return definition?.noun ?? kind;
  const plural = definition?.plural ?? `${kind}s`;
  return plural.charAt(0).toLowerCase() + plural.slice(1);
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
            if (group.heading) lines.push(`${indent}${group.heading}:`);
            for (const one of group.items) {
              lines.push(`${indent}${group.heading ? "  " : ""}- ${one.title}`);
              walk(one.parts, `${indent}${group.heading ? "    " : "  "}`);
            }
          }
          if (part.as === "card" && part.columns > 1) lines.push(`${indent}(cards, ${part.columns} across)`);
          if (part.more) lines.push(`${indent}and ${part.more} more`);
          break;
      }
    }
  };
  walk(description.parts, "");
  if (description.problems.length > 0) {
    lines.push("Problems:");
    for (const problem of description.problems) lines.push(`- ${problem.at}: ${problem.says}`);
  }
  return lines.join("\n");
}

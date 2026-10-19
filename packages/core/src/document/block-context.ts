import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import type { Principal } from "../permissions/types.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import { fieldSpecsOf, type BlockContext } from "./blocks.js";
import { shapesFor } from "./computed-values.js";
import type { FieldSpec } from "./schema.js";
import type { Money } from "./template.js";
import type { ViewSlot } from "./views.js";
import { isoToday } from "../days.js";

/*
 * A RECORD'S DECLARED BLOCKS, RESOLVED ONCE, FOR EVERYONE WHO SAYS THEM.
 *
 * The scene, the pages face, `describe_place` and a product's own face all
 * draw a record's page — or the home — from the blocks the declaration
 * writes. Each built the context those blocks are read in by hand: the seat's
 * graph, the schema, every kind's shape, the kind's fields, its display, the
 * day, the app's money, the heading level and the steps an expression may
 * take; a product did it with ten casts, and a record page was read under a
 * card's allowance, so a change with 98 tasks said "—" for every list on it.
 * `blockContextFor` is that context, built in one place: the faces read
 * their parsed blocks in it, and `resolveFor` (`@graview/core/describe`) —
 * what the describer and a product's own face call — finds a record's
 * declared blocks and reads them in it too, so a face cannot say a figure
 * the rest disagrees with.
 */

/** The steps each expression may take where blocks are drawn many times a frame: a card, a row. */
export const CARD_BUDGET = 500;
/**
 * The steps each expression may take where blocks are drawn once — a
 * record's page, the home, a blocks lens: they sweep whole kinds and walk
 * every record under one.
 */
export const PAGE_BUDGET = 20_000;

/** How blocks are read: for which of a record's views, under what budget, at what heading, on what day, in what money. */
export interface BlockContextOptions {
  /** Which of a record's views: its "page" (the default), its "card" or its "row". About no record, the home. */
  readonly slot?: ViewSlot;
  /**
   * The steps each expression may take. `PAGE_BUDGET` where the blocks are
   * drawn once — a page, the home, blocks about no record — and
   * `CARD_BUDGET` for a card or a row, which a list draws many times.
   */
  readonly budget?: number;
  /** The level a headline is said at: 2 on a page and the home, 3 in a card or a row. */
  readonly heading?: number;
  /** The level of the first headline where it is the page's own heading: 1 on the home. */
  readonly firstHeading?: number | undefined;
  /** The day it is, for dates said relatively: the store's own day, else today. */
  readonly today?: string;
  /** The currency and locale money is said in: the app's brand's. */
  readonly money?: Money | undefined;
}

/** What blocks are read from: a `Store`, or a graph with the schema it was made with. */
export interface BlockSource {
  readonly graph: GraphReader | object;
  readonly schema: AnySchema;
  today?(): string | undefined;
}

const FIELDS = new WeakMap<object, Map<string, Readonly<Record<string, FieldSpec>>>>();

/** A kind's fields in the document's words, read once per schema. */
function fieldsFor(schema: AnySchema, kind: string): Readonly<Record<string, FieldSpec>> {
  let byKind = FIELDS.get(schema);
  if (!byKind) FIELDS.set(schema, (byKind = new Map()));
  let fields = byKind.get(kind);
  if (!fields) byKind.set(kind, (fields = fieldSpecsOf(schema, kind)));
  return fields;
}

/**
 * The context a record's blocks — or the home's — are read in, as every
 * surface reads them. `principal` narrows a store to what that seat may see
 * (`store.seenBy`); null reads it as it is handed, which inside a
 * `GraviewProvider` is already the seat's.
 */
export function blockContextFor(source: BlockSource, principal: Principal | null, given: { readonly id: string; readonly kind: string } | null, options: BlockContextOptions = {}): BlockContext {
  if (principal && typeof (source as Partial<Store<AnySchema>>).seenBy !== "function") {
    throw new TypeError("blockContextFor: a seat is read from a store (its `seenBy`); a bare { graph, schema } is read as it is handed, with no principal");
  }
  const seen = principal ? (source as Store<AnySchema>).seenBy(principal) : source;
  // THE RECORD AS THE SEAT SEES IT, whichever copy was handed in: one it may not see is no record at all, and a field it may not read is cleared.
  const node = principal && given ? (((seen.graph as GraphReader).getNode(given.id) as { readonly id: string; readonly kind: string } | undefined) ?? null) : given;
  const schema = seen.schema;
  const definition = node && schema.tryDefinition(node.kind);
  const once = !node || (options.slot ?? "page") === "page";
  const { money, firstHeading } = options;
  return {
    node: node as AnyGraphNode | null,
    graph: seen.graph as GraphReader,
    schema,
    kinds: shapesFor(schema),
    fields: node ? fieldsFor(schema, node.kind) : {},
    definition: (definition || undefined) as BlockContext["definition"],
    today: options.today ?? seen.today?.() ?? isoToday(money?.timeZone),
    money,
    heading: options.heading ?? (once ? 2 : 3),
    firstHeading,
    budget: options.budget ?? (once ? PAGE_BUDGET : CARD_BUDGET),
    ...(once ? {} : { glance: true }),
  };
}

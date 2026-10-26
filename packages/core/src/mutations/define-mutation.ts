import { InvalidArguments } from "./invalid-arguments.js";
import type { z } from "zod";
import { ARCHIVED, isArchived } from "../graph/archived.js";
import type { Graph } from "../graph/graph.js";
import { GraphError, MissingRecordError } from "../graph/graph.js";
import { writesOf, type Primitive } from "../graph/primitives.js";
import { TrackedReader } from "../graph/tracked.js";
import { edgeId, type GraphEdge, type GraphReader } from "../graph/types.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import type {
  AnyMutationDefinition,
  MutationContext,
  MutationDefinition,
  MutationDefinitionSpec,
} from "./types.js";

export function defineMutation<
  S extends AnySchema,
  const Name extends string,
  I extends z.ZodType,
>(
  name: Name,
  spec: MutationDefinitionSpec<S, I>,
): MutationDefinition<S, Name, I> {
  return { ...spec, name };
}

export interface CompiledMutation {
  readonly primitives: readonly Primitive[];
  /** Node ids the mutation looked at while computing its writes. */
  readonly reads: readonly string[];
  /** Node ids its `describe` read to word its sentence, when it has one (FR-55). */
  readonly described?: readonly string[];
  readonly writes: readonly string[];
  readonly intent: string;
  /** The record a merge kept, when the act merged one into it (FR-173): the op says so. */
  readonly mergedInto?: string;
  /** The first id `freshId` gave — the one a requested `id` goes to — when the act minted any. */
  readonly firstMinted?: string;
}

/** Whether an act takes the framework's `id` argument: it creates, and has no `id` of its own. */
export function takesAnId(definition: { readonly creates?: readonly string[] | undefined; readonly input: unknown }): boolean {
  if (!definition.creates?.length) return false;
  const shape = (definition.input as { shape?: Record<string, unknown> }).shape;
  return shape === undefined || !("id" in shape);
}

/**
 * THE ARGUMENTS AN ACT TAKES, WHEN THE FRAMEWORK HOLDS IT TO THEM (FR-121):
 * the keys of a plain `z.object` input — which zod would strip silently —
 * and, on an act that creates, the `id` of the record it makes. Undefined
 * for an input its author said otherwise of: `z.strictObject` refuses by
 * itself, and `z.looseObject` or a `catchall` keeps what it is not told
 * about, on purpose; and for an input that is not an object's shape.
 */
export function argumentsTaken(definition: { readonly creates?: readonly string[] | undefined; readonly input: unknown }): readonly string[] | undefined {
  const input = definition.input as { readonly shape?: Record<string, unknown>; readonly _zod?: { readonly def?: { readonly type?: string; readonly catchall?: unknown } } };
  const def = input._zod?.def;
  if (def?.type !== "object" || def.catchall !== undefined || !input.shape) return undefined;
  const keys = Object.keys(input.shape);
  return takesAnId(definition) ? [...keys, "id"] : keys;
}

/**
 * "does not take "color"; it takes "id", "quote"" — the one sentence for an
 * argument an act does not take. A field another act writes is said with
 * that act (`writtenBy`): "whatToDo is set by set-verdict", so the caller
 * learns where it goes rather than only where it does not.
 */
const doesNotTake = (stray: readonly string[], takes: readonly string[], writtenBy: Readonly<Record<string, readonly string[]>> = {}): string => {
  const elsewhere = stray.filter((key) => writtenBy[key]?.length);
  const other = stray.filter((key) => !writtenBy[key]?.length);
  const said = [
    ...(other.length > 0 ? [`does not take ${other.map((key) => `"${key}"`).join(", ")}`] : []),
    ...elsewhere.map((key) => `${key} is set by ${writtenBy[key]!.join(" or ")}`),
  ];
  return `${said.join("; ")}; it takes ${takes.length > 0 ? takes.map((key) => `"${key}"`).join(", ") : "nothing"}`;
};

/** The schema under its optional, nullable and default wrappers. */
function bareSchema(schema: unknown): { readonly type?: string } | undefined {
  let def = (schema as { _zod?: { def?: { type?: string; innerType?: unknown } } } | undefined)?._zod?.def;
  for (let depth = 0; def?.innerType && depth < 8; depth++) def = (def.innerType as { _zod?: { def?: { type?: string; innerType?: unknown } } })._zod?.def;
  return def;
}

/** A string that is exactly a number, as JSON writes one: "8.6", "-3", "1e3"; never " 8", "8 kg" or "". */
const NUMBER_SPELLED = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * A NUMBER GIVEN AS ITS DIGITS IS THAT NUMBER. An agent writing JSON, a
 * form read as text, a CSV — each hands a number field "8.6", and the act
 * refused it as "expected number". At the one boundary every act's
 * arguments cross, a string that is exactly a number, given for an
 * argument whose schema is a number, is read as that number and nothing is
 * said; anything else is left for the schema to refuse as before.
 */
export function numbersSpelled(input: unknown, given: unknown): unknown {
  const shape = (input as { shape?: Record<string, unknown> } | undefined)?.shape;
  if (!shape || typeof given !== "object" || given === null || Array.isArray(given)) return given;
  let read: Record<string, unknown> | undefined;
  for (const [key, value] of Object.entries(given as Record<string, unknown>)) {
    if (typeof value !== "string" || !NUMBER_SPELLED.test(value) || bareSchema(shape[key])?.type !== "number") continue;
    const number = Number(value);
    if (!Number.isFinite(number)) continue;
    read ??= { ...(given as Record<string, unknown>) };
    read[key] = number;
  }
  return read ?? given;
}

/**
 * AN ID A CALLER MAY ASK FOR (Roadmap f-1-0-client-ids): 1–200 characters,
 * none of them a space or a control character. Readable slugs —
 * `task:buy-milk`, `room:green.0k3j2xa` — and a client's own UUIDs pass;
 * an id that would not survive a URL, a log line or a search does not.
 */
const validId = (id: unknown): id is string => typeof id === "string" && id.length <= 200 && /^[^\s\p{Cc}]+$/u.test(id);

function requestedId(rawArgs: unknown): string | undefined {
  if (typeof rawArgs !== "object" || rawArgs === null) return undefined;
  const id = (rawArgs as Record<string, unknown>)["id"];
  if (id === undefined) return undefined;
  if (!validId(id)) throw new GraphError("An id is 1–200 characters with no space", `Got ${JSON.stringify(id)}.`);
  return id;
}

function withoutId(args: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = args;
  return rest;
}

/**
 * An id from a name: the name's own letters, folded and hyphenated.
 *
 * It kept ASCII and dropped everything else, so "Zoë Lamarré" became
 * `artist:zo-lamarr` — an address that is neither her name nor anybody's —
 * and a name in any script without Latin letters became `item`. Accents are
 * folded the way search folds them (`zoe-lamarre`, the id a person would
 * guess), and a letter with no Latin form is kept as the letter it is.
 */
export function slug(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

/**
 * A SEAT'S OWN MARK ON THE IDS IT MINTS (FR-55): seven letters and digits
 * that are the same for the same seat on any store — so a page's guess and
 * its host's answer agree — and that do not spell who the seat is. An id
 * a seat minted is read by every seat that sees the record, and one that
 * may not see the seat's own record was told it by `room:green.person-gus`.
 */
export function seatMark(me: string): string {
  let hash = 0x811c9dc5;
  for (let at = 0; at < me.length; at++) hash = Math.imul(hash ^ me.charCodeAt(at), 0x01000193);
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/**
 * AN ID MINTED FOR A SEAT (FR-55), from `base` (`room:green`): stepping only
 * past what the seat `seen`s; where it may not see every record of the
 * kind (`limited`), its own — `room:green.<seatMark>`, which no label and no
 * other seat mints — and where a step would still land on an id something
 * holds, or the seat is nobody, a suffix no guess collides with. What an
 * act's `freshId` and an import mint alike.
 */
export function mintId(base: string, at: { readonly seen: (id: string) => boolean; readonly held: (id: string) => boolean; readonly limited: boolean; readonly me?: string | undefined }): string {
  if (at.limited && at.me === undefined) return unguessable(base, at.held);
  const own = at.limited ? `${base}.${seatMark(at.me!)}` : base;
  let id = own;
  for (let n = 2; at.seen(id); n++) id = `${own}-${n}`;
  return at.held(id) ? unguessable(own, at.held) : id;
}

/** An id from `base` no guess collides with: a random suffix, drawn again (never seen to be) while anything holds it. */
function unguessable(base: string, held: (id: string) => boolean): string {
  let id;
  do id = `${base}-${Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, "0")}`;
  while (held(id));
  return id;
}

/**
 * Runs a mutation against the graph WITHOUT applying it, returning the
 * primitives it would emit plus the causal read set. Applying is the op
 * log's job — keeping the two apart is what makes preview-as-diff free.
 */
export function compileMutation<S extends AnySchema>(
  graph: Graph<S>,
  definition: AnyMutationDefinition<S>,
  rawArgs: unknown,
  options: {
    /**
     * A field written with the value it already holds is kept in the patch
     * when this says so (FR-55): a seat that writes a value the store holds
     * in words it may not see has written its own words, and an act that
     * wrote nothing would tell it the guess was the hidden value.
     */
    readonly keepUnchanged?: (value: unknown, field: string, node: object) => boolean;
    /**
     * THE GRAPH THE ACT READS (FR-55): its author's view. Its body, its
     * guard, its refusal and its sentence read only what the author may
     * see, so a record kept from the author is to the act exactly what one
     * that does not exist is — not counted, quoted or copied, and no answer
     * differs for it. What it writes lands on the whole graph, and the
     * framework's bookkeeping reads the whole graph: a removed record's
     * links and fields, a patch's prior values, a single source's other
     * links, an id already taken. Absent, the graph itself.
     */
    readonly seen?: GraphReader<NodeOfSchema<S>>;
    /** The id of the seat the act is run by — the person, for an agent acting for one: the act's `ctx.me`. */
    readonly me?: string | undefined;
    /**
     * WHETHER THE SEAT SEES EVERY RECORD OF A KIND (FR-55), or, asked of no
     * kind, of every kind. Ids are unique across the whole store, so an id
     * minted or asked for where a record the seat may not see could hold it
     * would say that record is there: for a kind it does not see in full a
     * minted id carries a suffix no guess collides with, and a seat that
     * does not see everything may not ask for an id at all — refused alike,
     * whether or not anybody holds it. Absent, the seat sees everything.
     */
    readonly seesInFull?: (kind?: string) => boolean;
    /**
     * WHAT THE ACT WROTE, ASKED BEFORE ITS SENTENCE IS WORDED (Roadmap
     * f-field-sight): a write of a field the author may not see is refused
     * here, and the list handed back is filled, as the sentence is worded,
     * with the fields of records it reads (`<id>#<field>`), so a seat that
     * may not see one is served the op withheld. `@graview/core/field-sight` sets it.
     */
    /** The id a client minted for the first record, as a hint (`MutationCall.mintedHint`): taken when free and its to ask for, else minted as ever. */
    readonly hint?: string | undefined;
    /**
     * WHETHER THE LOG EVER HELD AN ID, a record since removed included. Who
     * made a record is the first add of its id in the log, so an id it once
     * held is never made again — minted, asked for or hinted — or the maker
     * of the removed record would be taken for the new one's.
     */
    readonly everHeld?: (id: string) => boolean;
    /**
     * WHETHER SOME SIGHT MAY KEEP A FIELD OF A KIND FROM SOME ROLE (Roadmap
     * f-field-sight). An id is served wherever its record is, so a name
     * handed to `freshId` that is an argument for such a field is not minted
     * from: the id is minted from the kind's name instead.
     */
    readonly keeps?: (kind: string, field: string) => boolean;
    readonly check?: (primitives: readonly Primitive[], definition: { readonly name: string; readonly creates?: readonly string[] | undefined; readonly input: unknown }) => readonly string[];
  } = {},
): CompiledMutation {
  /*
   * THE ID A CALLER BROUGHT. An act that creates a kind takes an optional
   * `id` the framework adds beside its own arguments (see `takesAnId`):
   * lifted here, before the declaration's own schema parses the rest, so a
   * strict input is not asked about an argument it never declared. It goes
   * to the first node `freshId` mints, and an id already in the graph is a
   * refusal — a seed being synced, or an agent that will name this node in
   * its next call, needs exactly the id it asked for or an honest no.
   */
  const requested = takesAnId(definition) ? requestedId(rawArgs) : undefined;
  const given = numbersSpelled(definition.input, requested === undefined ? rawArgs : withoutId(rawArgs as Record<string, unknown>));
  /*
   * AN ARGUMENT THE ACT DOES NOT TAKE IS REFUSED, by every act (FR-121; a
   * derived edit since FR-110). A plain `z.object` strips what it does not
   * declare, so `set-quote { id, quote, color }` set the quote and said
   * nothing of the color; the framework holds the act to its shape here,
   * at the one boundary every call crosses, so no product changes its
   * input. An argument given as `undefined` is no argument. Said with those
   * it does take — a caller that misspelled one learns the spelling.
   */
  const taken = argumentsTaken(definition);
  if (taken && typeof given === "object" && given !== null && !Array.isArray(given)) {
    const stray = Object.keys(given).filter((key) => !taken.includes(key) && (given as Record<string, unknown>)[key] !== undefined);
    if (stray.length > 0) throw new InvalidArguments(definition.name, [{ path: [], message: doesNotTake(stray, taken, definition.writtenBy) }]);
  }
  /*
   * WHAT `null` CLEARS (Roadmap f-partial-dates): an argument the act says
   * is `clearable` is taken past its field's own parse as `null`, so a
   * wrong date is taken away and the input's tool schema stays the field's.
   */
  const cleared =
    definition.clearable && typeof given === "object" && given !== null && !Array.isArray(given)
      ? definition.clearable.filter((key) => (given as Record<string, unknown>)[key] === null)
      : [];
  const parsed = definition.input.safeParse(cleared.length > 0 ? Object.fromEntries(Object.entries(given as Record<string, unknown>).filter(([key]) => !cleared.includes(key))) : given);
  if (parsed.success) for (const key of cleared) (parsed.data as Record<string, unknown>)[key] = null;
  if (!parsed.success) {
    // A strict input's own refusal of an argument (a derived edit's), said the same way.
    const takes = Object.keys((definition.input as { shape?: Record<string, unknown> }).shape ?? {});
    throw new InvalidArguments(
      definition.name,
      parsed.error.issues.map((issue) =>
        issue.code === "unrecognized_keys" && takes.length > 0 ? { ...issue, message: doesNotTake(issue.keys, takes, definition.writtenBy) } : issue,
      ),
    );
  }
  const args = parsed.data as Record<string, unknown>;

  const reader = new TrackedReader<NodeOfSchema<S>>(options.seen ?? graph);
  const primitives: Primitive[] = [];
  const minted = new Set<string>();
  /*
   * Asked the same whether a record the seat may not see holds it or
   * nothing does (FR-55): a seat that does not see everything may ask only
   * for an id of its own — one that ends `.<seatMark(me)>`, as the ids
   * minted for it do — which nobody else's label mints.
   */
  const mark = options.me === undefined ? undefined : `.${seatMark(options.me)}`;
  const mayAsk = (id: string) => !options.seesInFull || options.seesInFull() || (mark !== undefined && new RegExp(`\\${mark}(-[0-9a-z]+)?$`).test(id));
  // An id any record holds, seen or not: a minted id never lands on one.
  const held = (id: string) => reader.has(id) || graph.has(id) || minted.has(id) || options.everHeld?.(id) === true;
  let mergedInto: string | undefined;
  /** Every link touching a record, each once, taken off; what it reached is read. */
  const unlink = (id: string): Set<GraphEdge> => {
    const touching = new Set([...graph.outEdges(id), ...graph.inEdges(id)]);
    for (const edge of touching) {
      reader.getNode(edge.from);
      reader.getNode(edge.to);
      primitives.push({ op: "remove-edge", edge });
    }
    return touching;
  };

  const context: MutationContext<S> = {
    graph: reader,
    schema: graph.schema,
    me: options.me,
    emit(primitive) {
      primitives.push(primitive);
    },
    addNode(node) {
      primitives.push({ op: "add-node", node });
    },
    removeNode(id) {
      const node = reader.getNode(id) && graph.getNode(id);
      if (!node) throw new MissingRecordError(id, `Cannot remove missing node "${id}"`);
      unlink(id);
      primitives.push({ op: "remove-node", node });
    },
    patchNode(id, fields) {
      const node = reader.getNode(id) && graph.getNode(id);
      if (!node) throw new MissingRecordError(id, `Cannot patch missing node "${id}"`);
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        const current = (node as Record<string, unknown>)[key];
        if (JSON.stringify(current) === JSON.stringify(value) && !options.keepUnchanged?.(value, key, node)) continue;
        before[key] = current;
        after[key] = value;
      }
      if (Object.keys(after).length === 0) return;
      primitives.push({ op: "patch-node", id, before, after });
    },
    // The archived mark is a patch like any other (FR-173): nothing when it is already so.
    archiveNode: (id) => context.patchNode(id, { [ARCHIVED]: true }),
    unarchiveNode: (id) => context.patchNode(id, { [ARCHIVED]: undefined }),
    mergeNode(gone, into) {
      const kept = reader.getNode(into) && graph.getNode(into);
      if (!kept) throw new MissingRecordError(into, `Cannot merge into missing node "${into}"`);
      if (gone === into || isArchived(kept)) throw new GraphError(gone === into ? "Cannot merge a record into itself" : "Cannot merge into an archived record");
      // THE KEPT ONE TAKES THE LINKS, but never a link to itself or one it has; then the duplicate is archived.
      const has = new Set([...graph.outEdges(into), ...graph.inEdges(into)].map(edgeId));
      for (const edge of unlink(gone)) {
        // Moved whole: a link's own id and data (reserved) go with it.
        const next = { ...edge, from: edge.from === gone ? into : edge.from, to: edge.to === gone ? into : edge.to };
        if (next.from !== next.to && !has.has(edgeId(next))) has.add(edgeId(next)), primitives.push({ op: "add-edge", edge: next });
      }
      context.archiveNode(gone);
      mergedInto = into;
    },
    addEdge(edge) {
      primitives.push({ op: "add-edge", edge });
    },
    removeEdge(edge) {
      // A link named by its own id is removed as it is held, so the removal's inverse puts back all of it.
      primitives.push({ op: "remove-edge", edge: (edge.id !== undefined && graph.linkById(edge.id)) || edge });
    },
    setSingleSource(kind, to, from) {
      /*
       * The new link first, then the old ones it replaces (FR-55): a link the
       * seat may not see is no part of the op it is served, and what remains
       * reads — primitives, writes and their order — as it would had there
       * been no such link.
       */
      if (!graph.inEdges(to, kind).some((e) => e.from === from)) {
        primitives.push({ op: "add-edge", edge: { kind, from, to } });
      }
      for (const edge of graph.inEdges(to, kind)) {
        reader.getNode(edge.from);
        if (edge.from === from) continue;
        primitives.push({ op: "remove-edge", edge });
      }
    },
    freshId(label, prefix) {
      if (requested !== undefined && !minted.has(requested)) {
        /*
         * AN ID ASKED FOR SAYS ITS KIND, as every minted one does (Roadmap
         * f-add-id-kind-prefix). `apt1` was kept as `apt1` beside
         * `actor:apt29`, and a later call that named it `actor:apt1`, as
         * every other actor is named, missed it. Kept exactly as asked
         * (f-1-0-client-ids), so refused with the id it would be, never
         * quietly renamed: a batch that names it again names it the same.
         */
        if (prefix && !requested.startsWith(`${prefix}:`)) {
          const bare = requested.includes(":") ? requested.slice(requested.indexOf(":") + 1) : requested;
          throw new GraphError(
            `Id "${requested}" does not say its kind: ask for "${prefix}:${bare || requested}"`,
            `Every ${prefix} id starts "${prefix}:", the ones "${definition.name}" mints and the ones a caller asks for alike, so a later call names it as it names the rest.`,
          );
        }
        if (!mayAsk(requested)) {
          throw new GraphError(`"${definition.name}" makes its own id here`, `Leave id out${mark ? `, or end it "${mark}"` : ""}.`);
        }
        if (held(requested)) {
          throw new GraphError(
            `Id "${requested}" is already taken`,
            `"${definition.name}" was asked to make a node with that id, and the graph has or had one. Pick another, or leave id out and let the act mint one.`,
          );
        }
        minted.add(requested);
        return requested;
      }
      // A client's own guess at the first id (`hint`): taken when free, else minted as ever — never refused.
      const hint = options.hint;
      if (requested === undefined && !minted.size && validId(hint) && (!prefix || hint.startsWith(`${prefix}:`)) && mayAsk(hint) && !held(hint)) return minted.add(hint), hint;
      // A name that is the value of a field some sight keeps from a role is not quoted in the id: the kind's name is.
      if (prefix && options.keeps && Object.entries(args).some(([field, value]) => value === label && options.keeps!(prefix, field))) label = prefix;
      const base = prefix ? `${prefix}:${slug(label)}` : slug(label);
      /*
       * AN ID THAT SAYS NOTHING OF WHAT THE SEAT MAY NOT SEE (FR-55). Stepping
       * past what it sees is the seat's own to know; stepping past a hidden
       * record would tell it one is there ("Green" made `room:green-2` with
       * no room:green in sight). Where a kind may hold records the seat does
       * not see, its ids are the seat's own — `room:green.<its mark>`: a
       * slug never holds a dot, so no other seat's label mints one — and
       * the seat steps only past those it sees. Where a step would land on
       * a hidden record anyway (an id somebody asked for), and for a seat
       * that is nobody, the suffix is one no guess collides with.
       */
      const limited = options.seesInFull !== undefined && !options.seesInFull(prefix);
      // A seat that sees every record of the kind steps past one removed, as past one held: `task:plan-2`.
      const seen = (one: string) => (options.seen ? options.seen.has(one) : graph.has(one)) || minted.has(one) || (!limited && options.everHeld?.(one) === true);
      const id = mintId(base, { seen, held, limited, me: options.me });
      minted.add(id);
      return id;
    },
  };

  definition.apply(context, args);
  // An id asked for and not taken is said, never dropped: the caller would name a record that is not there.
  if (requested !== undefined && !minted.has(requested)) {
    throw new GraphError(`"${definition.name}" did not make a record with id "${requested}": it names what it makes itself`);
  }
  const quoted = options.check?.(primitives, definition);

  const writes = new Set(primitives.flatMap(writesOf));

  // Its own reader, so what the sentence read is known apart from what the act read (FR-55).
  const wording = new TrackedReader<NodeOfSchema<S>>(options.seen ?? graph);
  const intent =
    definition.describe?.(args, wording) ??
    `${definition.name}(${Object.entries(args)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ")})`;

  return {
    primitives,
    reads: [...new Set([...reader.reads(), ...wording.reads()])],
    ...(definition.describe ? { described: [...wording.reads(), ...(quoted ?? [])] } : {}),
    writes: [...writes],
    intent,
    ...(mergedInto !== undefined ? { mergedInto } : {}),
    ...(minted.size > 0 ? { firstMinted: minted.values().next().value! } : {}),
  };
}

import type { GraphEdge } from "../graph/types.js";
import type { Lineage } from "./lineage.js";
import type { Author, Operation } from "./types.js";

/*
 * WHERE A LINK CAME FROM, AND A LINEAGE IN WORDS (FR-172). Apart from
 * `lineage.ts`, which the store checks every change with: only what draws a
 * link or a history line reads these, so a page carries them when it draws.
 */

/**
 * A lineage in words, for a history line or a card: "based on “both name
 * the lease” · 60% sure · gpt-x". The basis is the maker's own words.
 */
export function lineageWords(lineage: Lineage): string {
  return [
    `based on “${lineage.basis}”`,
    ...(lineage.confidence !== undefined ? [`${Math.round(lineage.confidence * 100)}% sure`] : []),
    ...(lineage.model ? [lineage.model] : []),
  ].join(" · ");
}

/**
 * WHERE A LINK CAME FROM, read off the log (FR-172): the op that made it,
 * who that was, what it was based on, and whether it is still PROVISIONAL —
 * made by an op whose confidence is below 1, by someone other than a
 * person, and not touched by a person since. `keptBy` is the person's op
 * that touched it, when one has.
 */
export interface LinkProvenance {
  readonly edge: GraphEdge;
  /** The op that made it. */
  readonly made: string;
  readonly by: Author;
  readonly lineage?: Lineage;
  readonly provisional: boolean;
  readonly keptBy?: string;
}

/** A provisional link said in a sentence, the same on every face: who made it, and what it was based on. */
export const provenanceWords = (link: LinkProvenance): string =>
  `Not yet kept by a person. ${link.by.name ?? link.by.id ?? "Something"} made it${link.lineage ? `, ${lineageWords(link.lineage)}` : ""}.`;

/** A link as provenance asks about it: its kind and its two ends. */
export type LinkRef = { readonly kind: string; readonly from: string; readonly to: string };

/** The key a link is known by in a provenance map: its kind and its two ends. */
export const linkKey = (edge: LinkRef): string => `${edge.kind}\u0000${edge.from}\u0000${edge.to}`;

/**
 * Every link the standing ops made, with its provenance (`LinkProvenance`).
 *
 * Read along the ops that stand — neither undone nor an undo, so the fold
 * the graph is — in order: an op that adds a link makes it, one that takes
 * it away forgets it, and a PERSON'S op that takes it away and puts it back
 * ("Keep this link") keeps it. Something other than a person putting back
 * what it took away, saying nothing new, leaves it as it was. An undo is
 * not a touch: it takes its target out of the reading, so undoing the keep
 * makes the link provisional again, and undoing the making leaves nothing
 * to say.
 */
export function linkProvenances(ops: readonly Operation[], undone: ReadonlySet<string>): Map<string, LinkProvenance> {
  const links = new Map<string, LinkProvenance>();
  for (const op of ops) {
    if (op.undoes !== undefined || undone.has(op.id) || op.withheld) continue;
    const person = op.author.kind === "human";
    const gone = new Map<string, LinkProvenance>();
    for (const primitive of op.primitives) {
      if (primitive.op !== "add-edge" && primitive.op !== "remove-edge") continue;
      const key = linkKey(primitive.edge);
      const had = links.get(key) ?? gone.get(key);
      links.delete(key);
      if (primitive.op === "remove-edge") {
        if (had) gone.set(key, had);
      } else if (had && (person || !op.lineage)) {
        links.set(key, person ? { ...had, provisional: false, keptBy: op.id } : had);
      } else {
        const lineage = op.lineage;
        links.set(key, { edge: primitive.edge, made: op.id, by: op.author, ...(lineage ? { lineage } : {}), provisional: !person && (lineage?.confidence ?? 1) < 1 });
      }
    }
  }
  return links;
}

/** What provenance reads of a store: its log. A `Store` is one; so is anything holding an `OperationLog`. */
export interface HasLog {
  readonly log: { all(): readonly Operation[]; undoneIds(): ReadonlySet<string>; readonly horizon: number };
}

/** Each log's provenance map, and the state of the log it was read at. */
const read = new WeakMap<object, { readonly at: string; readonly links: ReadonlyMap<string, LinkProvenance> }>();

function linksOf({ log }: HasLog): ReadonlyMap<string, LinkProvenance> {
  const ops = log.all();
  const at = `${log.horizon}:${ops.length}:${ops.at(-1)?.id}`;
  let kept = read.get(log);
  if (kept?.at !== at) read.set(log, (kept = { at, links: linkProvenances(ops, log.undoneIds()) }));
  return kept.links;
}

/**
 * WHERE A LINK IN THIS STORE CAME FROM (FR-172): one answer for every face
 * and host, read once per state of its log. Undefined for a link the graph
 * does not hold, or one made before the log's horizon. A function rather
 * than a store method, so a page that never draws a link carries none of
 * it up front.
 */
export const linkProvenance = (store: HasLog, edge: LinkRef): LinkProvenance | undefined => linksOf(store).get(linkKey(edge));

/** Whether a link is provisional: made unsure, and not yet kept by a person (`linkProvenance`). */
export const isProvisional = (store: HasLog, edge: LinkRef): boolean => linkProvenance(store, edge)?.provisional === true;

/** Every link in this store still provisional, oldest first: usually none. */
export const provisionalLinks = (store: HasLog): readonly LinkProvenance[] => [...linksOf(store).values()].filter((link) => link.provisional);

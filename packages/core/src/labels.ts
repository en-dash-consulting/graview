import type { GraphDiff } from "./graph/diff.js";
import type { Graph } from "./graph/graph.js";
import type { NodeRefArg } from "./mutations/node-ref.js";
import { labelOf, nounOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";

/**
 * RECORDS BY THEIR NAMES (FR-33).
 *
 * A person says "book the florist", never `vendor:bloom-co`, and an agent
 * in a conversation had to look every id up first. A node argument given
 * as a label, or as a unique case-insensitive prefix of one, is resolved
 * among the records the principal may see of the kinds it accepts; several
 * matches are candidates, not a guess.
 *
 * The index is kept per kind as sorted keys, so a prefix is a binary search
 * and a walk over what matches: resolution costs the matches, not a scan of
 * every record. It follows the graph's own diffs, relabeling only what
 * changed.
 */

/** A record a name could mean. */
export interface RefCandidate {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
}

/** What a name given for a node argument was taken to mean. */
export type RefResolution =
  | {
      readonly ok: true;
      readonly id: string;
      readonly label: string;
      /** `id` when it was one; `label` for a whole label; `prefix` for the one label it starts. */
      readonly by: "id" | "label" | "prefix";
    }
  | {
      readonly ok: false;
      /** `none`: nothing this principal sees is called that; `ambiguous`: more than one is. */
      readonly reason: "none" | "ambiguous";
      readonly candidates: readonly RefCandidate[];
      /** The refusal, in words: what was given, and each candidate as `Label (id)`. */
      readonly message: string;
    };

/** Case, accents and spacing aside: how a name is compared. */
export function nameKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

interface KindIndex {
  /** key → ids holding it. */
  readonly ids: Map<string, Set<string>>;
  /** The distinct keys, sorted, for a prefix's binary search. */
  sorted: string[];
}

export class LabelIndex<S extends AnySchema> {
  private readonly kinds = new Map<string, KindIndex>();
  /** id → the kind and key it is filed under. */
  private readonly filed = new Map<string, { kind: string; key: string; label: string }>();

  constructor(private readonly graph: Graph<S>) {
    for (const node of graph.allNodes()) this.file(node as never);
    graph.subscribe((diff) => this.follow(diff as GraphDiff));
  }

  /** The label a record is filed under, as its kind reads it. */
  labelOf(id: string): string | undefined {
    return this.filed.get(id)?.label;
  }

  /**
   * Records of these kinds whose label starts with the name, and which of
   * them it is the whole of. `"*"` accepts every kind.
   */
  lookup(kinds: readonly string[], given: string): { readonly exact: readonly string[]; readonly prefix: readonly string[] } {
    const key = nameKey(given);
    if (key.length === 0) return { exact: [], prefix: [] };
    const indexes = kinds.includes("*") ? [...this.kinds.values()] : kinds.flatMap((kind) => this.kinds.get(kind) ?? []);
    const exact: string[] = [];
    const prefix: string[] = [];
    for (const index of indexes) {
      for (let at = lowerBound(index.sorted, key); at < index.sorted.length && index.sorted[at]!.startsWith(key); at += 1) {
        const ids = [...(index.ids.get(index.sorted[at]!) ?? [])];
        prefix.push(...ids);
        if (index.sorted[at] === key) exact.push(...ids);
      }
    }
    return { exact, prefix };
  }

  private follow(diff: GraphDiff): void {
    for (const node of diff.removedNodes) this.unfile(node.id);
    for (const change of diff.changedNodes) {
      this.unfile(change.after.id);
      this.file(change.after as never);
    }
    for (const node of diff.addedNodes) this.file(node as never);
  }

  private file(node: { id: string; kind: string } & Record<string, unknown>): void {
    const label = labelOf(this.graph.schema.tryDefinition(node.kind), node);
    const key = nameKey(label);
    this.filed.set(node.id, { kind: node.kind, key, label });
    let index = this.kinds.get(node.kind);
    if (!index) this.kinds.set(node.kind, (index = { ids: new Map(), sorted: [] }));
    const held = index.ids.get(key);
    if (held) held.add(node.id);
    else {
      index.ids.set(key, new Set([node.id]));
      index.sorted.splice(lowerBound(index.sorted, key), 0, key);
    }
  }

  private unfile(id: string): void {
    const was = this.filed.get(id);
    if (!was) return;
    this.filed.delete(id);
    const index = this.kinds.get(was.kind);
    const held = index?.ids.get(was.key);
    if (!index || !held) return;
    held.delete(id);
    if (held.size > 0) return;
    index.ids.delete(was.key);
    const at = lowerBound(index.sorted, was.key);
    if (index.sorted[at] === was.key) index.sorted.splice(at, 1);
  }
}

function lowerBound(sorted: readonly string[], key: string): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted[mid]! < key) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** The words a refusal uses for an argument's kinds: "vendor", "vendor or category", "record". */
export function kindsInWords(schema: AnySchema, kinds: readonly string[]): string {
  if (kinds.includes("*")) return "record";
  return kinds.map((kind) => nounOf(schema.tryDefinition(kind), kind)).join(" or ");
}

/** Builds the refusal for a name that resolved to none or to several. */
export function refusalFor(schema: AnySchema, arg: Pick<NodeRefArg, "name" | "kinds">, given: string, candidates: readonly RefCandidate[]): RefResolution {
  const what = kindsInWords(schema, arg.kinds);
  if (candidates.length === 0) {
    return { ok: false, reason: "none", candidates, message: `There is no ${what} called "${given}".` };
  }
  const shown = candidates.slice(0, 10).map((candidate) => `${candidate.label} (${candidate.id})`);
  const more = candidates.length > shown.length ? `, and ${candidates.length - shown.length} more` : "";
  return {
    ok: false,
    reason: "ambiguous",
    candidates,
    message: `"${given}" names more than one ${what}: ${shown.join(", ")}${more}. Pass the id of the one you mean as ${arg.name}.`,
  };
}

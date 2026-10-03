import type { Primitive } from "../graph/primitives.js";
import type { Operation } from "./types.js";

/**
 * WHICH OP LAST WROTE EACH FIELD (FR-05) — read off the log, never stored.
 *
 * A stale write is one made against a value somebody has changed since:
 * two people open one record, both change its status, and whoever sends
 * second used to win without knowing the first had spoken. To say so, a
 * call carries the revision of each field it changes as its sender last
 * saw it, and the store compares that with the field's revision now.
 *
 * A field's revision is the `seq` of the op that last wrote it: an op that
 * added its record, or one that patched it. It is DERIVED from the log
 * rather than kept beside it, so no stored format changes and every store,
 * every client and every host that folds the same log agrees on it without
 * being told. A field no op in the log has written (a seeded one, or one
 * written before the log's first op) is at `NEVER_WRITTEN`.
 */
export const NEVER_WRITTEN = -1;

/** What a call says it saw: one field of one record, at the revision its sender last read. */
export interface FieldRevision {
  readonly node: string;
  readonly field: string;
  readonly rev: number;
}

/**
 * A FIELD THAT MOVED WHILE SOMEBODY WAS EDITING IT: the stale write, as
 * the store refuses it. `theirs` is the value now, `yours` the one the call
 * would have written, `by` who wrote theirs and `rev` the op that did.
 * Named as Graview Cloud's room names it, so a host's interim reads the same.
 */
export interface FieldConflict {
  readonly node: string;
  readonly field: string;
  readonly theirs: unknown;
  readonly yours: unknown;
  /** Who wrote theirs, by name where the log says one: "Sam", "Someone". */
  readonly by: string;
  /** The revision the field is at now. */
  readonly rev: number;
  /** The revision the call said it saw. */
  readonly saw: number;
}

const key = (node: string, field: string) => `${node}\u0000${field}`;

/** The fields one primitive writes, by record. */
export function fieldsWritten(primitive: Primitive): readonly (readonly [string, string])[] {
  if (primitive.op === "add-node") {
    return Object.keys(primitive.node)
      .filter((field) => field !== "id" && field !== "kind")
      .map((field) => [primitive.node.id, field] as const);
  }
  if (primitive.op === "patch-node") return Object.keys(primitive.after).map((field) => [primitive.id, field] as const);
  return [];
}

/**
 * The revision of every field a log has written, kept current as ops land.
 * A revision only moves forward: an op noted twice, or out of order, leaves
 * a later one standing.
 */
export class FieldRevisions {
  private readonly revs = new Map<string, number>();

  /** Revisions read from a whole log (or the part of one a seat may see). */
  static of(ops: readonly Operation[]): FieldRevisions {
    const revisions = new FieldRevisions();
    revisions.note(ops);
    return revisions;
  }

  /** Takes in ops as they land, by the seq each carries. */
  note(ops: readonly Operation[]): void {
    for (const op of ops) {
      for (const primitive of op.primitives) {
        for (const [node, field] of fieldsWritten(primitive)) {
          const at = key(node, field);
          if ((this.revs.get(at) ?? NEVER_WRITTEN) < op.seq) this.revs.set(at, op.seq);
        }
      }
    }
  }

  /** The seq of the op that last wrote this field, or `NEVER_WRITTEN`. */
  of(node: string, field: string): number {
    return this.revs.get(key(node, field)) ?? NEVER_WRITTEN;
  }

  /** The base a call made of these ops would carry: each field they patch on a record they did not add, at its revision here. */
  baseFor(ops: readonly Operation[], skip: ReadonlySet<string> = new Set()): FieldRevision[] {
    const created = new Set<string>();
    const base = new Map<string, FieldRevision>();
    for (const op of ops) {
      for (const primitive of op.primitives) {
        if (primitive.op === "add-node") created.add(primitive.node.id);
        if (primitive.op !== "patch-node" || created.has(primitive.id) || skip.has(primitive.id)) continue;
        for (const field of Object.keys(primitive.after)) {
          const at = key(primitive.id, field);
          if (skip.has(at) || base.has(at)) continue;
          base.set(at, { node: primitive.id, field, rev: this.of(primitive.id, field) });
        }
      }
    }
    return [...base.values()];
  }

  /** The base entries that no longer hold: each field written since its sender read it. */
  stale(base: readonly FieldRevision[]): FieldRevision[] {
    return base.filter((entry) => this.of(entry.node, entry.field) !== entry.rev);
  }
}

/** Every record and every `record\0field` these ops write: what a later call need not claim to have seen. */
export function writtenBy(ops: readonly Operation[]): Set<string> {
  const out = new Set<string>();
  for (const op of ops) {
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node") out.add(primitive.node.id);
      for (const [node, field] of fieldsWritten(primitive)) out.add(key(node, field));
    }
  }
  return out;
}

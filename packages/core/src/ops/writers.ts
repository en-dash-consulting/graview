import { isUnset, type Primitive } from "../graph/primitives.js";
import { actingAs } from "../permissions/policy.js";
import type { Principal } from "../permissions/types.js";
import type { Operation } from "./types.js";

/**
 * WHO WROTE EACH FIELD'S VALUE, AND WHEN (FR-55).
 *
 * A seat is served its own words: a field whose value the seat wrote is
 * served as written even when it names a record the seat may not see,
 * because saying back what a seat said tells it nothing — and judging it
 * like anybody else's would tell a seat that guessed an id whether the
 * guess was real. So the seat view has to know who wrote a field's value,
 * at the moment it is served and at every moment of the log it serves.
 *
 * Each op that writes a field is an entry: the seq, and the seat that wrote
 * it — the person, for an agent acting for one. An undo is never the
 * author of what it puts back: the value it restores is the words of
 * whoever wrote it before the op it takes back. Kept as the log goes, like
 * `recordsOf`: a call reads only the ops appended since the last, a log cut
 * back takes out what its cut ops wrote, and a log compacted behind its
 * horizon keeps what was read before it.
 */
export interface Writers {
  /** Who wrote the value a field held just before op `seq` ran; `undefined` when nobody this log knows. */
  writerAt(id: string, field: string, seq: number): string | undefined;
}

interface Entry {
  readonly seq: number;
  readonly by: string | undefined;
}

interface Index {
  base: number;
  end: number;
  read: Operation[];
  readonly fields: Map<string, Entry[]>;
  /** The keys each op wrote, in seq order, to take out again when the log is cut back. */
  readonly written: { readonly seq: number; readonly keys: readonly string[] }[];
  readonly seqOf: Map<string, number>;
  readonly writers: Writers;
}

const keyOf = (id: string, field: string): string => `${id}\u0000${field}`;

const INDEXES = new WeakMap<object, Index>();

function indexFrom(base: number): Index {
  const fields = new Map<string, Entry[]>();
  const writerAt = (id: string, field: string, seq: number): string | undefined => {
    const entries = fields.get(keyOf(id, field));
    if (!entries) return undefined;
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (entries[middle]!.seq < seq) low = middle + 1;
      else high = middle;
    }
    return low === 0 ? undefined : entries[low - 1]!.by;
  };
  return { base, end: base, read: [], fields, written: [], seqOf: new Map(), writers: { writerAt } };
}

/** The fields one primitive writes, by record. */
function writtenBy(primitive: Primitive): readonly [string, readonly string[]] | undefined {
  if (primitive.op === "add-node") return [primitive.node.id, Object.keys(primitive.node).filter((field) => field !== "id" && field !== "kind")];
  if (primitive.op === "patch-node") return [primitive.id, Object.keys(primitive.after).filter((field) => !isUnset(primitive.after[field]))];
  return undefined;
}

function readInto(index: Index, op: Operation): void {
  const seq = index.end;
  const author = actingAs(op.author as Principal).id;
  // What an undo puts back is the words of whoever wrote them before the op it takes back.
  const undone = op.undoes !== undefined ? index.seqOf.get(op.undoes) : undefined;
  const keys: string[] = [];
  for (const primitive of op.primitives) {
    const written = writtenBy(primitive);
    if (!written) continue;
    const [id, fields] = written;
    for (const field of fields) {
      const by = op.undoes === undefined ? author : undone !== undefined ? index.writers.writerAt(id, field, undone) : undefined;
      const key = keyOf(id, field);
      let entries = index.fields.get(key);
      if (!entries) index.fields.set(key, (entries = []));
      entries.push({ seq, by });
      keys.push(key);
    }
  }
  index.written.push({ seq, keys });
  index.seqOf.set(op.id, seq);
  index.read.push(op);
  index.end++;
}

function cutBack(index: Index, seq: number): void {
  while (index.written.length > 0 && index.written.at(-1)!.seq >= seq) {
    const { keys } = index.written.pop()!;
    for (const key of keys) index.fields.get(key)?.pop();
  }
  for (const op of index.read.slice(seq - index.base)) index.seqOf.delete(op.id);
  index.read.length = seq - index.base;
  index.end = seq;
}

/** Who wrote each field's value in a log, kept as the log goes (see `Writers`). */
export function writersOf(log: { all(): readonly Operation[]; readonly length?: number }): Writers {
  const ops = log.all();
  const end = typeof log.length === "number" ? log.length : ops.length;
  const first = end - ops.length;
  let index = INDEXES.get(log);
  if (index && index.base <= first && first <= index.end) {
    let agreed = Math.min(index.end, end);
    while (agreed > first && ops[agreed - 1 - first] !== index.read[agreed - 1 - index.base]) agreed--;
    if (agreed === first && first > index.base && agreed < index.end) index = undefined;
    else {
      if (agreed < index.end) cutBack(index, agreed);
      if (first > index.base) {
        index.read = index.read.slice(first - index.base);
        index.base = first;
      }
    }
  } else index = undefined;
  if (!index) INDEXES.set(log, (index = indexFrom(first)));
  for (let seq = index.end; seq < end; seq++) readInto(index, ops[seq - first]!);
  return index.writers;
}

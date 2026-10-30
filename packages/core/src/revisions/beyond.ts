/*
 * WHAT AN ACT CHANGED BEYOND WHAT WAS ASKED (Roadmap
 * f-revisions-say-what-broke).
 *
 * An act's answer (`ApplyResult`) holds every op it kept and each op every
 * primitive, so it has always said what changed — but not apart from what
 * was asked. One act can change more than its target: its own body writes
 * another record, a record kept in step with it follows (`follows`), a
 * record removed takes its links with it, the app's own actor makes what
 * a vote decided in the same gesture. This reads an answer against the
 * acts asked for and says, in words and as entries, every record and link
 * changed beyond each act's own: the records its arguments name and the
 * record it made.
 */
import type { MutationCall } from "../mutations/types.js";
import type { Author, Operation } from "../ops/types.js";
import type { AnyGraphNode, GraphEdge } from "../graph/types.js";
import type { Primitive } from "../graph/primitives.js";

/** A record added or removed beyond what its act was asked. */
interface RecordChange<C extends "added" | "removed"> {
  readonly change: C;
  readonly record: string;
  readonly kind: string;
  readonly op: string;
  readonly act: string | null;
}

/** A link made or taken beyond what its act was asked. */
interface EdgeChange<C extends "linked" | "unlinked"> {
  readonly change: C;
  readonly edge: GraphEdge;
  readonly op: string;
  readonly act: string | null;
}

/** A record or a link changed beyond what its act was asked. */
export type BeyondChange =
  | RecordChange<"added">
  | RecordChange<"removed">
  | { readonly change: "changed"; readonly record: string; readonly fields: readonly string[]; readonly op: string; readonly act: string | null }
  | EdgeChange<"linked">
  | EdgeChange<"unlinked">;

/** What an answer changed, set against what was asked. */
export interface ActReach {
  /** Each act asked, with the records it was asked about: those its arguments name and the one it made. */
  readonly asked: readonly { readonly op: string; readonly act: string | null; readonly records: readonly string[] }[];
  readonly beyond: readonly BeyondChange[];
  readonly said: readonly string[];
  /** "Besides what was asked, it also …", or that it changed only what was asked. */
  readonly text: string;
}

export interface BeyondAskedOptions {
  /** The acts the caller asked for. Given, an op whose act is none of them is beyond what was asked whole; left out, each op's own act is what was asked. */
  readonly asked?: readonly MutationCall[];
  /** A record's name, as a person says it (`describeNode`, a store's label): its id otherwise, or its name where the change carried the record. */
  readonly label?: (id: string) => string | undefined;
}

/** Every string an act's arguments hold, however deep. */
function stringsIn(value: unknown, into: Set<string>): Set<string> {
  if (typeof value === "string") into.add(value);
  else if (Array.isArray(value)) for (const one of value) stringsIn(one, into);
  else if (typeof value === "object" && value !== null) for (const one of Object.values(value)) stringsIn(one, into);
  return into;
}

const sameAuthor = (a: Author, b: Author) => a.kind === b.kind && (a.id ?? "") === (b.id ?? "");

/** The record ids a primitive touches. */
function touched(primitive: Primitive): string[] {
  switch (primitive.op) {
    case "add-node":
    case "remove-node":
      return [primitive.node.id];
    case "patch-node":
    case "splice-text":
      return [primitive.id];
    case "add-edge":
    case "remove-edge":
      return [primitive.edge.from, primitive.edge.to];
  }
}

const nameOf = (node: AnyGraphNode) => [node["title"], node["name"], node["label"]].find((one): one is string => typeof one === "string" && one.length > 0);

/**
 * WHAT AN ANSWER CHANGED BEYOND WHAT WAS ASKED: every record added,
 * removed or changed, and every link made or taken, that is not the asking
 * act's own — its own being the records the act's arguments name and the
 * first record it made, and a link between two of those.
 */
export function beyondAsked(answer: { readonly ops: readonly Operation[] }, options: BeyondAskedOptions = {}): ActReach {
  const askedNames = options.asked ? new Set(options.asked.map((call) => call.name)) : undefined;
  const first = answer.ops[0]?.author;
  const names = new Map<string, string>();
  const asked: { op: string; act: string | null; records: string[] }[] = [];
  const beyond: BeyondChange[] = [];
  const changedAt = new Map<string, { fields: Set<string>; entry: number }>();
  for (const op of answer.ops) {
    const act = op.mutation?.name ?? null;
    for (const primitive of op.primitives) if ((primitive.op === "add-node" || primitive.op === "remove-node") && nameOf(primitive.node)) names.set(primitive.node.id, nameOf(primitive.node)!);
    /* An op is asked when it is an act, by whoever asked the first, and one of the acts asked: anything else in the answer is beyond it whole. */
    const isAsked = act !== null && (!first || sameAuthor(op.author, first)) && (!askedNames || askedNames.has(act));
    const ids = new Set(op.primitives.flatMap(touched));
    const targets = new Set<string>();
    if (isAsked) {
      for (const one of stringsIn(op.mutation!.args, new Set())) if (ids.has(one)) targets.add(one);
      const made = op.primitives.find((primitive): primitive is Extract<Primitive, { op: "add-node" }> => primitive.op === "add-node");
      if (made) targets.add(made.node.id);
      asked.push({ op: op.id, act, records: [...targets] });
    }
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node" || primitive.op === "remove-node") {
        if (!targets.has(primitive.node.id)) beyond.push({ change: primitive.op === "add-node" ? "added" : "removed", record: primitive.node.id, kind: primitive.node.kind, op: op.id, act } as BeyondChange);
      } else if (primitive.op === "patch-node" || primitive.op === "splice-text") {
        if (targets.has(primitive.id)) continue;
        const fields = primitive.op === "patch-node" ? Object.keys(primitive.after) : [primitive.field];
        const key = `${op.id} ${primitive.id}`;
        const at = changedAt.get(key);
        if (at) for (const field of fields) at.fields.add(field);
        else {
          changedAt.set(key, { fields: new Set(fields), entry: beyond.length });
          beyond.push({ change: "changed", record: primitive.id, fields, op: op.id, act });
        }
      } else if (!(targets.has(primitive.edge.from) && targets.has(primitive.edge.to))) {
        beyond.push({ change: primitive.op === "add-edge" ? "linked" : "unlinked", edge: primitive.edge, op: op.id, act } as BeyondChange);
      }
    }
  }
  for (const { fields, entry } of changedAt.values()) {
    const one = beyond[entry] as Extract<BeyondChange, { change: "changed" }>;
    beyond[entry] = { ...one, fields: [...fields] };
  }
  const label = (id: string) => {
    const name = options.label?.(id) ?? names.get(id);
    return name ? `"${name}"` : id;
  };
  const groups: string[] = [];
  const of = <C extends BeyondChange["change"]>(change: C) => beyond.filter((one): one is Extract<BeyondChange, { change: C }> => one.change === change);
  const changed = of("changed");
  if (changed.length > 0) groups.push(`changed ${changed.map((one) => `${label(one.record)} (${one.fields.join(", ")})`).join(", ")}`);
  const added = of("added");
  if (added.length > 0) groups.push(`added ${added.map((one) => `${one.kind} ${label(one.record)}`).join(", ")}`);
  const removed = of("removed");
  if (removed.length > 0) groups.push(`removed ${removed.map((one) => `${one.kind} ${label(one.record)}`).join(", ")}`);
  const linked = of("linked");
  if (linked.length > 0) groups.push(`linked ${linked.map((one) => `${label(one.edge.from)} ${one.edge.kind} ${label(one.edge.to)}`).join(", ")}`);
  const unlinked = of("unlinked");
  if (unlinked.length > 0) groups.push(`took the link ${unlinked.map((one) => `${label(one.edge.from)} ${one.edge.kind} ${label(one.edge.to)}`).join(", ")}`);
  const said = groups.length > 0 ? [`Besides what was asked, it also ${groups.join("; ")}.`] : [];
  return { asked, beyond, said, text: said[0] ?? "It changed only what was asked." };
}

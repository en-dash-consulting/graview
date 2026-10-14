/**
 * `@graview/core/field-sight` — A SIGHT THAT HIDES A FIELD, NOT ONLY A KIND
 * (Roadmap f-field-sight).
 *
 * A sight said who sees the records of a kind: a role saw a whole record or
 * none of it, so a roster where parents see every player's name and not
 * their phone number could not be said. A sight may now say `hide: [...]`,
 * or `fields: [...]` as an allow list, and SIGHTS ADD UP: a role is shown a
 * field of a record when any sight that shows it that record shows that
 * field. A field kept from a seat is kept by the seat view itself — the
 * record it is served, the log, an answer, a search, a name, a form — and
 * the seat may not write it: the write is refused as an argument the act
 * does not take, whatever it held and whatever was written.
 *
 * Loaded, it fills in `FIELD_SIGHT` and teaches the store; until it is, a
 * sight with `hide` or `fields` shows nothing (it fails closed). A host
 * that serves seats loads it — `@graview/ship`'s server entry
 * imports it, a page that holds its whole store imports it once — and a page whose host served it its
 * seat's records already (`openRemote`) does not need to: the fields were
 * never sent. Apart from `@graview/core` so a hosted page carries none of
 * it up front.
 */
import { ARCHIVED } from "./graph/archived.js";
import { isUnset, type Primitive } from "./graph/primitives.js";
import type { AnyGraphNode, GraphNodeBase, GraphReader } from "./graph/types.js";
import { nameKey, refusalFor, type RefResolution } from "./labels.js";
import { argumentsTaken } from "./mutations/define-mutation.js";
import { InvalidArguments } from "./mutations/invalid-arguments.js";
import type { NodeRefArg } from "./mutations/node-ref.js";
import { serveAlong } from "./ops/served.js";
export { withoutKeptFields } from "./ops/kept-fields.js";
import type { Operation } from "./ops/types.js";
import { keptOf, withoutKeptFields } from "./ops/kept-fields.js";
import { namesUnseen, whole, withhold, type SeatLens } from "./ops/withheld.js";
import { actingAs, grantsTo, isSystem } from "./permissions/policy.js";
import { FIELD_SIGHT, partialSight, recordsOf, type FieldsKept, type Records } from "./permissions/sight.js";
import type { Policy, Principal, Sight } from "./permissions/types.js";
import { labelOf } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { Judged } from "./seen.js";
import { Store } from "./store.js";

/** The edges a graph can be asked about, to say what is joined to whom. */
interface Joined {
  out(id: string, kind?: string): readonly { readonly id: string }[];
  in(id: string, kind?: string): readonly { readonly id: string }[];
}

type Node = { readonly id: string; readonly kind: string };

const partial = partialSight;

const PARTIAL = new WeakMap<object, ReadonlySet<string>>();

/** The kinds some sight shows only some fields of: the only kinds a field is ever kept from. */
export function partialKinds(policy: Policy | undefined): ReadonlySet<string> {
  const sees = policy?.sees ?? [];
  let kinds = PARTIAL.get(sees);
  if (!kinds) PARTIAL.set(sees, (kinds = new Set(sees.flatMap((sight) => (partial(sight) ? sight.kinds : [])))));
  return kinds;
}

/** Whether one sight shows a principal one record — its kind, its roles, and with `own` or `via`, theirs — as `sees` judges it. */
function showing(principal: Principal, node: Node, graph: Joined, records?: Pick<Records, "creatorOf">): (sight: Sight) => boolean {
  const acting = actingAs(principal);
  const me = acting.id;
  const mine = (other: { readonly id: string }) => other.id === me;
  return (sight) => {
    if (!sight.kinds.includes(node.kind) || !grantsTo(sight, acting)) return false;
    if (!sight.own && !sight.via) return true;
    if (me === undefined) return false;
    return sight.via
      ? graph.out(node.id, sight.via).some(mine) || graph.in(node.id, sight.via).some(mine)
      : node.id === me || graph.out(node.id).some(mine) || graph.in(node.id).some(mine) || records?.creatorOf(node.id) === me;
  };
}

/**
 * WHICH FIELDS OF A RECORD IT SEES a principal may not: a test that says
 * yes of a field kept from it, or undefined when it sees every field. A
 * field is shown when any sight that shows the principal the record shows
 * it, so one sight with neither `fields` nor `hide` shows them all.
 */
export function fieldsKept(policy: Policy | undefined, principal: Principal, node: Node, graph: Joined, records?: Pick<Records, "creatorOf">): ((field: string) => boolean) | undefined {
  if (!policy?.sees?.length || isSystem(principal) || !partialKinds(policy).has(node.kind)) return undefined;
  const shown = policy.sees.filter(showing(principal, node, graph, records));
  if (shown.some((sight) => !partial(sight))) return undefined;
  return (field) => field !== ARCHIVED && !shown.some((sight) => (sight.fields === undefined || sight.fields.includes(field)) && !sight.hide?.includes(field));
}

/**
 * THE FIELDS OF EACH RECORD ONE SEAT MAY NOT SEE, as the store judges them
 * now; undefined when no sight shows only some fields. A record no log has
 * made yet is judged the asking seat's own, as it will be once it makes it.
 */
export function keptFrom(store: Judged, principal: Principal): FieldsKept | undefined {
  const kinds = isSystem(principal) ? undefined : partialKinds(store.policy);
  if (!kinds?.size) return undefined;
  return (node) => {
    if (!kinds.has(node.kind)) return undefined;
    const records = recordsOf(store.log);
    const maker = { creatorOf: (id: string) => records.creatorOf(id) ?? (id === node.id && !store.graph.getNode(id) ? actingAs(principal).id : undefined) };
    return fieldsKept(store.policy, principal, node, store.graph, maker);
  };
}

/**
 * A SEAT'S LENS, KEEPING WHAT ITS SIGHT KEEPS OF A RECORD: the record it is
 * served without those fields, as though it had none — and, when the
 * record cannot be without one, not served at all, as a record whose
 * required field names what the seat may not see is not (FR-55).
 */
function fieldLens(base: SeatLens, store: Judged, principal: Principal): SeatLens {
  const kept = keptFrom(store, principal);
  if (!kept) return base;
  // The same record kept the same way is the same object, so a view read twice is equal by identity.
  const stripped = new WeakMap<object, { readonly key: string; readonly node: unknown }>();
  const strip = <N extends Node>(node: N | undefined): N | undefined => {
    const keeps = node && kept(node);
    if (!node || !keeps) return node;
    const without: string[] = [];
    for (const field in node) {
      if (!Object.hasOwn(node, field) || field === "id" || field === "kind" || !keeps(field)) continue;
      if (!base.optional(node.kind, field)) return undefined;
      without.push(field);
    }
    if (without.length === 0) return node;
    const key = without.join("\u0000");
    const held = stripped.get(node);
    if (held?.key === key) return held.node as N;
    const out = Object.fromEntries(Object.entries(node).filter(([field]) => !without.includes(field))) as N;
    stripped.set(node, { key, node: out });
    return out;
  };
  const lens: SeatLens = {
    ...base,
    served: (node) => strip(base.served(node)),
    servedWith: (node, writer) => strip(base.servedWith(node, writer)),
    shows: (id) => {
      if (!base.shows(id)) return false;
      const node = store.graph.getNode(id);
      return !node || strip(base.served(node)) !== undefined;
    },
    kept,
    redact: (ops) => redactKept(ops, lens),
    // A lens pinned anew is made by the seat view, and kept there already; a pinned one is itself.
    pin: () => {
      const one = base.pin?.();
      return !one || one === base ? lens : one;
    },
  };
  return lens;
}

/** Whether an op adds or removes a record some of whose fields the seat may not see, or writes such a field. */
function touchesKept(op: Operation, lens: SeatLens): boolean {
  return op.primitives.some((primitive) => {
    if (primitive.op === "add-node" || primitive.op === "remove-node") return lens.kept!(primitive.node) !== undefined;
    if (primitive.op !== "patch-node") return false;
    const kept = keptOf(lens, primitive.id);
    return kept !== undefined && Object.keys(primitive.after).some(kept);
  });
}

/**
 * WHETHER AN OP'S SENTENCE READ A FIELD THE SEAT MAY NOT SEE: a label or a
 * `describe` that reads one ("Call 555 0101") carries the value in words.
 * The op says which fields its sentence read (`<id>#<field>` in
 * `described`), so such an op is withheld whatever the field held.
 */
const quotesKept = (op: Operation, lens: SeatLens): boolean =>
  (op.described ?? []).some((entry) => {
    const at = entry.lastIndexOf("#");
    return at > 0 && keptOf(lens, entry.slice(0, at))?.(entry.slice(at + 1)) === true;
  });

/**
 * THE LOG AS A SEAT WHOSE SIGHT KEEPS FIELDS IS SERVED IT: each op judged
 * where it stood (`serveAlong`), record by record — no record is passed as
 * it is, since one it sees may still hold a field it may not. An op that
 * adds or removes a record with a kept field, writes one, or whose sentence
 * read one is withheld (FR-16) with what the seat may see of it: whether
 * the record had a value or not, the seat is served the same. Its own ops
 * are served whole, as written: what it wrote it may see.
 */
function redactKept(ops: readonly Operation[], lens: SeatLens): Operation[] {
  const judge = { served: (node: AnyGraphNode, writer: (field: string) => string | undefined) => lens.servedWith(node, writer), edgeClean: (edge: object) => !namesUnseen(edge, lens.sees) };
  const along = lens.timeline ? serveAlong(ops, lens.timeline, judge) : ops.map((op) => ({ op, primitives: withhold(op, lens).primitives, faithful: false }));
  return along.map(({ op, primitives, faithful }) => {
    const served = withoutKeptFields(primitives, lens);
    const own = lens.actor !== undefined && actingAs(op.author as Principal).id === lens.actor;
    const plain = faithful && served.length === primitives.length && served.every((one, at) => one === primitives[at]) && (own || (!touchesKept(op, lens) && !quotesKept(op, lens)));
    return (!op.withheld && plain ? whole(op, lens, served) : undefined) ?? withhold(op, lens, served);
  });
}

/** "does not take "phone"; it takes "id", "name"" — said as an act says an argument it does not take. */
const doesNotTake = (stray: readonly string[], takes: readonly string[]): string =>
  `does not take ${stray.map((key) => `"${key}"`).join(", ")}; it takes ${takes.length > 0 ? takes.map((key) => `"${key}"`).join(", ") : "nothing"}`;

/** A reader whose records of the given kinds say which of their fields were read, once `quoting()` says to listen. */
function quoting<N extends GraphNodeBase>(inner: GraphReader<N>, kinds: ReadonlySet<string>): { reader: GraphReader<N>; listen(): string[] } {
  const read: string[] = [];
  let listening = false;
  const told = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(told);
    const node = value as N | undefined;
    if (!node || typeof node !== "object" || !kinds.has(node.kind)) return value;
    return new Proxy(node, {
      get(target, field, receiver) {
        const said = `${target.id}#${String(field)}`;
        if (listening && typeof field === "string" && field !== "id" && field !== "kind" && !read.includes(said)) read.push(said);
        return Reflect.get(target, field, receiver);
      },
    });
  };
  const reader = new Proxy(inner, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? (...args: unknown[]) => told((value as (...args: unknown[]) => unknown).apply(target, args)) : value;
    },
  });
  return {
    reader,
    listen: () => {
      listening = true;
      return read;
    },
  };
}

type Compiling = {
  readonly seen?: GraphReader<GraphNodeBase>;
  readonly keepUnchanged?: (value: unknown, field: string, node: object) => boolean;
  readonly check?: (primitives: readonly Primitive[], definition: { readonly name: string; readonly creates?: readonly string[]; readonly input: unknown }) => readonly string[];
};

/**
 * AN ACT AS ITS AUTHOR RUNS IT, under field sight: a write of a field the
 * author may not see is refused — asked before a write of the value the
 * field holds is let go as no change, so the refusal is the same whatever
 * it held — and a field it leaves unset is no write. And whatever the
 * author, its sentence says which fields it read.
 */
function compiling<O extends Compiling>(store: Store<AnySchema>, author: Principal | undefined, options: O): O {
  const kinds = partialKinds(store.policy);
  if (!kinds.size) return options;
  const kept = author && keptFrom(store as never, author);
  const { reader, listen } = quoting((options.seen ?? store.graph) as GraphReader<GraphNodeBase>, kinds);
  const given = options.keepUnchanged;
  return {
    ...options,
    seen: reader,
    keepUnchanged: (value: unknown, field: string, node: object) => given?.(value, field, node) === true || kept?.(node as Node)?.(field) === true,
    check(primitives, definition) {
      for (let at = primitives.length - 1; kept && at >= 0; at--) {
        const primitive = primitives[at]!;
        if (primitive.op !== "add-node" && primitive.op !== "patch-node") continue;
        const node = primitive.op === "add-node" ? primitive.node : store.graph.getNode(primitive.id);
        const keeps = node && kept(node as Node);
        if (!keeps) continue;
        const fields = (primitive.op === "add-node" ? primitive.node : primitive.after) as Record<string, unknown>;
        const stray = Object.keys(fields).filter((field) => field !== "id" && field !== "kind" && keeps(field));
        if (stray.some((field) => !isUnset(fields[field]))) {
          throw new InvalidArguments(definition.name, [{ path: [], message: doesNotTake(stray, (argumentsTaken(definition) ?? []).filter((key) => !keeps(key))) }]);
        }
        // Left unset, it is no write: the record keeps what it holds.
        if (primitive.op === "patch-node") {
          const before = { ...primitive.before };
          const after = { ...primitive.after };
          for (const field of stray) delete before[field], delete after[field];
          if (Object.keys(after).length === 0) (primitives as Primitive[]).splice(at, 1);
          else (primitives as Primitive[])[at] = { op: "patch-node", id: primitive.id, before, after };
        }
      }
      return listen();
    },
  };
}

/**
 * A NAME AS THE SEAT READS IT: where its sight keeps a field, a record's
 * label is worked out from the record it is served, so a name that quotes
 * the field neither finds the record nor is said back.
 */
function resolvedFor(store: Store<AnySchema>, arg: Pick<NodeRefArg, "name" | "kinds">, given: string, principal: Principal, found: RefResolution): RefResolution {
  const kept = keptFrom(store as never, principal);
  if (!kept) return found;
  const seen = store.seenBy(principal).graph as unknown as GraphReader<AnyGraphNode>;
  const label = (id: string) => {
    const node = seen.getNode(id);
    return node ? labelOf(store.schema.tryDefinition(node.kind), node as never) : id;
  };
  const key = nameKey(given);
  const named = (id: string) => nameKey(label(id)).startsWith(key);
  if (found.ok) {
    if (found.by === "id") return { ...found, label: label(found.id) };
    return named(found.id) ? { ...found, label: label(found.id), by: nameKey(label(found.id)) === key ? "label" : "prefix" } : refusalFor(store.schema, arg, given, []);
  }
  const candidates = found.candidates.filter((one) => named(one.id)).map((one) => ({ ...one, label: label(one.id) }));
  if (candidates.length === 1) return { ok: true, id: candidates[0]!.id, label: candidates[0]!.label, by: nameKey(candidates[0]!.label) === key ? "label" : "prefix" };
  return refusalFor(store.schema, arg, given, candidates);
}

/*
 * LOADED, IT IS IN FORCE: the seat view keeps fields, an act refuses a
 * write of one, and a name is read as the seat reads it.
 */
FIELD_SIGHT.on = true;
FIELD_SIGHT.lens = fieldLens;
FIELD_SIGHT.keptFrom = keptFrom;
const store = Store.prototype as unknown as {
  sighted(author: Principal | undefined): Compiling;
  resolveRef(arg: Pick<NodeRefArg, "name" | "kinds">, given: string, principal?: Principal): RefResolution;
};
const sighted = store.sighted;
store.sighted = function (this: Store<AnySchema>, author) {
  return compiling(this, author, sighted.call(this, author));
};
const resolveRef = store.resolveRef;
store.resolveRef = function (this: Store<AnySchema>, arg, given, principal = { kind: "human" }) {
  return resolvedFor(this, arg, given, principal, resolveRef.call(this, arg, given, principal));
};

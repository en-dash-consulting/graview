/**
 * `@graview/core/past` — THE APP AS IT STOOD (Roadmap f-playback).
 *
 * `pastOf(store, when)` folds the log to a moment and hands back a store
 * of it, read and never changed; `pastAt` does so under the declaration a
 * host says the moment was made under; `seqAt` says where a time falls.
 * Its own entry, apart from the store and from the timeline
 * (`@graview/core/history`): the provider fetches it when somebody first
 * asks to see the past, so the fold, its kept points and the store it
 * makes are none of a page's weight until then. It imports nothing of the
 * store's or the graph's modules — it makes the past with the store's own
 * classes — since a bundler puts what a fetched part uses of a module a
 * page also reaches in what that page loads first.
 */
import type { Graph } from "./graph/graph.js";
import type { GraphSnapshot } from "./graph/types.js";
import type { DeclarationMark, HistoryHost } from "./history.js";
import type { EvaluateOptions, InvariantDefinition } from "./invariants/types.js";
import type { ModuleMap } from "./modules.js";
import type { Author, Operation } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";
import type { AnySchema, NodeOfSchema } from "./schema/schema.js";
import { seatOf } from "./seat-of.js";
import type { PastDeclaration, Store, StoreOptions } from "./store.js";

/** The declaration a moment was made under: the last mark at or before `seq` that carries one. Absent, the store's own. */
export function declarationAt(marks: readonly DeclarationMark[] | undefined, seq: number): PastDeclaration | undefined {
  let found: PastDeclaration | undefined;
  for (const mark of [...(marks ?? [])].sort((a, b) => a.seq - b.seq)) {
    if (mark.seq > seq) break;
    if (mark.declaration) found = mark.declaration;
  }
  return found;
}

/** What a host says of the declaration at a moment: the one it was made under (absent, the store's own), or that it is still being asked for. */
export type DeclarationAnswer = { readonly declaration: PastDeclaration | undefined } | { readonly waiting: Promise<void> };

/** A mark's declaration as the host answered it, kept per `declarationAt` function and per mark seq. */
type Asked = { settled: boolean; declaration: PastDeclaration | undefined; waiting: Promise<void> };
const ASKED = new WeakMap<NonNullable<HistoryHost["declarationAt"]>, Map<number, Asked>>();

/**
 * THE DECLARATION A MOMENT WAS MADE UNDER, ASKING THE HOST WHEN IT MUST
 * (Roadmap f-declaration-at-lazy): under the last mark at or before `seq`.
 * A mark handed with its declaration is that one, at once. One handed
 * without it is asked of the host (`declarationAt(mark.seq)`) the first
 * time, and `waiting` until the answer comes; an answer of `undefined`,
 * or a failure, is as if it had none — the last declaration handed before
 * it, else the store's own.
 */
export function askDeclaration(host: HistoryHost | undefined, seq: number): DeclarationAnswer {
  const handed = declarationAt(host?.declarations, seq);
  const ask = host?.declarationAt;
  const mark = [...(host?.declarations ?? [])].filter((one) => one.seq <= seq).sort((a, b) => a.seq - b.seq).at(-1);
  if (!ask || !mark || mark.declaration) return { declaration: handed };
  let asks = ASKED.get(ask);
  if (!asks) ASKED.set(ask, (asks = new Map()));
  let asked = asks.get(mark.seq);
  if (!asked) {
    const one: Asked = { settled: true, declaration: undefined, waiting: Promise.resolve() };
    try {
      const answer = ask(mark.seq);
      if (answer instanceof Promise) {
        one.settled = false;
        one.waiting = answer.then(
          (declaration) => void Object.assign(one, { settled: true, declaration }),
          () => void (one.settled = true),
        );
      } else one.declaration = answer;
    } catch {
      // A host that throws asking is a host that did not say.
    }
    asks.set(mark.seq, (asked = one));
  }
  return asked.settled ? { declaration: asked.declaration ?? handed } : { waiting: asked.waiting };
}

/*
 * WHAT THE PAST IS FOLDED WITH: the store's own declaration and options,
 * which it keeps to itself. Read here, apart from the store, so a page that
 * never opens the past carries none of the fold.
 */
interface Opened<S extends AnySchema> {
  readonly invariants: readonly InvariantDefinition<S>[];
  readonly invariantOptions: EvaluateOptions<S>;
  readonly declaredModules: ModuleMap | undefined;
  readonly startingModules: readonly string[] | undefined;
  readonly by: Author | Principal;
  readonly validate: boolean;
  readonly now: () => string;
}
const openedOf = <S extends AnySchema>(store: Store<S>) => store as unknown as Opened<S>;

/** A point a seek folded past, with the id of the op before it, so a log cut back and grown again is not trusted. */
type Mark = { readonly seq: number; readonly id: string | undefined; readonly base: GraphSnapshot };
/** The points each store's past is folded from, oldest first, kept in memory as seeks pass them. */
const MARKS = new WeakMap<object, Mark[]>();
/** The graph where each store's log begins, when no epoch says it, with the id of its first op. */
const REWOUND = new WeakMap<object, { readonly firstId: string | undefined; readonly base: GraphSnapshot }>();

/**
 * THE SEQ A TIME FALLS AT (Roadmap f-playback): every op made at or
 * before `when` is before it. Before the first op the log holds, its
 * horizon; after the last, its length.
 */
export function seqAt(store: Pick<Store<AnySchema>, "log">, when: string | Date): number {
  const time = typeof when === "string" ? Date.parse(when) : when.getTime();
  if (Number.isNaN(time)) throw new RangeError(`“${String(when)}” is not a time`);
  const ops = store.log.all();
  const after = ops.findIndex((op) => Date.parse(op.at) > time);
  return after === -1 ? store.log.length : store.log.horizon + after;
}

/**
 * THE APP AS IT STOOD (Roadmap f-playback): a store read, never changed,
 * holding the graph and the log as they were before `when` — a seq (the
 * ops before it are in, none after), or a time (every op made at or
 * before it). Its graph, its log, its problems and its sight are the
 * past's own: `seenBy` on it serves a seat what that seat could see then,
 * and asked of a seat's view (`seenBy`) it is the past as that seat could
 * see it, never the whole store's. It offers no act — not one declared or
 * derived — and refuses every change (`PastError`).
 *
 * A seek folds from the nearest point it can: an epoch at or before
 * `when`, or a point kept in memory for this store every `pastEvery` ops
 * (`StoreOptions`, default 64) as an earlier seek passed it — never the
 * whole log twice. `declaration` is the one the moment was made under,
 * when a host knows it was another (`pastAt` reads it from the host's
 * marks); absent, the store's own. A seq behind the undo horizon (FR-23)
 * is in the archive, not here, and is refused.
 */
export function pastOf<S extends AnySchema>(store: Store<S>, when: number | string | Date, options: { readonly declaration?: PastDeclaration | undefined } = {}): Store<S> {
  const seat = seatOf(store);
  if (seat) return pastOf(seat.store, when, options).seenBy(seat.principal);
  const inside = openedOf(store);
  const log = store.log;
  const first = log.horizon;
  const seq = typeof when === "number" ? when : seqAt(store, when);
  if (!Number.isInteger(seq) || seq < first || seq > log.length) {
    throw new RangeError(`No moment at seq ${seq}: this store holds seqs ${first} to ${log.length}${first > 0 ? "; what is before its horizon is in the archive" : ""}`);
  }
  const ops = log.all();
  const declared = options.declaration;
  const schema = (declared?.schema ?? store.schema) as S;
  const epochs = log.epochs().filter((epoch) => epoch.seq <= seq);
  const epoch = epochs.at(-1);
  const start = epoch?.seq ?? first;
  // A kept point is trusted while the op before it is the one it was taken after.
  const idBefore = (at: number) => (at > first ? ops[at - 1 - first]?.id : undefined);
  const marks = (MARKS.get(store) ?? []).filter((mark) => mark.seq <= log.length && idBefore(mark.seq) === mark.id);
  MARKS.set(store, marks);
  const mark = [...marks].reverse().find((one) => one.seq >= start && one.seq <= seq);
  const from = mark?.seq ?? start;
  const base = (mark?.base ?? epoch?.base ?? rewound(store)) as GraphSnapshot<NodeOfSchema<S>>;
  // Judged as the store judges, so a default filled in on the way in is filled in again; a base the declaration no longer fits is held as written.
  const Graphs = store.graph.constructor as typeof Graph;
  let graph: Graph<S>;
  try {
    graph = Graphs.from(schema, base, { validate: inside.validate });
  } catch {
    graph = Graphs.from(schema, base, { validate: false });
  }
  const every = store.pastEvery;
  const keep = (after: number, id: string | undefined) => {
    if (marks.some((one) => one.seq === after)) return;
    marks.push({ seq: after, id, base: graph.snapshot() });
    marks.sort((a, b) => a.seq - b.seq);
  };
  for (let next = from; next < seq; next++) {
    const op = ops[next - first]!;
    try {
      fold(graph, op);
    } catch {
      // An op that lands on nothing under this declaration is passed over: the past is shown, never refused.
    }
    if ((next + 1) % every === 0 && next + 1 < seq) keep(next + 1, op.id);
  }
  // A long fold keeps where it ended too, so scrubbing about here folds little.
  if (seq - from >= every) keep(seq, idBefore(seq));
  const at = ops[seq - 1 - first]?.at ?? epoch?.at;
  const given = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : { [key]: value }) as { readonly [P in K]?: V };
  // The store's own class, so this entry imports none of it (`seat-of.ts` says why).
  const Made = store.constructor as new (options: StoreOptions<S>) => Store<S>;
  return new Made({
    schema,
    invariants: (declared?.invariants ?? inside.invariants) as readonly InvariantDefinition<S>[],
    invariantOptions: inside.invariantOptions,
    ...given("policy", declared ? declared.policy : store.policy),
    ...given("modules", declared?.modules ?? inside.declaredModules),
    ...given("enabledModules", inside.startingModules),
    intelligence: store.intelligence,
    principal: inside.by,
    log: ops.slice(0, seq - first),
    epochs,
    ...(first > 0 && !epochs.some((one) => one.horizon) ? { horizon: first } : {}),
    snapshot: graph.snapshot(),
    validate: false,
    now: inside.now,
    past: { seq, ...given("at", at), foldedFrom: from, folded: seq - from },
  });
}

/**
 * THE GRAPH WHERE THE LOG BEGINS, when no epoch says it (Roadmap
 * f-playback): a store reopened with its log and its graph but not the
 * epoch its seed began (a page's browser adapter keeps none) did not
 * begin empty, so the past is not folded from empty. It is the graph
 * after the log — the first epoch past it, else the graph held — with
 * each op's inverse put back, newest first. Kept while the log begins
 * with the same op.
 */
function rewound<S extends AnySchema>(store: Store<S>): GraphSnapshot {
  const ops = store.log.all();
  const first = store.log.horizon;
  const firstId = ops[0]?.id;
  const kept = REWOUND.get(store);
  if (kept && kept.firstId === firstId) return kept.base;
  const later = store.log.epochs().find((epoch) => epoch.seq > first);
  const graph = (store.graph.constructor as typeof Graph).from(store.schema, (later?.base ?? store.graph.snapshot()) as GraphSnapshot<NodeOfSchema<S>>, { validate: false });
  for (let at = (later?.seq ?? store.log.length) - 1; at >= first; at--) {
    try {
      graph.applyPrimitives(ops[at - first]!.inverse, { restoring: true });
    } catch {
      // An inverse that lands on nothing is passed over, as a fold passes over an op that does.
    }
  }
  const base = graph.snapshot();
  REWOUND.set(store, { firstId, base });
  return base;
}

/**
 * The app as it stood at `when`, under the declaration the host says it was
 * made under: `pastOf` with the host's marks read (`askDeclaration`). While
 * the host is still asked for it, the last declaration handed, else the
 * store's own.
 */
export function pastAt<S extends AnySchema>(store: Store<S>, when: number | string | Date, host: HistoryHost = {}): Store<S> {
  const seq = typeof when === "number" ? when : seqAt(store, when);
  const answer = askDeclaration(host, seq);
  return pastOf(store, seq, { declaration: "declaration" in answer ? answer.declaration : declarationAt(host.declarations, seq) });
}

/** One op folded onto a graph as `OperationLog.fold` lands each (`foldOp`): an undo puts back what was there, and a write an older declaration accepted and this one does not is held as written. */
function fold<S extends AnySchema>(graph: Graph<S>, op: Operation): void {
  if (op.undoes !== undefined) {
    graph.applyPrimitives(op.primitives, { restoring: true });
    return;
  }
  try {
    graph.applyPrimitives(op.primitives);
  } catch {
    graph.applyPrimitives(op.primitives, { restoring: true });
  }
}

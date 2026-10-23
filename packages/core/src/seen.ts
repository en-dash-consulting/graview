import type { AnyGraphNode, GraphEdge, GraphNodeBase, GraphReader, GraphSnapshot } from "./graph/types.js";
import type { Violation } from "./invariants/types.js";
import { batchesOf, undoneIn, type Epoch, type LogReading, type OperationLog } from "./ops/log.js";
import { checkUndo } from "./ops/undo.js";
import type { Batch, Operation } from "./ops/types.js";
import type { FieldWriter, Timeline } from "./ops/served.js";
import { writersOf, type Writers } from "./ops/writers.js";
import { namesUnseen, redact, type SeatLens } from "./ops/withheld.js";
import { actingAs, grantsTo, isSystem } from "./permissions/policy.js";
import { FIELD_SIGHT, fieldsJudged, partialSight, recordsOf, sees, type Judged, type Records } from "./permissions/sight.js";
import type { Principal } from "./permissions/types.js";
import { diffSnapshots, type GraphDiff } from "./graph/diff.js";
import { pastOf } from "./past.js";
import { servedThroughFor, type Publishing } from "./publishing.js";

const NOTHING: ReadonlySet<string> = new Set();

/**
 * The kinds kept from a seat because their module is off (FR-12): from
 * every seat but the system itself, which keeps the records and is the
 * one that turns the module on again.
 */
function turnedOff(store: Judged, principal: Principal): ReadonlySet<string> {
  return isSystem(principal) ? NOTHING : (store.modules?.disabledKinds ?? NOTHING);
}

/**
 * WHETHER ANYTHING IS KEPT FROM THIS SEAT: a sight the policy declares
 * (FR-02), or a module the workspace has off (FR-12). When neither, every
 * read is the store's own and nothing needs redacting.
 */
export function hidesFrom(store: Judged, principal: Principal): boolean {
  if (isSystem(principal)) return false;
  return (store.policy?.sees?.length ?? 0) > 0 || turnedOff(store, principal).size > 0;
}

/**
 * WHICH KINDS A SEAT SEES EVERY RECORD OF (FR-55): by a sight that is not
 * only its own (`own`, `via`), with the kind's module on. Asked without a
 * kind, whether it sees every record of every kind — nothing kept from it
 * at all. What an act or an import may mint for the seat, and whether it
 * may ask for an id, turn on it: an id is unique across the whole store,
 * so one minted or asked for where a record the seat may not see could
 * hold it would tell the seat that record is there.
 */
export function seesEveryRecord(store: Judged & { readonly schema: { readonly kinds: readonly string[] } }, author: Principal): (kind?: string) => boolean {
  if (!hidesFrom(store, author)) return () => true;
  const off = store.modules?.disabledKinds ?? NOTHING;
  const sights = store.policy?.sees ?? [];
  const acting = actingAs(author);
  // A sight that shows only some fields shows no record until they can be judged: it fails closed here as in `sees`.
  const judged = fieldsJudged(store);
  const full = (kind: string) => !off.has(kind) && (sights.length === 0 || sights.some((sight) => sight.kinds.includes(kind) && grantsTo(sight, acting) && !sight.own && !sight.via && (judged || !partialSight(sight))));
  const everything = store.schema.kinds.every(full);
  return (kind) => everything || (kind !== undefined && full(kind));
}

/**
 * WHETHER ONE SEAT SEES A RECORD, BY ID — one in the graph by what it is
 * now; one since removed by the kind the log says it was, and so never by
 * an edge it no longer has; and a string that names no record at all (a
 * label in a call's arguments) is nothing to keep from anybody.
 *
 * THE JUDGMENT FOLLOWS THE STORE (FR-51). It reads the policy, the
 * modules that are off and who made each record as it is asked, not as it
 * was taken: one taken before a commit and asked after it knows the record
 * just made is its maker's own. Asking costs nothing more for that — who
 * made what is an index the log keeps as it goes (`recordsOf`).
 */
export function seesId(store: Judged, principal: Principal): (id: string) => boolean {
  return (id) => {
    const off = turnedOff(store, principal);
    if (!store.policy?.sees?.length && off.size === 0) return true;
    const records = recordsOf(store.log);
    const node = store.graph.getNode(id);
    if (node) return !off.has(node.kind) && sees(store.policy, principal, node, store.graph, records, fieldsJudged(store));
    const kind = records.kindOf(id) ?? unplaced(store, records, id);
    if (kind === undefined) return true;
    return !off.has(kind) && sees(store.policy, principal, { id, kind }, { out: () => [], in: () => [] }, records, fieldsJudged(store));
  };
}

const NO_LINKS = { out: () => [], in: () => [] };

/**
 * THE KIND AN ID THE LOG CANNOT PLACE MAY BE OF (FR-199). A store opened
 * on a checkpoint that keeps what each record removed behind it was knows
 * every record it ever held, and a string it cannot place names none. One
 * opened on a checkpoint written before that (`Records.knowsAll` false)
 * cannot tell a record made and removed behind its horizon from no record
 * at all, so it fails closed: an id that begins with a kind the app
 * declares (`secret:s0`) is judged as a record of that kind removed — kept
 * from a seat that may not see every record of it, as the record would be.
 * A store that holds only what its host served one seat (`openRemote`'s,
 * `FIELD_SIGHT.served`) was judged there, and shows what it holds.
 */
function unplaced(store: Judged, records: Records, id: string): string | undefined {
  if (records.knowsAll || FIELD_SIGHT.served.has(store)) return undefined;
  const colon = id.indexOf(":");
  if (colon <= 0) return undefined;
  const kind = id.slice(0, colon);
  return store.schema?.tryDefinition(kind) ? kind : undefined;
}

/**
 * ONE SEAT'S SIGHT AS OF NOW, each id judged once: `seesId` for a reading
 * of the store that does not change while it is read. What is off, the
 * records the log knows and each answer are taken once here, where
 * `seesId` reads them again for every id — a served log asks of every
 * string in every op, and most are the same few ids.
 */
function pinnedSight(store: Judged, principal: Principal, judged: Map<string, boolean> = new Map(), unnamed?: Set<string>): (id: string) => boolean {
  const off = turnedOff(store, principal);
  if (!store.policy?.sees?.length && off.size === 0) return () => true;
  const records = recordsOf(store.log);
  return (id) => {
    const held = judged.get(id);
    if (held !== undefined) return held;
    let seen: boolean;
    const node = store.graph.getNode(id);
    if (node) seen = !off.has(node.kind) && sees(store.policy, principal, node, store.graph, records, fieldsJudged(store));
    else {
      const kind = records.kindOf(id) ?? unplaced(store, records, id);
      // A string that names no record is nothing to keep, and not judged: most strings in a log are not ids. A caller that keeps a reading is told it was asked.
      if (kind === undefined) {
        unnamed?.add(id);
        return true;
      }
      seen = !off.has(kind) && sees(store.policy, principal, { id, kind }, NO_LINKS, records, fieldsJudged(store));
    }
    judged.set(id, seen);
    return seen;
  };
}

/** Whether a kind's field may be left off a record: declared optional, or not declared at all. Unknown kinds keep every field. */
function optionalIn(schema: Judged["schema"]): (kind: string, field: string) => boolean {
  const known = new Map<string, boolean>();
  return (kind, field) => {
    const key = `${kind}\u0000${field}`;
    let optional = known.get(key);
    if (optional === undefined) {
      const shape = (schema?.tryDefinition(kind)?.fields as { shape?: Record<string, { safeParse?(value: unknown): { success: boolean } }> } | undefined)?.shape;
      const declared = shape?.[field];
      optional = shape !== undefined && (declared === undefined || declared.safeParse?.(undefined).success === true);
      known.set(key, optional);
    }
    return optional;
  };
}

/**
 * WHAT ONE SEAT IS SERVED (FR-55) — the judgment every surface built on
 * the seat view reads, so a snapshot, a log, an answer and the wire cannot
 * disagree about it.
 *
 * Its sight (`seesId`) says which records it may be told of. An id is
 * minted from a label, so a seen record's field that holds the id of one
 * it may not see tells it that record's name: such a field is CLEARED in
 * what the seat is served — the record stays, usable, without it — when
 * the kind's declaration lets a record be without it. When the field is
 * one the record cannot do without, clearing it would serve a record that
 * fails its own declaration, and a client refuses to load that: the record
 * is WITHHELD from the seat whole instead, as if its sight did not reach
 * it — not in the graph, the snapshot, the log's primitives or an edge.
 * Which ids a field names is judged by the seat's sight alone, so a record
 * naming one withheld this way still names a record the seat may see.
 */
export function seatLens(store: Judged, principal: Principal): SeatLens {
  return lensFor(store, principal).lens;
}

/** What a pinned lens judged: each id's sight and whether each is served, kept for a reading that goes on (`logSeenBy`). */
interface Judgments {
  readonly judged: Map<string, boolean>;
  readonly shown: Map<string, boolean>;
  /** Strings it was asked about that named no record then: one a record takes later is a name it must judge again. */
  readonly unnamed?: Set<string>;
}

/** Nothing judged yet. */
const fresh = (): Judgments => ({ judged: new Map(), shown: new Map() });

/** A seat's lens, and a way to pin it over judgments the caller keeps. */
function lensFor(store: Judged, principal: Principal): { readonly lens: SeatLens; readonly pinWith: (memo: Judgments) => SeatLens } {
  const optional = optionalIn(store.schema);
  /*
   * A SEAT IS SERVED ITS OWN WORDS (FR-55). A field whose value this seat
   * wrote — or the person an agent acts for — is served as written, though
   * it name a record the seat may not see: saying back what a seat said
   * tells it nothing, and judging it like anybody else's would tell a seat
   * that guessed an id whether the guess was real.
   */
  const actor = isSystem(principal) ? undefined : actingAs(principal).id;
  const length = (): number => (store.log as { readonly length?: number }).length ?? store.log.all().length;
  // The same record served the same way is the same object, so a view read twice is equal by identity.
  const cleared = new WeakMap<object, { readonly without: string; readonly node: unknown }>();
  const graph = store.graph;
  /**
   * The lens over one sight: the seat's own, which follows the store as it
   * is asked, or one pinned to now (`pin`), which judges each id and each
   * record once and is thrown away after the reading it was made for.
   */
  const over = (sees: (id: string) => boolean, writers: () => Writers, now: () => number, kindOf: (id: string) => string | undefined, pinned?: Judgments): SeatLens => {
    const servedWith = <N extends { readonly id: string; readonly kind: string }>(node: N, writer: FieldWriter): N | undefined => {
      if (!sees(node.id)) return undefined;
      let without: string[] | undefined;
      for (const field in node) {
        if (!Object.hasOwn(node, field) || field === "id" || field === "kind" || !namesUnseen(node[field], sees)) continue;
        if (actor !== undefined && writer(field) === actor) continue;
        if (!optional(node.kind, field)) return undefined;
        (without ??= []).push(field);
      }
      if (!without) return node;
      const key = without.join("\u0000");
      const held = cleared.get(node);
      if (held?.without === key) return held.node as N;
      const out = Object.fromEntries(Object.entries(node).filter(([field]) => !without.includes(field))) as N;
      cleared.set(node, { without: key, node: out });
      return out;
    };
    const judge = <N extends { readonly id: string; readonly kind: string }>(node: N): N | undefined => {
      const at = now();
      return servedWith(node, (field) => writers().writerAt(node.id, field, at));
    };
    // Pinned, a record is served once however often the reading asks for it: no record or id changes under a pin.
    const servedOnce = new WeakMap<object, { readonly node: unknown }>();
    const served = pinned
      ? <N extends { readonly id: string; readonly kind: string }>(node: N): N | undefined => {
          let held = servedOnce.get(node);
          if (!held) servedOnce.set(node, (held = { node: judge(node) }));
          return held.node as N | undefined;
        }
      : judge;
    const showsNow = (id: string): boolean => {
      if (!sees(id)) return false;
      const node = graph.getNode(id);
      return node === undefined || served(node) !== undefined;
    };
    const shown = pinned?.shown ?? new Map<string, boolean>();
    const shows = pinned
      ? (id: string): boolean => {
          let held = shown.get(id);
          if (held === undefined) shown.set(id, (held = showsNow(id)));
          return held;
        }
      : showsNow;
    const timeline: Timeline | undefined =
      graph.outEdges && graph.inEdges
        ? {
            present: {
              getNode: (id) => graph.getNode(id) as AnyGraphNode | undefined,
              outEdges: (id) => graph.outEdges!(id),
              inEdges: (id) => graph.inEdges!(id),
            },
            log: store.log as Timeline["log"],
            get writers() {
              return writers();
            },
          }
        : undefined;
    const lens: SeatLens = {
      sees,
      shows,
      served,
      servedWith,
      optional,
      kindOf,
      ...(actor !== undefined ? { actor } : {}),
      ...(timeline ? { timeline } : {}),
      hides: () => hidesFrom(store, principal),
      // A pinned lens is already of one moment: pinning it again is itself.
      pin: pinned ? () => lens : () => pinWith(fresh()),
    };
    // Keeping what its sight keeps of a record's fields, when field sight is loaded (Roadmap f-field-sight).
    return FIELD_SIGHT.lens?.(lens, store, principal) ?? lens;
  };
  function pinWith(memo: Judgments): SeatLens {
    // Who wrote what is read only when a field names what the seat may not see: a seat that sees all of it never asks.
    let writers: Writers | undefined;
    const at = length();
    const records = recordsOf(store.log);
    return over(pinnedSight(store, principal, memo.judged, memo.unnamed), () => (writers ??= writersOf(store.log as never)), () => at, (id) => graph.getNode(id)?.kind ?? records.kindOf(id), memo);
  }
  const lens = over(
    seesId(store, principal),
    () => writersOf(store.log as never),
    length,
    (id) => graph.getNode(id)?.kind ?? recordsOf(store.log).kindOf(id),
  );
  return { lens, pinWith };
}

/**
 * ONE SEAT'S SERVED LOG, KEPT WITH WHAT SERVING IT READ. Redacting a long
 * log judges every string in every op, so a log that only grew is served
 * from what was served before it grew, and its new ops are judged alone —
 * when nothing the old ops were judged by can have moved:
 *
 *   - the log still holds the ops it was served from, at the same horizon,
 *     and the same modules are off;
 *   - every id a new op touches (a record it adds, removes, patches or
 *     links) is seen, and served, as it was: a sight follows a record's
 *     own links, kind and maker, and only an op touching it moves those;
 *   - and no record a new op adds or touches has an id the old ops were
 *     judged to name nothing by — an id that names nothing is nobody's to
 *     keep, and one that names a hidden record is (`UNNAMED`).
 *
 * Otherwise the whole log is served again. The moments a served op is
 * judged at are the log's own up to it, which later ops do not change.
 */
interface ServedLog {
  readonly horizon: number;
  readonly off: string;
  readonly length: number;
  readonly last: Operation | undefined;
  readonly ops: readonly Operation[];
  readonly judgments: Judgments;
}

const SERVED_LOGS = new WeakMap<object, Map<string, ServedLog>>();

/**
 * EVERY STRING A SERVED LOG'S READING ASKED ABOUT THAT NAMED NO RECORD THEN,
 * for every seat served from the log: an id a record takes later is one
 * an op served before may name. A string never asked about changed nothing
 * any seat was served — a withheld op drops its sentence, its call and its
 * author unread — so these are all the names that can come to matter.
 * Shared by the seats, so a name one seat asked about only ever sends
 * another to serve its log again; never fewer.
 */
const UNNAMED = new WeakMap<object, Set<string>>();

/** The ids a primitive touches, links' ends among them: what can move a record's sight. */
const touchedIds = (ops: readonly Operation[]): Set<string> => {
  const ids = new Set<string>();
  for (const op of ops) {
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node" || primitive.op === "remove-node") ids.add(primitive.node.id);
      else if (primitive.op === "patch-node") ids.add(primitive.id);
      else {
        ids.add(primitive.edge.from);
        ids.add(primitive.edge.to);
      }
    }
  }
  return ids;
};

/** The store's log as one seat may read it: every op in its place, the ones it may not see withheld (FR-16), and no id it may not see in any of them (FR-55). */
export function logSeenBy(store: Judged, principal: Principal): readonly Operation[] {
  if (!hidesFrom(store, principal)) return store.log.all();
  const all = store.log.all();
  const length = (store.log as { readonly length?: number }).length ?? all.length;
  const horizon = length - all.length;
  const off = [...turnedOff(store, principal)].sort().join("\u0000");
  const key = seatKey(principal);
  let seats = SERVED_LOGS.get(store.log);
  if (!seats) SERVED_LOGS.set(store.log, (seats = new Map()));
  const held = seats.get(key);
  const { pinWith } = lensFor(store, principal);
  let unnamed = UNNAMED.get(store.log);
  if (!unnamed) UNNAMED.set(store.log, (unnamed = new Set()));
  const grown = held !== undefined && held.horizon === horizon && held.off === off && held.length <= length && (held.length === horizon || all[held.length - 1 - horizon] === held.last);
  if (held && grown) {
    if (held.length === length) return held.ops;
    const added = all.slice(held.length - horizon);
    // Judged afresh, to compare with what serving the old ops read.
    const now = pinWith(fresh());
    let still = true;
    const touched = touchedIds(added);
    for (const id of touched) {
      const sight = held.judgments.judged.get(id);
      const served = held.judgments.shown.get(id);
      if ((sight !== undefined && now.sees(id) !== sight) || (served !== undefined && now.shows(id) !== served)) {
        still = false;
        break;
      }
    }
    if (still) {
      // A record new to the log that an op already served named, when it named nothing: that name may be one to keep now.
      for (const id of touched) {
        if (unnamed.has(id)) {
          still = false;
          break;
        }
      }
    }
    if (still) {
      // What the old ops read stands: the new ones are judged over it, and what they read is kept with it.
      const ops = [...held.ops, ...redact(added, pinWith(held.judgments))];
      const served: ServedLog = { horizon, off, length, last: all.at(-1), ops, judgments: held.judgments };
      seats.set(key, served);
      return ops;
    }
  }
  const judgments: Judgments = { ...fresh(), unnamed };
  const ops = redact(all, pinWith(judgments));
  seats.set(key, { horizon, off, length, last: all.at(-1), ops, judgments });
  return ops;
}

/** Whether a rule's finding or violation is one a seat may be told: about records it is served, naming none it may not see. */
function violationShown(lens: SeatLens, has: (id: string) => boolean, violation: Pick<Violation, "subjectId" | "nodeIds">): boolean {
  return (
    (violation.subjectId === undefined || !has(violation.subjectId) || lens.shows(violation.subjectId)) &&
    violation.nodeIds.every((id) => !has(id) || lens.shows(id)) &&
    !namesUnseen(violation, lens.sees)
  );
}

/** A log reading over a seat's redacted ops, for `checkUndo`. */
export function readingOf(ops: readonly Operation[], epochs: LogReading["epochs"]): LogReading {
  return { all: () => ops, undoneIds: () => undoneIn(ops), epochs };
}

const VIEWS = new WeakMap<object, Map<string, unknown>>();

/**
 * A seat, keyed by the seat the policy judges: an agent for Nick is not the
 * same agent alone. It is everything serving reads of the principal — its
 * kind, the id and roles sight is judged by (`actingAs`), and whether it
 * acts for somebody — and nothing it does not (a session, a name), so two
 * tabs of one seat share what they are served.
 */
function seatKey(principal: Principal): string {
  const judged = isSystem(principal) ? principal : actingAs(principal);
  // An agent's own id too: two agents for one person are two seats, and each view answers as its own (`seenFor`, `wouldChange`, `preview`).
  return `${principal.kind}|${judged.id ?? ""}|${(judged.roles ?? []).join(",")}|${principal.onBehalfOf ? `for:${principal.id ?? ""}` : ""}`;
}

/**
 * WHERE A SEAT'S VIEW IS SERVED THROUGH (`servedSeq`): the head, for a seat
 * of a live app and a collaborator of one that publishes — the view reads
 * its store as it grows — or what was published, for a reader of one
 * (`servedBehind`), which moves when a publish does. The store a seat's
 * view is of, the module reading what is off and the policy are each the
 * store's own, so the view's key is the seat and this.
 */
const viewKey = (principal: Principal, served: "head" | "published"): string => `${seatKey(principal)}@${served}`;

const bound = (target: object, prop: PropertyKey): unknown => {
  const value = Reflect.get(target, prop, target);
  return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
};

/**
 * THE APP AS THIS SEAT IS SERVED IT.
 *
 * Every surface reads `store.graph` — the scene, the pages, Find, the
 * chat, an agent's tools — and none of them asked who was looking: a
 * storefront showed a stranger every customer's name, email and finance
 * question, because a policy could only say who may ACT. With the policy's
 * `sees` declared, this is the store a surface is handed: its graph, its
 * log, its history and its problems hold only what the principal may see,
 * and every act still goes to the store itself, judged there — at the
 * head — as always. With no `sees`, it is the store, unchanged.
 *
 * What a seat is served is not promised to be the head: it is served
 * through `servedSeq`, which is the head today and which a policy may set
 * behind it (docs/stability.md, "Served state and the head"). Nor is it
 * promised to be one object per principal: the view is kept to save
 * judging again, keyed by what serving depends on (`viewKey`).
 */
/** The key a seat's view answers with the store it is of and the seat (`seatOf`, `@graview/core/seat-of`'s reading of it). */
const SEAT = Symbol.for("@graview/core:seat");

/**
 * WHAT A SEAT'S VIEW IS A VIEW OF: a store as `seenBy` reads it — beyond
 * what judges its sight, its graph and its log whole, which the view serves
 * through, and the reads the view answers again over what the seat sees.
 * Asked by its shape, so this module needs nothing of the store's, which
 * hands every seat its view through this one; the view has the store's type.
 */
export interface Viewed extends Judged {
  readonly graph: Omit<GraphReader<GraphNodeBase>, "nodesOfKind"> & { nodesOfKind(kind: never, options?: never): readonly GraphNodeBase[]; snapshot(): GraphSnapshot<GraphNodeBase>; outEdges(id: string): readonly GraphEdge[]; inEdges(id: string): readonly GraphEdge[] };
  readonly log: OperationLog;
  violations(context: never, over: never): readonly Pick<Violation, "subjectId" | "nodeIds">[];
  findings(): readonly { readonly id: string }[];
  wouldChange(call: never, author: Principal): unknown;
  preview(call: never, context: never, options: { readonly author: Principal }): unknown;
  checkpoint(options?: never): Epoch | undefined;
  readonly publishing?: Publishing | undefined;
  readonly publishedSeq?: number | undefined;
  subscribe(listener: never): () => void;
}

/** How a seat asks to be served: as it is (the default), or — a collaborator previewing — as readers are, `"published"`. */
export interface SeenOptions {
  readonly as?: "head" | "published";
}

export function seenBy<T extends Viewed>(store: T, principal: Principal, options: SeenOptions = {}): T {
  // A reader of an app that publishes is served what was published (Roadmap f-publishing-lifecycle).
  if (store.publishing?.mode === "on-publish" && servedThroughFor(store.publishing, store.publishedSeq, store.log.horizon, principal, options.as) !== undefined) return servedBehind(store, principal);
  return seatView(store, principal);
}

/** The reads a reader's view answers from what was published; every other, and every write, is the head's. */
const PUBLISHED_READS = new Set<PropertyKey>(["graph", "log", "snapshot", "batches", "violations", "findings", "canUndo", "servedSeq", "checkpoint"]);

/**
 * THE APP AS A READER IS SERVED IT, in an app that publishes (Roadmap
 * f-publishing-lifecycle): its graph, log, problems and history are those
 * of the app as it stood at the last publish (`pastOf`), as the seat may
 * see it; and every act, preview and permission still goes to the store
 * and is judged at the head, where what the reader writes lands — read by
 * readers when it is next published. It follows the published seq as a
 * publish (or the undo of one) moves it, and tells its subscribers only
 * when it does, with the change between the two.
 */
function servedBehind<T extends Viewed>(store: T, principal: Principal): T {
  const views = viewsOf(store);
  const key = viewKey(principal, "published");
  const held = views.get(key);
  if (held) return held as T;
  const head = seatView(store, principal);
  let kept: { readonly seq: number; readonly id: string | undefined; readonly view: T } | undefined;
  const now = (): T => {
    const seq = servedThroughFor(store.publishing, store.publishedSeq, store.log.horizon, principal, "published") ?? store.log.length;
    if (seq >= store.log.length) return head;
    const id = store.log.all()[seq - 1 - store.log.horizon]?.id;
    if (kept?.seq !== seq || kept.id !== id) kept = { seq, id, view: seatView(pastOf(store as never, seq) as unknown as T, principal) };
    return kept.view;
  };
  const seqOf = (served: T): number => (served as unknown as { readonly servedSeq: number }).servedSeq;
  const subscribe = (listener: (diff: GraphDiff<never>, ops: readonly Operation[]) => void) => {
    let from = seqOf(now());
    let shot = now().graph.snapshot();
    return store.subscribe((() => {
      const served = now();
      const to = seqOf(served);
      if (to === from) return;
      const after = served.graph.snapshot();
      const ops = to > from ? served.log.all().filter((op) => op.seq >= from) : [];
      const diff = diffSnapshots(shot as never, after as never) as GraphDiff<never>;
      [from, shot] = [to, after];
      listener(diff, ops);
    }) as never);
  };
  const view = new Proxy(head, {
    get(target, prop) {
      switch (prop) {
        case SEAT:
          return { store, principal };
        case "subscribe":
          return subscribe;
        case "seenBy":
          return (other: Principal, options?: SeenOptions) => seenBy(store, other, options);
        case "seenFor":
          return principal;
        default:
          return PUBLISHED_READS.has(prop) ? bound(now(), prop) : bound(target, prop);
      }
    },
  });
  views.set(key, view);
  return view as T;
}

function viewsOf(store: object): Map<string, unknown> {
  let views = VIEWS.get(store);
  if (!views) VIEWS.set(store, (views = new Map()));
  return views;
}

/** The app as a seat is served it at the head: what its sight reaches, as the store grows. */
function seatView<T extends Viewed>(store: T, principal: Principal): T {
  // A module off keeps its kinds from every seat as a sight would (FR-12); the view reads which are off as it goes. The system is kept from nothing.
  if (!hidesFrom(store, principal)) return store;
  const key = viewKey(principal, "head");
  const views = viewsOf(store);
  const held = views.get(key);
  if (held) return held as T;

  const full = store.graph;
  /*
   * WHAT THIS SEAT IS SERVED (FR-55): a record its sight reaches, with any
   * field that names one it may not see cleared — or, when that field is
   * one the record cannot do without, not the record at all.
   */
  const lens = seatLens(store as never, principal);
  /**
   * HOW ONE READING JUDGES: a single record by the lens, which follows the
   * store; a whole graph, a snapshot or a neighborhood by the lens pinned
   * for that one reading, each id and record judged once in it.
   */
  const judging = (seat: SeatLens) => {
    const served = <N>(node: N | undefined): N | undefined => (node === undefined ? undefined : (seat.served(node as never) as N | undefined));
    const seenNode = (node: { id: string; kind: string } | undefined): boolean => served(node) !== undefined;
    const seenId = (id: string): boolean => seenNode(full.getNode(id) as never);
    const seenEdge = (edge: GraphEdge): boolean => seenId(edge.from) && seenId(edge.to) && !namesUnseen(edge, seat.sees);
    const servedAll = <N>(nodes: readonly N[]): N[] => nodes.flatMap((node) => served(node) ?? []);
    return { served, seenNode, seenId, seenEdge, servedAll };
  };
  const { served, seenId } = judging(lens);
  const pinned = () => judging(lens.pin?.() ?? lens);
  /** A graph of another moment — an epoch's base, at `seq` — as this seat is served it: its records, as who wrote them then, and its links between them. */
  const servedGraph = (snapshot: GraphSnapshot, seq: number): GraphSnapshot => {
    const writers = writersOf(store.log as never);
    const seat = lens.pin?.() ?? lens;
    const nodes = snapshot.nodes.flatMap((node) => seat.servedWith(node, (field) => writers.writerAt(node.id, field, seq)) ?? []);
    const kept = new Set(nodes.map((node) => node.id));
    return { nodes, edges: snapshot.edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to) && !namesUnseen(edge, seat.sees)) };
  };
  /**
   * AN EPOCH AS THIS SEAT IS SERVED IT: its base as the seat was served it
   * then, and who made each record (`creators`, which a checkpoint carries
   * so a seat's own records stay its own past a compaction) only for the
   * records in that base — a record the seat is not served is not named in
   * the map either, by its id or by its maker's (FR-55). The store keeps
   * the whole map for its own judgment.
   */
  const servedEpoch = <E extends { readonly seq: number; readonly base: GraphSnapshot; readonly creators?: Readonly<Record<string, string>>; readonly removed?: unknown; readonly writers?: unknown }>(epoch: E): E => {
    // What each record removed behind a checkpoint was, and who wrote what, are the store's own to judge by, never the seat's (FR-199): they name every record.
    const { removed: _removed, writers: _writers, ...rest } = epoch;
    const base = servedGraph(epoch.base, epoch.seq);
    if (!epoch.creators) return { ...rest, base } as unknown as E;
    const kept = new Set(base.nodes.map((node) => node.id));
    const creators = Object.fromEntries(Object.entries(epoch.creators).filter(([id, maker]) => kept.has(id) && !namesUnseen(maker, lens.sees)));
    return { ...rest, base, creators } as unknown as E;
  };
  /** An epoch as this seat is served it, when there is one. */
  const servedIf = <E extends Parameters<typeof servedEpoch>[0]>(epoch: E | undefined) => epoch && servedEpoch(epoch);
  /*
   * THE LOG, REDACTED RATHER THAN GAPPED (FR-16): every op in its place,
   * and one that touched what this seat may not see withheld — so the log
   * still loads, folds and undoes, and says something happened there.
   */
  const ops = (): readonly Operation[] => logSeenBy(store as never, principal);
  const reading = (): LogReading => readingOf(ops(), () => store.log.epochs());

  const graph = new Proxy(full, {
    get(target, prop) {
      switch (prop) {
        case "getNode":
          return (id: string) => served(target.getNode(id));
        case "has":
          return seenId;
        /*
         * Each read as the graph's own, its arguments handed on — a read that
         * lists records says which (FR-173) — and what comes back served:
         * records as this seat may see them, links between records it sees,
         * and nothing reached from a record it may not.
         */
        case "allNodes":
        case "nodesOfKind":
          return (...args: never[]) => pinned().servedAll((target[prop] as (...args: never[]) => GraphNodeBase[])(...args));
        case "count":
          return (...args: Parameters<typeof target.nodesOfKind>) => pinned().servedAll(target.nodesOfKind(...args)).length;
        case "allEdges":
        case "edgesOfKind":
        case "outEdges":
        case "inEdges":
          return (...args: never[]) => (target[prop] as (...args: never[]) => GraphEdge[])(...args).filter(pinned().seenEdge);
        case "out":
        case "in":
        case "neighbors":
          return (id: string, ...rest: never[]) => {
            const now = pinned();
            return now.seenId(id) ? now.servedAll((target[prop] as (id: string, ...rest: never[]) => GraphNodeBase[])(id, ...rest)) : [];
          };
        case "snapshot":
          return () => {
            const snapshot = target.snapshot();
            const now = pinned();
            return { ...snapshot, nodes: now.servedAll(snapshot.nodes), edges: snapshot.edges.filter(now.seenEdge) };
          };
        case "size": {
          const now = pinned();
          return { nodes: now.servedAll(target.allNodes({ archived: "all" })).length, edges: target.allEdges({ archived: "all" }).filter(now.seenEdge).length };
        }
        default:
          return bound(target, prop);
      }
    },
  });

  const batches = (): Batch[] => {
    const all = ops();
    return batchesOf(all, undoneIn(all));
  };
  const log = new Proxy(store.log, {
    get(target, prop) {
      switch (prop) {
        case "all":
        case "toJSON":
          return () => [...ops()];
        // Each epoch's base as this seat is served it, so its log folds from there to what it is served (FR-55).
        case "epochs":
          return () => target.epochs().map(servedEpoch);
        case "lastEpoch":
          return () => servedIf(target.lastEpoch());
        case "live":
          return () => {
            const all = ops();
            const undone = undoneIn(all);
            return all.filter((op) => !undone.has(op.id));
          };
        case "get":
          return (id: string) => ops().find((op) => op.id === id);
        case "opsInBatch":
          return (batch: string) => ops().filter((op) => op.batch === batch);
        case "batches":
          return batches;
        default:
          return bound(target, prop);
      }
    },
  });

  const view = new Proxy(store, {
    get(target, prop) {
      switch (prop) {
        // Whose view this is (`seatOf`): read by what reads a store from outside it — the past, the suggestions — without importing this module.
        case SEAT:
          return { store: target, principal };
        case "graph":
          return graph;
        case "log":
          return log;
        case "snapshot":
          // The graph's own, as this seat is served it: the proxy hands a function that needs no `this`.
          return (graph as unknown as { snapshot(): unknown }).snapshot;
        case "batches":
          return batches;
        // Judged over what this seat sees, so the sentence never names a change it may not (FR-16).
        case "canUndo":
          return (batchIds: string | readonly string[]) => checkUndo(reading(), typeof batchIds === "string" ? [batchIds] : batchIds);
        /*
         * JUDGED OVER WHAT THIS SEAT SEES, its lines and its facts with it,
         * as a page served only what its seat sees judges (FR-55): over the
         * whole graph, a rule that counts what the seat may not see is
         * broken, and says "3 proposed", to a seat that sees one. A record it
         * may not see never makes, mends or words one of its problems.
         */
        case "violations":
          return (context?: never) => target.violations(context as never, graph as never).filter((violation) => violationShown(lens, (id) => full.has(id), violation));
        // What no longer fits, about records this seat is served and naming none it may not see (FR-55).
        case "findings":
          return () =>
            target.findings().filter((finding) => {
              const ids = finding.id.includes("->") ? finding.id.split("->").map((end, at) => (at === 0 ? end.slice(end.indexOf(":") + 1) : end)) : [finding.id];
              return ids.every((id) => !full.has(id) || seenId(id)) && !namesUnseen(finding, lens.sees);
            });
        // An act asked about through the view runs under its sight, as it would when applied.
        case "wouldChange":
          return (call: never) => target.wouldChange(call, principal);
        case "preview":
          return (call: never, context?: never, options?: object) => target.preview(call, context as never, { author: principal, ...options });
        case "seenBy":
          return (other: Principal, options?: SeenOptions) => seenBy(target, other, options);
        case "seenFor":
          return principal;
        // Where what this seat is served ends: the store's own (`servedSeq`) — its head, or a past's seq; never set through the view.
        case "servedSeq":
          return (target as unknown as { servedSeq: number }).servedSeq;
        // A checkpoint taken through the seat's view is the one it is served.
        case "checkpoint":
          return (options?: never) => servedIf(target.checkpoint(options));
        default:
          return bound(target, prop);
      }
    },
  });
  views.set(key, view);
  return view;
}


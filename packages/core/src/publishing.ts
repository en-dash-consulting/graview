/**
 * `@graview/core/publishing` — HOW AN APP THAT PUBLISHES IS SERVED
 * (Roadmap f-publishing-lifecycle).
 *
 * An app declared `publishing: { mode: "on-publish" }` serves the head to
 * its `working` roles and, to every other seat, the app as it stood at the
 * last publish. A live app needs none of that, so it lives here, apart
 * from `@graview/core`: loaded, it teaches the store the `publish` act and
 * its published seq, and `seenBy` how to serve a reader (`PUBLISHING`).
 * Until it is, a store of such an app offers no `publish`, says no
 * published seq (a checkpoint then holds the whole log), and refuses to
 * serve a reader — it fails closed, never handing a reader the head.
 *
 * A host that serves seats loads it — `@graview/ship`'s server entry and
 * live protocol, `@graview/pages/static`, `@graview/core/linked`, the
 * command line and the agent tools import it. A page fetches it with
 * `@graview/core/past`, which imports it, since a reader's view folds the
 * past: `GraviewProvider` fetches that before it draws an app that
 * publishes, and a live app's page carries none of it.
 */
import type { GraphDiff } from "./graph/diff.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { OperationLog } from "./ops/log.js";
import type { Operation } from "./ops/types.js";
import { pastOf } from "./past.js";
import type { Principal, Refusal } from "./permissions/types.js";
import type { Publishing, PublishingServed } from "./publish.js";
import type { AnySchema } from "./schema/schema.js";
import type { SeenOptions, Viewed } from "./seen.js";

/** The store's and the seat view's own (`publish.ts`), found by its key: nothing of a page's first chunk is imported here. */
const PUBLISHING: PublishingServed = ((globalThis as Record<symbol, PublishingServed | undefined>)[Symbol.for("@graview/core:publishing")] ??= {});
/** What the seat view lends, once its module has run — which it has wherever a store is served. */
const kit = () => PUBLISHING.kit!;

/*
 * Written out here rather than imported where they are kept (`PUBLISH`,
 * `onPublish`, the seat view's key and `bound`), so a page that fetches
 * this asks its first chunk for as few names as it can.
 */
const NAME = "publish";
const publishes = (publishing: Publishing | undefined): publishing is Publishing => publishing?.mode === "on-publish";
const SEAT = Symbol.for("@graview/core:seat");
const bound = (target: object, prop: PropertyKey): unknown => {
  const value = Reflect.get(target, prop, target);
  return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
};

/**
 * "PUBLISH": no record is its subject and it makes none. Its one argument,
 * `through`, publishes through an earlier seq; absent, everything to the
 * head. The store writes its op itself (`publishedThrough`), so its body
 * is never run; offered, as the store offers it, to `publishers`.
 */
let made: object | undefined;
const act = (): object => (made ??= { name: NAME, title: "Publish", description: "Publish what collaborators have changed, so readers see it.", input: PUBLISHING.input!(), apply() {} });
export const publishMutation = <S extends AnySchema>(): AnyMutationDefinition<S> => act() as unknown as AnyMutationDefinition<S>;

/** What of a store publishing reads and writes: its declaration, its log, and whether it is a past. */
type Held = { readonly publishing: Publishing | undefined; readonly past?: unknown; readonly log: OperationLog };

/**
 * HOW FAR READERS ARE SERVED: the `publishedThrough` of the last publish
 * op that stands (an undone one does not — undoing a publish takes readers
 * back to the one before), or `undefined` when nothing was ever published.
 * Kept per log while its length and last op are the ones it was read at.
 */
const READ = new WeakMap<object, { readonly length: number; readonly last: string | undefined; readonly seq: number | undefined }>();
export function publishedSeqOf(log: Pick<OperationLog, "all" | "undoneIds">): number | undefined {
  const ops = log.all();
  const last = ops.at(-1)?.id;
  const held = READ.get(log);
  if (held && held.length === ops.length && held.last === last) return held.seq;
  let seq: number | undefined;
  let undone: Set<string> | undefined;
  for (let at = ops.length - 1; at >= 0; at--) {
    const op = ops[at]!;
    if (op.publishedThrough === undefined || (undone ??= log.undoneIds()).has(op.id)) continue;
    seq = op.publishedThrough;
    break;
  }
  READ.set(log, { length: ops.length, last, seq });
  return seq;
}

/** Who may publish: a refusal in a sentence when this principal may not — whoever holds none of `publishers` (else `working`), the system aside. */
export function publishRefusal(publishing: Publishing | undefined, principal: Principal): Refusal | undefined {
  if (!publishes(publishing)) return { mutation: NAME, message: "this app is live: every edit reaches its readers as it is made, so there is nothing to publish.", wouldNeed: [] };
  const roles = publishing.publishers ?? publishing.working;
  if (!kit().reads({ mode: "on-publish", working: roles }, principal)) return undefined;
  return { mutation: NAME, message: `only ${roles.join(", ") || "nobody"} may publish.`, wouldNeed: [...roles] };
}

/**
 * THE MARKER A PUBLISH IS: one op that touches no record and says how far
 * readers are served — through itself, or through `through` when the call
 * names an earlier seq the store holds — appended to the store's log.
 */
const publishOp: NonNullable<typeof PUBLISHING.op> = (held, made, call, batch, author, options) => {
  const { log } = held as Held;
  const seq = log.length;
  const asked = call.args["through"];
  if (asked !== undefined && (!Number.isInteger(asked) || (asked as number) < log.horizon || (asked as number) > seq)) {
    throw new RangeError(`Cannot publish through seq ${String(asked)}: this store holds seqs ${log.horizon} to ${seq}.`);
  }
  const through = (asked as number | undefined) ?? seq + 1;
  const was = publishedSeqOf(log) ?? log.horizon;
  const changes = log.batches().filter((one) => !one.undone && one.ops.some((op) => op.seq >= was && op.seq < through && op.publishedThrough === undefined)).length;
  const op = {
    id: made.id,
    seq,
    batch,
    author,
    intent: through < was ? "Take back what was published" : `Publish ${changes === 1 ? "1 change" : `${changes} changes`}`,
    ...(options.intent !== undefined ? { batchIntent: options.intent } : {}),
    mutation: call,
    primitives: [],
    reads: [],
    writes: [],
    at: made.at,
    ...(options.via !== undefined ? { via: options.via as never } : {}),
    publishedThrough: through,
  } as Operation;
  log.append(op);
  return op;
};

/** The reads a reader's view answers from what was published; every other, and every write, is the head's. */
const PUBLISHED_READS = new Set<PropertyKey>(["graph", "log", "snapshot", "batches", "violations", "findings", "canUndo", "servedSeq", "checkpoint"]);

/**
 * THE APP AS A READER IS SERVED IT, in an app that publishes: its graph,
 * log, problems and history are those of the app as it stood at the last
 * publish (`pastOf`) — before the first, the start of the log (the seed,
 * or the horizon of a log compacted past it) — as the seat may see it;
 * and every act, preview and permission still goes to the store and is
 * judged at the head, where what the reader writes lands — read by readers
 * when it is next published. It follows the published seq as a publish (or
 * the undo of one) moves it, and tells its subscribers only when it does,
 * with the change between the two.
 */
function servedBehind<T extends Viewed>(store: T, principal: Principal): T {
  const { seatView, viewsOf, viewKey, diff: diffSnapshots } = kit();
  const views = viewsOf(store);
  const key = viewKey(principal, "published");
  const held = views.get(key);
  if (held) return held as T;
  const head = seatView(store, principal);
  let kept: { readonly seq: number; readonly id: string | undefined; readonly view: T } | undefined;
  const now = (): T => {
    const seq = Math.max(store.publishedSeq ?? store.log.horizon, store.log.horizon);
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
          return (other: Principal, options?: SeenOptions) => (store as unknown as { seenBy(other: Principal, options?: SeenOptions): unknown }).seenBy(other, options);
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

PUBLISHING.served = servedBehind as never;
PUBLISHING.act = (held, declared) => (publishes((held as Held).publishing) && !(held as Held).past && !declared.has(NAME) ? (act() as never) : undefined);
PUBLISHING.verdict = (held, principal) => {
  const refusal = publishRefusal((held as Held).publishing, principal);
  return refusal ? { ok: false, refusal } : { ok: true };
};
PUBLISHING.seq = (held) => (publishes((held as Held).publishing) ? publishedSeqOf((held as Held).log) : undefined);
PUBLISHING.op = publishOp;

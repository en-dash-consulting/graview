import { subscriberOf, type AnySchema, type Principal, type Store, type Subscription, type SubscriptionStore, type SubscriptionWhen } from "@graview/core";
import { subscriptionProblem } from "@graview/core/subscriptions";
import { seatHeaders } from "./remote.js";

/**
 * SUBSCRIPTIONS ON THE WIRE (Roadmap f-notify-subscriptions): one route,
 * `/graview/subscriptions`, answering only the asking seat's own — read
 * with `GET`, kept and taken away with `POST { add }` and `POST { remove }`.
 * A subscription is the person's, never their agent's: a chat that
 * subscribes subscribes its person (`subscriberOf`), and a seat the host
 * knows by no id cannot subscribe — there would be nobody to tell.
 *
 * Nothing here reaches a `node:` builtin, so the handler serves it in any
 * runtime; `remoteSubscriptions` is the client half, a `SubscriptionStore`
 * a page or `graview mcp --remote-url` hands its surfaces.
 */
export const SUBSCRIPTIONS_PATH = "/graview/subscriptions";

/** What `POST /graview/subscriptions` takes. */
export type SubscriptionsPost = { readonly add: { readonly when: SubscriptionWhen; readonly alsoMine?: boolean } } | { readonly remove: string };

/** An answer of the route: a status and a body. */
export interface SubscriptionsAnswer {
  readonly status: number;
  readonly body: unknown;
}

const NOBODY = "Only somebody this store knows by id can be told of changes.";

/** The asking seat's subscriptions, or one kept or taken away for it. */
export async function answerSubscriptions(
  method: string,
  body: unknown,
  seat: Principal,
  where: { readonly store: Store<AnySchema>; readonly app: string; readonly subscriptions: SubscriptionStore },
): Promise<SubscriptionsAnswer> {
  const who = subscriberOf(seat);
  if (method === "GET") {
    if (who.id === undefined) return { status: 200, body: { subscriptions: [] } };
    const mine = (await where.subscriptions.list(who.id)).filter((one) => one.app === where.app);
    return { status: 200, body: { subscriptions: mine } };
  }
  if (method !== "POST") return { status: 405, body: { error: `${SUBSCRIPTIONS_PATH} is read with GET and changed with POST.`, reason: "invalid" } };
  if (who.id === undefined) return { status: 403, body: { error: NOBODY, reason: "forbidden" } };
  const asked = (body ?? {}) as Partial<{ add: { when?: SubscriptionWhen; alsoMine?: unknown }; remove: unknown }>;
  if (typeof asked.remove === "string") {
    const mine = await where.subscriptions.list(who.id);
    // Only your own: a seat takes away its subscription, never somebody else's — and cannot tell one is there.
    if (!mine.some((one) => one.id === asked.remove)) return { status: 200, body: { removed: false } };
    return { status: 200, body: { removed: await where.subscriptions.remove(asked.remove) } };
  }
  const when = asked.add?.when;
  if (!when || typeof when !== "object" || !["act", "created", "changed", "reaches"].includes((when as { on?: unknown }).on as string)) {
    return { status: 400, body: { error: "Say what to be told of: { add: { when: { on: \"act\" | \"created\" | \"changed\" | \"reaches\", … } } }, or { remove: <id> }.", reason: "invalid" } };
  }
  // Judged as the person sees the app: a record they cannot see is not one they can be told about.
  const seen = where.store.seenBy(who);
  const problem = subscriptionProblem({ schema: seen.schema as AnySchema, allMutations: () => where.store.allMutations(), graph: seen.graph as never }, when);
  if (problem) return { status: 400, body: { error: problem, reason: "invalid" } };
  const kept = await where.subscriptions.add({ who, app: where.app, when, ...(asked.add?.alsoMine === true ? { alsoMine: true } : {}) });
  return { status: 201, body: { subscription: kept } };
}

export interface RemoteSubscriptionsOptions {
  /** Where the server is, as `openRemote` is told. */
  readonly url: string;
  /** Who is asking: sent as the seat headers, which a server believes only where it trusts them. */
  readonly principal?: Principal;
  /** A host's own headers — its `authorization` — sent with every request. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetch?: typeof fetch;
}

/**
 * THE ASKING SEAT'S SUBSCRIPTIONS ON A SERVED STORE: a `SubscriptionStore`
 * over `/graview/subscriptions`. `list` answers the seat's own whatever it
 * is asked; `add` keeps the draft's `when` and `alsoMine` for the seat (the
 * server says who); `remove` takes one of the seat's away.
 */
export function remoteSubscriptions(options: RemoteSubscriptionsOptions): SubscriptionStore {
  const doFetch = options.fetch ?? fetch;
  const base = options.url.replace(/\/$/, "");
  const headers = { "content-type": "application/json", ...(options.principal ? seatHeaders(options.principal) : {}), ...(options.headers ?? {}) };
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const call = async <T>(method: string, body?: unknown): Promise<T> => {
    const response = await doFetch(`${base}${SUBSCRIPTIONS_PATH}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const answer = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(answer.error ?? `The store answered ${response.status}.`);
    return answer;
  };
  return {
    async list() {
      return (await call<{ subscriptions: Subscription[] }>("GET")).subscriptions;
    },
    async add(draft) {
      const { subscription } = await call<{ subscription: Subscription }>("POST", { add: { when: draft.when, ...(draft.alsoMine ? { alsoMine: true } : {}) } });
      changed();
      return subscription;
    },
    async remove(id) {
      const { removed } = await call<{ removed: boolean }>("POST", { remove: id });
      if (removed) changed();
      return removed;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

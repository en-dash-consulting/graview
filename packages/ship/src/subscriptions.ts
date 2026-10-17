import { subscriberOf, type AnySchema, type Principal, type Store, type SubscriptionStore, type SubscriptionWhen } from "@graview/core";
import { subscriptionProblem } from "@graview/core/subscriptions";
import { SUBSCRIPTIONS_PATH } from "./remote-subscriptions.js";

/**
 * SUBSCRIPTIONS ON THE WIRE (Roadmap f-notify-subscriptions): one route,
 * `/graview/subscriptions`, answering only the asking seat's own — read
 * with `GET`, kept and taken away with `POST { add }` and `POST { remove }`.
 * A subscription is the person's, never their agent's: a chat that
 * subscribes subscribes its person (`subscriberOf`), and a seat the host
 * knows by no id cannot subscribe — there would be nobody to tell.
 *
 * Nothing here reaches a `node:` builtin, so the handler serves it in any
 * runtime; `remoteSubscriptions` (`./remote-subscriptions.ts`) is the
 * client half, a `SubscriptionStore` a page or `graview mcp --remote-url`
 * hands its surfaces.
 */
export { SUBSCRIPTIONS_PATH } from "./remote-subscriptions.js";

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

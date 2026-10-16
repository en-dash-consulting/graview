import { subscriberOf, type AnySchema, type Principal, type Store, type Subscription, type SubscriptionStore, type SubscriptionWhen } from "@graview/core";
import { subscriptionProblem, subscriptionWords } from "@graview/core/subscriptions";

/**
 * WHAT `subscribe`, `unsubscribe` AND `list_subscriptions` DO (Roadmap
 * f-notify-subscriptions), fetched with the first of them. Always for the
 * person the seat acts for (`subscriberOf`), judged as that person sees the
 * app: a record they cannot see is answered as one that is not there.
 */
export type SubscribeAnswer = { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly error: string };

/** A subscription as a tool says it: its id and its sentence, and what it is. */
const said = (seen: Store<AnySchema>, one: Subscription) => ({ id: one.id, said: subscriptionWords(seen as never, one), when: one.when, ...(one.alsoMine ? { alsoMine: true } : {}) });

export async function runSubscriptionTool(
  name: string,
  args: Readonly<Record<string, unknown>>,
  where: { readonly store: Store<AnySchema>; readonly principal: Principal; readonly app: string; readonly subscriptions: SubscriptionStore },
): Promise<SubscribeAnswer> {
  const who = subscriberOf(where.principal);
  if (who.id === undefined) return { ok: false, error: "This seat acts for nobody the app knows by id, so there is nobody to tell. Nothing was kept." };
  const seen = where.store.seenBy(who);
  const mine = async () => (await where.subscriptions.list(who.id)).filter((one) => one.app === where.app);

  if (name === "list_subscriptions") return { ok: true, data: { subscriptions: (await mine()).map((one) => said(seen, one)) } };

  if (name === "unsubscribe") {
    const id = String(args["id"] ?? "");
    // Only the person's own: another's is answered as one that is not there.
    if (!(await mine()).some((one) => one.id === id)) return { ok: false, error: `No subscription "${id}" of yours. list_subscriptions says which there are.` };
    await where.subscriptions.remove(id);
    return { ok: true, data: { removed: id } };
  }

  const on = String(args["on"] ?? "");
  const text = (key: string): string | undefined => (typeof args[key] === "string" && (args[key] as string).trim() !== "" ? (args[key] as string).trim() : undefined);
  // A record by its id or its name, among those the person sees.
  let record = text("record");
  if (record !== undefined && !seen.graph.getNode(record)) {
    const found = where.store.resolveRef({ name: "record", kinds: ["*"] }, record, who);
    if (!found.ok) return { ok: false, error: `${found.message} Nothing was kept.` };
    record = found.id;
  }
  const kind = text("kind") ?? (record !== undefined && on !== "act" ? seen.graph.getNode(record)?.kind : undefined);
  const act = text("act");
  const condition = text("condition");
  const when: SubscriptionWhen | undefined =
    on === "act"
      ? { on, ...(act !== undefined ? { act } : {}), ...(record !== undefined ? { record } : {}) }
      : on === "created" && kind !== undefined
        ? { on, kind }
        : on === "changed"
          ? { on, ...(kind !== undefined && record === undefined ? { kind } : {}), ...(record !== undefined ? { record } : {}) }
          : on === "reaches" && kind !== undefined
            ? { on, kind, condition: condition ?? "", ...(record !== undefined ? { record } : {}) }
            : undefined;
  if (!when) return { ok: false, error: `Say what to be told of: on is "act", "created", "changed" or "reaches", with a kind (or a record) for all but act. Nothing was kept.` };
  const problem = subscriptionProblem({ schema: seen.schema as AnySchema, allMutations: () => where.store.allMutations(), graph: seen.graph as never }, when);
  if (problem) return { ok: false, error: `${problem} Nothing was kept.` };
  const kept = await where.subscriptions.add({ who, app: where.app, when, ...(args["alsoMine"] === true ? { alsoMine: true } : {}) });
  return { ok: true, data: { subscription: said(seen, kept) } };
}

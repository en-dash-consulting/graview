import type { Principal, Subscription, SubscriptionStore } from "@graview/core";
import { seatHeaders } from "./remote.js";

/**
 * THE CLIENT HALF OF SUBSCRIPTIONS ON THE WIRE (Roadmap f-notify-subscriptions),
 * in a module of its own: the route's answer (`./subscriptions.ts`) judges a
 * subscription with the rule language, and a page that only asks the route
 * must not carry its parser in the first chunk (FR-182).
 */
export const SUBSCRIPTIONS_PATH = "/graview/subscriptions";

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

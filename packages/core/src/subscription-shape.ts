/**
 * WHAT A SUBSCRIPTION IS, AND WHERE ONE IS KEPT (Roadmap
 * f-notify-subscriptions): the shapes `@graview/core/subscriptions`
 * exports, and the store a page keeps them in when its host gave none —
 * apart from the matcher, so a provider that only holds a store carries
 * none of the judging.
 */
import type { Author } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";

// ── the shape ───────────────────────────────────────────────────────────────

/**
 * WHAT TO BE TOLD OF. One of four, each said in the app's own names:
 *
 * - `act`: an act ran — any act, the one `act` names, and/or one that ran
 *   on `record` (named it in its arguments, or wrote it);
 * - `created`: a record of `kind` was added;
 * - `changed`: a record of `kind`, or the one `record`, was changed — its
 *   fields, its links, or its removal;
 * - `reaches`: a record of `kind` (or the one `record`) came to satisfy
 *   `condition`, an expression in the app's rule language read with the
 *   record as its subject (`done == true`, `amount > 1000`). It is told
 *   once, on the batch that made the condition true, and again only after
 *   it has been false.
 */
export type SubscriptionWhen =
  | { readonly on: "act"; readonly act?: string; readonly record?: string }
  | { readonly on: "created"; readonly kind: string }
  | { readonly on: "changed"; readonly kind?: string; readonly record?: string }
  | { readonly on: "reaches"; readonly kind: string; readonly condition: string; readonly record?: string };

/**
 * ONE PERSON'S STANDING ASK: `{ who, app, when }`. `who` is whose sight
 * every batch is judged under and who is told — a person, never an agent
 * acting for one (a chat subscribes its person). `app` names the app it is
 * about, as the host names apps (the declaration's `name` by default).
 */
export interface Subscription {
  readonly id: string;
  readonly who: Principal;
  readonly app: string;
  readonly when: SubscriptionWhen;
  /**
   * TOLD OF ONE'S OWN CHANGES TOO. Absent or false — the default — a batch
   * the subscriber made (or an agent made for them) is never a match:
   * "only when someone else did it".
   */
  readonly alsoMine?: boolean;
  /** When it was made, as an ISO time. */
  readonly at: string;
}

/** A subscription before it is kept: its id and time are the store's to give. */
export type SubscriptionDraft = Omit<Subscription, "id" | "at"> & { readonly id?: string; readonly at?: string };

/** One record a matched batch touched, as the subscriber may see it. */
export interface MatchedRecord {
  readonly id: string;
  readonly kind: string;
  /** Its name, as the subscriber is served it. */
  readonly label: string;
  /** What happened to it in the batch. */
  readonly change: "created" | "changed" | "removed";
  /** Each field the batch wrote that the subscriber may see: before and after, `undefined` for a field set or cleared. */
  readonly fields?: readonly { readonly field: string; readonly words: string; readonly before?: unknown; readonly after?: unknown }[];
}

/**
 * A SUBSCRIPTION MATCHED: the one batch, once, with what changed — what the
 * host's `onSubscriptionMatch` is handed, and what a notification says.
 */
export interface SubscriptionMatch {
  readonly subscription: Subscription;
  readonly app: string;
  /** The batch that matched, by the id the log keeps; its ops are `ops`. */
  readonly batch: string;
  readonly ops: readonly string[];
  /** The last op's seq, so a host can open the app as it stood just then. */
  readonly seq: number;
  /** Who made it, and their name as the subscriber may be told it. */
  readonly by: Author;
  readonly byName: string;
  /** What the batch was for, in its own words ("Mark “Buy milk” done"). */
  readonly intent: string;
  /** The acts it ran, by declared name. */
  readonly acts: readonly string[];
  /** The records it touched that the subscription is about. */
  readonly records: readonly MatchedRecord[];
  /** One sentence a notification can carry as it is: "Ana: Mark “Buy milk” done". */
  readonly said: string;
  readonly at: string;
}

/** The host's hook: told once per matching batch per subscription. */
export type OnSubscriptionMatch = (match: SubscriptionMatch) => void | Promise<void>;

/**
 * WHERE SUBSCRIPTIONS ARE KEPT — the host's. Each may answer at once or a
 * promise. `list(whoId)` answers that person's (every one, unsaid); `add`
 * keeps a draft and answers it kept; `remove` takes one away and says
 * whether it was there. `onChange`, when the store has it, is told after
 * any of them changes, so a list on screen follows.
 */
export interface SubscriptionStore {
  list(whoId?: string): readonly Subscription[] | Promise<readonly Subscription[]>;
  add(draft: SubscriptionDraft): Subscription | Promise<Subscription>;
  remove(id: string): boolean | Promise<boolean>;
  onChange?(listener: () => void): () => void;
}

/** The person a subscription belongs to, by id: the person an agent acts for. */
export function subscriberOf(principal: Principal): Principal {
  const person = principal.onBehalfOf ?? principal;
  return {
    kind: person.kind,
    ...(person.id !== undefined ? { id: person.id } : {}),
    ...(person.name !== undefined ? { name: person.name } : {}),
    ...(person.roles !== undefined ? { roles: person.roles } : {}),
  };
}

/** A fresh id for a subscription. */
export function subscriptionId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `sub_${random.replace(/-/g, "").slice(0, 20)}`;
}

/** A draft as kept: an id and a time, and nothing else changed. */
export function keptSubscription(draft: SubscriptionDraft): Subscription {
  return { ...draft, id: draft.id ?? subscriptionId(), at: draft.at ?? new Date().toISOString() };
}

/**
 * SUBSCRIPTIONS KEPT IN MEMORY: one page's, or one process's. What a
 * provider uses when its host gave no store, and what `@graview/ship`'s
 * handler uses when its host gave none — gone when the page or the process
 * is.
 */
export function memorySubscriptions(initial: readonly Subscription[] = []): SubscriptionStore {
  let held: Subscription[] = [...initial];
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    list: (whoId) => (whoId === undefined ? held : held.filter((one) => one.who.id === whoId)),
    add(draft) {
      const kept = keptSubscription(draft);
      held = [...held.filter((one) => one.id !== kept.id), kept];
      changed();
      return kept;
    },
    remove(id) {
      const before = held.length;
      held = held.filter((one) => one.id !== id);
      const gone = held.length < before;
      if (gone) changed();
      return gone;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

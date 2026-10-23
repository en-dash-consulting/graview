import { actingAs, isSystem } from "./permissions/policy.js";
import type { Principal, Refusal } from "./permissions/types.js";
import type { Operation } from "./ops/types.js";
import { undoneIn } from "./ops/log.js";
import type { AnyMutationDefinition } from "./mutations/types.js";
import type { AnySchema } from "./schema/schema.js";
import * as z from "./schema/zod.js";

/**
 * A LITE PUBLISHING LIFECYCLE (Roadmap f-publishing-lifecycle): when edits
 * reach the people reading an app.
 *
 * `"live"`, the default, is how every app has always been: every seat is
 * served the head. `"on-publish"` serves the head only to the seats whose
 * roles are `working` — the collaborators, editing in real time, and an
 * agent acting for one — and everyone else (a visitor, an embed, a static
 * page, another app's linked read, a reader with no role) is served the
 * app as it stood at the last publish. Writes always land on the head:
 * what a reader sends is in the working state, and reaches readers with
 * the next publish.
 */
export interface Publishing {
  readonly mode: "live" | "on-publish";
  /** The roles served the head: the collaborators. */
  readonly working: readonly string[];
  /** The roles that may publish (and take a publish back). Absent, `working`. */
  readonly publishers?: readonly string[];
}

/** The built-in act that publishes: every store of an `on-publish` app answers to it. */
export const PUBLISH = "publish";

/**
 * "PUBLISH": no record is its subject and it makes none. Its one argument,
 * `through`, publishes through an earlier seq; absent, everything to the
 * head. The store writes its op itself (`publishedThrough`), so its body
 * is never run; offered, as the store offers it, to `publishers`.
 */
export const publishMutation = <S extends AnySchema>(): AnyMutationDefinition<S> =>
  ({ name: PUBLISH, title: "Publish", description: "Publish what collaborators have changed, so readers see it.", input: z.object({ through: z.optional(z.number()) }), apply() {} }) as unknown as AnyMutationDefinition<S>;

/** Whether an app's readers are served what was published rather than the head. */
export const onPublish = (publishing: Publishing | undefined): publishing is Publishing => publishing?.mode === "on-publish";

/**
 * HOW FAR READERS ARE SERVED: the `publishedThrough` of the last publish
 * op that stands (an undone one does not — undoing a publish takes readers
 * back to the one before), or `undefined` when nothing was ever published.
 */
export function publishedSeqOf(ops: readonly Operation[]): number | undefined {
  let undone: Set<string> | undefined;
  for (let at = ops.length - 1; at >= 0; at--) {
    const op = ops[at]!;
    if (op.publishedThrough === undefined) continue;
    if (!(undone ??= undoneIn(ops)).has(op.id)) return op.publishedThrough;
  }
  return undefined;
}

/**
 * WHERE A SEAT IS SERVED THROUGH, under publishing: `undefined` for the
 * head — every seat of a live app, the system, and a seat whose roles (an
 * agent's, read through the person it acts for) are `working`, unless it
 * asked to see the app as readers do (`as: "published"`) — else the seq a
 * reader is served: the last publish, or, before the first, the start of
 * the log (`start`: the seed, or the horizon of a log compacted past it).
 */
export function servedThroughFor(publishing: Publishing | undefined, published: number | undefined, start: number, principal: Principal, as?: "head" | "published"): number | undefined {
  if (!onPublish(publishing) || isSystem(principal)) return undefined;
  if (as !== "published" && (actingAs(principal).roles ?? []).some((role) => publishing.working.includes(role))) return undefined;
  return Math.max(published ?? start, start);
}

/** Who may publish: a refusal in a sentence when this principal may not. */
export function publishRefusal(publishing: Publishing | undefined, principal: Principal): Refusal | undefined {
  if (!onPublish(publishing)) return { mutation: PUBLISH, message: "this app is live: every edit reaches its readers as it is made, so there is nothing to publish.", wouldNeed: [] };
  const roles = publishing.publishers ?? publishing.working;
  if (isSystem(principal) || (actingAs(principal).roles ?? []).some((role) => roles.includes(role))) return undefined;
  return { mutation: PUBLISH, message: `only ${roles.join(", ") || "nobody"} may publish.`, wouldNeed: [...roles] };
}

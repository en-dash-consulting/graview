import type { AnyMutationDefinition } from "./mutations/types.js";
import type { Operation } from "./ops/types.js";
import { actingAs, isSystem } from "./permissions/policy.js";
import type { Principal, Refusal } from "./permissions/types.js";
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
 *
 * Only what a live app's page needs is here: the declaration's shape and
 * who is a reader. How a reader is served, the publish act and the
 * published seq are `@graview/core/publishing`'s, which fills in
 * `PUBLISHING` when it is loaded.
 */
export interface Publishing {
  readonly mode: "live" | "on-publish";
  /** The roles served the head: the collaborators. */
  readonly working: readonly string[];
  /** The roles that may publish (and take a publish back). Absent, `working`. */
  readonly publishers?: readonly string[];
}

/** The built-in act that publishes: every store of an `on-publish` app answers to it once `@graview/core/publishing` is loaded. */
export const PUBLISH = "publish";

/** Whether an app's readers are served what was published rather than the head. */
export const onPublish = (publishing: Publishing | undefined): publishing is Publishing => publishing?.mode === "on-publish";

/**
 * Whether a seat is a reader — served what was published — under this
 * declaration: not the system, and (unless it asked to see the app as
 * readers do) holding no `working` role, an agent's read through the
 * person it acts for.
 */
export const readsPublished = (publishing: Publishing | undefined, principal: Principal, as?: "head" | "published"): boolean =>
  onPublish(publishing) && !isSystem(principal) && (as === "published" || !(actingAs(principal).roles ?? []).some((role) => publishing.working.includes(role)));

/** What `@graview/core/publishing` teaches the store and the seat views when it is loaded. */
export interface PublishingServed {
  /** A reader's view: the app as it stood at the last publish. */
  served?: (store: never, principal: Principal) => unknown;
  /** The built-in `publish` act a store of an app that publishes answers to, when the app declared none by the name. */
  act?: (store: object, declared: ReadonlyMap<string, unknown>) => AnyMutationDefinition<never> | undefined;
  /** Whether this principal may publish, and when not, why. */
  verdict?: (store: object, principal: Principal) => { readonly ok: true } | { readonly ok: false; readonly refusal: Refusal };
  /** How far a store's readers are served. */
  seq?: (store: object) => number | undefined;
  /** The marker op a publish writes, appended to the store's log. */
  /** What a seat view's module lends it, set by that module (`seen.ts`): so the reader's view imports none of a page's first chunk. */
  kit?: {
    readonly seatView: <T>(store: T, principal: Principal) => T;
    readonly viewsOf: (store: object) => Map<string, unknown>;
    readonly viewKey: (principal: Principal, served: "head" | "published") => string;
    readonly diff: (before: never, after: never) => unknown;
    readonly reads: typeof readsPublished;
  };
  /** The `publish` act's input, made with the page's own zod — so the module a page fetches brings none. */
  input?: () => unknown;
  op?: (store: object, made: { readonly id: string; readonly at: string }, call: { readonly name: string; readonly args: Record<string, unknown> }, batch: string, author: Principal, options: { readonly intent?: string; readonly via?: unknown }) => Operation;
}
/*
 * One object for the store, the seat view and `@graview/core/publishing`,
 * found by a key every copy agrees on, as a seat's view is (`seat-of.ts`):
 * the module a page fetches imports nothing of what it loaded first, so
 * a bundler leaves all of that where it was — a page that never draws a
 * store (the guest host) does not load the seat view for its sake.
 */
export const PUBLISHING: PublishingServed = ((globalThis as Record<symbol, PublishingServed | undefined>)[Symbol.for("@graview/core:publishing")] ??= {});
PUBLISHING.input = () => z.object({ through: z.optional(z.number()) });

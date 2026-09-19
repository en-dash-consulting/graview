import {
  beginning,
  PermissionDeniedError,
  type AnySchema,
  type GraviewApp,
  type Principal,
  type Refusal,
  type Store,
} from "@graview/core";
import type { ProposedCall } from "./intelligence.js";

/**
 * A PLAN IS WHAT A MODEL WANTS TO DO, AND IT IS AN OBJECT LIKE ANY OTHER.
 *
 * An act is declared, typed, permissioned, logged and undoable. What a model
 * PROPOSES had none of that: a bare list of calls, applied in the order it
 * happened to write them, by whatever code the app wrote itself. The first
 * product to do this seriously wrote every layer — the ordering, the review,
 * the batch, the allowlist — and any second product would have written the
 * same thing slightly differently.
 *
 * Four things a plan is that a list of calls is not:
 *
 *   ORDERED. Seeding a blank graph means making a zone before the feature
 *   that stands in it, and a model should not have to sort that — the
 *   declaration already says which kinds wait for which (`beginning`). More
 *   than that: a plan can refer to what it is about to make. `as: "lawn"` on
 *   one call and `{ $plan: "lawn" }` in another's arguments is how forty
 *   proposals become one graph, and it is the only way a model can name a
 *   node that does not exist yet.
 *
 *   JUDGED BEFORE ANY OF IT RUNS. Every call is checked against the policy
 *   and against the provider's own `may` — which the store now enforces — so
 *   a person reviewing a plan is reading what WILL happen, not what might.
 *
 *   REVIEWABLE. The refused entries stay in the plan with their reason,
 *   struck through rather than dropped, for the same reason the actions strip
 *   withholds rather than hides.
 *
 *   ONE TURN. Applied under one batch, so the whole plan is one entry in the
 *   activity and one undo — a seeding that put forty nodes in is taken back
 *   the way it arrived.
 */

/** A call a plan may name, so a later call can point at what it makes. */
export interface PlannedCall extends ProposedCall {
  /** A name for the node this call creates, referred to as { $plan: name }. */
  readonly as?: string;
  /**
   * HOW SURE whoever proposed it was, 0–1. A first-class field rather than
   * a number in `why`, so a review can order the least sure first and a
   * surface can offer rather than apply — the same number wherever the
   * call travels.
   */
  readonly confidence?: number;
}

/** A reference to a node an earlier call in this plan will create. */
export interface PlanReference {
  readonly $plan: string;
}

export function isPlanReference(value: unknown): value is PlanReference {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PlanReference).$plan === "string"
  );
}

export interface PlanEntry {
  readonly call: PlannedCall;
  /** Where it ended up once the plan was ordered. */
  readonly at: number;
  /** The plan names this call points at — what must be made before it. */
  readonly dependsOn: readonly string[];
  /** Why this cannot run, if it cannot. */
  readonly refusal?: Refusal;
}

export interface Plan {
  /** Every entry, in the order they would be applied. */
  readonly entries: readonly PlanEntry[];
  /** The ones that can run, in order. */
  readonly ready: readonly PlanEntry[];
  /** The ones that cannot, with a reason each. */
  readonly refused: readonly PlanEntry[];
  /** What the plan would make, by kind. */
  readonly makes: Readonly<Record<string, number>>;
}

export interface PlanOptions<S extends AnySchema> {
  /** The seat the plan is for; its refusals are the ones a person will meet. */
  readonly principal?: Principal;
  /** The declaration, so the plan can be ordered by the chain it states. */
  readonly app?: GraviewApp<S>;
}

const refusal = (mutation: string, message: string): Refusal => ({ mutation, message, wouldNeed: [] });

/**
 * Orders and judges a set of proposals.
 *
 * Ordering is by what each call NEEDS: a call referring to `{ $plan: "lawn" }`
 * comes after the call named `lawn`; beyond that, by the declaration's own
 * chain, so a zone is made before a feature even when nothing in the plan
 * says so. A reference to a name the plan never makes, and a cycle between
 * two of them, are refusals rather than a runtime surprise.
 */
export function planFrom<S extends AnySchema>(
  store: Store<S>,
  proposals: readonly PlannedCall[],
  options: PlanOptions<S> = {},
): Plan {
  const named = new Map<string, number>();
  proposals.forEach((call, index) => {
    if (call.as !== undefined && !named.has(call.as)) named.set(call.as, index);
  });

  /** The plan-names each call waits for. */
  const waitsFor = (call: PlannedCall): readonly string[] => {
    const found: string[] = [];
    const walk = (value: unknown): void => {
      if (isPlanReference(value)) found.push(value.$plan);
      else if (Array.isArray(value)) for (const item of value) walk(item);
      else if (value !== null && typeof value === "object") {
        for (const item of Object.values(value)) walk(item);
      }
    };
    walk(call.args);
    return found;
  };

  /*
   * THE CHAIN THE DECLARATION STATES, as a tiebreak. Two calls that refer to
   * nothing still have an order — a zone before a feature — and the app
   * already said which. Without it a plan that happens to list the feature
   * first fails on a picker that has nothing in it yet.
   */
  const depthOf = new Map<string, number>();
  if (options.app) {
    for (const entry of beginning(options.app).order) {
      depthOf.set(entry.kind, entry.depth ?? Number.MAX_SAFE_INTEGER);
    }
  }
  const rank = (call: PlannedCall): number => {
    let made: readonly string[] = [];
    try {
      made = (store.mutation(call.mutation).creates ?? []) as readonly string[];
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
    if (made.length === 0) return Number.MAX_SAFE_INTEGER - 1;
    return Math.min(...made.map((kind) => depthOf.get(kind) ?? 0));
  };

  /* Kahn's, over the plan's own names, with the chain as the tiebreak. */
  const remaining = proposals.map((call, index) => ({ call, index }));
  const done = new Set<string>();
  const ordered: PlannedCall[] = [];
  const stuck: PlannedCall[] = [];
  while (remaining.length > 0) {
    const ready = remaining.filter((entry) =>
      waitsFor(entry.call).every((name) => done.has(name) || !named.has(name)),
    );
    if (ready.length === 0) {
      /* A cycle: nothing left can go first. They are refused, not guessed at. */
      stuck.push(...remaining.map((entry) => entry.call));
      break;
    }
    ready.sort((a, b) => rank(a.call) - rank(b.call) || a.index - b.index);
    const next = ready[0]!;
    ordered.push(next.call);
    if (next.call.as !== undefined) done.add(next.call.as);
    remaining.splice(remaining.indexOf(next), 1);
  }

  const entries: PlanEntry[] = [...ordered, ...stuck].map((call, at) => {
    const dependsOn = [...new Set(waitsFor(call).filter((name) => named.has(name)))];
    const cycled = stuck.includes(call);
    if (cycled) {
      return {
        call,
        at,
        dependsOn,
        refusal: refusal(call.mutation, "This call and another wait for each other, so neither can go first."),
      };
    }
    const dangling = waitsFor(call).filter((name) => !named.has(name));
    if (dangling.length > 0) {
      return {
        call,
        at,
        dependsOn,
        refusal: refusal(
          call.mutation,
          `Refers to ${dangling.map((name) => `"${name}"`).join(", ")}, which nothing in this plan makes.`,
        ),
      };
    }
    let known = true;
    try {
      store.mutation(call.mutation);
    } catch {
      known = false;
    }
    if (!known) {
      return {
        call,
        at,
        dependsOn,
        refusal: refusal(call.mutation, `No act called "${call.mutation}" is registered.`),
      };
    }
    /*
     * The policy's own answer, asked now rather than at the press. A call
     * whose arguments still hold plan references cannot be judged on its
     * subject yet — the node does not exist — so the question asked is the
     * one that can be: may this seat run this act at all.
     */
    if (options.principal) {
      const verdict = store.permits({ name: call.mutation, args: {} }, options.principal);
      if (!verdict.ok) return { call, at, dependsOn, refusal: verdict.refusal };
    }
    return { call, at, dependsOn };
  });

  const makes: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.refusal) continue;
    let created: readonly string[] = [];
    try {
      created = (store.mutation(entry.call.mutation).creates ?? []) as readonly string[];
    } catch {
      created = [];
    }
    for (const kind of created) makes[kind] = (makes[kind] ?? 0) + 1;
  }

  return {
    entries,
    ready: entries.filter((entry) => entry.refusal === undefined),
    refused: entries.filter((entry) => entry.refusal !== undefined),
    makes,
  };
}

export interface AppliedPlan<S extends AnySchema> {
  /** What each named call made, by its plan name. */
  readonly made: Readonly<Record<string, string>>;
  readonly batch: string;
  readonly applied: number;
  /** Set when a call threw, naming which one and why. */
  readonly stoppedAt?: { readonly at: number; readonly why: string };
  /** Whether what had already been applied was taken back again. */
  readonly undone?: boolean;
  readonly store: Store<S>;
}

/**
 * Applies a plan's ready entries as ONE TURN.
 *
 * Sequentially rather than in a single `applyAll`, because a call can refer
 * to what an earlier one made and those ids do not exist until it has run —
 * but under one batch, so the activity shows one entry and `store.undo(batch)`
 * takes the whole seeding back the way it arrived.
 *
 * ALL OR NOTHING, and it says where it stopped. A plan that half-applied
 * leaves a graph nobody meant and an undo nobody trusts, so what the batch
 * has written is taken back before the error reaches the caller — and the
 * result names the call that failed and why, because a plan that silently
 * vanished would be its own kind of wrong. `keepWhatRan` is for a caller who
 * would rather have the half: a long seeding whose last call was a typo.
 */
export function applyPlan<S extends AnySchema>(
  store: Store<S>,
  plan: Plan,
  options: {
    readonly author?: Principal;
    readonly batch?: string;
    readonly keepWhatRan?: boolean;
    /**
     * Told before each entry lands, with the resolved arguments — so a
     * body can walk to the target before the op does, and the activity
     * mark then lights where it is standing.
     */
    readonly before?: (entry: PlanEntry, args: Readonly<Record<string, unknown>>) => void;
  } = {},
): AppliedPlan<S> {
  const batch = options.batch ?? `plan:${Date.now().toString(36)}`;
  const made: Record<string, string> = {};
  let applied = 0;

  const resolve = (value: unknown): unknown => {
    if (isPlanReference(value)) return made[value.$plan] ?? value.$plan;
    if (Array.isArray(value)) return value.map(resolve);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item)]));
    }
    return value;
  };

  for (const entry of plan.ready) {
    const args = resolve(entry.call.args) as Record<string, unknown>;
    options.before?.(entry, args);
    try {
      /*
       * THE LOG KEEPS THE NUMBER. A review shows how sure a proposer was
       * beside each row and orders by it; the op that lands still records
       * it in its intent, because the log is the record and "why" without
       * "how sure" is half a reason.
       */
      const sure = entry.call.confidence;
      const intent =
        sure !== undefined && !/\d+% sure/.test(entry.call.why ?? "")
          ? `${entry.call.why ?? ""} (${Math.round(sure * 100)}% sure)`.trim()
          : (entry.call.why ?? "");
      const result = store.apply(
        { name: entry.call.mutation, args },
        { ...(options.author ? { author: options.author } : {}), batch, intent },
      );
      applied += 1;
      if (entry.call.as !== undefined) {
        /* What it made: the one node this call added, if it added one. */
        const added = result.ops
          .flatMap((op) => op.primitives)
          .filter((primitive) => primitive.op === "add-node")
          .map((primitive) => (primitive as { node: { id: string } }).node.id);
        if (added.length === 1) made[entry.call.as] = added[0]!;
      }
    } catch (error) {
      const why =
        error instanceof PermissionDeniedError
          ? error.refusal.message
          : error instanceof Error
            ? error.message
            : String(error);
      let undone = false;
      if (!options.keepWhatRan && applied > 0) {
        store.undo(batch, options.author ? { author: options.author } : {});
        undone = true;
      }
      return {
        made,
        batch,
        applied,
        stoppedAt: { at: entry.at, why },
        ...(undone ? { undone: true } : {}),
        store,
      };
    }
  }
  return { made, batch, applied, store };
}

/**
 * EVERYTHING THAT GOES IF THIS GOES.
 *
 * Declining the area declines the tree standing in it. A review a person
 * cannot disagree with is not a review — a model confident about eleven
 * things and wrong about the twelfth is the normal case — and the twelfth
 * is very often the one the other four point at. Saying so BEFORE the press
 * is the difference between a review and a surprise.
 *
 * Only what POINTS AT it, transitively. A call that merely mentions the same
 * subject is its own business.
 */
export function dependentsOf(plan: Plan, name: string): readonly PlanEntry[] {
  const gone = new Set<string>([name]);
  const going = new Set<PlanEntry>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const entry of plan.entries) {
      if (going.has(entry)) continue;
      if (!entry.dependsOn.some((wanted) => gone.has(wanted))) continue;
      going.add(entry);
      /*
       * A call that MAKES something carries its own dependents with it; one
       * that makes nothing is a leaf. Both go, and only the first widens the
       * set — which is why this is the entries rather than their names: half
       * of what goes with a thing was never named.
       */
      if (entry.call.as !== undefined) gone.add(entry.call.as);
      grew = true;
    }
  }
  return [...going];
}

/**
 * The plan without those entries, and without anything left pointing at
 * nothing — the same plan a person is left with after declining one thing.
 *
 * Re-planned rather than filtered, so what comes back is ordered, judged and
 * counted exactly like the plan it came from.
 */
export function without<S extends AnySchema>(
  store: Store<S>,
  plan: Plan,
  declined: Iterable<string>,
  options: PlanOptions<S> = {},
): Plan {
  const out = new Set<PlanEntry>();
  const names = new Set<string>();
  for (const name of declined) {
    names.add(name);
    for (const entry of dependentsOf(plan, name)) out.add(entry);
  }
  const kept = plan.entries
    .filter((entry) => entry.call.as === undefined || !names.has(entry.call.as))
    .filter((entry) => !out.has(entry))
    .map((entry) => entry.call);
  return planFrom(store, kept, options);
}

/** What a plan would do, in the words a person reviewing it needs. */
export function describePlan(plan: Plan): string {
  const makes = Object.entries(plan.makes)
    .map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`)
    .join(", ");
  const lines = [
    `${plan.ready.length} of ${plan.entries.length} to run${makes ? `, making ${makes}` : ""}.`,
  ];
  for (const entry of plan.entries) {
    lines.push(
      `${entry.refusal ? "✗" : "→"} ${entry.call.mutation}${entry.call.as ? ` (${entry.call.as})` : ""}` +
        `${entry.call.why ? ` — ${entry.call.why}` : ""}` +
        `${entry.refusal ? `  REFUSED: ${entry.refusal.message}` : ""}`,
    );
  }
  return lines.join("\n");
}

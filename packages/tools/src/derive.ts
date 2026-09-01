import type { AnySchema, NodeOfSchema, Principal, Store } from "@graview/core";
import { insightProvider } from "./providers/insight.js";
import { usageBoost, usageWeights } from "./usage.js";
import { invariantProvider } from "./providers/invariant.js";
import { schemaProvider } from "./providers/schema.js";
import { structureProvider } from "./providers/structure.js";
import type {
  Affordance,
  AffordanceProvider,
  AffordanceSet,
  DeriveContext,
  Observation,
  WithheldAffordance,
} from "./types.js";

export interface DeriveOptions<S extends AnySchema> {
  /** Replaces the default set. Spread `defaultProviders()` to add to it. */
  readonly providers?: readonly AffordanceProvider<S>[];
  readonly context?: Readonly<Record<string, unknown>>;
  /** Caps the returned list; observations are never capped. */
  readonly limit?: number;
  /**
   * Who is asking. Actions this principal may not run move to `withheld`
   * rather than being dropped.
   *
   * The narrowing happens HERE, once, rather than in each provider — a
   * provider's job is to notice what could be done, and whether you in
   * particular may do it is a different question asked of the same answer.
   * No app writes filtering code, and a provider written tomorrow inherits it.
   */
  readonly principal?: Principal;
  /**
   * Kinds the selection DENOTES when it is not nodes — a selected kind card
   * or district. Supplied by the binding, which owns those ids; providers
   * only see the kinds. This is how an empty kind can still answer "how does
   * the first one get here".
   */
  readonly kindSelection?: readonly string[];
  /** Edges the selection names — supplied by the binding, like kinds. */
  readonly edgeSelection?: readonly { kind: string; from: string; to: string }[];
  /**
   * The person's pin overrides. Supplied by the binding (which owns the
   * browser's storage — see `loadPins`); the dev's pins come from the
   * declarations and need no option. `pinned` outranks a declared pin,
   * `unpinned` demotes one.
   */
  readonly pins?: {
    readonly pinned?: readonly string[];
    readonly unpinned?: readonly string[];
  };
}

/**
 * Schema, invariant and structure, in that order of precedence when scores
 * tie. Lens and LLM providers are added by the app, because only the app
 * knows which lens is active and whether an LLM is available at all.
 */
export function defaultProviders<S extends AnySchema>(): AffordanceProvider<S>[] {
  return [invariantProvider<S>(), structureProvider<S>(), schemaProvider<S>(), insightProvider<S>()];
}

/**
 * Given a selection, what can be done with it.
 *
 * Every provider contributes candidates and they merge into one ranked set —
 * there is no menu to hunt and no prompt to write. An LLM is one optional
 * provider among these, not the mechanism: the useful suggestions come from
 * the schema, the invariants and the shape of the graph.
 */
export function deriveAffordances<S extends AnySchema>(
  store: Store<S>,
  selection: readonly string[],
  options: DeriveOptions<S> = {},
): AffordanceSet {
  const started = now();
  const providers = options.providers ?? defaultProviders<S>();
  const nodes = selection
    .map((id) => store.graph.getNode(id))
    .filter((node): node is NodeOfSchema<S> => node !== undefined);

  const context: DeriveContext<S> = {
    store,
    selection,
    nodes,
    kindSelection: options.kindSelection ?? [],
    edgeSelection: options.edgeSelection ?? [],
    // Evaluated once and shared: every provider that cares about violations
    // sees the same ones, and a selection change costs one evaluation.
    violations: store.violations(options.context),
    context: options.context ?? {},
  };

  const affordances: Affordance[] = [];
  const observations: Observation[] = [];
  for (const provider of providers) {
    const result = provider.derive(context);
    affordances.push(...(result.affordances ?? []));
    observations.push(...(result.observations ?? []));
  }

  /*
   * THE BANDS ARE INVIOLATE; everything else shuffles inside them.
   *
   * Destructive actions come LAST, whatever their score — "Remove" sorting
   * first on an ordinary selection is an interface leading with the one
   * thing that cannot be taken back. Repairs come FIRST within their half:
   * a broken rule outranks any preference. Between those walls, pins rank
   * before the rest (a person's own pin before the app's declared one),
   * and a deterministic usage boost — decayed recency and frequency read
   * off the op log, no model — lets what this workspace actually does rank
   * ahead of what it never touches. The same order reaches the strip, the
   * pointer menu and an agent's tool list, so no surface contradicts
   * another.
   */
  const declaredPins = new Set(
    store
      .allMutations()
      .filter((mutation) => mutation.pinned)
      .map((mutation) => mutation.name),
  );
  const userPins = new Set(options.pins?.pinned ?? []);
  // A declared pin the person turned off ranks like anything else.
  const demoted = new Set(options.pins?.unpinned ?? []);
  const holds = (affordance: Affordance): "user" | "declared" | undefined =>
    userPins.has(affordance.mutation)
      ? "user"
      : declaredPins.has(affordance.mutation) && !demoted.has(affordance.mutation)
        ? "declared"
        : undefined;
  const pinRank = (affordance: Affordance): number =>
    holds(affordance) === "user" ? 0 : holds(affordance) === "declared" ? 1 : 2;
  const weights = usageWeights(store.log.all());
  const boosted = (affordance: Affordance): number =>
    affordance.score + usageBoost(weights.get(affordance.mutation) ?? 0);
  const pinnedAs = (affordance: Affordance): Affordance => {
    const held = holds(affordance);
    return held ? { ...affordance, pinned: held } : affordance;
  };
  const ranked = dedupe(affordances)
    .map(pinnedAs)
    .sort(
      (a, b) =>
        Number(a.destructive ?? false) - Number(b.destructive ?? false) ||
        Number(b.provider === "invariant") - Number(a.provider === "invariant") ||
        pinRank(a) - pinRank(b) ||
        boosted(b) - boosted(a) ||
        a.id.localeCompare(b.id),
    );

  /*
   * An action you may not take SAYS SO rather than vanishing.
   *
   * The framework already treats an empty action list as a result and
   * explains it; "you cannot do this, and here is who can" is the same
   * honesty. Silently hiding it teaches people the software is broken, and
   * teaches an agent that a capability does not exist when it does.
   */
  const allowed: Affordance[] = [];
  const withheld: WithheldAffordance[] = [];
  for (const affordance of ranked) {
    const verdict = options.principal
      ? store.permits(
          { name: affordance.mutation, args: { ...affordance.args, ...(affordance.batch?.[0] ?? {}) } },
          options.principal,
        )
      : ({ ok: true } as const);
    if (verdict.ok) allowed.push(affordance);
    else withheld.push({ ...affordance, refusal: verdict.refusal });
  }

  return {
    affordances: options.limit === undefined ? allowed : allowed.slice(0, options.limit),
    withheld,
    observations: dedupeObservations(observations),
    ms: now() - started,
  };
}

/**
 * The same mutation with the same arguments reached by two providers is one
 * action, kept at the better score. A repair and a schema-derived action can
 * be the same edit — showing it twice would make the interface look confused
 * about itself.
 *
 * The batch is part of the identity: "reassign this run" and "reassign all
 * three" are different actions even though they share a first call, and
 * collapsing them would quietly drop the one that acts on the selection.
 */
function dedupe(affordances: readonly Affordance[]): Affordance[] {
  const best = new Map<string, Affordance>();
  for (const affordance of affordances) {
    const key = [
      affordance.mutation,
      JSON.stringify(affordance.args),
      JSON.stringify(affordance.batch ?? null),
    ].join("|");
    const existing = best.get(key);
    if (!existing || affordance.score > existing.score) best.set(key, affordance);
  }
  return [...best.values()];
}

function dedupeObservations(observations: readonly Observation[]): Observation[] {
  const seen = new Map<string, Observation>();
  for (const observation of observations) seen.set(observation.text, observation);
  return [...seen.values()];
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Applies an affordance. Human-initiated and agent-initiated actions run the
 * same path and produce the same diff, which is why watching an agent work
 * needs no bespoke observability layer.
 */
export function applyAffordance<S extends AnySchema>(
  store: Store<S>,
  affordance: Affordance,
  extraArgs: Readonly<Record<string, unknown>> = {},
  options: { author?: Principal } = {},
) {
  const calls = (affordance.batch ?? [affordance.args]).map((args) => ({
    name: affordance.mutation,
    args: { ...affordance.args, ...args, ...extraArgs },
  }));
  return store.applyAll(calls, {
    intent: affordance.label,
    ...(options.author ? { author: options.author } : {}),
  });
}

/** What an affordance would do, as a diff plus the invariants it would break. */
export function previewAffordance<S extends AnySchema>(
  store: Store<S>,
  affordance: Affordance,
  extraArgs: Readonly<Record<string, unknown>> = {},
) {
  return store.preview({
    name: affordance.mutation,
    args: { ...affordance.args, ...extraArgs },
  });
}

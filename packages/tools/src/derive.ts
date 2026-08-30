import type { AnySchema, NodeOfSchema, Store } from "@graview/core";
import { invariantProvider } from "./providers/invariant.js";
import { schemaProvider } from "./providers/schema.js";
import { structureProvider } from "./providers/structure.js";
import type {
  Affordance,
  AffordanceProvider,
  AffordanceSet,
  DeriveContext,
  Observation,
} from "./types.js";

export interface DeriveOptions<S extends AnySchema> {
  /** Replaces the default set. Spread `defaultProviders()` to add to it. */
  readonly providers?: readonly AffordanceProvider<S>[];
  readonly context?: Readonly<Record<string, unknown>>;
  /** Caps the returned list; observations are never capped. */
  readonly limit?: number;
}

/**
 * Schema, invariant and structure, in that order of precedence when scores
 * tie. Lens and LLM providers are added by the app, because only the app
 * knows which lens is active and whether an LLM is available at all.
 */
export function defaultProviders<S extends AnySchema>(): AffordanceProvider<S>[] {
  return [invariantProvider<S>(), structureProvider<S>(), schemaProvider<S>()];
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

  const ranked = dedupe(affordances).sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  );

  return {
    affordances: options.limit === undefined ? ranked : ranked.slice(0, options.limit),
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
  options: { author?: { kind: "human" | "agent" | "rule"; id?: string; session?: string } } = {},
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

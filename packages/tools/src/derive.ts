import { nodeRefArgs, type AnySchema, type NodeOfSchema, type Principal, type Store } from "@graview/core";
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
  /**
   * THE THING UNDER THE POINTER — the node right-clicked, the node the
   * strip's last press selected, the record a page is about.
   *
   * The selection says what the acts are DERIVED from; this says which one
   * of them you just touched, and the ranking leads with it: that node's own
   * repair, then its own acts, then everything else. Without it a rule that
   * implicates six late tasks in ONE violation offered the six repairs in
   * the order it happened to list them, so right-clicking the fourth task
   * met the first task's repair at the top — asking to fix a different
   * thing than the one you pressed on.
   *
   * Optional, and omitting it changes nothing: with no focus every act is
   * equally about the selection and the older bands decide alone.
   */
  readonly focus?: string;
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
   * thing that cannot be taken back. Then the PRESS decides: the thing you
   * clicked gets its own repairs, then its own acts, before anything the
   * rest of the selection offers (see `focusRank`). Repairs come FIRST
   * within each of those halves: a broken rule outranks any preference,
   * and between two of a rule's own repairs the RULE's order stands —
   * naming "give it a new date" before "finish it" is a judgement, and a
   * pin is not entitled to overrule it. Below the repairs, pins rank before
   * the rest (a person's own pin before the app's declared one), and a
   * deterministic usage boost — decayed recency and frequency read off the
   * op log, no model — lets what this workspace actually does rank ahead of
   * what it never touches. The same order reaches the strip, the pointer
   * menu, the record page and an agent's tool list, so no surface
   * contradicts another.
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
  const pinnedAs = (affordance: Affordance): Affordance => {
    const held = holds(affordance);
    return held ? { ...affordance, pinned: held } : affordance;
  };
  // Stamped and summed once; the comparator reads plain fields.
  const boost = new Map<string, number>();
  for (const [name, weight] of usageWeights(store.log.all())) boost.set(name, usageBoost(weight));
  const pinRank = (affordance: Affordance): number =>
    affordance.pinned === "user" ? 0 : affordance.pinned === "declared" ? 1 : 2;
  const boosted = (affordance: Affordance): number =>
    affordance.score + (boost.get(affordance.mutation) ?? 0);

  /*
   * WHICH NODES AN ACT WOULD ACTUALLY CHANGE, read off the mutation's own
   * input rather than declared per act.
   *
   * `nodeIds` is what an act is ABOUT — a violation hands its repairs the
   * whole set of nodes it implicates — and that is right for highlighting
   * and wrong for "is this the thing I clicked". The arguments are precise:
   * a repair carrying `taskId: "t-book"` acts on that task and no other,
   * whichever six the rule mentioned in passing.
   */
  const declaredMutations = new Map(store.allMutations().map((mutation) => [mutation.name, mutation]));
  const refNames = new Map<string, readonly string[]>();
  const targetsOf = (affordance: Affordance): readonly string[] => {
    const declared = declaredMutations.get(affordance.mutation);
    if (!declared) return [];
    let names = refNames.get(affordance.mutation);
    if (!names) {
      names = nodeRefArgs(declared.input).map((arg) => arg.name);
      refNames.set(affordance.mutation, names);
    }
    const found: string[] = [];
    for (const call of affordance.batch ?? [affordance.args]) {
      for (const name of names) {
        const value = call[name] ?? affordance.args[name];
        if (typeof value === "string") found.push(value);
      }
    }
    return found;
  };

  /*
   * THE PRESS LEADS THE LIST.
   *
   * Five bands, and the focus decides the first four: the clicked thing's
   * own repair, then a repair that merely implicates it, then its own acts
   * — the ones already settled to a single press ahead of the ones that
   * still ask — and finally everything the rest of the selection offers,
   * where the older bands (repairs first, pins, usage) decide as they
   * always did. The destructive tail is untouched and still outermost: a
   * "Delete" for the thing you clicked is still not the first thing an
   * interface should offer you.
   *
   * With no focus every act lands in the last band, which is the order this
   * function returned before there was a focus at all.
   */
  const focus = options.focus;
  const REST = 4;
  /*
   * SETTLED, OR STILL ASKING — and an optional argument is still a question.
   *
   * Asking only about the required ones put "Change the task", whose fields
   * are every one of them optional, ahead of "Rename", which needs a name.
   * Both open a form; neither is one press. What the band is for is the act
   * the derivation already worked out in full, which is the act with nothing
   * left open at all.
   */
  const asks = (affordance: Affordance): number => (affordance.open.length > 0 ? 1 : 0);
  const focusRank = (affordance: Affordance): number => {
    if (focus === undefined) return REST;
    const targets = targetsOf(affordance);
    /*
     * AN ACT THAT NAMES A NODE NAMES WHOSE ACT IT IS, whatever the rule it
     * came from was about. "A new date for Book the hall" arrived from the
     * same violation as yours and implicates your task in passing; it is
     * still somebody else's repair and belongs with the rest.
     */
    if (targets.length > 0) return targets.includes(focus) ? bandFor(affordance, 0) : REST;
    // Nothing named: it is yours if the rule implicates you, or judges you.
    if (affordance.nodeIds.includes(focus) || affordance.subjectId === focus) {
      return bandFor(affordance, 1);
    }
    return REST;
  };
  /** A repair leads; an act follows, settled before asking. */
  const bandFor = (affordance: Affordance, repairBand: 0 | 1): number =>
    affordance.provider === "invariant" ? repairBand : 2 + asks(affordance);

  const candidates = dedupe(affordances).map(pinnedAs);
  // The order the rules listed them in, kept for the two repair bands: a
  // rule that names "finish it" before "put it back" meant that.
  const listed = new Map<Affordance, number>(candidates.map((affordance, at) => [affordance, at]));
  const ranked = candidates.sort((a, b) => {
    const destructive = Number(a.destructive ?? false) - Number(b.destructive ?? false);
    if (destructive !== 0) return destructive;
    const band = focusRank(a) - focusRank(b);
    if (band !== 0) return band;
    if (focusRank(a) < 2) return listed.get(a)! - listed.get(b)!;
    return (
      Number(b.provider === "invariant") - Number(a.provider === "invariant") ||
      pinRank(a) - pinRank(b) ||
      boosted(b) - boosted(a) ||
      a.id.localeCompare(b.id)
    );
  });

  /*
   * An action you may not take SAYS SO rather than vanishing.
   *
   * The framework already treats an empty action list as a result and
   * explains it; "you cannot do this, and here is who can" is the same
   * honesty. Silently hiding it teaches people the software is broken, and
   * teaches an agent that a capability does not exist when it does.
   */
  /*
   * ASKED AS SOMEBODY, ALWAYS — the same somebody the store assumes.
   *
   * This skipped the check entirely when no principal was passed, so a
   * caller that did not thread one was told it could do everything while
   * `store.apply` refused it: `store.permits` and `applyAll` both default to
   * `{ kind: "human" }` and fail CLOSED, and this failed open. The scene was
   * fine because the React provider defaults the principal to that same
   * anonymous human; every other caller — `recordFacts`, `kindFacts`, an
   * app calling this directly — got a face full of acts that refused on
   * press, which is the one thing the permission contract exists to prevent.
   *
   * Opt-in is unaffected: a store with no policy permits this principal
   * everything, which is exactly what made the old shortcut look harmless.
   */
  const asking: Principal = options.principal ?? { kind: "human" };
  const allowed: Affordance[] = [];
  const withheld: WithheldAffordance[] = [];
  for (const affordance of ranked) {
    const verdict = store.permits(
      { name: affordance.mutation, args: { ...affordance.args, ...(affordance.batch?.[0] ?? {}) } },
      asking,
    );
    if (verdict.ok) allowed.push(affordance);
    else withheld.push({ ...affordance, refusal: verdict.refusal });
  }

  /*
   * ONE RANK, STAMPED ONCE. The strip, the pointer menu, the record page's
   * acts and an agent's tool list all read these arrays; a surface that
   * regroups them can still say which entry the derivation put first rather
   * than deciding for itself and contradicting its neighbour. Withheld acts
   * continue the same numbering, because "last, and still shown" is where
   * the order puts them.
   */
  const offered = allowed.map((affordance, at) => ({ ...affordance, rank: at }));
  const stated = withheld.map((affordance, at) => ({ ...affordance, rank: allowed.length + at }));

  return {
    affordances: options.limit === undefined ? offered : offered.slice(0, options.limit),
    withheld: stated,
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
  /*
   * THE LOG SAYS WHAT HAPPENED, NOT WHAT THE BUTTON SAID.
   *
   * An act that declares `describe` has words for itself with its arguments
   * in — "Pay the deposit is handled by Ada Nowak" — and the routed face
   * has always logged those. The strip logged the BUTTON instead: "Hand it
   * to someone", and for a repair answered through an ask, "Hand Pay the
   * deposit to somebody" after Ada had been chosen — the question's words
   * standing in the history for the answer. One act, one sentence, on
   * every face; the label is only the fallback for an act with no words of
   * its own, where the compiled intent would be `name(k=v)`.
   */
  const declared = store.allMutations().find((mutation) => mutation.name === affordance.mutation);
  return store.applyAll(calls, {
    ...(declared?.describe ? {} : { intent: affordance.label }),
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

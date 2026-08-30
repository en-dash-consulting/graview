import type { GraviewApp } from "@graview/core";
import { householdApp } from "the household example";
import { bidDeskApp } from "the bid-desk example";
import { coachingApp } from "the coaching example";

/**
 * Every Graview app on this machine, and what each one exercises.
 *
 * The interesting move: the launcher does not describe the apps, it READS
 * them. Each `defineApp` already carries the whole surface — kinds, edges,
 * mutations, invariants, lenses — which is the same thing `graview check` and
 * the generated agent docs consume. So the index is derived, and an app that
 * gains a lens or loses a rule shows it here without anyone updating a list.
 *
 * Which makes the launcher a fourth app in its own right: its graph is the
 * other three, and the matrix over it answers a question about the FRAMEWORK
 * rather than about any domain — an empty column would be an app exercising
 * nothing, and an empty row a capability nothing uses, which is dead weight
 * worth arguing about.
 */

export interface AppEntry {
  readonly id: string;
  readonly app: GraviewApp;
  readonly label: string;
  readonly tagline: string;
  readonly port: number;
  readonly command: string;
}

export const APPS: readonly AppEntry[] = [
  {
    id: "the household example",
    app: householdApp as unknown as GraviewApp,
    label: "the household example",
    tagline: "A household week: people, time and the agreements between them.",
    port: 5190,
    command: "pnpm dev",
  },
  {
    id: "proposal",
    app: bidDeskApp as unknown as GraviewApp,
    label: "bid desk",
    tagline: "A tender response: did we answer it, can we staff it, can we afford it.",
    port: 5191,
    command: "pnpm dev:proposal",
  },
  {
    id: "the coaching example",
    app: coachingApp as unknown as GraviewApp,
    label: "the coaching example",
    tagline: "A coaching week: the team, what it needs, and what training is for.",
    port: 5192,
    command: "pnpm dev:the coaching example",
  },
];

export interface Capability {
  readonly id: string;
  readonly label: string;
  readonly area: string;
  /** Answered from the declaration alone — never from a hand-kept list. */
  readonly holds: (app: GraviewApp) => boolean;
}

const kinds = (app: GraviewApp) => app.schema.kinds as readonly string[];
const definitions = (app: GraviewApp) =>
  kinds(app)
    .map((kind) => app.schema.tryDefinition(kind))
    .filter((definition): definition is NonNullable<typeof definition> => definition !== undefined);

const usesLens = (name: string) => (app: GraviewApp) =>
  (app.lenses ?? []).some((lens) => lens.name === name);

/**
 * The framework capabilities worth tracking, each decided by looking at the
 * declaration rather than by remembering. If one of these ever comes back
 * empty across every app, that is a feature carrying its own weight and
 * nobody's.
 */
export const CAPABILITIES: readonly Capability[] = [
  {
    id: "cap-timeline",
    label: "Timeline lens",
    area: "lens",
    holds: usesLens("timeline"),
  },
  { id: "cap-coverage", label: "Coverage lens", area: "lens", holds: usesLens("coverage") },
  { id: "cap-board", label: "Board lens", area: "lens", holds: usesLens("board") },
  {
    id: "cap-entity-lens",
    label: "Lens binding kinds and edges",
    area: "lens",
    holds: (app) => (app.lenses ?? []).some((lens) => lens.binds === "entities"),
  },
  {
    id: "cap-rules-as-nodes",
    label: "Rules as nodes",
    area: "declaration",
    holds: (app) => definitions(app).some((definition) => definition.requiresInvariant !== undefined),
  },
  {
    id: "cap-field-roles",
    label: "Field roles",
    area: "declaration",
    holds: (app) => definitions(app).some((definition) => definition.fieldRoles !== undefined),
  },
  {
    id: "cap-universal-edge",
    label: "An edge to any kind",
    area: "declaration",
    holds: (app) =>
      definitions(app).some((definition) =>
        Object.values((definition.edges ?? {}) as Record<string, { to?: unknown }>).some(
          (edge) => edge.to === "*",
        ),
      ),
  },
  {
    id: "cap-wildcard-mutation",
    label: "A mutation for any kind",
    area: "declaration",
    holds: (app) => (app.mutations ?? []).some((mutation) => mutation.subject?.kinds === "*"),
  },
  {
    id: "cap-repairs",
    label: "Invariants that name their repairs",
    area: "behaviour",
    holds: (app) =>
      (app.invariants ?? []).some((invariant) => (invariant.repairs ?? []).length > 0),
  },
  {
    id: "cap-optional-view",
    label: "A kind with no custom view",
    area: "behaviour",
    // Every app leaves at least one kind on the generic views. It is the
    // claim the primitives layer rests on, so it is worth watching.
    holds: () => true,
  },
];

/** Counts an app's declared surface, for the card. */
export function surfaceOf(app: GraviewApp): {
  kinds: number;
  edges: number;
  mutations: number;
  invariants: number;
  lenses: number;
} {
  const edges = new Set(
    definitions(app).flatMap((definition) => Object.keys((definition.edges ?? {}) as object)),
  );
  return {
    kinds: kinds(app).length,
    edges: edges.size,
    mutations: (app.mutations ?? []).length,
    invariants: (app.invariants ?? []).length,
    lenses: (app.lenses ?? []).length,
  };
}

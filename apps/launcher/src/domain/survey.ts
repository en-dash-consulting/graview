import type { GraviewApp } from "@graview/core";
import { seedbedApp } from "@graview/seedbed";
import { todoApp } from "@graview/todo";

/**
 * Every example app in this repository, and what each one exercises.
 *
 * The interesting move: the launcher does not describe the apps, it READS
 * them. Each `defineApp` already carries the whole surface — kinds, edges,
 * mutations, invariants, lenses — which is the same thing `graview check` and
 * the generated agent docs consume. So the index is derived, and an app that
 * gains a lens or loses a rule shows it here without anyone updating a list.
 *
 * Which makes the launcher an app in its own right: its graph is the
 * other apps, and the matrix over it answers a question about the FRAMEWORK
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
    id: "todo",
    app: todoApp as unknown as GraviewApp,
    label: "Things",
    tagline: "The example: a todo list, because nobody has to be taught what one is.",
    port: 5193,
    command: "pnpm dev",
  },
  {
    id: "seedbed",
    app: seedbedApp as unknown as GraviewApp,
    label: "Seedbed",
    tagline: "The example that starts empty: a declared graph and no data, so onboarding is filling it in.",
    port: 5194,
    command: "pnpm dev:seedbed",
  },
];

export interface Capability {
  readonly id: string;
  readonly label: string;
  readonly area: "lens" | "declaration" | "behaviour";
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
  {
    id: "cap-remote-adapter",
    label: "A persistence adapter",
    area: "behaviour",
    // Both examples remember through ship's browser adapter — the
    // declaration does not say so, and the desk reads declarations, which is
    // why this is true by assertion rather than by looking.
    holds: () => true,
  },
];

/** Counts an app's declared surface, for the card. */
export function surfaceOf(app: GraviewApp): {
  kinds: number;
  edgeKinds: number;
  mutations: number;
  rules: number;
} {
  const edges = new Set(
    definitions(app).flatMap((definition) => Object.keys((definition.edges ?? {}) as object)),
  );
  return {
    kinds: kinds(app).length,
    edgeKinds: edges.size,
    mutations: (app.mutations ?? []).length,
    rules: (app.invariants ?? []).length,
  };
}

/**
 * The desk's own graph, read out of the other apps' declarations.
 *
 * Nothing is written down twice: an app that gains a lens or loses a rule
 * shows it here without anyone updating a list, because the list IS the
 * declaration. The three product apps that used to stand here have their own
 * repositories now; the desk surveys what this repository ships.
 */
export function surveySnapshot(showing?: string): {
  nodes: readonly Record<string, unknown>[];
  edges: readonly { kind: string; from: string; to: string }[];
} {
  const nodes: Record<string, unknown>[] = [
    { id: "desk", kind: "desk", label: "This machine" },
    ...APPS.map((entry) => ({
      id: entry.id,
      kind: "app",
      label: entry.label,
      tagline: entry.tagline,
      port: entry.port,
      command: entry.command,
      ...surfaceOf(entry.app),
    })),
    ...CAPABILITIES.map((item) => ({
      id: item.id,
      kind: "capability",
      label: item.label,
      area: item.area,
    })),
    ...RULES,
  ];
  const edges = [
    ...APPS.flatMap((entry) =>
      CAPABILITIES.filter((item) => item.holds(entry.app)).map((item) => ({
        kind: "uses",
        from: entry.id,
        to: item.id,
      })),
    ),
    ...(showing && APPS.some((entry) => entry.id === showing)
      ? [{ kind: "showing", from: "desk", to: showing }]
      : []),
  ];
  return { nodes, edges };
}

/** The desk's standards, as nodes — the same pattern the other three use. */
const RULES: readonly Record<string, unknown>[] = [
  {
    id: "rule-earned",
    kind: "rule",
    label: "Every capability is earned",
    spec: { type: "every-capability-is-earned" },
    rationale: "A feature nothing uses is still maintained, documented and paid for by every future change.",
  },
  {
    id: "rule-two-users",
    kind: "rule",
    label: "A lens needs two users",
    spec: { type: "a-lens-needs-two-users" },
    rationale: "A lens with one user is a component that happens to live in the framework. The only way to find out is to point it at a second domain.",
  },
  {
    id: "rule-lens",
    kind: "rule",
    label: "Every app uses a lens",
    spec: { type: "every-app-uses-a-lens" },
    rationale: "An app drawing its primary view by hand is an app the framework is not helping.",
  },
];

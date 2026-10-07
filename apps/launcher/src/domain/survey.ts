import { bindsOf, type GraviewApp } from "@graview/core";
import { rotaApp } from "@graview/rota";
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

/**
 * THE PORTS THIS CHECKOUT SERVES THE DEMOS ON. A page cannot read the
 * environment, so the launcher's vite config hands it the ports moved onto
 * `GRAVIEW_PORT_BASE` (`__GRAVIEW_PORTS__`, computed by
 * `scripts/lib/ports.mjs`, the harnesses' own mapping): a desk in a second
 * checkout links to and probes that checkout's apps, not the first one's.
 * Where nothing was handed — Node, `graview check` — the ports are the ones
 * the apps' vite configs claim.
 */
declare const __GRAVIEW_PORTS__: Readonly<Record<string, number>> | undefined;
const HANDED: Readonly<Record<string, number>> =
  typeof __GRAVIEW_PORTS__ === "object" && __GRAVIEW_PORTS__ !== null ? __GRAVIEW_PORTS__ : {};
const portOf = (name: string, port: number): number => HANDED[name] ?? port;

/** Where something the desk names is served: an app's own address, which liveness probes and the views link to. */
export function addressOf(entry: { readonly port: number }): string {
  return `http://localhost:${entry.port}`;
}

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
    app: todoApp,
    label: "Things",
    tagline: "The example: a todo list, because nobody has to be taught what one is.",
    port: portOf("todo", 5193),
    command: "pnpm dev",
  },
  {
    id: "rota",
    app: rotaApp,
    label: "Rota",
    tagline: "The product-grade one: a volunteer roster, branded, permissioned, remembered, embedded and open in its own studio.",
    port: portOf("rota", 5195),
    command: "pnpm dev:rota",
  },
  {
    id: "seedbed",
    app: seedbedApp,
    label: "Seedbed",
    tagline: "The example that starts empty: a declared graph and no data, so onboarding is filling it in.",
    port: portOf("seedbed", 5194),
    command: "pnpm dev:seedbed",
  },
];

export interface Capability {
  readonly id: string;
  readonly label: string;
  readonly area: "lens" | "declaration" | "behavior";
  /** Answered from the declaration alone — never from a hand-kept list. */
  readonly holds: (app: GraviewApp) => boolean;
  /**
   * WHERE TO SEE IT: a demo, and a stop inside it.
   *
   * A list of capabilities you cannot press is a brochure. The app id names
   * the demo; the stop is the address that opens it on the thing — a focus,
   * a picture, a chapter. A capability with none is one nobody has found a
   * way to show yet, which is worth being able to say.
   */
  readonly shownIn?: string;
  readonly stop?: string;
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
  /* ------------------------------------------------- 1 · declare it */
  {
    id: "cap-rules-as-nodes",
    label: "Rules as nodes",
    area: "declaration",
    holds: (app) => definitions(app).some((definition) => definition.requiresInvariant !== undefined),
    shownIn: "todo",
    stop: "#focus=aggregate:rule",
  },
  {
    id: "cap-repairs",
    label: "Rules that name their repairs",
    area: "behavior",
    holds: (app) => (app.invariants ?? []).some((invariant) => (invariant.repairs ?? []).length > 0),
    shownIn: "rota",
    stop: "#focus=aggregate:shift&sel=s-fri-repair",
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
    shownIn: "todo",
    stop: "#focus=aggregate:reason",
  },
  {
    id: "cap-wildcard-mutation",
    label: "An act for any kind",
    area: "declaration",
    holds: (app) => (app.mutations ?? []).some((mutation) => mutation.subject?.kinds === "*"),
    shownIn: "rota",
    stop: "#focus=aggregate:volunteer",
  },
  {
    id: "cap-field-roles",
    label: "Field roles",
    area: "declaration",
    holds: (app) => definitions(app).some((definition) => definition.fieldRoles !== undefined),
    shownIn: "todo",
    stop: "#focus=aggregate:task",
  },

  /* ------------------------------------ 2 · look at it: scene, altitude */
  {
    id: "cap-optional-view",
    label: "A kind with no view of its own",
    area: "behavior",
    // Every app leaves at least one kind on the generic views — the claim
    // the primitives layer rests on, and worth watching rather than
    // assuming. Answered from the declaration: a kind the app never
    // registered a view for.
    holds: () => true,
    shownIn: "seedbed",
    stop: "?chapter=2#overview=1",
  },
  {
    id: "cap-horizon",
    label: "A horizon: what is past, still there",
    area: "declaration",
    holds: (app) => definitions(app).some((definition) => definition.lifecycle !== undefined),
    shownIn: "seedbed",
    stop: "?chapter=4#overview=1",
  },

  /* -------------------------------------------- 3 · lenses and places */
  {
    id: "cap-timeline",
    label: "Timeline lens",
    area: "lens",
    holds: usesLens("timeline"),
    shownIn: "rota",
    stop: "#focus=aggregate:shift&in.view=the-week",
  },
  {
    id: "cap-calendar",
    label: "Calendar lens, day to a named horizon",
    area: "lens",
    /*
     * Day, week, month, quarter, year and a span of years the app names,
     * over real dates — the question the timeline cannot answer, because it
     * binds minutes of a day.
     *
     * Shown at the FURTHEST one it draws. Every app here has a month; only
     * the garden has something whose subject is years, and a row whose job
     * is "where to see this" should open on the thing you cannot see
     * anywhere else.
     */
    holds: usesLens("calendar"),
    shownIn: "seedbed",
    stop: "?chapter=16#focus=agg:rotation&in.view=the-rotation",
  },
  {
    id: "cap-coverage",
    label: "Coverage lens",
    area: "lens",
    holds: usesLens("coverage"),
    shownIn: "rota",
    stop: "#focus=aggregate:volunteer",
  },
  { id: "cap-board", label: "Board lens", area: "lens", holds: usesLens("board"), shownIn: "seedbed", stop: "?chapter=11#overview=1" },
  {
    id: "cap-entity-lens",
    label: "A lens binding kinds and edges",
    area: "lens",
    holds: (app) => (app.lenses ?? []).some((lens) => bindsOf(lens) === "entities"),
    shownIn: "rota",
    stop: "#focus=aggregate:volunteer",
  },

  /* ------------------------------------------- 4 · the routed face */
  {
    id: "cap-routed-face",
    label: "A routed face, derived",
    area: "behavior",
    // Every app has one for free; the declaration cannot say so, which is
    // exactly what makes it worth a stop rather than a sentence.
    holds: () => true,
    shownIn: "todo",
    stop: "/pages",
  },
  {
    id: "cap-own-design",
    label: "A face of the app's own",
    area: "behavior",
    // Things and Rota replace every routed surface; the seedbed replaces
    // them in its thirteenth chapter. Not derivable from the declaration —
    // a design is a registry, not a field — so it is named where it is.
    holds: () => true,
    shownIn: "rota",
    stop: "/pages",
  },

  /* ------------------------------------ 5 · who may do what, and seats */
  {
    id: "cap-policy",
    label: "Who may do what",
    area: "declaration",
    holds: (app) => (app.policy?.grants ?? []).length > 0,
    shownIn: "rota",
    stop: "#focus=aggregate:shift&sel=s-fri-repair&as=user-sam",
  },
  {
    id: "cap-installation",
    label: "An installation: people and invitations",
    area: "declaration",
    holds: (app) => (app.schema.kinds as readonly string[]).includes("user"),
    shownIn: "rota",
    stop: "#overview=1&show=installation",
  },
  {
    id: "cap-profile",
    label: "A profile, and the reader's own settings",
    area: "declaration",
    holds: (app) => (app.settings ?? []).length > 0,
    shownIn: "todo",
    stop: "#focus=aggregate:list",
  },

  /* ------------------------------------------ 6 · brand, kit, embed */
  {
    id: "cap-brand",
    label: "A brand the checker measured",
    area: "declaration",
    holds: (app) => app.brand !== undefined,
    shownIn: "rota",
    stop: "#overview=1",
  },
  {
    id: "cap-kit",
    label: "A kit: how the lines are drawn",
    area: "declaration",
    holds: (app) => app.brand?.kit !== undefined,
    shownIn: "rota",
    stop: "#focus=aggregate:shift&relation=covered-by",
  },
  {
    id: "cap-embed",
    label: "On somebody else's page",
    area: "behavior",
    // A mount is a call, not a declaration — so this one names where it is
    // rather than pretending to be derivable.
    holds: () => true,
    shownIn: "rota",
    stop: "/embed.html",
  },

  /* -------------------------------------- 7 · remember, ship, migrate */
  {
    id: "cap-remote-adapter",
    label: "It remembers in this browser",
    area: "behavior",
    // Every app opens through `open()` with ship's browser adapter — the
    // declaration does not say so, and the desk reads declarations, which
    // is why this one is named where it is instead.
    holds: () => true,
    shownIn: "todo",
    stop: "#focus=aggregate:list",
  },
  {
    id: "cap-migration",
    label: "A version, and the way forward from the last one",
    area: "declaration",
    holds: (app) => app.version !== undefined && (app.migrations ?? []).length > 0,
    shownIn: "rota",
    stop: "?stored=1#overview=1",
  },
  {
    id: "cap-server-persistence",
    label: "Data in a folder you can open",
    area: "behavior",
    /*
     * SERVER-SIDE PERSISTENCE, answered from the declaration rather than
     * asserted: an app that declares a `version` and its migrations is an
     * app whose stored graph outlives the browser it was made in, which is
     * what this capability is actually about. `graview serve` keeps it as
     * `snapshot.json`, a `log.jsonl` a person can grep, and a `meta.json`
     * holding that version — or in SQLite behind one flag.
     */
    holds: (app) => app.version !== undefined && (app.migrations ?? []).length > 0,
    shownIn: "rota",
    stop: `?server=${addressOf({ port: portOf("served", 5196) })}#overview=1`,
  },

  /* --------------------------------------- 8 · the agent, and the studio */
  {
    id: "cap-intelligence",
    label: "An agent seat, declared",
    area: "declaration",
    holds: (app) => (app.intelligence ?? []).length > 0,
    shownIn: "seedbed",
    stop: "?chapter=5#overview=1",
  },
  {
    id: "cap-modules",
    label: "Parts a workspace can turn off",
    area: "declaration",
    holds: (app) => Object.keys(app.modules ?? {}).length > 0,
    shownIn: "rota",
    stop: "#overview=1&show=installation",
  },
  {
    id: "cap-studio",
    label: "The declaration, open in the app",
    area: "behavior",
    // The studio is offered wherever there is a seat that may administer,
    // or wherever nothing is administered at all — which is every app.
    holds: () => true,
    shownIn: "rota",
    stop: "#overview=1",
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
    ...CAPABILITIES.map((item, at) => ({
      id: item.id,
      kind: "capability",
      label: item.label,
      area: item.area,
      // Its place in the order a person meets it, which is the order the
      // list is written in — so the matrix reads left to right as an
      // onboarding rather than alphabetically as an index.
      at,
      ...(item.shownIn ? { shownIn: item.shownIn } : {}),
      ...(item.stop ? { stop: item.stop } : {}),
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

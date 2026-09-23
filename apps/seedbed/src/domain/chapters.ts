import {
  createSchema,
  defineApp,
  defineNode,
  type GraphSnapshot,
  type GraviewApp,
  type Policy,
  type Principal,
  declareInstallation,
} from "@graview/core";
import { z } from "zod";
import { declarationToGraph, studioApp } from "@graview/studio";
import { seedbedBrand } from "./brand.js";
import { everyPlotTended } from "./invariants.js";
import { addGardener, addPlot, adoptRule, harvest, rotate, sow, sowInTurn, tend } from "./mutations.js";
import { gardener, planting, plot, rotation, rule } from "./schema.js";

/**
 * THE GARDEN, GROWN A CHAPTER AT A TIME.
 *
 * The docs and the marketing page say "declare a little, check it, look at
 * it, declare more". This is that sentence made into data: one example, the
 * community garden, as it stands after each step — the declaration it has,
 * the graph it holds, and the stop worth photographing. Every chapter is a
 * real GraviewApp that passes its own check; `scripts/progression.mjs`
 * renders each one and writes what it saw, so the pages that teach from
 * these pictures can never drift from what the framework does.
 *
 * Nothing here is a second copy of the garden. The kinds, acts and rule are
 * the ones the finished example uses; a chapter is a SUBSET of them plus the
 * seed it has earned so far. The one exception is the first plot, which has
 * no edge yet because there is nobody to point it at.
 */
export interface Chapter {
  readonly n: number;
  readonly slug: string;
  readonly title: string;
  /** The one thing this chapter proves, in the docs' own words. */
  readonly claim: string;
  /** What the declaration gained since the last chapter. */
  readonly adds: readonly string[];
  readonly app: GraviewApp;
  /** The garden as it stands. Chapters that start empty say so. */
  readonly seed: GraphSnapshot;
  /** The stop worth a picture: a URL fragment the scene understands. */
  readonly stop: string;
  /** What the picture-taker does once there. */
  readonly drive?: "activity" | "select-plot" | "standing";
  /** Whether this chapter's app remembers in the browser (chapter 6 on). */
  readonly remembers: boolean;
  /** Whether the agent's seat is in the rail (chapter 5 on). */
  readonly seat: boolean;
  /** Who is at the keyboard, once the garden has a policy. */
  readonly principal?: Principal;
  /** The seats a reader may take on the page, once there is a policy to feel. */
  readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
  /** Whether the garden's own plot page is registered over the derived face (chapter 9 on). */
  readonly pages: boolean;
  /** Whether the coverage lens is mounted over the gardeners (chapter 10 on). */
  readonly lens: boolean;
  /** The declaration this chapter's studio edits: the chapter is the studio over it (chapter 15). */
  readonly studioOf?: GraviewApp;
  /** Whether the board lens is mounted over the plots (chapter 11 on). */
  readonly board: boolean;
  /** Whether the garden's own lens — the map — is mounted over the plots instead of the board (chapter 13). */
  readonly map?: boolean;
  /** Whether the pages face wears the garden's own design, every surface replaced (chapter 13). */
  readonly design?: boolean;
  /** For the pages face: photograph at a desk's width rather than a phone's. */
  readonly wide?: boolean;
  /** Whether the reach lens — what each role may do — is registered over the people (chapter 14). */
  readonly reach?: boolean;
  /** Whether the season calendar — what was in the ground, and when — is over the plantings. */
  readonly season?: boolean;
  /** Whether the rotation — the years a bed turns through — is over the rotations (chapter 16). */
  readonly rotation?: boolean;
  /** Which face the picture is of: the scene (default) or the routed pages at phone width. */
  readonly face?: "scene" | "pages";
  /** For the pages face: the path to photograph. */
  readonly path?: string;
  /**
   * What an older deployment left behind, for the chapter about shipping:
   * a graph stored at an earlier version, which opening must carry forward.
   */
  readonly stored?: { readonly version: number; readonly snapshot: GraphSnapshot };
}

/** A chapter's app at the boundary where every chapter is the same shape. */
const asApp = (app: unknown): GraviewApp => app as GraviewApp;

/* ------------------------------------------------ 1 · a plot, alone */

/** The first kind, before there is anyone to tend it: no edge yet. */
const plotAlone = defineNode("plot", {
  description: "A patch of ground with a number and how many beds it holds.",
  fields: z.object({ label: z.string().min(1), beds: z.number().int().min(1) }),
  plural: "Plots",
  label: (node) => node.label,
});

const one = createSchema([plotAlone]);
const chapterOne: Chapter = {
  n: 1,
  slug: "a-plot",
  title: "A plot",
  claim: "One kind, one act. The city, the district, the derived form and the routed face all exist before a line of UI is written.",
  adds: ['defineNode("plot")', 'defineMutation("add-plot") with creates: ["plot"]'],
  app: asApp(defineApp({ name: "Seedbed", schema: one, mutations: [addPlot as never] })),
  seed: {
    nodes: [
      { id: "plot-1", kind: "plot", label: "Plot 1", beds: 4 },
      { id: "plot-2", kind: "plot", label: "Plot 2", beds: 3 },
    ],
    edges: [],
  },
  stop: "#overview=1&expand=kind:plot",
  remembers: false,
  seat: false,
  pages: false,
  lens: false,
  board: false,
};

/* ------------------------------- 2 · gardeners, and who tends what */

const two = createSchema([gardener, plot]);
const chapterTwo: Chapter = {
  n: 2,
  slug: "who-tends-what",
  title: "Gardeners, and who tends what",
  claim: "A second kind and one edge. The line is drawn from the declaration, captioned in its own words, and made and unmade by the act that names it.",
  adds: ['defineNode("gardener")', 'edges: { "tended-by": { to: ["gardener"], description, inverse } } on plot', 'defineMutation("tend") with connects and severs'],
  app: asApp(defineApp({ name: "Seedbed", schema: two, mutations: [addGardener, addPlot, tend] as never })),
  seed: {
    nodes: [
      { id: "june", kind: "gardener", label: "June" },
      { id: "ravi", kind: "gardener", label: "Ravi" },
      { id: "plot-1", kind: "plot", label: "Plot 1", beds: 4 },
      { id: "plot-2", kind: "plot", label: "Plot 2", beds: 3 },
    ],
    edges: [{ kind: "tended-by", from: "plot-1", to: "june" }],
  },
  stop: "#focus=plot-1",
  remembers: false,
  seat: false,
  pages: false,
  lens: false,
  board: false,
};

/* ------------------------------------------- 3 · the garden's agreement */

const three = createSchema([gardener, plot, rule]);
const chapterThree: Chapter = {
  n: 3,
  slug: "the-agreement",
  title: "The garden's agreement",
  claim: "A rule is data on the map, and it names its own repair. The moment it lands, an untended plot is a problem with a one-click fix, not a bug report.",
  adds: ['defineNode("rule") with requiresInvariant', 'defineInvariant("every-plot-tended") with repairs: ["tend"]', 'defineMutation("adopt-rule")'],
  app: asApp(
    defineApp({
      name: "Seedbed",
      schema: three,
      mutations: [addGardener, addPlot, tend, adoptRule] as never,
      invariants: [everyPlotTended as never],
    }),
  ),
  seed: {
    nodes: [
      { id: "june", kind: "gardener", label: "June" },
      { id: "ravi", kind: "gardener", label: "Ravi" },
      { id: "plot-1", kind: "plot", label: "Plot 1", beds: 4, x: 0.25, y: 0.35 },
      { id: "plot-2", kind: "plot", label: "Plot 2", beds: 3, x: 0.72, y: 0.35 },
      { id: "every-plot-tended", kind: "rule", label: "Every plot has a caretaker", spec: { type: "every-plot-tended" } },
    ],
    edges: [{ kind: "tended-by", from: "plot-1", to: "june" }],
  },
  // The rule on the map, opened, and Standing's own account of what it found.
  stop: "#overview=1&expand=kind:rule",
  drive: "standing",
  remembers: false,
  seat: false,
  pages: false,
  lens: false,
  board: false,
};

/* ------------------------------------------ 4 · plantings and the past */

const four = createSchema([gardener, plot, planting, rule]);
const grown = [addGardener, addPlot, sow, tend, harvest, adoptRule] as never;
const seedFour: GraphSnapshot = {
  nodes: [
    ...chapterThree.seed.nodes,
    { id: "beans", kind: "planting", label: "Beans", sown: "2026-04-04", status: "growing" },
    // Sown in March and brought in in April: a span, which is what a
    // planting is and what the season calendar draws it as.
    { id: "tomatoes", kind: "planting", label: "Tomatoes", sown: "2026-03-20", harvested: "2026-04-12", status: "harvested" },
  ],
  edges: [
    ...chapterThree.seed.edges,
    { kind: "tended-by", from: "plot-2", to: "ravi" },
    { kind: "grows-in", from: "beans", to: "plot-1" },
    { kind: "grows-in", from: "tomatoes", to: "plot-2" },
  ],
};
const chapterFour: Chapter = {
  n: 4,
  slug: "the-horizon",
  title: "Plantings, and the horizon",
  claim: "A harvested planting leaves the counts but never the graph. The district says +1 past, and last season is one stop away rather than deleted — and the season calendar draws each planting across the days it was actually in the ground.",
  adds: ['defineNode("planting") with lifecycle: { field: "status", retired: ["harvested", "failed"] }', 'an appendOnly edge "grows-in"', 'defineMutation("sow"), defineMutation("harvest") with writes: ["status", "harvested"]'],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never] })),
  seed: seedFour,
  stop: "#overview=1",
  remembers: false,
  seat: false,
  pages: false,
  lens: false,
  board: false,
  season: true,
};

/* ----------------------------------------------- 5 · a seat for an agent */

const intelligence = [
  {
    name: "starter",
    kind: "graph" as const,
    description: "Proposes first data and open repairs from the declaration alone.",
    may: ["add-gardener", "add-plot", "sow", "tend", "adopt-rule"],
  },
];
const chapterFive: Chapter = {
  n: 5,
  slug: "a-seat",
  title: "A seat for an agent",
  claim: "An agent gets the same acts a person does, through one declared seam. Its turn is attributed in the log, watchable from altitude, and undoable out of order.",
  adds: ["intelligence: [{ name: \"starter\", kind: \"graph\", may: [...] }] on defineApp", "an AgentSeat in the rail, gated on add-gardener"],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], intelligence })),
  seed: { nodes: [], edges: [] },
  stop: "#overview=1",
  drive: "activity",
  remembers: false,
  seat: true,
  pages: false,
  lens: false,
  board: false,
};

/* ---------------------------------------------- 6 · the garden remembers */

const chapterSix: Chapter = {
  n: 6,
  slug: "it-remembers",
  title: "The garden remembers",
  claim: "Persistence is the operation log. One adapter in main.tsx and an edit survives a reload, still attributed, still undoable, with the way back to empty on the rail.",
  adds: ["openStore({ app, adapter: createBrowserAdapter(), fresh: browserStartsFresh() }) in main.tsx", "remembers on the Shell"],
  app: chapterFive.app,
  seed: seedFour,
  stop: "#overview=1",
  drive: "activity",
  remembers: true,
  seat: true,
  pages: false,
  lens: false,
  board: false,
};

/* ---------------------------------------------- 7 · who may do what */

const policy: Policy = {
  roles: ["coordinator", "gardener"],
  grants: [
    { roles: ["coordinator"], mutations: "*", describe: "The coordinator keeps the map." },
    { roles: ["gardener"], mutations: ["sow", "harvest", "tend"], describe: "A gardener works the ground." },
  ],
};
const ravi: Principal = { kind: "human", id: "ravi", roles: ["gardener"] };
const coordinator: Principal = { kind: "human", id: "june", roles: ["coordinator"] };
/** Two seats at the keyboard, from the chapter that declares who may do what. */
const seats = [
  { label: "June, coordinator", principal: coordinator },
  { label: "Ravi, gardener", principal: ravi },
] as const;

const chapterSeven: Chapter = {
  n: 7,
  slug: "who-may",
  title: "Who may do what",
  claim: "One policy, declared once. The store refuses, the actions strip narrows, and an agent's seat narrows with it, so a gardener never sees a button that would fail.",
  adds: ["policy: { roles, grants } on defineApp", "a principal with roles on the store"],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], intelligence, policy })),
  seed: seedFour,
  stop: "#overview=1&sel=kind:plot",
  drive: "select-plot",
  remembers: false,
  seat: true,
  pages: false,
  lens: false,
  board: false,
  principal: ravi,
  seats,
};

/* ------------------------------------------ 8 · the garden's own name */

const chapterEight: Chapter = {
  n: 8,
  slug: "its-own-name",
  title: "The garden's own name",
  claim: "One accent, a mark and a typeface, and both schemes are derived and measured. Every text pair is checked against AA before the brand is allowed to ship.",
  adds: ["brand: { name, logo, typography, accents, schemes: brandFromAccent(...) } on defineApp"],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], intelligence, policy, brand: seedbedBrand })),
  seed: seedFour,
  stop: "#overview=1",
  remembers: false,
  seat: true,
  pages: false,
  lens: false,
  board: false,
  principal: coordinator,
  seats,
};

/* ------------------------------------------------- 9 · the other face */

const chapterNine: Chapter = {
  n: 9,
  slug: "the-other-face",
  title: "The other face",
  claim: "The same declaration is also an ordinary web application: lists, records, forms and problems, routed, at phone width — with the garden's own pictures as pages, a map of how the kinds fit together, and the seat on every route. Any page can be replaced with one the app writes, in its own words, over the same derivations.",
  adds: ["PagesApp at /pages, from the same store", "views in the page context: every lens a page at /places, and the assistant with it", "createPageRegistry(schema).register(\"plot\", \"record\", PlotPage) — the plot's page in the garden's words"],
  app: chapterEight.app,
  seed: seedFour,
  stop: "",
  face: "pages",
  path: "/pages/plots/plot-2",
  remembers: false,
  seat: true,
  pages: true,
  lens: false,
  board: false,
  principal: coordinator,
  seats,
};

/* ---------------------------------------------- 10 · a lens over the garden */

/**
 * The coverage lens, written for requirements and the tests that answer
 * them, over gardeners and the plots they tend. It binds ROLES — rows,
 * columns, the edge between — and has never heard of a garden.
 */
const coverage = {
  name: "coverage",
  requiredRoles: ["rows", "columns", "link"],
  binds: "entities" as const,
  bindings: { rows: { kind: "gardener" }, columns: { kind: "plot" }, link: { edge: "tended-by" } },
};
const chapterTen: Chapter = {
  n: 10,
  slug: "a-lens",
  title: "A lens over the garden",
  claim: "A lens binds roles, not field names. The coverage grid was written for requirements and tests; pointed at gardeners and plots it says, in a picture, which plot nobody tends.",
  adds: ["lenses: [{ name: \"coverage\", binds: \"entities\", bindings: { rows, columns, link } }] on defineApp", "the lens's View registered for the gardeners, cardinality many"],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], intelligence, policy, brand: seedbedBrand, lenses: [coverage] })),
  seed: {
    nodes: seedFour.nodes,
    // Plot 2's caretaker steps back: the grid shows the gap the rule names.
    edges: seedFour.edges.filter((edge) => !(edge.kind === "tended-by" && edge.from === "plot-2")),
  },
  stop: "#focus=agg:gardener",
  remembers: false,
  seat: true,
  pages: true,
  lens: true,
  board: false,
  principal: coordinator,
  seats,
};

/* ------------------------------------------------ 11 · what grows where */

/**
 * The board lens, written for a seating plan, over the plots where they
 * lie and what grows in each. The garden binds a kind, two fields and an
 * edge to the lens's roles; the empty bed is the whole point.
 */
const board = {
  name: "board",
  requiredRoles: ["slots", "x", "y", "fill"],
  binds: "entities" as const,
  bindings: { slots: { kind: "plot" }, x: { field: "x", on: "slots" }, y: { field: "y", on: "slots" }, fill: { edge: "grows-in" } },
};
const chapterEleven: Chapter = {
  n: 11,
  slug: "what-grows-where",
  title: "What grows where",
  claim: "A second lens, written for a seating plan, drawn over the plots where they lie in the garden. Things sit where the domain says they sit, and an empty bed is a picture of something to do, not a missing row.",
  adds: ["x and y on plot, 0..1 across the garden", "a second lens declaration binding slots, x, y and fill to plot and grows-in", "fillFrom: \"occupant\" — the lens reads the edge from the planting's end"],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], intelligence, policy, brand: seedbedBrand, lenses: [coverage, board] })),
  seed: {
    nodes: [
      ...seedFour.nodes.filter((node) => node.kind !== "plot"),
      { id: "plot-1", kind: "plot", label: "Plot 1", beds: 4, x: 0.18, y: 0.3 },
      { id: "plot-2", kind: "plot", label: "Plot 2", beds: 3, x: 0.5, y: 0.3 },
      { id: "plot-3", kind: "plot", label: "Plot 3", beds: 2, x: 0.82, y: 0.3 },
    ],
    edges: [...seedFour.edges, { kind: "tended-by", from: "plot-3", to: "june" }],
  },
  stop: "#focus=agg:plot",
  remembers: false,
  seat: true,
  pages: true,
  lens: true,
  board: true,
  principal: coordinator,
  seats,
};

/* ------------------------------------------------------------ 12 · ship it */

/**
 * The declaration gains a version and the migration between them. A garden
 * stored by the earlier deployment — before there was an agreement — is
 * carried forward on open: the migration is an operation in the log, by
 * the system, invertible like any other.
 */
const chapterTwelve: Chapter = {
  n: 12,
  slug: "ship-it",
  title: "Ship it",
  claim: "Deployment is one declaration plus one adapter. A version and a migration on the app carry a garden stored last season forward, as a logged, attributed, undoable operation.",
  adds: ["version: 2 and migrations: [{ from: 1, to: 2, title, apply }] on defineApp", "openStore against a stored version-1 garden"],
  app: asApp(
    defineApp({
      name: "Seedbed",
      schema: four,
      mutations: grown,
      invariants: [everyPlotTended as never],
      intelligence,
      policy,
      brand: seedbedBrand,
      lenses: [coverage, board],
      version: 2,
      migrations: [
        {
          from: 1,
          to: 2,
          title: "Every garden adopts the agreement",
          apply: (snapshot) =>
            snapshot.nodes.some((node) => node.kind === "rule")
              ? []
              : [
                  {
                    op: "add-node" as const,
                    node: {
                      id: "every-plot-tended",
                      kind: "rule",
                      label: "Every plot has a caretaker",
                      spec: { type: "every-plot-tended" },
                    },
                  },
                ],
        },
      ],
    }),
  ),
  seed: seedFour,
  stored: {
    version: 1,
    // Last season's garden: plots, gardeners and plantings, and no rule yet.
    snapshot: { nodes: seedFour.nodes.filter((node) => node.kind !== "rule"), edges: seedFour.edges },
  },
  stop: "#overview=1",
  drive: "activity",
  remembers: true,
  seat: true,
  pages: true,
  lens: true,
  board: true,
  principal: coordinator,
  seats,
};

/* ------------------------------------------- 13 · the garden's own face */

/**
 * Chapter nine replaced one page. This replaces every surface and every
 * page — the shell, the home, the lists, the records, the problems — with
 * the garden's own design, and the board in the scene with a lens the
 * garden drew of itself. Nothing underneath changed: the same store, the
 * same acts, the same rules and the same permissions the derived face
 * reads. That is what a registry is for.
 */
const chapterThirteen: Chapter = {
  n: 13,
  slug: "the-gardens-own-face",
  title: "The garden's own face",
  claim: "Every surface of the pages face replaced with the garden's own design — an almanac, not an admin panel — and a lens the garden drew of itself in the scene. The same store, acts, rules and permissions underneath; only what a reader sees is the app's.",
  adds: [
    'createPageRegistry(schema).surface("shell" | "home" | "problems", …) and .register(kind, "list" | "record", …) for every kind',
    'register("plot", { cardinality: "many", fidelity: "full" }, GardenMapView, { title: "The garden map" }) — a lens of the garden\'s own',
  ],
  app: chapterTwelve.app,
  // The garden with the untended plot in it: the design has something to say.
  seed: chapterEleven.seed,
  stop: "#focus=agg:plot",
  face: "pages",
  path: "/pages",
  wide: true,
  remembers: false,
  seat: true,
  pages: true,
  design: true,
  lens: true,
  board: false,
  map: true,
  principal: coordinator,
  seats,
};

/* ------------------------------------------------ 14 · who is here */

/**
 * The installation is in the graph. Who may use the garden, who has been
 * asked to, and what each of them may do are nodes and acts like everything
 * else — drawn only for the coordinator, who sees "Show the installation"
 * on the bar, and never a district for a gardener. A person's card is their
 * profile; the derived edit of it is theirs alone by a self grant; and a
 * lens over the policy draws what each role reaches, read through the same
 * function the store refuses with.
 */
const installation = declareInstallation({ roles: ["coordinator", "gardener"], admin: "coordinator" });
const fourAndWhoIsHere = createSchema([gardener, plot, planting, rule, ...installation.kinds]);
/*
 * The people at the keyboard ARE nodes now: a seat's principal id is its
 * user node's id, which is what a self grant compares. The gardener nodes
 * june and ravi keep their ids; the users are the same two people as the
 * installation knows them.
 */
const juneUser: Principal = { kind: "human", id: "user-june", roles: ["coordinator"] };
const raviUser: Principal = { kind: "human", id: "user-ravi", roles: ["gardener"] };
const seatsWhoIsHere = [
  { label: "June, coordinator", principal: juneUser },
  { label: "Ravi, gardener", principal: raviUser },
] as const;
const chapterFourteen: Chapter = {
  n: 14,
  slug: "who-is-here",
  title: "Who is here",
  claim: "Users, invitations and roles are nodes and acts like everything else: drawn only for the seat that keeps the installation, refused for everyone else by the same policy, and a person's own record is theirs to edit. A lens over the policy shows what each role reaches.",
  adds: [
    'declareInstallation({ roles, admin }) — two kinds, six acts, a module drawn only for those who administer it, and a self grant for a profile',
    'createSchema([...yours, ...installation.kinds]), mutations: [...yours, ...installation.mutations], policy: installation.withPolicy(policy)',
    'reachLens registered over the people as "Who may do what"',
  ],
  app: asApp(
    defineApp({
      name: "Seedbed",
      schema: fourAndWhoIsHere as never,
      mutations: [...grown, ...installation.mutations] as never,
      invariants: [everyPlotTended as never],
      intelligence,
      policy: installation.withPolicy(policy),
      modules: installation.modules,
      brand: seedbedBrand,
      lenses: [coverage, board],
      version: 2,
      migrations: chapterTwelve.app.migrations as never,
    }),
  ),
  seed: {
    nodes: [
      ...chapterEleven.seed.nodes,
      { id: "user-june", kind: "user", label: "June", email: "june@seedbed.test", roles: ["coordinator"], status: "active" },
      { id: "user-ravi", kind: "user", label: "Ravi", email: "ravi@seedbed.test", roles: ["gardener"], status: "active" },
      { id: "sam-invited", kind: "invitation", label: "sam@seedbed.test", email: "sam@seedbed.test", roles: ["gardener"], status: "pending" },
    ],
    edges: chapterEleven.seed.edges,
  },
  stop: "#overview=1&show=installation",
  remembers: false,
  seat: true,
  pages: true,
  design: true,
  lens: true,
  board: true,
  reach: true,
  principal: juneUser,
  seats: seatsWhoIsHere,
};

/*
 * THE STUDIO. The declaration chapter fourteen arrived at — its kinds,
 * fields, edges, acts, rules, roles, grants, lenses and brand — read into
 * the graph and opened in Graview's own interface. Adding a field is an
 * act; every change is an op with an author and an inverse; a place says
 * what the checker makes of the declaration as it now stands.
 */
const chapterFifteen: Chapter = {
  n: 15,
  slug: "the-studio",
  title: "The studio",
  claim: "The declaration itself is a graph: every kind, field, edge, act, rule, role and grant of chapter fourteen is a node here, edited with ordinary acts, checked before it is applied, migrated when a stored garden needs it, and written back as the files graview create writes.",
  adds: [
    'createStudio(app) — the declaration as a store of the meta-schema; studio.check(), studio.apply(), studio.files()',
    'add-kind, add-field, add-edge, add-act, add-rule, name-repair, add-role, grant — acts on the declaration, undone like any other',
    'createStudioLens(app) registered over the kinds as "What the checker says"',
  ],
  app: asApp(studioApp("Seedbed studio") as never),
  seed: declarationToGraph(chapterFourteen.app as never),
  stop: "#overview=1",
  remembers: false,
  seat: true,
  pages: true,
  lens: false,
  board: false,
  studioOf: chapterFourteen.app,
};

/* ------------------------------------------- 16 · the years it turns through */

/**
 * THE GARDEN LOOKS OUT OVER YEARS.
 *
 * Everything so far happens inside one season, because until now the
 * furthest the framework could draw was a month: a planting, a rule, a
 * caretaker, a harvest. But a bed is turned through four families and comes
 * back to the first four years later, and that is a fact no month grid can
 * hold — an app whose subject is years had a month grid it could page
 * through forty-eight times.
 *
 * One kind, one act, one binding. The calendar lens that drew the season
 * draws the rotation too, a month per cell across as many years as THE
 * GARDEN says it turns through — four, because it grows four families, and
 * the framework has no opinion about that.
 */
const sixteen = createSchema([gardener, plot, planting, rotation, rule, ...installation.kinds]);
// The rotation's garden sows under the turn a plot is in.
const turning = [...(grown as readonly unknown[]).map((act) => (act === sow ? sowInTurn : act)), rotate, ...installation.mutations] as never;
const turns: readonly { plot: string; family: string; year: number }[] = [
  { plot: "plot-1", family: "brassicas", year: 2026 },
  { plot: "plot-1", family: "legumes", year: 2027 },
  { plot: "plot-1", family: "roots", year: 2028 },
  { plot: "plot-1", family: "resting", year: 2029 },
  { plot: "plot-2", family: "legumes", year: 2026 },
  { plot: "plot-2", family: "roots", year: 2027 },
  { plot: "plot-2", family: "resting", year: 2028 },
  { plot: "plot-2", family: "brassicas", year: 2029 },
];
const said = (family: string): string => `${family[0]!.toUpperCase()}${family.slice(1)}`;
const chapterSixteen: Chapter = {
  n: 16,
  slug: "the-rotation",
  title: "The years it turns through",
  claim:
    "A bed is turned through four families and comes back to the first four years later. The same calendar lens that drew the season draws the rotation, a month per cell over as many years as the garden says it turns through — and how far out that is is the garden's word, not the framework's.",
  adds: [
    'defineNode("rotation") with an appendOnly edge "turns-over" to the plot it turns',
    'an appendOnly edge "holds" from a rotation to what went in during it — so a turn and its plantings are connected, not strangers on the same plot',
    'defineMutation("rotate") — which family a plot grows, and until when; it claims what is already in the ground, and sow puts new plantings under the turn',
    'the same calendar binding at range: "years" with horizon: { years: 4, title: "The rotation" }',
  ],
  app: asApp(
    defineApp({
      name: "Seedbed",
      schema: sixteen as never,
      mutations: turning,
      invariants: [everyPlotTended as never],
      intelligence,
      policy: installation.withPolicy(policy),
      modules: installation.modules,
      brand: seedbedBrand,
      lenses: [
        coverage,
        board,
        /*
         * ONE BINDING, EVERY HORIZON. The season and the rotation are the
         * same lens with different fields answering the same roles — so
         * `graview check` reads exactly the binding it already read, and a
         * horizon four years long needed no new declaration at all.
         */
        {
          name: "calendar",
          requiredRoles: ["start"],
          bindings: {
            planting: { start: "sown", end: "harvested", label: "label" },
            rotation: { start: "from", end: "to", label: "label" },
          },
        },
      ],
      version: 2,
      migrations: chapterTwelve.app.migrations as never,
    }),
  ),
  seed: {
    nodes: [
      ...chapterFourteen.seed.nodes,
      ...turns.map(({ plot: where, family, year }) => ({
        id: `rot-${where}-${year}`,
        kind: "rotation",
        label: `${said(family)} · ${where === "plot-1" ? "Plot 1" : "Plot 2"}`,
        family,
        from: `${year}-03-01`,
        // Through to the end of the growing year, so the span crosses cells
        // rather than sitting in one: a rotation IS a stretch of time.
        to: `${year}-10-31`,
      })),
    ],
    edges: [
      ...chapterFourteen.seed.edges,
      ...turns.map(({ plot: where, year }) => ({ kind: "turns-over", from: `rot-${where}-${year}`, to: where })),
      /*
       * And what each turn held: every planting sown in that plot inside
       * that turn's dates — the same join `rotate` and `sow` write.
       */
      ...chapterFourteen.seed.edges
        .filter((edge) => edge.kind === "grows-in")
        .flatMap((edge) => {
          const sown = String(chapterFourteen.seed.nodes.find((node) => node.id === edge.from)?.["sown"] ?? "");
          const turn = turns.find(({ plot: where, year }) => where === edge.to && `${year}-03-01` <= sown && sown <= `${year}-10-31`);
          return turn ? [{ kind: "holds", from: `rot-${turn.plot}-${turn.year}`, to: edge.from }] : [];
        }),
    ],
  },
  stop: "#focus=agg:rotation&in.view=the-rotation",
  remembers: false,
  seat: true,
  pages: true,
  lens: true,
  board: true,
  reach: true,
  season: true,
  rotation: true,
  principal: juneUser,
  seats: seatsWhoIsHere,
};

export const CHAPTERS: readonly Chapter[] = [
  chapterOne,
  chapterTwo,
  chapterThree,
  chapterFour,
  chapterFive,
  chapterSix,
  chapterSeven,
  chapterEight,
  chapterNine,
  chapterTen,
  chapterEleven,
  chapterTwelve,
  chapterThirteen,
  chapterFourteen,
  chapterFifteen,
  chapterSixteen,
];

/** The chapter a URL asks for, or none: the finished example is the default. */
export function chapterFromSearch(search: string): Chapter | null {
  const asked = Number(new URLSearchParams(search).get("chapter"));
  return Number.isInteger(asked) && asked >= 1 && asked <= CHAPTERS.length ? CHAPTERS[asked - 1]! : null;
}

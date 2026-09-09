import {
  createSchema,
  defineApp,
  defineNode,
  type GraphSnapshot,
  type GraviewApp,
  type Policy,
  type Principal,
} from "@graview/core";
import { z } from "zod";
import { seedbedBrand } from "./brand.js";
import { everyPlotTended } from "./invariants.js";
import { addGardener, addPlot, adoptRule, harvest, sow, tend } from "./mutations.js";
import { gardener, planting, plot, rule } from "./schema.js";

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
  readonly drive?: "activity" | "select-plot";
  /** Whether this chapter's app remembers in the browser (chapter 6 on). */
  readonly remembers: boolean;
  /** Whether the agent's seat is in the rail (chapter 5 on). */
  readonly seat: boolean;
  /** Who is at the keyboard, once the garden has a policy. */
  readonly principal?: Principal;
}

/** A chapter's app at the boundary where every chapter is the same shape. */
const asApp = (app: unknown): GraviewApp => app as GraviewApp;

/**
 * The brand, narrowed to the kinds a chapter has. `accents` names kinds by
 * hue, and an accent for a kind nobody declared is a check ERROR — rightly:
 * it is a brand decision that looks applied and is not.
 */
const brandFor = (kinds: readonly string[]) => ({
  ...seedbedBrand,
  accents: Object.fromEntries(
    Object.entries(seedbedBrand.accents ?? {}).filter(([kind]) => kinds.includes(kind)),
  ),
});

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
  app: asApp(defineApp({ name: "Seedbed", schema: one, mutations: [addPlot as never], brand: brandFor(one.kinds) })),
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
};

/* ------------------------------- 2 · gardeners, and who tends what */

const two = createSchema([gardener, plot]);
const chapterTwo: Chapter = {
  n: 2,
  slug: "who-tends-what",
  title: "Gardeners, and who tends what",
  claim: "A second kind and one edge. The line is drawn from the declaration, captioned in its own words, and made and unmade by the act that names it.",
  adds: ['defineNode("gardener")', 'edges: { "tended-by": { to: ["gardener"], description } } on plot', 'defineMutation("tend") with connects and severs'],
  app: asApp(defineApp({ name: "Seedbed", schema: two, mutations: [addGardener, addPlot, tend] as never, brand: brandFor(two.kinds) })),
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
      brand: brandFor(three.kinds),
    }),
  ),
  seed: {
    nodes: [
      { id: "june", kind: "gardener", label: "June" },
      { id: "ravi", kind: "gardener", label: "Ravi" },
      { id: "plot-1", kind: "plot", label: "Plot 1", beds: 4 },
      { id: "plot-2", kind: "plot", label: "Plot 2", beds: 3 },
      { id: "every-plot-tended", kind: "rule", label: "Every plot has a caretaker", spec: { type: "every-plot-tended" } },
    ],
    edges: [{ kind: "tended-by", from: "plot-1", to: "june" }],
  },
  stop: "#focus=plot-2",
  remembers: false,
  seat: false,
};

/* ------------------------------------------ 4 · plantings and the past */

const four = createSchema([gardener, plot, planting, rule]);
const grown = [addGardener, addPlot, sow, tend, harvest, adoptRule] as never;
const seedFour: GraphSnapshot = {
  nodes: [
    ...chapterThree.seed.nodes,
    { id: "beans", kind: "planting", label: "Beans", sown: "2026-04-04", status: "growing" },
    { id: "tomatoes", kind: "planting", label: "Tomatoes", sown: "2026-03-20", status: "harvested" },
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
  claim: "A harvested planting leaves the counts but never the graph. The district says +1 past, and last season is one stop away rather than deleted.",
  adds: ['defineNode("planting") with lifecycle: { field: "status", retired: ["harvested", "failed"] }', 'an appendOnly edge "grows-in"', 'defineMutation("sow"), defineMutation("harvest") with writes: ["status"]'],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], brand: seedbedBrand })),
  seed: seedFour,
  stop: "#overview=1",
  remembers: false,
  seat: false,
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
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], brand: seedbedBrand, intelligence })),
  seed: { nodes: [], edges: [] },
  stop: "#overview=1",
  drive: "activity",
  remembers: false,
  seat: true,
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
};

/* ---------------------------------------------- 7 · who may do what */

const policy: Policy = {
  roles: ["coordinator", "gardener"],
  grants: [
    { roles: ["coordinator"], mutations: "*", describe: "The coordinator keeps the map." },
    { roles: ["gardener"], mutations: ["sow", "harvest", "tend"], describe: "A gardener works the ground." },
  ],
};
const chapterSeven: Chapter = {
  n: 7,
  slug: "who-may",
  title: "Who may do what",
  claim: "One policy, declared once. The store refuses, the actions strip narrows, and an agent's seat narrows with it, so a gardener never sees a button that would fail.",
  adds: ["policy: { roles, grants } on defineApp", "a principal with roles on the store"],
  app: asApp(defineApp({ name: "Seedbed", schema: four, mutations: grown, invariants: [everyPlotTended as never], brand: seedbedBrand, intelligence, policy })),
  seed: seedFour,
  stop: "#overview=1&sel=kind:plot",
  drive: "select-plot",
  remembers: false,
  seat: true,
  principal: { kind: "human", id: "ravi", roles: ["gardener"] },
};

export const CHAPTERS: readonly Chapter[] = [
  chapterOne,
  chapterTwo,
  chapterThree,
  chapterFour,
  chapterFive,
  chapterSix,
  chapterSeven,
];

/** The chapter a URL asks for, or none: the finished example is the default. */
export function chapterFromSearch(search: string): Chapter | null {
  const asked = Number(new URLSearchParams(search).get("chapter"));
  return Number.isInteger(asked) && asked >= 1 && asked <= CHAPTERS.length ? CHAPTERS[asked - 1]! : null;
}

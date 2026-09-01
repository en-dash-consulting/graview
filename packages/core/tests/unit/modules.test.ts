import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  checkApp,
  createSchema,
  defineApp,
  defineNode,
  resolveModules,
  Store,
  type Violation,
} from "../../src/index.js";

/**
 * Modules: named parts of a declaration a workspace can turn on and off.
 * Everything no module claims is core and always on; disabling never
 * deletes — nodes of a disabled kind stay in the graph and stop being
 * offered, drawn or judged.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
});
const vehicle = defineNode("vehicle", {
  fields: z.object({ label: z.string() }),
  plural: "Vehicles",
  edges: { "driven-by": { to: ["person"], description: "who drives it" } },
});
const route = defineNode("route", {
  fields: z.object({ label: z.string() }),
  plural: "Routes",
  edges: { uses: { to: ["vehicle"], description: "the car it needs" } },
});
const schema = createSchema([person, vehicle, route]);
const bound = bindSchema(schema);

const addVehicle = bound.defineMutation("add-vehicle", {
  title: "Add a vehicle",
  description: "Put a car in the fleet.",
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ kind: "vehicle", label: args.label } as never);
  },
});
const rename = bound.defineMutation("rename", {
  title: "Rename",
  description: "Rename a person.",
  subject: { kinds: ["person"], arg: "id" },
  input: z.object({ id: z.string(), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const fleetRule = bound.defineInvariant("fleet-not-empty", {
  scope: "graph",
  evaluate: ({ graph }): Violation[] =>
    [...graph.allNodes()].some((node) => node.kind === "vehicle")
      ? []
      : [
          {
            invariant: "fleet-not-empty",
            label: "Fleet",
            message: "No vehicles at all",
            nodeIds: [],
            repairs: [],
          },
        ],
});
const vehicleRule = bound.defineInvariant("vehicle-has-driver", {
  scope: { kind: "vehicle" },
  evaluate: ({ graph, subject }): Violation[] =>
    graph.out(subject.id, "driven-by").length > 0
      ? []
      : [
          {
            invariant: "vehicle-has-driver",
            subjectId: subject.id,
            label: "Driver",
            message: `${subject.label} has no driver`,
            nodeIds: [subject.id],
            repairs: [],
          },
        ],
});

const modules = {
  fleet: { kinds: ["vehicle"], mutations: ["add-vehicle"], invariants: ["fleet-not-empty", "vehicle-has-driver"] },
  routing: { kinds: ["route"], requires: ["fleet"] },
} as const;

const makeStore = (enabledModules?: readonly string[]) =>
  new Store({
    schema,
    mutations: [addVehicle, rename],
    invariants: [fleetRule, vehicleRule],
    modules,
    ...(enabledModules ? { enabledModules } : {}),
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "estate", kind: "vehicle", label: "The estate" },
      ] as never,
      edges: [],
    },
  });

describe("resolveModules", () => {
  it("means everything when no enabled set is given", () => {
    const projection = resolveModules(modules, undefined);
    expect(projection.disabledKinds.size).toBe(0);
    expect(projection.enabled.has("fleet")).toBe(true);
  });

  it("disables what no enabled module claims", () => {
    const projection = resolveModules(modules, []);
    expect([...projection.disabledKinds].sort()).toEqual(["route", "vehicle"]);
    expect(projection.disabledMutations.has("add-vehicle")).toBe(true);
  });

  it("drags requirements in, transitively", () => {
    const projection = resolveModules(modules, ["routing"]);
    expect(projection.enabled.has("fleet")).toBe(true);
    expect(projection.disabledKinds.size).toBe(0);
  });

  it("keeps a kind on while any claimant is enabled", () => {
    const shared = {
      a: { kinds: ["vehicle"] },
      b: { kinds: ["vehicle"] },
    } as const;
    expect(resolveModules(shared, ["a"]).disabledKinds.has("vehicle")).toBe(false);
  });
});

describe("a store with a module off", () => {
  it("stops offering its mutations, and refuses them with the module's name", () => {
    const store = makeStore([]);
    expect(store.allMutations().map((m) => m.name)).toEqual(["rename"]);
    expect(() => store.mutation("add-vehicle")).toThrow(/module/i);
    // Core is untouched.
    expect(() => store.mutation("rename")).not.toThrow();
  });

  it("stops judging its invariants — named ones and kind-scoped ones", () => {
    const off = makeStore([]);
    expect(off.violations()).toEqual([]);
    const on = makeStore(["fleet"]);
    expect(on.violations().map((v) => v.invariant)).toEqual(["vehicle-has-driver"]);
  });

  it("never deletes: the nodes are still in the graph", () => {
    const store = makeStore([]);
    expect(store.graph.getNode("estate")?.label).toBe("The estate");
  });

  it("behaves exactly as before when the store never heard of modules", () => {
    const plain = new Store({
      schema,
      mutations: [addVehicle, rename],
      invariants: [fleetRule, vehicleRule],
      snapshot: { nodes: [{ id: "ana", kind: "person", label: "Ana" }] as never, edges: [] },
    });
    expect(plain.allMutations()).toHaveLength(2);
    expect(plain.violations().map((v) => v.invariant)).toContain("fleet-not-empty");
  });
});

describe("graview check holds the module boundaries", () => {
  const findings = (moduleMap: Record<string, unknown>) =>
    checkApp(
      defineApp({
        name: "test",
        schema,
        mutations: [addVehicle, rename],
        invariants: [fleetRule, vehicleRule],
        modules: moduleMap as never,
      }),
    ).findings.map((f) => `${f.severity}:${f.code}`);

  it("accepts a well-formed module map", () => {
    expect(findings(modules as never).filter((f) => f.includes("module"))).toEqual([]);
  });

  it("errors on claims nobody declared", () => {
    const bad = findings({
      ghost: { kinds: ["hoverboard"], mutations: ["teleport"], invariants: ["no-crashing"], requires: ["warp"] },
    });
    expect(bad).toContain("error:module-unknown-kind");
    expect(bad).toContain("error:module-unknown-mutation");
    expect(bad).toContain("error:module-unknown-invariant");
    expect(bad).toContain("error:module-unknown-requirement");
  });

  it("warns when an always-on kind reaches into a module", () => {
    // route is core here, and its edge reaches vehicle, which fleet owns:
    // the line dangles the day a workspace turns fleet off.
    const leaky = findings({ fleet: { kinds: ["vehicle"] } });
    expect(leaky).toContain("warning:module-edge-leak");
  });

  it("accepts the same edge when the reaching kind's module requires the target's", () => {
    const sound = findings({
      fleet: { kinds: ["vehicle"] },
      routing: { kinds: ["route"], requires: ["fleet"] },
    });
    expect(sound.filter((f) => f.includes("module-edge-leak"))).toEqual([]);
  });
});

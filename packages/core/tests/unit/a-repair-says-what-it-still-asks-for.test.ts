import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "../../src/index.js";

/**
 * A REPAIR SAYS WHAT IT STILL ASKS FOR, whether or not its rule said so (the
 * twelfth walk). A festival's "Every selected film is screened" named
 * `schedule` with the film and left the venue and the time to choose, as
 * graview-invariant teaches; the rule did not write `missing`, so the
 * problems page offered "Schedule Under Weather" as one press and answered
 * it "Not yet: Venue id — invalid input: expected string, received
 * undefined". What an act's input requires and the repair does not give is
 * asked for, wherever the rule is read.
 */
const film = defineNode("film", { fields: z.object({ label: z.string(), status: z.enum(["selected", "declined"]) }), plural: "Films" });
const venue = defineNode("venue", { fields: z.object({ label: z.string() }), plural: "Venues" });
const screening = defineNode("screening", {
  fields: z.object({ label: z.string(), startsAt: z.string() }),
  edges: { shows: { to: ["film"], description: "the film it shows", inverse: "its screenings" } },
  plural: "Screenings",
});
const schema = createSchema([film, venue, screening]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const schedule = defineMutation("schedule", {
  title: "Schedule a screening",
  creates: ["screening"],
  input: z.object({ filmId: nodeRef(["film"]), venueId: nodeRef(["venue"]), startsAt: z.string(), note: z.string().optional() }),
  apply(ctx, args) {
    const id = ctx.freshId("screening", "screening");
    ctx.addNode({ id, kind: "screening", label: "A screening", startsAt: args.startsAt });
    ctx.addEdge({ kind: "shows", from: id, to: args.filmId });
  },
});
const screened = defineInvariant("screened", {
  label: "Every selected film is screened",
  scope: { kind: "film" },
  repairs: ["schedule"],
  evaluate({ graph, subject }) {
    if (subject.status !== "selected" || graph.in(subject.id, "shows").length > 0) return [];
    return [{ invariant: "screened", subjectId: subject.id, label: subject.label, message: "no screening", nodeIds: [subject.id], repairs: [{ mutation: "schedule", args: { filmId: subject.id }, label: "Schedule it" }] }];
  },
});
const snapshot = { nodes: [{ id: "f1", kind: "film", label: "Under Weather", status: "selected" }] as never, edges: [] };

describe("a repair whose rule did not say what it still needs", () => {
  it("asks for every argument its act requires and it does not give, and nothing optional", () => {
    const store = new Store({ schema, mutations: [schedule], invariants: [screened], snapshot });
    const [violation] = store.violations();
    expect(violation?.repairs[0]?.missing).toEqual(["venueId", "startsAt"]);
  });

  it("keeps what a rule said it still needs, and says nothing of a repair that needs nothing", () => {
    const told = defineInvariant("told", {
      label: "Told",
      scope: { kind: "film" },
      repairs: ["schedule"],
      evaluate: ({ subject }) => [
        { invariant: "told", subjectId: subject.id, label: subject.label, message: "told", nodeIds: [subject.id], repairs: [
          { mutation: "schedule", args: { filmId: subject.id }, missing: ["startsAt"], label: "Said" },
          { mutation: "schedule", args: { filmId: subject.id, venueId: "v", startsAt: "now" }, label: "Whole" },
        ] },
      ],
    });
    const store = new Store({ schema, mutations: [schedule], invariants: [told], snapshot });
    const [said, whole] = store.violations()[0]!.repairs;
    expect(said?.missing).toEqual(["startsAt"]);
    expect(whole?.missing).toBeUndefined();
  });
});

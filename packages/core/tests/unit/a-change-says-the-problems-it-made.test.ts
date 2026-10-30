import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "../../src/index.js";
import { problemsMade, viewProblemKey } from "../../src/revisions.js";

/*
 * A CHANGE SAYS THE PROBLEMS IT MADE (Roadmap f-revisions-say-what-broke).
 * An act's or a proposed view's answer carries "this change broke: …" —
 * the rules that held and fail after, the view problems new after — keyed
 * as they will be next time, with the act a rule names to repair it, so
 * nothing waits for a later look at the problems.
 */
const film = defineNode("film", { fields: z.object({ label: z.string(), status: z.enum(["selected", "declined"]) }), plural: "Films" });
const screening = defineNode("screening", { fields: z.object({ label: z.string() }), edges: { shows: { to: ["film"], description: "the film it shows" } }, plural: "Screenings" });
const schema = createSchema([film, screening]);
const { defineMutation, defineInvariant } = bindSchema(schema);
const select = defineMutation("select-film", { title: "Select a film", input: z.object({ filmId: nodeRef(["film"]) }), apply: (ctx, args) => ctx.patchNode(args.filmId, { status: "selected" }) });
const schedule = defineMutation("schedule", {
  title: "Schedule a screening",
  creates: ["screening"],
  input: z.object({ filmId: nodeRef(["film"]) }),
  apply(ctx, args) {
    const id = ctx.freshId("screening", "screening");
    ctx.addNode({ id, kind: "screening", label: "A screening" });
    ctx.addEdge({ kind: "shows", from: id, to: args.filmId });
  },
});
const screened = defineInvariant("screened", {
  label: "Every selected film is screened",
  scope: { kind: "film" },
  repairs: ["schedule"],
  evaluate({ graph, subject }) {
    if (subject.status !== "selected" || graph.in(subject.id, "shows").length > 0) return [];
    return [{ invariant: "screened", subjectId: subject.id, label: subject.label, message: `"${subject.label}" is selected and not screened`, nodeIds: [subject.id], repairs: [{ mutation: "schedule", args: { filmId: subject.id }, label: "Schedule it" }] }];
  },
});
const store = () => new Store({ schema, mutations: [select, schedule], invariants: [screened], snapshot: { nodes: [{ id: "f1", kind: "film", label: "Under Weather", status: "declined" }] as never, edges: [] } });

describe("the problems a change made", () => {
  it("says a rule that held and fails after the act, with the act that repairs it", () => {
    const app = store();
    const before = app.violations();
    app.apply({ name: "select-film", args: { filmId: "f1" } });
    const made = problemsMade({ rules: before }, { rules: app.violations() }, { rules: app.allInvariants() });
    expect(made.made).toMatchObject([{ kind: "rule", rule: "screened", subject: "f1", says: '"Under Weather" is selected and not screened', repair: { act: "schedule", label: "Schedule it", args: { filmId: "f1" } } }]);
    expect(made.mended).toEqual([]);
    expect(made.text).toBe('This change broke one thing that held: "Under Weather" is selected and not screened (repair: schedule — Schedule it). Fix it before going on.');
  });

  it("keys a problem as it is keyed next time, and says what the repair mended", () => {
    const app = store();
    app.apply({ name: "select-film", args: { filmId: "f1" } });
    const broken = app.violations();
    const again = problemsMade({ rules: broken }, { rules: app.violations() }, { rules: app.allInvariants() });
    expect(again.made).toEqual([]);
    expect(again.text).toBe("This change broke nothing that held.");
    app.apply({ name: "schedule", args: { filmId: "f1" } });
    const mended = problemsMade({ rules: broken }, { rules: app.violations() }, { rules: app.allInvariants() });
    expect(mended.mended.map((one) => one.key)).toEqual(problemsMade({}, { rules: broken }, { rules: app.allInvariants() }).made.map((one) => one.key));
    expect(mended.said).toEqual(['It mended one problem: "Under Weather" is selected and not screened (repair: schedule — Schedule it).']);
  });

  it("says a view problem new after a revision, and not one it already had", () => {
    const old = { view: "home", at: "navigate", says: 'It goes to "week", which is no place.' };
    const fresh = { view: "home", at: "pictures", says: "A picture is heavier than the host fetches." };
    const made = problemsMade({ views: [old] }, { views: [old, fresh] });
    expect(made.made).toEqual([{ key: viewProblemKey(fresh), kind: "view", view: "home", at: "pictures", says: fresh.says }]);
    expect(made.text).toBe('This change broke one thing that held: the view "home" at pictures says: A picture is heavier than the host fetches. Fix it before going on.');
  });

  it("does not say a rule that could not judge as broken", () => {
    const unsure = { invariant: "big", status: "over-budget" as const, label: "Big", message: "looks at too much", nodeIds: [], repairs: [] };
    expect(problemsMade({}, { rules: [unsure] }).made).toEqual([]);
  });
});

import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocumentWithoutCheck } from "@graview/core/document";
import { composeAppChange } from "@graview/core/compose";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { InlineEnv } from "../../src/inline-ai-env.js";
import { planFor, type AppPlan } from "../../src/quick-ask-plan.js";

/**
 * A MISSING CAPABILITY, OFFERED AS ONE PLAN THAT FINISHES THE ASK (Roadmap
 * f-menu-type-anything): "assign these to nick" on tasks that have nobody to
 * give them to. The model names the need — a link called "assigned to", to a
 * person — and code writes the least change that gives it and the records
 * that finish the ask, each step said as a thing that will happen; Yes only
 * for a seat that may change the app, with the host's composer; anyone else
 * is told, once, who would make the first steps.
 */
const tasks = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/tasks.gdd.json", import.meta.url), "utf8"));
const lean = { ...tasks, kinds: { task: { ...tasks.kinds.task, edges: {} } }, acts: { "add-task": tasks.acts["add-task"], "set-status": tasks.acts["set-status"] }, policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: ["owner", "viewer"], kinds: ["task"] }] } };
const compiled = compileDocumentWithoutCheck(lean);
if (!compiled.ok) throw new Error("the lean tasks did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], policy: app.policy!, snapshot: { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }, { id: "t2", kind: "task", label: "Book the hall", status: "doing" }] as never, edges: [] } } as never);
const env = (principal: Principal, given: GraviewApp<AnySchema> = app): InlineEnv => ({ store, principal, app: given, ai: { name: "fake" }, places: [], selection: [] }) as unknown as InlineEnv;
const missing = { said: "Tasks have no one to assign them to.", need: { link: { on: "task", called: "assigned to", to: "person" } }, who: "Nick" };
const owner: Principal = { kind: "human", id: "p1", roles: ["owner"] };
const STEPS = ["Add a People list.", "Give each task an “Assigned to” field that points to a person.", "Add Nick to People.", "Assign Nick to the 2 tasks here."];

describe("a missing capability", () => {
  it("is offered as one plan that finishes the ask, its steps numbered and ending in a question, for an owner with a host", async () => {
    const plan = (await planFor(env(owner), { said: "assign these to nick", missing, members: ["t1", "t2"], host: true, compose: composeAppChange })) as AppPlan;
    expect(plan.question).toBe("Tasks have no one to assign them to. I can do it in 4 steps. Should I?");
    expect(plan.parts.map((one) => one.said)).toEqual(STEPS);
    expect(plan.parts.map((one) => one.part)).toEqual(["app", "app", "record", "record"]);
    expect(plan.proposal).toMatchObject({ add: [], drop: [], via: "ai:fake" });
    expect(plan.proposal!.records).toEqual([
      { name: "add-person", args: { name: "Nick" }, mintedHint: "person-nick" },
      { name: "set-assigned-to", args: { id: "t1", to: "person-nick" } },
      { name: "set-assigned-to", args: { id: "t2", to: "person-nick" } },
    ]);
  });

  it("takes only what the ask needs: the kind, the link and the acts that make and set it — no rule, no new place (aPlanTakesOnlyWhatTheAskNeeds)", async () => {
    const plan = (await planFor(env(owner), { said: "assign these to nick", missing, members: ["t1", "t2"], host: true, compose: composeAppChange })) as AppPlan;
    expect(plan.proposal!.edits!.map((edit) => (edit as { op: string }).op)).toEqual(["add-kind", "add-relation", "add-act"]);
  });

  it("says its steps in plain words: no name the app keeps, no trait's vocabulary, no act's title capitalized mid-sentence (aPlanSaysItsStepsInPlainWords)", async () => {
    const plan = (await planFor(env(owner), { said: "assign these to nick", missing, members: ["t1", "t2"], host: true, compose: composeAppChange })) as AppPlan;
    const words = [plan.question, ...plan.parts.map((one) => one.said)].join(" ");
    expect(words).not.toMatch(/\b[a-z]+-[a-z]+\b/); // an act's or a kind's name: add-person, set-assigned-to
    expect(words).not.toMatch(/people who own things|an owner link|Who has what|somebody on it/);
    expect(words).not.toMatch(/[a-z,] (Give|Set|Add) [a-z]/); // a title mid-sentence
  });

  it("says, once, who would add the first steps — and offers no Yes — to a seat that may not change the app", async () => {
    const plan = (await planFor(env({ kind: "human", id: "v1", roles: ["viewer"] }), { said: "assign these to nick", missing, members: ["t1", "t2"], host: true, compose: composeAppChange })) as AppPlan;
    expect(plan.proposal).toBeUndefined();
    expect(plan.question).toBe("Tasks have no one to assign them to. An owner would add steps 1–2; then I can do steps 3–4.");
    expect(plan.parts.map((one) => one.said)).toEqual(STEPS);
  });

  it("says the whole plan for an app declared in code, its first steps a developer's", async () => {
    const code = { name: "tasks in code", schema: app.schema } as unknown as GraviewApp<AnySchema>;
    const plan = (await planFor(env(owner, code), { said: "assign these to nick", missing, members: ["t1"], host: true })) as AppPlan;
    expect(plan.proposal).toBeUndefined();
    expect(plan.question).toBe("Tasks have no one to assign them to. Whoever develops this app would add steps 1–2; then I can do steps 3–4.");
    expect(plan.parts.at(-1)!.said).toBe("Assign Nick to the task here.");
  });

  it("says the host would add the first steps where it lends no composer", async () => {
    const plan = (await planFor(env(owner), { said: "assign these to nick", missing, members: ["t1"], host: true })) as AppPlan;
    expect(plan.proposal).toBeUndefined();
    expect(plan.question).toBe("Tasks have no one to assign them to. Whoever hosts this app would add steps 1–2; then I can do steps 3–4.");
  });

  it("refuses rather than offers where no need was named", async () => {
    expect(await planFor(env(owner), { said: "fly them", missing: { said: "Tasks cannot fly." }, members: ["t1"], host: true, compose: composeAppChange })).toEqual({ refused: "Tasks cannot fly." });
  });
});

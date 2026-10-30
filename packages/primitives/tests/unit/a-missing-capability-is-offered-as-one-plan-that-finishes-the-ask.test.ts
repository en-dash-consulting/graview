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
 * give them to comes back as the change to the app (a person kind, an owner
 * on each task) and the records that finish it (Nick made, each task given
 * to him), composed by the host's composer, checked and rehearsed before it is offered —
 * with Yes only for a seat that may change the app; anyone else is told who
 * could, and a code app says its developer would.
 */
const tasks = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/tasks.gdd.json", import.meta.url), "utf8"));
const lean = { ...tasks, kinds: { task: { ...tasks.kinds.task, edges: {} } }, acts: { "add-task": tasks.acts["add-task"], "set-status": tasks.acts["set-status"] }, policy: { grants: [{ roles: ["owner"], mutations: "*" }], sees: [{ roles: ["owner", "viewer"], kinds: ["task"] }] } };
const compiled = compileDocumentWithoutCheck(lean);
if (!compiled.ok) throw new Error("the lean tasks did not compile");
const app = compiled.app as GraviewApp<AnySchema>;
const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], policy: app.policy!, snapshot: { nodes: [{ id: "t1", kind: "task", label: "Write the brief", status: "todo" }, { id: "t2", kind: "task", label: "Book the hall", status: "doing" }] as never, edges: [] } } as never);
const env = (principal: Principal, given: GraviewApp<AnySchema> = app): InlineEnv => ({ store, principal, app: given, ai: { name: "fake" }, places: [], selection: [] }) as unknown as InlineEnv;
const missing = { said: "Tasks have no one to assign them to.", add: ["owners"], who: "Nick" };

describe("a missing capability", () => {
  it("is offered as one plan — the change to the app and the records that finish the ask — ending in a question, for an owner", async () => {
    const plan = (await planFor(env({ kind: "human", id: "p1", roles: ["owner"] }), { said: "assign these to nick", missing, members: ["t1", "t2"], host: true, compose: composeAppChange })) as AppPlan;
    expect(plan.question).toMatch(/^Tasks have no one to assign them to\. I can add people who own things \(a person kind and an owner on each task\), add Nick as a person and give each of the 2 tasks here to Nick\. Should I\?$/);
    // In a person's words, never the app's names: a kind by its noun, a link by what it says, an act by its title.
    expect(plan.parts.filter((one) => one.part === "app").map((one) => one.said)).toEqual([
      "A new kind, person, with name.",
      "Tasks get an owner — who it is on: a person.",
      "A new act: Add a person.",
      "A new act: Give it to someone.",
      "Everyone sees people.",
      "A new rule: Every task has somebody on it.",
      'A lens "Who has what" is added, over tasks.',
    ]);
    expect(plan.parts.filter((one) => one.part === "record").map((one) => one.said)).toEqual(["Add Nick as a person.", "Give each of the 2 tasks here to Nick (Give it to someone)."]);
    expect(plan.proposal).toMatchObject({ add: ["owners"], drop: [], via: "ai:fake" });
    expect(plan.proposal!.records).toEqual([
      { name: "add-person", args: { name: "Nick" }, mintedHint: "person-nick" },
      { name: "give-task", args: { id: "t1", to: "person-nick" } },
      { name: "give-task", args: { id: "t2", to: "person-nick" } },
    ]);
  });

  it("names who could make the change, and offers no Yes, to a seat that may not change the app", async () => {
    const plan = (await planFor(env({ kind: "human", id: "v1", roles: ["viewer"] }), { said: "assign these to nick", missing, members: ["t1"], host: true, compose: composeAppChange })) as AppPlan;
    expect(plan.proposal).toBeUndefined();
    expect(plan.whoMay).toBe("an owner");
    expect(plan.question).toMatch(/^Tasks have no one to assign them to\. An owner would need to add people who own things/);
  });

  it("says a developer would add it where the app is declared in code", async () => {
    const code = { name: "tasks in code", schema: app.schema } as unknown as GraviewApp<AnySchema>;
    const plan = (await planFor(env({ kind: "human", id: "p1", roles: ["owner"] }, code), { said: "assign these to nick", missing, members: ["t1"], host: true, compose: composeAppChange })) as AppPlan;
    expect(plan.proposal).toBeUndefined();
    expect(plan.question).toContain("declared in code, so whoever develops it would add that");
  });

  it("refuses rather than offers what nothing it could add would do", async () => {
    const plan = await planFor(env({ kind: "human", id: "p1", roles: ["owner"] }), { said: "assign these to nick", missing: { said: "Tasks cannot fly.", add: [] }, members: ["t1"], host: true, compose: composeAppChange });
    expect(plan).toEqual({ refused: "Tasks cannot fly. Nothing this app could add would do it." });
  });

  it("says what is missing and who could add it, with no plan, where the host lends no composer", async () => {
    const plan = (await planFor(env({ kind: "human", id: "p1", roles: ["owner"] }), { said: "assign these to nick", missing, members: ["t1"], host: true })) as AppPlan;
    expect(plan.proposal).toBeUndefined();
    expect(plan.question).toBe("Tasks have no one to assign them to. Adding people who own things would do it; an owner could add that.");
  });
});

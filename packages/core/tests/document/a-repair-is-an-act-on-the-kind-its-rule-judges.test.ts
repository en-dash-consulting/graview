import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "../../src/index.js";
import { expressionRule, type GraviewDocument } from "../../src/document/index.js";
import { checkApp, compileDocument } from "../../src/check.js";

/**
 * A RULE'S REPAIR IS AN ACT ON THE KIND THE RULE JUDGES. A rule in the rule
 * language hands each repair the record it judged; a rule over tasks that
 * offers an act on modules hands that act a task, and the act refuses it —
 * a button that can only ever fail. `graview check` refuses it first, in a
 * sentence naming both kinds and the act, with a fix: in a document and in
 * a declaration's `expressionRule` alike.
 */
const planner = (repair: string): GraviewDocument =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Planner",
    kinds: {
      module: { noun: "module", plural: "modules", label: "{name}", fields: { name: { type: "string", required: true }, closed: { type: "boolean" } } },
      task: { noun: "task", plural: "tasks", label: "{name}", fields: { name: { type: "string", required: true }, done: { type: "boolean" } } },
    },
    acts: {
      "add-task": { title: "Add a task", creates: "task" },
      "add-module": { title: "Add a module", creates: "module" },
      finish: { title: "Finish", on: "task", sets: { done: true } },
      "close-module": { title: "Close the module", on: "module", sets: { closed: true } },
    },
    rules: {
      "nothing-left-open": { title: "Nothing left open", over: "task", require: "done", repairs: [{ act: repair }] },
    },
  }) as unknown as GraviewDocument;

describe("a rule's repair is an act on the kind the rule judges", () => {
  it("refuses a document whose rule over tasks names an act on modules, naming both kinds and the act", () => {
    const compiled = compileDocument(planner("close-module"));
    expect(compiled.ok).toBe(false);
    const finding = compiled.findings.find((f) => f.code === "check:repair-wrong-kind");
    expect(finding).toMatchObject({ severity: "error", path: "rules.nothing-left-open.repairs.0" });
    expect(finding!.message).toContain('"close-module"');
    expect(finding!.message).toContain("module");
    expect(finding!.message).toContain("task");
    expect(finding!.fix).toContain("finish");
  });

  it("passes the same rule with an act on the kind it judges, declared or derived", () => {
    for (const repair of ["finish", "edit-task"]) {
      const compiled = compileDocument(planner(repair));
      expect(compiled.findings.filter((f) => f.code === "check:repair-wrong-kind")).toEqual([]);
      expect(compiled.ok).toBe(true);
    }
  });

  it("refuses a declaration's expressionRule that names an act on another kind", () => {
    const module = defineNode("module", { fields: z.object({ label: z.string() }) });
    const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().optional() }) });
    const schema = createSchema([module, task]);
    const bound = bindSchema(schema);
    const close = bound.defineMutation("close-module", {
      title: "Close the module",
      subject: { kinds: ["module"], arg: "id" },
      input: z.object({ id: nodeRef(["module"]) }),
      apply() {},
    });
    const app = defineApp({ name: "planner", schema, mutations: [close], invariants: [expressionRule("nothing-left-open", { over: "task", require: "done", repairs: ["close-module"] }) as never] });
    const finding = checkApp(app).findings.find((f) => f.code === "repair-wrong-kind");
    expect(finding).toMatchObject({ severity: "error", where: 'defineInvariant("nothing-left-open").repairs[0]' });
    expect(finding!.message).toMatch(/"close-module", an act on module, but the rule judges a task/);
  });

  it("leaves a rule that is a function alone: it names each repair's arguments itself", () => {
    const module = defineNode("module", { fields: z.object({ label: z.string() }) });
    const task = defineNode("task", { fields: z.object({ label: z.string() }) });
    const schema = createSchema([module, task]);
    const bound = bindSchema(schema);
    const close = bound.defineMutation("close-module", { title: "Close the module", subject: { kinds: ["module"], arg: "id" }, input: z.object({ id: nodeRef(["module"]) }), apply() {} });
    const rule = bound.defineInvariant("tasks-close-their-module", { scope: { kind: "task" }, repairs: ["close-module"], evaluate: () => [] });
    const app = defineApp({ name: "planner", schema, mutations: [close], invariants: [rule] });
    expect(checkApp(app).findings.filter((f) => f.code === "repair-wrong-kind")).toEqual([]);
  });
});

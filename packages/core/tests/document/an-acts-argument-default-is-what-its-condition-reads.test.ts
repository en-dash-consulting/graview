import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { refusalOf, Store, type AnySchema } from "../../src/index.js";
import { mayRun } from "../../src/seat.js";

/**
 * AN ARGUMENT LEFT OUT IS ITS DEFAULT to what the act's condition reads and
 * to a record the act makes; a field the act sets on a record already there
 * from an argument left out stays as it stands.
 */
const store = () => {
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: "Errands",
    kinds: { errand: { fields: { name: { type: "string", required: true }, note: { type: "string" }, urgent: { type: "boolean" }, prio: { type: "enum", options: ["low", "high"] } } } },
    acts: {
      "add-errand": { title: "Add an errand", creates: "errand", description: "Add one." },
      "add-quick": {
        title: "Add a quick one",
        args: { name: { type: "string", required: true }, prio: { type: "enum", options: ["low", "high"], default: "low" } },
        effects: [{ create: "errand", set: { name: "$name", prio: "$prio" } }],
        description: "Add one, low unless said.",
      },
      "push-errand": {
        title: "Push",
        on: "errand",
        args: { words: { type: "string", required: true }, force: { type: "boolean", default: false } },
        sets: { note: "$words", urgent: "$force" },
        allowedWhen: "force",
        refusal: "only when forced",
        description: "Push it, when forced.",
      },
      "touch-errand": {
        title: "Touch",
        on: "errand",
        args: { prio: { type: "enum", options: ["low", "high"], default: "low" }, note: { type: "string" } },
        sets: { prio: "$prio", note: "$note" },
        description: "Touch it.",
      },
    },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const s = new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations ?? [] });
  s.apply({ name: "add-errand", args: { name: "Post", prio: "high", note: "keep" } });
  return s;
};
const said = (run: () => unknown) => {
  try {
    run();
    return "ran";
  } catch (error) {
    return refusalOf(error);
  }
};

describe("an act's argument left out is its default to its condition and to what it makes", () => {
  it("is what the condition reads: refused in the act's own words when the default does not meet it", () => {
    const s = store();
    const id = s.graph.allNodes()[0]!.id;
    expect(said(() => s.apply({ name: "push-errand", args: { id, words: "w" } }))).toEqual({ reason: "refused", sentence: "only when forced" });
    expect(said(() => s.apply({ name: "push-errand", args: { id, words: "w", force: true } }))).toBe("ran");
  });

  it("makes a record with it", () => {
    const s = store();
    s.apply({ name: "add-quick", args: { name: "Milk" } });
    expect(s.graph.allNodes().find((node) => node["name"] === "Milk")?.["prio"]).toBe("low");
  });

  it("leaves a field of a record already there as it stands", () => {
    const s = store();
    const id = s.graph.allNodes()[0]!.id;
    expect(said(() => s.apply({ name: "touch-errand", args: { id, note: "n2" } }))).toBe("ran");
    expect(s.graph.getNode(id)).toMatchObject({ prio: "high", note: "n2" });
  });

  it("is what mayRun says too", () => {
    const s = store();
    const id = s.graph.allNodes()[0]!.id;
    const me = { kind: "human" as const, id: "me", roles: [] };
    expect(mayRun(s, me, { act: "push-errand", record: id, args: { words: "w" } })).toEqual({ answer: "refused", rule: "condition", reason: "refused", message: "only when forced" });
  });
});

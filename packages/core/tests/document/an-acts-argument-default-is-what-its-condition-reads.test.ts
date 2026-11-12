import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { refusalOf, Store, type AnySchema } from "../../src/index.js";
import { mayRun } from "../../src/seat.js";

/**
 * AN ACT'S ARGUMENT LEFT OUT IS ITS DEFAULT, to its condition and its
 * effects alike: `"force": { "type": "boolean", "default": false }` reads
 * false in `allowedWhen: "force"`, and the act is refused in its own words.
 */
const store = () => {
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: "Errands",
    kinds: { errand: { fields: { name: { type: "string", required: true }, note: { type: "string" }, urgent: { type: "boolean" } } } },
    acts: {
      "add-errand": { title: "Add an errand", creates: "errand", description: "Add one." },
      "push-errand": {
        title: "Push",
        on: "errand",
        args: { words: { type: "string", required: true }, force: { type: "boolean", default: false } },
        sets: { note: "$words", urgent: "$force" },
        allowedWhen: "force",
        refusal: "only when forced",
        description: "Push it, when forced.",
      },
      "nudge-errand": {
        title: "Nudge",
        on: "errand",
        args: { force: { type: "boolean", default: true } },
        sets: { urgent: "$force" },
        allowedWhen: "force",
        refusal: "only when forced",
        description: "Nudge it.",
      },
    },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const s = new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations ?? [] });
  s.apply({ name: "add-errand", args: { name: "Post" } });
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

describe("an act's argument default is what its condition reads", () => {
  it("refuses in its own words when the default does not meet the condition", () => {
    const s = store();
    const id = s.graph.allNodes()[0]!.id;
    expect(said(() => s.apply({ name: "push-errand", args: { id, words: "w" } }))).toEqual({ reason: "refused", sentence: "only when forced" });
    expect(said(() => s.apply({ name: "push-errand", args: { id, words: "w", force: true } }))).toBe("ran");
  });

  it("runs on a default that meets it, and sets the default where the act sets the argument", () => {
    const s = store();
    const id = s.graph.allNodes()[0]!.id;
    expect(said(() => s.apply({ name: "nudge-errand", args: { id } }))).toBe("ran");
    expect(s.graph.getNode(id)?.["urgent"]).toBe(true);
  });

  it("is what mayRun says too", () => {
    const s = store();
    const id = s.graph.allNodes()[0]!.id;
    const me = { kind: "human" as const, id: "me", roles: [] };
    expect(mayRun(s, me, { act: "push-errand", record: id, args: { words: "w" } })).toEqual({ answer: "refused", rule: "condition", reason: "refused", message: "only when forced" });
    expect(mayRun(s, me, { act: "nudge-errand", record: id })).toEqual({ answer: "allowed" });
  });
});

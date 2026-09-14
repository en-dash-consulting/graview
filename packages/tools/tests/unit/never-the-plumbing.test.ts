import { createSchema, defineMutation, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { firstJsonObject, llmResponder, resolveProposal } from "../../src/index.js";

/**
 * WHAT A MODEL HANDS BACK IS THE SEAT'S PROBLEM, NOT THE PERSON'S.
 *
 * Two things a model does constantly, and both reached the screen: it
 * closes one brace too many, and it names things the way a person does.
 * The first produced a chat bubble containing raw JSON; the second produced
 * a struck-through line and zod's own sentence about an argument.
 */
const meal = defineNode("meal", {
  fields: z.object({ label: z.string().min(1) }),
  plural: "Meals",
  label: (node) => node.label,
});
const shift = defineNode("shift", {
  fields: z.object({ label: z.string().min(1) }),
  plural: "Shifts",
  label: (node) => node.label,
});
const schema = createSchema([meal, shift]);
const serve = defineMutation("serve", {
  title: "Serve it",
  description: "Put a meal on a shift.",
  subject: { kinds: ["shift"], arg: "shift" },
  input: z.object({ shift: nodeRef(["shift"]), meal: nodeRef(["meal"]) }),
  describe: (args) => `${args.meal} on ${args.shift}`,
  apply() {},
});
const store = () =>
  new Store({
    schema,
    mutations: [serve],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "m-soup", kind: "meal", label: "Soup" },
        { id: "s-mon", kind: "shift", label: "Monday" },
      ] as never,
      edges: [],
    },
  });

describe("reading a model's answer", () => {
  it("takes the object the model meant, past whatever it typed after it", () => {
    // The exact shape that broke: one brace too many at the end.
    const answer = '{"say": "Yes", "proposals": [{"mutation": "serve", "args": {}}]}}';
    expect(firstJsonObject(answer)).toMatchObject({ say: "Yes" });
  });

  it("survives a fence, an apology and an explanation", () => {
    expect(firstJsonObject('Sure! ```json\n{"say": "ok"}\n```\nHope that helps.')).toMatchObject({ say: "ok" });
  });

  it("is not fooled by a brace inside a string", () => {
    expect(firstJsonObject('{"say": "use { like this", "proposals": []}')).toMatchObject({
      say: "use { like this",
    });
  });

  it("answers nothing when there is no object, rather than half of one", () => {
    expect(firstJsonObject("I think you should add a field.")).toBeUndefined();
    expect(firstJsonObject('{"say": ')).toBeUndefined();
  });
});

describe("a person never sees the plumbing", () => {
  it("says so when the model answers in a shape it cannot read", async () => {
    const reply = await llmResponder({ complete: async () => '{"say": "Yes"' })(store(), "anything");
    expect(reply.say).not.toContain("{");
    expect(reply.say).toContain("could not read");
    expect(reply.proposals).toEqual([]);
  });

  it("passes prose through as prose", async () => {
    const reply = await llmResponder({ complete: async () => "I would add a field." })(store(), "anything");
    expect(reply.say).toBe("I would add a field.");
  });

  it("reads the object even when the model overshoots its braces", async () => {
    const reply = await llmResponder({
      complete: async () => '{"say": "Done", "proposals": [{"mutation": "serve", "args": {"shift": "s-mon", "meal": "m-soup"}}]}}',
    })(store(), "serve the soup");
    expect(reply.say).toBe("Done");
    expect(reply.proposals).toHaveLength(1);
  });
});

describe("a name is not an id, and a model will hand you a name", () => {
  it("reads a label that means exactly one node as that node", () => {
    const resolved = resolveProposal(store(), {
      mutation: "serve",
      args: { shift: "Monday", meal: "Soup" },
    });
    expect(resolved.args).toEqual({ shift: "s-mon", meal: "m-soup" });
  });

  it("leaves a name that means nothing, or more than one thing, exactly as it came", () => {
    const two = new Store({
      schema,
      mutations: [serve],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "m-soup", kind: "meal", label: "Soup" },
          // Two meals called Soup: which one is a decision, not a lookup.
          { id: "m-soup-2", kind: "meal", label: "Soup" },
        ] as never,
        edges: [],
      },
    });
    expect(resolveProposal(two, { mutation: "serve", args: { meal: "Soup" } }).args["meal"]).toBe("Soup");
    expect(resolveProposal(store(), { mutation: "serve", args: { meal: "Nothing" } }).args["meal"]).toBe("Nothing");
  });

  it("never moves a value that is already an id, and never touches a plain field", () => {
    const resolved = resolveProposal(store(), { mutation: "serve", args: { shift: "s-mon", meal: "m-soup" } });
    expect(resolved.args).toEqual({ shift: "s-mon", meal: "m-soup" });
  });

  it("says nothing about a mutation it does not know", () => {
    const proposal = { mutation: "nonsense", args: { shift: "Monday" } };
    expect(resolveProposal(store(), proposal)).toBe(proposal);
  });
});

import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { configuredResponder, type Responder } from "../../src/index.js";

/**
 * A FACT OUTRANKS A MODEL. A READING DOES NOT.
 *
 * Both came back from the floor marked `grounded`, so the ladder answered
 * every change request with the pattern-matcher's single act and never
 * asked the model at all — which is the one thing a model is better at.
 * Speaking loosely is the point: "add details to Meal, the name of the food
 * and the number of people it can feed" is two fields in one sentence, and
 * a pattern-matcher can only ever see one of them.
 *
 * Driven through the REAL ladder with the network stubbed, because a test
 * that re-implements the rule it is checking cannot fail when the rule is
 * wrong.
 */
const meal = defineNode("meal", {
  fields: z.object({ label: z.string().min(1) }),
  plural: "Meals",
  label: (node) => node.label,
});
const schema = createSchema([meal]);
const rename = bindSchema(schema).defineMutation("rename", {
  title: "Rename it",
  description: "Call it something else.",
  subject: { kinds: ["meal"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["meal"]), label: z.string().min(1) }),
  describe: (args) => `Rename to ${args.label}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const store = () =>
  new Store({
    schema,
    mutations: [rename],
    invariants: [],
    snapshot: { nodes: [{ id: "m1", kind: "meal", label: "Soup" }] as never, edges: [] },
  });

/** A floor that answers a question as a fact and a change as a reading. */
const floor: Responder<typeof schema> = async (_store, text) =>
  text.trim().endsWith("?")
    ? { say: "One meal: Soup.", proposals: [], grounded: true }
    : { say: "A reading.", proposals: [{ mutation: "rename", args: { id: "m1", label: "Broth" } }] };

/** Every prompt the model was handed, and whatever it was told to answer. */
const prompts: string[] = [];
const realFetch = globalThis.fetch;
const answering = (content: string) => {
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    prompts.push(JSON.parse(init.body).messages[0].content as string);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => content,
    };
  }) as never;
};
afterEach(() => {
  globalThis.fetch = realFetch;
  prompts.length = 0;
});

const withModel = (content: string) => {
  answering(content);
  return configuredResponder<typeof schema>(
    { source: "remote", remote: { preset: "custom", baseUrl: "http://nowhere/v1", apiKey: "k", model: "test" } },
    { floor },
  );
};

describe("what the model is asked", () => {
  it("is never a fact the graph already holds", async () => {
    const reply = await withModel('{"say":"I reckon two meals."}')(store(), "how many meals are there?");
    expect(prompts).toEqual([]);
    expect(reply.say).toContain("One meal: Soup.");
  });

  it("is every change, with the floor's reading handed up as a starting point", async () => {
    await withModel('{"say":"ok","proposals":[{"mutation":"rename","args":{"id":"m1","label":"Stew"}}]}')(
      store(),
      "call the soup something else",
    );
    expect(prompts).toHaveLength(1);
    // The reading, and the instruction that turns one sentence into several acts.
    expect(prompts[0]).toContain('rename {"id":"m1","label":"Broth"}');
    expect(prompts[0]).toContain("split it into several");
    // And what is actually in the graph, by name, so it can name it back.
    expect(prompts[0]).toContain("Soup");
  });

  it("may split one loose sentence into several acts, which is the whole point", async () => {
    const reply = await withModel(
      '{"say":"Two changes.","proposals":[{"mutation":"rename","args":{"id":"m1","label":"Broth"}},{"mutation":"rename","args":{"id":"m1","label":"Stew"}}]}',
    )(store(), "call it Broth and then Stew");
    expect(reply.proposals).toHaveLength(2);
    expect(reply.say).toBe("Two changes.");
  });

  it("never comes back with less than the floor had", async () => {
    // A model that answers with nothing does not get to replace a reading.
    const reply = await withModel('{"say":"I am not sure."}')(store(), "call the soup something else");
    expect(reply.say).toContain("A reading.");
    expect(reply.proposals).toHaveLength(1);
  });

  it("falls back to the floor, saying so, when the model cannot be reached", async () => {
    globalThis.fetch = (async () => {
      throw new Error("no network");
    }) as never;
    const reply = await configuredResponder<typeof schema>(
      { source: "remote", remote: { preset: "custom", baseUrl: "http://nowhere/v1", apiKey: "k", model: "test" } },
      { floor },
    )(store(), "call the soup something else");
    expect(reply.say).toContain("A reading.");
    expect(reply.say).toContain("no network");
    expect(reply.proposals).toHaveLength(1);
  });
});

describe("the ladder with no model on it", () => {
  it("answers from the floor, reading and fact alike", async () => {
    const graphOnly = configuredResponder<typeof schema>({ source: "graph" }, { floor });
    expect((await graphOnly(store(), "how many meals are there?")).say).toBe("One meal: Soup.");
    expect((await graphOnly(store(), "call the soup something else")).proposals).toHaveLength(1);
  });
});

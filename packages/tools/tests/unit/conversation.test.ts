import { bindSchema, createSchema, defineNode, nodeRef, Store, type Violation } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { graphResponder, llmResponder } from "../../src/index.js";

/**
 * The conversation is the intelligence contract given a voice: words in,
 * something to read plus validated proposals out — and the graph-native
 * responder holds a useful conversation before any key exists.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { "assigned-to": { to: ["duty"], description: "who does the run" } },
});
const duty = defineNode("duty", {
  fields: z.object({ label: z.string(), minutes: z.number() }),
  plural: "Runs",
});
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const reassign = bound.defineMutation("reassign", {
  title: "Reassign the run",
  description: "Give a run to someone else.",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]), toPersonId: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.setSingleSource("assigned-to", args.dutyId, args.toPersonId);
  },
});
const shorten = bound.defineMutation("shorten", {
  title: "Shorten it",
  description: "Cut a run to half an hour.",
  subject: { kinds: ["duty"], arg: "dutyId" },
  input: z.object({ dutyId: nodeRef(["duty"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.dutyId, { minutes: 30 });
  },
});
const tooLong = bound.defineInvariant("too-long", {
  scope: { kind: "duty" },
  evaluate: ({ subject }): Violation[] =>
    subject.minutes > 60
      ? [
          {
            invariant: "too-long",
            subjectId: subject.id,
            label: "Too long",
            message: `${subject.label} runs over an hour`,
            nodeIds: [subject.id],
            repairs: [{ mutation: "shorten", args: { dutyId: subject.id }, label: "Shorten it" }],
          },
        ]
      : [],
});

const store = () =>
  new Store({
    schema,
    mutations: [reassign, shorten],
    invariants: [tooLong],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "bo", kind: "person", label: "Bo" },
        { id: "school", kind: "duty", label: "School run", minutes: 75 },
      ] as never,
      edges: [{ kind: "assigned-to", from: "ana", to: "school" }],
    },
  });

describe("the graph answers for itself", () => {
  it("states the standing and proposes the rules' own repairs", async () => {
    const reply = await graphResponder()(store(), "what's wrong?");
    expect(reply.say).toContain("1 problem");
    expect(reply.say).toContain("School run runs over an hour");
    expect(reply.proposals).toEqual([
      { mutation: "shorten", args: { dutyId: "school" }, why: "School run runs over an hour" },
    ]);
  });

  it("states a named thing's facts, trouble, and that trouble's repairs", async () => {
    const reply = await graphResponder()(store(), "tell me about the School run");
    expect(reply.say).toContain("School run — a duty");
    expect(reply.say).toContain("connected to 1 thing");
    expect(reply.say).toContain("runs over an hour");
    expect(reply.proposals[0]?.mutation).toBe("shorten");
  });

  it('treats the selection as what "this" means', async () => {
    const reply = await graphResponder()(store(), "what is this?", { selection: ["ana"] });
    expect(reply.say).toContain("Ana — a person");
    expect(reply.say).toContain("Nothing about it is broken");
  });

  it("proposes a mutation said in its own words, endpoints from the referents", async () => {
    const reply = await graphResponder()(store(), "reassign the run to Bo", {
      selection: ["school"],
    });
    expect(reply.proposals).toEqual([
      {
        mutation: "reassign",
        args: { dutyId: "school", toPersonId: "bo" },
        why: "you asked in words",
      },
    ]);
  });

  it("asks for what it cannot honestly fill rather than guessing", async () => {
    const reply = await graphResponder()(store(), "reassign the run please");
    // "the run" is not a node label; nothing is selected; both refs missing.
    expect(reply.proposals).toEqual([]);
    expect(reply.say).toContain("needs");
  });

  it("finds a name across spacing and punctuation — 'child 2' is child2", async () => {
    const spaced = new Store({
      schema,
      mutations: [reassign, shorten],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "c2", kind: "person", label: "child2" },
          { id: "nap", kind: "duty", label: "child2 nap", minutes: 30 },
        ] as never,
        edges: [],
      },
    });
    const reply = await graphResponder()(spaced, "when does child 2 nap?");
    // The longest matching name wins: the nap block, not just the child.
    expect(reply.say).toContain("child2 nap — a duty");
    expect(reply.say).toContain("minutes 30");
    // Token alignment still keeps "Bo" out of "elbow".
    const noFalse = await graphResponder()(store(), "my elbow hurts");
    expect(noFalse.say).toContain("This graph holds");
  });

  it("falls back to the shape of the graph, and how to ask", async () => {
    const reply = await graphResponder()(store(), "hello");
    expect(reply.say).toContain("2 People");
    expect(reply.say).toContain("1 Runs");
  });
});

describe("a model holds the conversation through the same gate", () => {
  it("threads history and selection into the prompt and validates the reply", async () => {
    const model = llmResponder({
      may: ["shorten"],
      complete: async (prompt) => {
        expect(prompt).toContain("Person: and now?");
        expect(prompt).toContain("Person: earlier words");
        expect(prompt).toContain('what "this" means');
        expect(prompt).toContain("School run");
        return '{"say":"Cutting it.","proposals":[{"mutation":"shorten","args":{"dutyId":"school"},"why":"over an hour"},{"mutation":"reassign","args":{},"why":"not allowed"}]}';
      },
    });
    const reply = await model(store(), "and now?", {
      selection: ["school"],
      history: [{ role: "person", text: "earlier words" }],
    });
    expect(reply.say).toBe("Cutting it.");
    // The allowlist filtered the second proposal — same gate as everywhere.
    expect(reply.proposals).toHaveLength(1);
    expect(reply.proposals[0]?.mutation).toBe("shorten");
  });

  it("degrades an unparseable answer to words, never to guesses", async () => {
    const model = llmResponder({ complete: async () => "I would rather chat." });
    const reply = await model(store(), "hm");
    expect(reply).toEqual({ say: "I would rather chat.", proposals: [] });
  });
});

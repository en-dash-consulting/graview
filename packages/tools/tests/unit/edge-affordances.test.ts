import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * A selected LINE derives its own actions. Mutations declare the edge kinds
 * they make and break; endpoints prefill by matching argument kinds against
 * the edge's real ends, and an ambiguous match stays an open question.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: {
    "rides-in": { to: ["duty"], description: "who is along for it" },
  },
});
const duty = defineNode("duty", {
  fields: z.object({ label: z.string() }),
  plural: "Runs",
  edges: {
    "waits-for": { to: ["duty"], description: "what has to happen first" },
  },
});
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const removeRider = bound.defineMutation("remove-rider", {
  title: "Take them off it",
  description: "Remove a rider from a run.",
  severs: ["rides-in"],
  input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "rides-in", from: args.personId, to: args.dutyId });
  },
});
const unblock = bound.defineMutation("unblock", {
  title: "Stop waiting",
  description: "Break a wait between two runs.",
  severs: ["waits-for"],
  input: z.object({ taskId: nodeRef(["duty"]), blockerId: nodeRef(["duty"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
  },
});

const store = () =>
  new Store({
    schema,
    mutations: [removeRider, unblock],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "morning", kind: "duty", label: "Morning run" },
        { id: "evening", kind: "duty", label: "Evening run" },
      ] as never,
      edges: [
        { kind: "rides-in", from: "ana", to: "morning" },
        { kind: "waits-for", from: "evening", to: "morning" },
      ],
    },
  });

describe("edge affordances", () => {
  it("offers a severing mutation with both ends prefilled when kinds disambiguate", () => {
    const { affordances } = deriveAffordances(store(), ["edge:rides-in:ana:morning"], {
      edgeSelection: [{ kind: "rides-in", from: "ana", to: "morning" }],
    });
    const offer = affordances.find((a) => a.mutation === "remove-rider");
    expect(offer).toBeDefined();
    expect(offer?.args).toEqual({ personId: "ana", dutyId: "morning" });
    expect(offer?.open).toEqual([]);
    // The line in its words (W-133), not its name.
    expect(offer?.why).toContain('"who is along for it"');
    expect(offer?.nodeIds).toEqual(["ana", "morning"]);
  });

  it("leaves both arguments open when two accept the same kind — no guessing", () => {
    const { affordances } = deriveAffordances(store(), ["edge:waits-for:evening:morning"], {
      edgeSelection: [{ kind: "waits-for", from: "evening", to: "morning" }],
    });
    const offer = affordances.find((a) => a.mutation === "unblock");
    expect(offer).toBeDefined();
    expect(offer?.args).toEqual({});
    expect(offer?.open?.map((p) => p.name).sort()).toEqual(["blockerId", "taskId"]);
  });

  /*
   * The line IS the relation, so the act that would make it has nothing to
   * make. Both ends prefill from the line, so it arrived with no question
   * left — a one-press button that looked inert and was not: pressed, it
   * wrote a second identical op into the history describing a change that
   * never happened.
   */
  it("does not offer the act that would make the line you already selected", () => {
    const tie = bound.defineMutation("give-a-ride", {
      title: "Give them a ride",
      description: "Put a rider on a run.",
      connects: ["rides-in"],
      input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
      apply(ctx, args) {
        ctx.addEdge({ kind: "rides-in", from: args.personId, to: args.dutyId });
      },
    });
    const both = new Store({
      schema,
      mutations: [tie, removeRider],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "morning", kind: "duty", label: "Morning run" },
        ] as never,
        edges: [{ kind: "rides-in", from: "ana", to: "morning" }],
      },
    });
    const { affordances } = deriveAffordances(both, ["edge:rides-in:ana:morning"], {
      edgeSelection: [{ kind: "rides-in", from: "ana", to: "morning" }],
    });
    expect(affordances.map((a) => a.mutation)).toEqual(["remove-rider"]);
  });

  it("keeps a maker on a line when it still has something to ask", () => {
    // Two arguments accepting the same kind leave a real question open, so
    // the act can produce a relation that is not the one you selected.
    const chain = bound.defineMutation("make-it-wait", {
      title: "Make it wait",
      description: "Put one run behind another.",
      connects: ["waits-for"],
      input: z.object({ taskId: nodeRef(["duty"]), blockerId: nodeRef(["duty"]) }),
      apply(ctx, args) {
        ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
      },
    });
    const chained = new Store({
      schema,
      mutations: [chain],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "morning", kind: "duty", label: "Morning run" },
          { id: "evening", kind: "duty", label: "Evening run" },
        ] as never,
        edges: [{ kind: "waits-for", from: "evening", to: "morning" }],
      },
    });
    const { affordances } = deriveAffordances(chained, ["edge:waits-for:evening:morning"], {
      edgeSelection: [{ kind: "waits-for", from: "evening", to: "morning" }],
    });
    expect(affordances.map((a) => a.mutation)).toContain("make-it-wait");
  });

  it("offers nothing for an edge kind no mutation claims", () => {
    const bare = new Store({ schema, mutations: [], invariants: [] });
    const { affordances } = deriveAffordances(bare, ["edge:rides-in:ana:morning"], {
      edgeSelection: [{ kind: "rides-in", from: "ana", to: "morning" }],
    });
    expect(affordances).toEqual([]);
  });
});

describe("a move offers the new, a pure sever offers the attached", () => {
  const move = bound.defineMutation("move-rider", {
    title: "Move the rider",
    description: "Put the ride with someone else's run.",
    subject: { kinds: ["duty"], arg: "dutyId" },
    connects: ["rides-in"],
    severs: ["rides-in"],
    input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
    apply(ctx, args) {
      ctx.addEdge({ kind: "rides-in", from: args.personId, to: args.dutyId });
    },
  });
  const moveStore = () =>
    new Store({
      schema,
      mutations: [move],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "bo", kind: "person", label: "Bo" },
          { id: "morning", kind: "duty", label: "Morning run" },
          { id: "bare", kind: "duty", label: "Bare run" },
        ] as never,
        edges: [{ kind: "rides-in", from: "ana", to: "morning" }],
      },
    });

  it("offers everyone NOT already on it — never a list of the current rider", () => {
    const { affordances } = deriveAffordances(moveStore(), ["morning"]);
    const offer = affordances.find((a) => a.mutation === "move-rider");
    expect(offer?.open?.find((p) => p.name === "personId")?.candidates).toEqual(["bo"]);
  });

  it("is offered on a subject with nothing attached — a move is what it needs", () => {
    const { affordances } = deriveAffordances(moveStore(), ["bare"]);
    expect(affordances.map((a) => a.mutation)).toContain("move-rider");
  });

  it("offers from the other endpoint with the same rule", () => {
    const { affordances } = deriveAffordances(moveStore(), ["bo"]);
    const offer = affordances.find((a) => a.mutation === "move-rider" && a.ties);
    expect(offer).toBeDefined();
    expect(offer?.args).toEqual({ personId: "bo" });
    // Bo rides nothing: every duty is a valid new home.
    expect(offer?.open?.find((p) => p.name === "dutyId")?.candidates?.sort()).toEqual([
      "bare",
      "morning",
    ]);
  });

  it("on a selected line, ambiguity resolves to the line's own two ends", () => {
    const both = bound.defineMutation("unlink", {
      title: "Unlink",
      description: "Break a wait.",
      severs: ["waits-for"],
      input: z.object({ taskId: nodeRef(["duty"]), blockerId: nodeRef(["duty"]) }),
      apply() {},
    });
    const s2 = new Store({
      schema,
      mutations: [both],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "a", kind: "duty", label: "A" },
          { id: "b", kind: "duty", label: "B" },
          { id: "c", kind: "duty", label: "C" },
        ] as never,
        edges: [{ kind: "waits-for", from: "a", to: "b" }],
      },
    });
    const { affordances } = deriveAffordances(s2, ["edge:waits-for:a:b"], {
      edgeSelection: [{ kind: "waits-for", from: "a", to: "b" }],
    });
    const offer = affordances.find((a) => a.mutation === "unlink");
    for (const parameter of offer?.open ?? []) {
      expect(parameter.candidates?.sort()).toEqual(["a", "b"]);
    }
  });
});

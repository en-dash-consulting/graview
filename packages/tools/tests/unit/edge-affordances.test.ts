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
    expect(offer?.why).toContain('"rides-in"');
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

  it("offers nothing for an edge kind no mutation claims", () => {
    const bare = new Store({ schema, mutations: [], invariants: [] });
    const { affordances } = deriveAffordances(bare, ["edge:rides-in:ana:morning"], {
      edgeSelection: [{ kind: "rides-in", from: "ana", to: "morning" }],
    });
    expect(affordances).toEqual([]);
  });
});

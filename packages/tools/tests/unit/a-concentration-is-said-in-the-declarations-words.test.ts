import { createSchema, defineNode, edgeWords, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { insightProvider } from "../../src/index.js";

/*
 * FR-142. Graview Cloud's workshop: one workshop part, four topics tied to
 * it by `partOf`. The seat's panel said `Holds 4 of 4 "partOf" — most of
 * them` — the relation's key where its words belong, and "most" for all of
 * them. The declaration has the words: read from the part, `partOf` is
 * "covers".
 */
const segment = defineNode("segment", {
  fields: z.object({ label: z.string() }),
  noun: "workshop part",
  plural: "Workshop parts",
});
const topic = defineNode("topic", {
  fields: z.object({ label: z.string() }),
  noun: "topic",
  plural: "Topics",
  edges: { partOf: { to: ["segment"], cardinality: "one", description: "the workshop part it belongs to", inverse: "covers" } },
});
const schema = createSchema([segment, topic]);

const workshop = (ties: readonly [string, string][]) =>
  new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "ongoing", kind: "segment", label: "Ongoing support" },
        { id: "kickoff", kind: "segment", label: "Kick-off" },
        ...["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => ({ id, kind: "topic", label: `Topic ${id}` })),
      ] as never,
      edges: ties.map(([from, to]) => ({ kind: "partOf", from, to })),
    },
  });

const saidOf = (store: Store<typeof schema>, id: string) =>
  (insightProvider<typeof schema>().derive({
    store,
    selection: [id],
    nodes: [store.graph.getNode(id)!],
    kindSelection: [],
    edgeSelection: [],
    violations: [],
    context: {},
  }).observations ?? []).map((o) => o.text);

describe("a record holding most of a relation is said in the declaration's words", () => {
  it("says all four topics a part covers as all of them, in the relation's own words", () => {
    const store = workshop([["t1", "ongoing"], ["t2", "ongoing"], ["t3", "ongoing"], ["t4", "ongoing"]]);
    expect(saidOf(store, "ongoing")).toEqual(["Ongoing support covers: all 4 topics"]);
  });

  it("says five of six as five of the six, never 'most' and never the key", () => {
    const store = workshop([["t1", "ongoing"], ["t2", "ongoing"], ["t3", "ongoing"], ["t4", "ongoing"], ["t5", "ongoing"], ["t6", "kickoff"]]);
    const [said] = saidOf(store, "ongoing");
    expect(said).toBe("Ongoing support covers: 5 of the 6 topics");
    expect(said).not.toMatch(/partOf|most/);
  });
});

describe("a relation in words", () => {
  it("reads the declaring end's description and the far end's inverse", () => {
    expect(edgeWords(schema, "topic", "partOf", "out")).toBe("the workshop part it belongs to");
    expect(edgeWords(schema, "topic", "partOf", "in")).toBe("covers");
  });

  it("speaks the key where the declaration says nothing, never printing it as written", () => {
    expect(edgeWords(schema, "segment", "partOf", "in")).toBe("part of");
    expect(edgeWords(schema, "topic", "tended-by", "out")).toBe("tended by");
  });
});

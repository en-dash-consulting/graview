import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createSchema,
  defineNode,
  diffSnapshots,
  Graph,
  GraphError,
  invert,
  TrackedReader,
  type Primitive,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string(), at: z.number() }) });
const schema = createSchema([person, duty]);

function seeded() {
  return Graph.from(schema, {
    nodes: [
      { id: "p1", kind: "person", label: "Ana" },
      { id: "p2", kind: "person", label: "Bo" },
      { id: "d1", kind: "duty", label: "School run", at: 480 },
    ],
    edges: [{ kind: "assigned-to", from: "p1", to: "d1" }],
  });
}

describe("Graph", () => {
  it("indexes edges in both directions", () => {
    const graph = seeded();
    expect(graph.out("p1", "assigned-to").map((n) => n.id)).toEqual(["d1"]);
    expect(graph.in("d1", "assigned-to").map((n) => n.id)).toEqual(["p1"]);
    expect(graph.neighbors("d1").map((n) => n.id)).toEqual(["p1"]);
  });

  it("refuses an edge the schema does not declare", () => {
    const graph = seeded();
    expect(() =>
      graph.applyPrimitives([{ op: "add-edge", edge: { kind: "assigned-to", from: "d1", to: "p1" } }]),
    ).toThrow(GraphError);
  });

  /*
   * A PERSON READS THIS. The refusal reaches the interface — a refused undo
   * shows its reason in the activity rail — so it names the node the way the
   * app names it, the field in the app's own words, and carries none of the
   * validator's own JSON.
   */
  it("refuses a node that does not match its declared fields, in words", () => {
    const graph = seeded();
    let said = "";
    try {
      graph.applyPrimitives([{ op: "add-node", node: { id: "d2", kind: "duty", label: "Late" } }]);
    } catch (error) {
      said = (error as Error).message;
    }
    expect(said).toContain("Late");
    expect(said).toContain("duty");
    // The field, humanized, and the validator's sentence about it.
    expect(said).toContain("At: ");
    expect(said).toContain("expected number");
    // And nothing of the dump: no issue objects, no codes, no paths.
    expect(said).not.toMatch(/"code"|"path"|\[\s*\{/);
  });

  it("removes the edges that touch a removed node", () => {
    const graph = seeded();
    graph.applyPrimitives([
      { op: "remove-edge", edge: { kind: "assigned-to", from: "p1", to: "d1" } },
      { op: "remove-node", node: { id: "d1", kind: "duty", label: "School run", at: 480 } },
    ]);
    expect(graph.allEdges()).toEqual([]);
    expect(graph.getNode("d1")).toBeUndefined();
  });

  it("emits one diff per batch, and nothing for a no-op", () => {
    const graph = seeded();
    const listener = vi.fn();
    graph.subscribe(listener);
    graph.applyPrimitives([
      { op: "patch-node", id: "d1", before: { at: 480 }, after: { at: 500 } },
    ]);
    graph.applyPrimitives([]);
    expect(listener).toHaveBeenCalledTimes(1);
    const diff = listener.mock.calls[0]![0];
    expect(diff.changedNodes[0].fields).toEqual(["at"]);
    expect(diff.touched).toEqual(["d1"]);
  });

  it("previews without touching the live graph", () => {
    const graph = seeded();
    const diff = graph.preview([
      { op: "patch-node", id: "d1", before: { at: 480 }, after: { at: 900 } },
    ]);
    expect(diff.changedNodes).toHaveLength(1);
    expect(graph.getNode("d1")).toMatchObject({ at: 480 });
  });

  it("drops a field when a patch sets it to undefined", () => {
    const optional = defineNode("thing", {
      fields: z.object({ note: z.string().optional() }),
    });
    const s = createSchema([optional]);
    const graph = Graph.from(s, {
      nodes: [{ id: "t", kind: "thing", note: "hi" }],
      edges: [],
    });
    graph.applyPrimitives([
      { op: "patch-node", id: "t", before: { note: "hi" }, after: { note: undefined } },
    ]);
    expect(graph.getNode("t")).toEqual({ id: "t", kind: "thing" });
  });

  it("counts each kind as records come and go, without walking them: added, removed, put back by a failed batch, and loaded", () => {
    const graph = seeded();
    const walked = vi.spyOn(graph, "allNodes");
    expect([graph.count("person"), graph.count("duty"), graph.count("nobody")]).toEqual([2, 1, 0]);
    graph.applyPrimitives([{ op: "add-node", node: { id: "d2", kind: "duty", label: "Late", at: 1 } }]);
    graph.applyPrimitives([{ op: "remove-node", node: { id: "p2", kind: "person", label: "Bo" } }]);
    expect([graph.count("person"), graph.count("duty")]).toEqual([1, 2]);
    // A batch that fails part way changes no count: the graph is put back as it was.
    expect(() => graph.applyPrimitives([{ op: "remove-node", node: { id: "p1", kind: "person", label: "Ana" } }, { op: "remove-node", node: { id: "gone", kind: "duty", label: "", at: 0 } }])).toThrow(GraphError);
    expect([graph.count("person"), graph.count("duty")]).toEqual([1, 2]);
    // A patch that names the kind moves the record between counts.
    graph.applyPrimitives([{ op: "patch-node", id: "d2", before: { kind: "duty" }, after: { kind: "person" } }], { restoring: true });
    expect([graph.count("person"), graph.count("duty")]).toEqual([2, 1]);
    graph.load({ nodes: [{ id: "p9", kind: "person", label: "Cy" }], edges: [] });
    expect([graph.count("person"), graph.count("duty")]).toEqual([1, 0]);
    walked.mockClear();
    graph.count("person");
    expect(walked).not.toHaveBeenCalled();
  });
});

describe("primitives", () => {
  it("inverts every primitive back to itself", () => {
    const primitives: Primitive[] = [
      { op: "add-node", node: { id: "x", kind: "duty", label: "L", at: 1 } },
      { op: "remove-node", node: { id: "x", kind: "duty", label: "L", at: 1 } },
      { op: "patch-node", id: "x", before: { at: 1 }, after: { at: 2 } },
      { op: "add-edge", edge: { kind: "assigned-to", from: "p1", to: "d1" } },
      { op: "remove-edge", edge: { kind: "assigned-to", from: "p1", to: "d1" } },
    ];
    for (const primitive of primitives) {
      expect(invert(invert(primitive))).toEqual(primitive);
    }
  });
});

describe("TrackedReader", () => {
  it("records the id asked for even when nothing comes back", () => {
    const reader = new TrackedReader(seeded());
    reader.getNode("missing");
    expect(reader.reads()).toEqual(["missing"]);
  });

  it("records both endpoints of every edge it hands out", () => {
    const reader = new TrackedReader(seeded());
    reader.edgesOfKind("assigned-to");
    expect(reader.reads().sort()).toEqual(["d1", "p1"]);
  });

  it("records a whole-graph scan honestly", () => {
    const reader = new TrackedReader(seeded());
    reader.allNodes();
    expect(reader.reads().sort()).toEqual(["d1", "p1", "p2"]);
  });
});

describe("diffSnapshots", () => {
  it("names the fields that changed and every node touched", () => {
    const before = seeded().snapshot();
    const after = {
      nodes: [
        { id: "p1", kind: "person" as const, label: "Ana" },
        { id: "d1", kind: "duty" as const, label: "School run", at: 500 },
      ],
      edges: [],
    };
    const diff = diffSnapshots(before as never, after as never);
    expect(diff.removedNodes.map((n) => n.id)).toEqual(["p2"]);
    expect(diff.changedNodes[0]?.fields).toEqual(["at"]);
    expect(diff.removedEdges).toHaveLength(1);
    expect(diff.touched).toEqual(["d1", "p1", "p2"]);
  });
});

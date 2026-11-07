import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { edgesReadWithoutTheirKinds, edgesReadWithoutTheirKindsSaid, ownKindRelations, workerViewProps, type WorkerViewManifest } from "../../src/host/views.js";

/**
 * A VIEW OF ONE READS ITS OWN KIND ACROSS A RELATION BACK TO IT (Roadmap
 * f-view-authoring-friction-2026-11). A children's rocks-and-minerals app's
 * rock page read `becomes` (rock → rock: granite becomes gneiss) and was
 * handed no linked rock until `rock` was added to `reads.kinds`, and
 * nothing said why. Now a view of one record is handed the records of its
 * own kind linked to it by a relation it reads — and only those — and a
 * relation it reads with an end it is never handed is said, with the kind
 * to add, by the headless check and to the page's host.
 */
const rock = defineNode("rock", { fields: z.object({ label: z.string() }), edges: { becomes: { to: ["rock"] }, foundIn: { to: ["place"] }, contains: { to: ["mineral"] } } });
const mineral = defineNode("mineral", { fields: z.object({ label: z.string() }) });
const place = defineNode("place", { fields: z.object({ label: z.string() }) });
const schema = createSchema([rock, mineral, place]);
const snapshot = {
  nodes: [
    { id: "rock:granite", kind: "rock", label: "Granite" },
    { id: "rock:gneiss", kind: "rock", label: "Gneiss" },
    { id: "rock:magma", kind: "rock", label: "Magma" },
    { id: "rock:chalk", kind: "rock", label: "Chalk" },
    { id: "mineral:quartz", kind: "mineral", label: "Quartz" },
    { id: "place:alps", kind: "place", label: "The Alps" },
  ],
  edges: [
    { kind: "becomes", from: "rock:granite", to: "rock:gneiss" },
    { kind: "becomes", from: "rock:magma", to: "rock:granite" },
    { kind: "contains", from: "rock:granite", to: "mineral:quartz" },
    { kind: "foundIn", from: "rock:granite", to: "place:alps" },
  ],
};
const store = () => new Store<AnySchema>({ schema: schema as AnySchema, mutations: [], policy: { grants: [] }, snapshot: snapshot as never });
const child: Principal = { kind: "human", id: "u:child" };
const page: WorkerViewManifest = { name: "rock-page", attach: "rock", cardinality: "one", reads: { edges: ["becomes"] } };

describe("a view of one record", () => {
  it("is handed the records of its own kind a relation it reads links to it, both ways, with those links — and no other record of its kind", () => {
    const props = workerViewProps(store(), child, { manifest: page, input: { node: { id: "rock:granite" } } });
    expect(props.node?.id).toBe("rock:granite");
    expect((props.nodes ?? []).map((one) => one.id).sort()).toEqual(["rock:gneiss", "rock:magma"]);
    expect(props.edges).toEqual(expect.arrayContaining([
      { kind: "becomes", from: "rock:granite", to: "rock:gneiss" },
      { kind: "becomes", from: "rock:magma", to: "rock:granite" },
    ]));
    expect(props.edges).toHaveLength(2);
    expect(ownKindRelations(store(), page)).toEqual(["becomes"]);
  });

  it("reads no more of its kind than it did when it names the kind in reads.kinds, which hands every record of it", () => {
    const every = { ...page, reads: { kinds: ["rock"], edges: ["becomes"] } };
    expect(ownKindRelations(store(), every)).toEqual([]);
    expect((workerViewProps(store(), child, { manifest: every, input: { node: { id: "rock:granite" } } }).nodes ?? []).map((one) => one.id).sort()).toEqual(["rock:chalk", "rock:gneiss", "rock:magma"]);
  });

  it("of many is handed only the members the face gave it, as before", () => {
    const shelf: WorkerViewManifest = { name: "shelf", attach: "rock", cardinality: "many", reads: { edges: ["becomes"] } };
    expect(ownKindRelations(store(), shelf)).toEqual([]);
    const props = workerViewProps(store(), child, { manifest: shelf, input: { nodes: [{ id: "rock:granite" }] } });
    expect((props.nodes ?? []).map((one) => one.id)).toEqual(["rock:granite"]);
  });
});

describe("a relation a view reads and is never handed", () => {
  const unread: WorkerViewManifest = { ...page, reads: { kinds: ["mineral"], edges: ["becomes", "contains", "foundIn"] } };

  it("is named with the kind that would hand it, and a relation it is handed both ends of is not", () => {
    expect(edgesReadWithoutTheirKinds(store(), unread)).toEqual([{ edge: "foundIn", kinds: ["place"] }]);
    expect(edgesReadWithoutTheirKindsSaid(store(), unread)).toEqual([
      '"rock-page" reads the relation "foundIn", from rock to place, and is handed no place, so no link of it reaches the view: add "place" to its manifest\'s reads.kinds.',
    ]);
    expect(edgesReadWithoutTheirKinds(store(), { ...unread, reads: { kinds: ["mineral", "place"], edges: ["foundIn"] } })).toEqual([]);
  });

  it("is among a headless check's problems", async () => {
    const source = `graview.onProps((props) => graview.render(graview.html\`<h1>\${props.node.label}</h1>\`));`;
    const result = await runWorkerViewHeadless({ store: store(), principal: child, manifest: unread, input: { node: { id: "rock:granite" } }, source, run: nodeIsolate() });
    if (!result.ok) throw new Error(result.detail);
    expect(result.description.problems).toContainEqual({ at: "reads", says: edgesReadWithoutTheirKindsSaid(store(), unread)[0] });
  });
});

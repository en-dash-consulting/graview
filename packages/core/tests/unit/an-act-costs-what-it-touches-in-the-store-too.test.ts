import { describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z } from "../../src/index.js";

/**
 * AN ACT COSTS WHAT IT TOUCHES, IN THE STORE TOO (the tenth walk, W-205).
 * W-197 made the graph diff only what a change touches; the store, around
 * it, diffed the whole graph again after every act — a map of every record
 * and every link, a key made for each link — so seeding a rescue team of
 * 1,700 records and 15,000 links through its own acts still took three
 * minutes and a quarter, eleven milliseconds an act and growing. A link the
 * act does not touch is not keyed: its kind is never read.
 */
const callout = defineNode("callout", {
  fields: z.object({ label: z.string(), status: z.enum(["open", "closed"]) }),
  edges: { "attended-by": { to: ["member"], description: "who went", inverse: "what they went out on" } },
});
const member = defineNode("member", { fields: z.object({ label: z.string() }) });
const schema = createSchema([callout, member]);
const { defineMutation } = bindSchema(schema);
const send = defineMutation("send", {
  title: "Send a member",
  subject: { kinds: ["callout"], arg: "id" },
  connects: ["attended-by"],
  input: z.object({ id: nodeRef(["callout"]), memberId: nodeRef(["member"]) }),
  apply: (ctx, args) => ctx.addEdge({ kind: "attended-by", from: args.id, to: args.memberId }),
});
const close = defineMutation("close", {
  title: "Close it",
  subject: { kinds: ["callout"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["callout"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { status: "closed" }),
});

describe("an act in the store", () => {
  it("reads no link it does not touch, whether it applies, is undone or is taken back", () => {
    const nodes = [
      ...Array.from({ length: 30 }, (_, i) => ({ id: `callout:${i}`, kind: "callout", label: `Callout ${i}`, status: "open" })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `member:${i}`, kind: "member", label: `Member ${i}` })),
    ];
    const edges = Array.from({ length: 30 }, (_, i) => ({ kind: "attended-by", from: `callout:${i}`, to: `member:${i % 10}` }));
    let read = 0;
    const watched = edges[20]!;
    Object.defineProperty(watched, "kind", { enumerable: true, get: () => ((read += 1), "attended-by") });
    const store = new Store({ schema, mutations: [send, close], snapshot: { nodes, edges } as never });
    read = 0;
    store.apply({ name: "close", args: { id: "callout:3" } });
    const sent = store.apply({ name: "send", args: { id: "callout:4", memberId: "member:9" } });
    store.undo(sent.batch);
    expect(read).toBe(0);
  });

  it("says what comparing the whole graph says", () => {
    const store = new Store({
      schema,
      mutations: [send, close],
      snapshot: { nodes: [{ id: "c", kind: "callout", label: "C", status: "open" }, { id: "m", kind: "member", label: "M" }], edges: [] } as never,
    });
    const sent = store.apply({ name: "send", args: { id: "c", memberId: "m" } });
    expect(sent.diff.addedEdges).toEqual([{ kind: "attended-by", from: "c", to: "m" }]);
    expect(sent.diff.touched).toEqual(["c", "m"]);
    const closed = store.apply({ name: "close", args: { id: "c" } });
    expect(closed.diff.changedNodes.map((change) => change.fields)).toEqual([["status"]]);
  });
});

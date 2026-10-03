import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, Store } from "../../src/index.js";

/**
 * A ROLLBACK PUTS THINGS BACK WHERE THEY WERE. An optimistic client rolled
 * its pending ops back by applying their inverses, and a node a pending op
 * had removed came back at the END of the graph — the same records, in a
 * different order from the server's. "As they come" reads that order, so
 * two people saw one list two ways, and the live wire's convergence test
 * failed whenever its random walk undid an add and then rebased (CI, PR
 * #16). A rollback is exact: what it puts back goes back in its place.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string() }),
  plural: "Tasks",
  edges: { next: { to: ["task"], description: "what follows it", inverse: "what it follows" } },
});
const schema = createSchema([task]);
const seed = {
  nodes: [
    { id: "a", kind: "task", label: "A" },
    { id: "b", kind: "task", label: "B" },
    { id: "c", kind: "task", label: "C" },
    { id: "d", kind: "task", label: "D" },
  ] as never,
  edges: [
    { kind: "next", from: "a", to: "b" },
    { kind: "next", from: "b", to: "c" },
    { kind: "next", from: "c", to: "d" },
  ],
};
const order = (store: Store<typeof schema>) => ({
  nodes: store.snapshot().nodes.map((node) => node.id),
  edges: store.snapshot().edges.map((edge) => `${edge.from}>${edge.to}`),
});

describe("a rollback", () => {
  it("puts a node a pending op removed back in its place, with its edges in theirs", () => {
    const client = new Store({ schema, snapshot: seed });
    const was = order(client);
    const { batch } = client.apply({ name: "remove-task", args: { id: "b" } });
    expect(order(client).nodes).toEqual(["a", "c", "d"]);
    client.rebase({ confirmed: [], pending: [], drop: [batch] });
    expect(order(client)).toEqual(was);
  });

  it("puts back several, removed in any order, each where it was", () => {
    const client = new Store({ schema, snapshot: seed });
    const was = order(client);
    const first = client.apply({ name: "remove-task", args: { id: "c" } });
    const second = client.apply({ name: "remove-task", args: { id: "a" } });
    client.rebase({ confirmed: [], pending: [], drop: [first.batch, second.batch] });
    expect(order(client)).toEqual(was);
  });

  it("leaves the server's order and the client's the same once the server's ops land", () => {
    const server = new Store({ schema, snapshot: seed });
    const client = new Store({ schema, snapshot: server.snapshot(), log: server.log.all() });
    // The client removes b and has not heard back; the server meanwhile renames d.
    const pending = client.apply({ name: "remove-task", args: { id: "b" } });
    const theirs = server.apply({ name: "edit-task", args: { id: "d", label: "D!" } });
    client.rebase({ confirmed: theirs.ops, pending: [pending.batch] });
    // The server then takes the client's remove, as the wire would send it.
    server.apply({ name: "remove-task", args: { id: "b" } });
    expect(order(client)).toEqual(order(server));
  });

  it("is not how an undo puts something back: an undo still adds at the end, as it always has", () => {
    const store = new Store({ schema, snapshot: seed });
    const { batch } = store.apply({ name: "remove-task", args: { id: "b" } });
    store.undo(batch);
    expect(order(store).nodes).toEqual(["a", "c", "d", "b"]);
  });
});

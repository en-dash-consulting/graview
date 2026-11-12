import { Store, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { actOnSeveral, createToolRuntime } from "../../src/index.js";

/**
 * A KIND'S OWN ACTS TAKE ONLY THAT KIND'S RECORDS, FROM A SEAT TOO. The same
 * refusal the store gives a call alone holds for one act over several
 * records, and for an agent's tool for the act: a record of another kind
 * is named refused, and nothing of it changes.
 */
const app = () => {
  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: "Keys",
    roles: ["packer", "runner"],
    kinds: {
      box: { fields: { name: { type: "string", required: true } } },
      errand: { fields: { name: { type: "string", required: true } } },
    },
    acts: {
      "add-box": { title: "Add a box", description: "Add a box to fill.", creates: "box" },
      "add-errand": { title: "Add an errand", description: "Add an errand to run.", creates: "errand" },
    },
    policy: {
      grants: [
        { roles: ["packer"], mutations: ["add-box", "remove-box", "archive-box", "edit-box", "merge-box"] },
        { roles: ["runner"], mutations: ["add-errand"] },
      ],
    },
  } as never);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return compiled.app;
};

const packer: Principal = { kind: "human", id: "pat", roles: ["packer"] };
const runner: Principal = { kind: "human", id: "ray", roles: ["runner"] };
const agent: Principal = { kind: "agent", id: "helper", roles: ["packer"] };

function setUp() {
  const a = app();
  const store = new Store<AnySchema>({ schema: a.schema, mutations: a.mutations ?? [], ...(a.policy ? { policy: a.policy } : {}) });
  store.apply({ name: "add-box", args: { name: "Main box" } }, { author: packer });
  store.apply({ name: "add-errand", args: { name: "Post" } }, { author: runner });
  const box = (store.graph.nodesOfKind("box" as never)[0] as unknown as { id: string }).id;
  const errand = (store.graph.nodesOfKind("errand" as never)[0] as unknown as { id: string }).id;
  return { store, box, errand };
}

describe("a kind's own acts take only that kind's records, from a seat", () => {
  it("one act over several records refuses the record of another kind and runs on the rest", () => {
    const { store, box, errand } = setUp();
    const before = store.graph.getNode(errand);
    const outcome = actOnSeveral(store, { mutation: "archive-box", subject: "id" }, [box, errand], { author: packer });
    expect(outcome.applied).toEqual([box]);
    expect(outcome.refused.map((one) => [one.id, one.reason])).toEqual([[errand, "invalid"]]);
    expect(store.graph.getNode(errand)).toEqual(before);
  });

  for (const [act, args] of [
    ["remove-box", {}],
    ["archive-box", {}],
    ["edit-box", { name: "Renamed" }],
  ] as const) {
    it(`an agent's tool for ${act} is refused a record of another kind`, async () => {
      const { store, errand } = setUp();
      const before = store.graph.getNode(errand);
      const runtime = createToolRuntime(store, { author: agent });
      const tool = runtime.definitions.find((one) => one.name === act);
      expect(tool, `the agent is offered ${act}`).toBeDefined();
      const answer = await runtime.call(tool!.name, { id: errand, ...args });
      expect(answer.ok).toBe(false);
      expect(store.graph.getNode(errand)).toEqual(before);
    });
  }

  it("an agent's tool still takes the kind's own records", async () => {
    const { store, box } = setUp();
    const runtime = createToolRuntime(store, { author: agent });
    expect((await runtime.call("edit-box", { id: box, name: "Renamed" })).ok).toBe(true);
    expect(store.graph.getNode(box)?.["name"]).toBe("Renamed");
  });

  it("an agent's tool for merge-box is refused a record of another kind at either end", async () => {
    const { store, box, errand } = setUp();
    const runtime = createToolRuntime(store, { author: agent });
    expect(runtime.definitions.map((one) => one.name)).toContain("merge-box");
    expect((await runtime.call("merge-box", { id: errand, into: box })).ok).toBe(false);
    expect((await runtime.call("merge-box", { id: box, into: errand })).ok).toBe(false);
    expect(store.graph.getNode(errand)).toBeDefined();
    expect(store.graph.getNode(box)).toBeDefined();
  });
});

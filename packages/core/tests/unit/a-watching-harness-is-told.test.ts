import { afterEach, describe, expect, it } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, tellTheWatchWhatIsUnseen, z } from "../../src/index.js";

/**
 * A WATCHING HARNESS IS TOLD. The browser harnesses judge every screen
 * against the rules that hold everywhere (scripts/lib/watch.mjs), and two
 * of those need the store: which strings are the declaration's own names,
 * so a screen showing `close-deal` to a person is caught exactly; and which
 * presses the policy refused, which is an act offered to a seat that may
 * not take it. The store hands itself over, and the watch reads the names
 * (`tests/the-watch-reads-a-stores-names.test.ts`).
 */
const deal = defineNode("deal", {
  fields: z.object({ label: z.string(), stage: z.enum(["open", "closed"]), closedAt: z.string().optional() }),
  edges: { "sold-by": { to: ["deal"], description: "who sold it" } },
  plural: "Deals",
});
const schema = createSchema([deal]);
const { defineMutation } = bindSchema(schema);
const close = defineMutation("close-deal", {
  title: "Close the deal",
  subject: { kinds: ["deal"], arg: "id" },
  writes: ["stage"],
  input: z.object({ id: nodeRef(["deal"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.id, { stage: "closed" }),
});
const policy = { roles: ["sales-manager", "salesperson"], grants: [{ roles: ["sales-manager"], mutations: ["close-deal"] }] };
const snapshot = { nodes: [{ id: "d1", kind: "deal", label: "Chloé · Highlander", stage: "open" }] as never, edges: [] };

const listen = () => {
  const told = { ids: new Set<string>(), words: [] as string[], refused: [] as { mutation: string; author?: string }[], stores: [] as unknown[] };
  (globalThis as { __graviewWatch?: unknown }).__graviewWatch = {
    store: (store: unknown) => told.stores.push(store),
    learn: ({ ids, words }: { ids: string[]; words: string[] }) => {
      for (const id of ids) told.ids.add(id);
      told.words.push(...words);
    },
    refused: (refusal: { mutation: string; author?: string }) => told.refused.push(refusal),
  };
  return told;
};

afterEach(() => {
  delete (globalThis as { __graviewWatch?: unknown }).__graviewWatch;
});

describe("a store in a watched page", () => {
  it("hands the watch the store, and the seat at a surface, to read its names and what the seat may not see", () => {
    const told: unknown[][] = [];
    (globalThis as { __graviewWatch?: unknown }).__graviewWatch = { store: (store: unknown) => told.push(["store", store]), seat: (...args: unknown[]) => told.push(["seat", ...args]) };
    const store = new Store({ schema, mutations: [close], policy, snapshot });
    const seat = { kind: "human" as const, id: "user-priya", roles: ["salesperson"] };
    tellTheWatchWhatIsUnseen(store, seat, "here");
    expect(told).toEqual([["store", store], ["seat", store, seat, "here"]]);
  });

  it("tells the watch when the policy refuses a press, and who pressed", () => {
    const told = listen();
    const store = new Store({ schema, mutations: [close], policy, snapshot });
    expect(() =>
      store.apply({ name: "close-deal", args: { id: "d1" } }, { author: { kind: "human", id: "user-priya", roles: ["salesperson"] } }),
    ).toThrow();
    expect(told.refused).toEqual([expect.objectContaining({ mutation: "close-deal", author: "user-priya" })]);
  });

  it("tells the watch when an act's own input refuses a press, and who pressed (the twelfth walk)", () => {
    const told: { mutation: string; message: string; author?: string }[] = [];
    (globalThis as { __graviewWatch?: unknown }).__graviewWatch = { refusedInput: (refusal: { mutation: string; message: string; author?: string }) => told.push(refusal) };
    const store = new Store({ schema, mutations: [close], policy, snapshot });
    expect(() => store.apply({ name: "close-deal", args: {} }, { author: { kind: "human", id: "user-mona", roles: ["sales-manager"] } })).toThrow();
    expect(told).toEqual([expect.objectContaining({ mutation: "close-deal", author: "user-mona", message: expect.stringContaining("id") })]);
    // A rehearsal is nobody's press.
    expect(() => store.preview({ name: "close-deal", args: {} })).toThrow();
    expect(told).toHaveLength(1);
  });

  it("learns a seat's id once it signs something", () => {
    const told = listen();
    const store = new Store({ schema, mutations: [close], policy, snapshot });
    store.apply({ name: "close-deal", args: { id: "d1" } }, { author: { kind: "human", id: "user-mona", roles: ["sales-manager"] } });
    expect(told.ids).toContain("user-mona");
  });

  it("hands the watch the store itself, once it holds its graph, so a harness can read what a press did", () => {
    const told = listen();
    const store = new Store({ schema, mutations: [close], policy, snapshot });
    expect(told.stores).toEqual([store]);
    expect((told.stores[0] as Store<typeof schema>).graph.getNode("d1")).toBeDefined();
  });

  it("costs nothing where nobody watches", () => {
    expect(() => new Store({ schema, mutations: [close], policy, snapshot })).not.toThrow();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { declined, suggest, suggestions } from "../../src/tidying.js";
import { bindSchema, createSchema, defineNode, nodeRef, PermissionDeniedError, snapshotHash, Store, type AnySchema, type Author, type Operation } from "../../src/index.js";

/**
 * AN OLD LOG OF SUGGESTIONS AND DECLINES FOLDS THE SAME. The fixture is the
 * log a 0.1.48 build kept of the app's own actor — two links it was sure
 * of, two suggestions, one declined and one accepted, and a sure link a
 * person took back — written by that build before suggestions could expire
 * or be matched by meaning. Read by this one it folds to the graph that
 * build held, nothing in it waits, and every decline in it still refuses
 * the actor: as it was asked, and now by what it means, too.
 */
const fixture = JSON.parse(readFileSync(new URL("../fixtures/formats/suggestions-0.1.48.json", import.meta.url), "utf8")) as {
  snapshot: never;
  ops: Operation[];
  folds: string;
  edges: unknown[];
};

const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }), edges: { supplies: { to: ["event"], description: "the events it supplies" } } });
const event = defineNode("event", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor, event]);
const { defineMutation } = bindSchema(schema);
const supply = defineMutation("supply", {
  title: "Say a vendor supplies an event",
  subject: { kinds: ["vendor"], arg: "id" },
  connects: ["supplies"],
  input: z.object({ id: nodeRef(["vendor"]), event: nodeRef(["event"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "supplies", from: args.id, to: args.event });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const opened = () => {
  const store = new Store<AnySchema>({ schema, mutations: [supply] as never, snapshot: fixture.snapshot, now: () => "2026-10-22T09:00:00.000Z" });
  store.receive(fixture.ops);
  return store;
};

describe("a log of suggestions and declines kept by 0.1.48", () => {
  it("folds to the graph that build held, and verifies", () => {
    const store = opened();
    expect(snapshotHash(store.graph.snapshot())).toBe(fixture.folds);
    expect(store.graph.allEdges()).toEqual(fixture.edges);
    expect(store.verify().ok).toBe(true);
  });

  it("has nothing waiting: the one declined and the one accepted are answered", () => {
    expect(suggestions(opened())).toEqual([]);
  });

  it("still refuses the actor what a person declined, as it was asked", () => {
    const store = opened();
    const quill = { name: "supply", args: { id: "vendor:quill", event: "event:gala" } };
    expect(declined(store, [quill])?.undoes).toBe("op3");
    expect(() => suggest(store, [quill], { author: actor, lineage: { basis: "Again" } })).toThrow(PermissionDeniedError);
    // A sure link a person took back is declined as well.
    expect(() => store.apply({ name: "supply", args: { id: "vendor:harbor", event: "event:gala" } }, { author: actor, lineage: { basis: "Sure now", confidence: 1 } })).toThrow(/declined/);
  });

  it("refuses it by what it means, too: the same link asked in another spelling of the act", () => {
    const store = opened();
    expect(declined(store, [{ name: "Supply", args: { event: "event:gala", id: "vendor:quill" } }])?.undoes).toBe("op3");
    expect(() => suggest(store, [{ name: "SUPPLY", args: { id: "vendor:quill", event: "event:gala" } }], { author: actor, lineage: { basis: "Again" } })).toThrow(/declined/);
    expect(declined(store, [{ name: "Supply", args: { id: "vendor:bloom", event: "event:gala" } }])).toBeUndefined();
  });
});

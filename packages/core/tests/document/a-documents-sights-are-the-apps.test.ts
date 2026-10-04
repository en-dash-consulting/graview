import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocumentWithoutCheck } from "../../src/document/index.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * A DOCUMENT'S SIGHTS ARE THE APP'S (FR-02). `compileDocument` read a
 * document's `policy.sees`, checked it, and handed it back beside the app —
 * and left it out of the app's policy, because the document and the
 * framework meant two different things by it. A host that served the
 * compiled app showed every record to everybody. There is one meaning now,
 * and the compiled app carries it.
 */
const vendors = JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"));
const sighted = {
  ...vendors,
  policy: {
    ...vendors.policy,
    sees: [
      { roles: ["owner", "planner"], kinds: ["category", "vendor"] },
      { roles: ["viewer"], kinds: ["vendor"], own: true },
    ],
  },
};

function storeOf(document: unknown) {
  const compiled = compileDocumentWithoutCheck(document, { today: () => "2026-10-02" });
  if (!compiled.ok) throw new Error("the document compiles");
  const app = compiled.app;
  return {
    app,
    store: new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      ...(app.policy ? { policy: app.policy } : {}),
      snapshot: {
        nodes: [
          { id: "category:flowers", kind: "category", name: "Flowers" },
          { id: "vendor:bloom-co", kind: "vendor", name: "Bloom & Co", status: "researching" },
        ] as never,
        edges: [],
      },
    }),
  };
}
const viewer: Principal = { kind: "human", id: "u:vee", roles: ["viewer"] };
const planner: Principal = { kind: "human", id: "u:pat", roles: ["planner"] };
const ids = (store: Store<AnySchema>) => store.graph.allNodes().map((node) => node.id).sort();

describe("a document's sights, compiled", () => {
  it("are the compiled app's policy.sees", () => {
    expect(storeOf(sighted).app.policy?.sees).toEqual(sighted.policy.sees);
  });

  it("keep a kind no sight names from everybody but the system", () => {
    const { store } = storeOf(sighted);
    // The viewer is named on vendors with `own` only, and on categories not at all.
    expect(ids(store.seenBy(viewer))).toEqual([]);
    expect(ids(store.seenBy(planner))).toEqual(["category:flowers", "vendor:bloom-co"]);
    expect(ids(store.seenBy({ kind: "system" }))).toEqual(["category:flowers", "vendor:bloom-co"]);
  });

  it("let `own` mean what the principal made, as well as their record and what an edge joins to it", () => {
    const { store } = storeOf({ ...sighted, policy: { ...sighted.policy, grants: [...sighted.policy.grants, { roles: ["viewer"], mutations: ["add-vendor"] }] } });
    store.apply({ name: "add-vendor", args: { name: "Lens Lane" } }, { author: viewer });
    const made = store.graph.allNodes().find((node) => (node as { name?: string }).name === "Lens Lane")!.id;
    expect(ids(store.seenBy(viewer))).toEqual([made]);
    expect(ids(store.seenBy({ kind: "human", id: "u:other", roles: ["viewer"] }))).toEqual([]);
  });

  it("leave a document with no sights seen by everybody", () => {
    expect(ids(storeOf(vendors).store.seenBy(viewer))).toEqual(["category:flowers", "vendor:bloom-co"]);
  });
});

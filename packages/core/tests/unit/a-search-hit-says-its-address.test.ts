import { describe, expect, it } from "vitest";
import { z } from "zod";
import { addressOf, createSchema, defineNode, search, Store, type Hit, type Policy, type Principal } from "../../src/index.js";

/**
 * A SEARCH HIT SAYS ITS ADDRESS (FR-129).
 *
 * Graview Cloud searches each of a person's apps with the framework's own
 * `search`, under the seat's own sight, and opens each record at its
 * address — and worked that address out itself, from `placesOf`: the kind's
 * place, then the id. A node hit now carries it, spelled as the routed face
 * spells its record links (`/<plural>/<id>`, the id encoded) and as
 * `addressOf` spells it under a host's base path; a place hit carries its
 * place's, a kind hit its list's. The routed face's own links are compared
 * in `@graview/embed` (a-search-hit-is-the-record-link-the-pages-draw).
 */
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const task = defineNode("task", {
  fields: z.object({ label: z.string(), notes: z.string().optional() }),
  edges: { for: { to: ["person"], cardinality: "one", description: "whose it is", inverse: "their tasks" } },
});
const shelfItem = defineNode("shelfItem", { fields: z.object({ label: z.string() }), plural: "Things on the shelf" });
const schema = createSchema([person, task, shelfItem]);
const snapshot = {
  nodes: [
    { id: "person:ada", kind: "person", label: "Ada Lovelace" },
    { id: "person:grace", kind: "person", label: "Grace Hopper" },
    { id: "task:a b/c?d#e", kind: "task", label: "Stamp the letters" },
    { id: "task:café", kind: "task", label: "Stamp book for Grace" },
    { id: "box 1", kind: "shelfItem", label: "Stamp tin" },
  ],
  edges: [
    { kind: "for", from: "task:a b/c?d#e", to: "person:ada" },
    { kind: "for", from: "task:café", to: "person:grace" },
  ],
};
const make = (policy?: Policy) => new Store({ schema, mutations: [], snapshot: snapshot as never, ...(policy ? { policy } : {}) });
const nodes = (hits: readonly Hit[]) => hits.filter((hit): hit is Extract<Hit, { about: "node" }> => hit.about === "node");

describe("a node hit says where its record is", () => {
  it("is the record's path on the routed face: the kind's plural as its list is addressed, then the id encoded", () => {
    const found = nodes(search(make(), "stamp").hits);
    expect(Object.fromEntries(found.map((hit) => [hit.id, hit.address]))).toEqual({
      "task:a b/c?d#e": `/tasks/${encodeURIComponent("task:a b/c?d#e")}`,
      "task:café": "/tasks/task%3Acaf%C3%A9",
      "box 1": "/things-on-the-shelf/box%201",
    });
    expect(nodes(search(make(), "ada").hits)[0]).toMatchObject({ id: "person:ada", address: "/people/person%3Aada" });
  });

  it("is spelled under a host's base path as addressOf spells it", () => {
    for (const basePath of ["/apps/a1", "/apps/a1/", "apps/a1"]) {
      const under = nodes(search(make(), "stamp", { basePath }).hits);
      const bare = nodes(search(make(), "stamp").hits);
      expect(under.map((hit) => hit.address)).toEqual(bare.map((hit) => addressOf(hit.address, { basePath })));
      expect(under.every((hit) => hit.address.startsWith("/apps/a1/"))).toBe(true);
    }
  });

  it("says a kind's list and a place by their own addresses", () => {
    const places = [
      { kind: "task", title: "The board", as: "the-board" },
      { kind: "task", title: "Who does what", as: "who-does-what" },
      { kind: "person", title: "Who does what", as: "who-does-what" },
    ];
    const found = search(make(), "the board", { places }).hits;
    expect(found.find((hit) => hit.about === "place")).toMatchObject({ title: "The board", address: "/places/the-board" });
    // A name two kinds share says which kind's picture, as placesOf spells it.
    const shared = search(make(), "who does", { places, basePath: "/apps/a1" }).hits.filter((hit) => hit.about === "place");
    expect(shared.map((hit) => hit.address).sort()).toEqual(["/apps/a1/places/who-does-what?of=people", "/apps/a1/places/who-does-what?of=tasks"]);
    expect(search(make(), "people").hits[0]).toMatchObject({ about: "kind", kind: "person", address: "/people" });
    expect(search(make(), "things on", { basePath: "/apps/a1" }).hits[0]).toMatchObject({ about: "kind", kind: "shelfItem", address: "/apps/a1/things-on-the-shelf" });
  });
});

describe("a hit is never an address a seat may not see", () => {
  const policy: Policy = {
    grants: [{ roles: ["staff"], mutations: "*" }],
    sees: [
      { roles: ["staff"], kinds: ["person", "task", "shelfItem"] },
      { roles: ["member"], kinds: ["person", "task"], own: true },
    ],
  };
  const ada: Principal = { kind: "human", id: "person:ada", roles: ["member"] };
  const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

  it("finds only the records the seat sees, so it names no address of another's record", () => {
    const store = make(policy);
    const seen = nodes(search(store, "stamp", { principal: ada }).hits);
    expect(seen.map((hit) => hit.id)).toEqual(["task:a b/c?d#e"]);
    expect(search(store, "stamp", { principal: ada }).matched).toEqual(["task:a b/c?d#e"]);
    expect(search(store, "grace", { principal: ada }).hits.filter((hit) => hit.about === "node")).toEqual([]);
    expect(search(store, "stamp", { principal: ada }).byKind).toEqual({ task: 1 });
    // The seat that sees everything finds everything, and the seat view agrees with the store asked as the seat.
    expect(nodes(search(store, "stamp", { principal: staff }).hits)).toHaveLength(3);
    expect(nodes(search(store.seenBy(ada), "stamp", { principal: ada }).hits)).toEqual(seen);
  });
});

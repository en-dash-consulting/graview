import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, isoDate, search, Store, tellApart } from "../../src/index.js";

/**
 * TWO THINGS OF ONE NAME ARE TOLD APART WHERE A PERSON CHOOSES. A single
 * and its album are both "Blue Hour"; every picker, every ask and the Find
 * strip listed "Blue Hour, Blue Hour".
 */
const album = defineNode("album", {
  fields: z.object({ label: z.string(), released: isoDate.optional(), type: z.enum(["album", "single"]) }),
  plural: "Albums",
  label: (node) => node.label,
});
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", label: (node) => node.label });
const schema = createSchema([album, song]);
const nodes = [
  { id: "album:blue-hour", kind: "album", label: "Blue Hour", released: "2018-07-01", type: "single" },
  { id: "album:blue-hour-2", kind: "album", label: "Blue Hour", released: "2018-09-14", type: "album" },
  { id: "album:paper-money", kind: "album", label: "Paper Money", released: "2020-03-20", type: "album" },
  { id: "song:blue-hour", kind: "song", label: "Blue Hour" },
];
const definitionOf = (kind: string) => schema.tryDefinition(kind as never);

describe("two of one name", () => {
  it("says the word that differs, before a date", () => {
    const apart = tellApart(nodes.slice(0, 3) as never, definitionOf);
    expect(apart.get("album:blue-hour")).toBe("single");
    expect(apart.get("album:blue-hour-2")).toBe("album");
    expect(apart.has("album:paper-money")).toBe(false);
  });

  it("says the kind when the kinds are what differ", () => {
    const apart = tellApart([nodes[1], nodes[3]] as never, definitionOf);
    expect(apart.get("song:blue-hour")).toBe("song");
  });

  it("carries it on search hits", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: nodes as never, edges: [] } });
    const hits = search(store, "blue hour").hits.filter((hit) => hit.about === "node" && hit.kind === "album");
    expect(hits.map((hit) => (hit.about === "node" ? hit.apart : null)).sort()).toEqual(["album", "single"]);
  });
});

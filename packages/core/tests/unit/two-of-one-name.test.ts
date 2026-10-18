import { describe, expect, it } from "vitest";
import { z } from "zod";
import { arrange } from "../../src/arrange.js";
import { createSchema, defineNode, isoDate, Store } from "../../src/index.js";
import { tellApart } from "../../src/words.js";
import { search } from "../../src/search.js";

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
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", label: (node) => node.label, edges: { on: { to: ["album"] } } });
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
    expect(apart.get("album:blue-hour")).toBe("Single");
    expect(apart.get("album:blue-hour-2")).toBe("Album");
    expect(apart.has("album:paper-money")).toBe(false);
  });

  it("never says a record's id: two facts together, else one of its own, else which of them it is (the twelfth walk)", () => {
    // A festival's film picker read "Small Harbor · film:small-harbor": three films of one name, no one fact telling all three apart.
    const film = defineNode("film", {
      fields: z.object({ label: z.string(), director: z.string(), section: z.enum(["features", "shorts"]) }),
      plural: "Films",
      label: (node) => node.label,
    });
    const films = createSchema([film]);
    const of = (kind: string) => films.tryDefinition(kind as never);
    const three = [
      { id: "film:small-harbor", kind: "film", label: "Small Harbor", director: "Ana Smith", section: "features" },
      { id: "film:small-harbor-2", kind: "film", label: "Small Harbor", director: "Ana Smith", section: "shorts" },
      { id: "film:small-harbor-3", kind: "film", label: "Small Harbor", director: "Bo Tanaka", section: "features" },
    ];
    const pairs = tellApart(three as never, of);
    expect(new Set(pairs.values()).size).toBe(3);
    for (const said of pairs.values()) expect(said).not.toMatch(/film:/);
    const twins = [three[0], { ...three[0], id: "film:small-harbor-2" }];
    const apart = tellApart(twins as never, of);
    expect([...apart.values()]).toEqual(["1 of 2", "2 of 2"]);
  });

  it("says the kind when the kinds are what differ", () => {
    const apart = tellApart([nodes[1], nodes[3]] as never, definitionOf);
    expect(apart.get("song:blue-hour")).toBe("song");
  });

  it("carries it on search hits", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: nodes as never, edges: [] } });
    const hits = search(store, "blue hour").hits.filter((hit) => hit.about === "node" && hit.kind === "album");
    expect(hits.map((hit) => (hit.about === "node" ? hit.apart : null)).sort()).toEqual(["Album", "Single"]);
  });

  it("heads a group of songs by release in words that tell the releases apart", () => {
    const store = new Store({
      schema,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [...nodes, { id: "song:navy-coat", kind: "song", label: "Navy Coat" }] as never,
        edges: [
          { kind: "on", from: "song:blue-hour", to: "album:blue-hour" },
          { kind: "on", from: "song:blue-hour", to: "album:blue-hour-2" },
          { kind: "on", from: "song:navy-coat", to: "album:blue-hour-2" },
        ],
      },
    });
    const songs = store.graph.nodesOfKind("song");
    const grouped = arrange(songs, { group: { by: "on" } }, { schema, graph: store.graph as never, flagged: new Set() });
    expect(grouped.groups.map((group) => group.label).sort()).toEqual(["Blue Hour · Album", "Blue Hour · Album, Blue Hour · Single"]);
  });

  it("says each one's noun on search hits when a song and an album share a name", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [nodes[2], { id: "song:paper-money", kind: "song", label: "Paper Money" }] as never, edges: [] } });
    const hits = search(store, "paper").hits.flatMap((hit) => (hit.about === "node" ? [[hit.kind, hit.apart]] : []));
    expect(Object.fromEntries(hits)).toEqual({ album: "album", song: "song" });
  });

  it("says the noun the declaration gives a kind, not its identifier", () => {
    const staff = defineNode("staff", { fields: z.object({ label: z.string() }), plural: "Staff", noun: "staff member", label: (node) => node.label });
    const room = defineNode("room", { fields: z.object({ label: z.string() }), plural: "Rooms", label: (node) => node.label });
    const venue = createSchema([staff, room]);
    const apart = tellApart(
      [
        { id: "staff:hall", kind: "staff", label: "Hall" },
        { id: "room:hall", kind: "room", label: "Hall" },
      ],
      (kind) => venue.tryDefinition(kind as never),
    );
    expect(apart.get("staff:hall")).toBe("staff member");
  });

  it("leads with the kind the person is in, among names found as well", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: nodes as never, edges: [] } });
    const first = (inKind?: string) => search(store, "blue hour", inKind ? { inKind } : {}).hits.find((hit) => hit.about === "node");
    expect(first()?.kind).toBe("album");
    expect(first("song")?.kind).toBe("song");
  });
});

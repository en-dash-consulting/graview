import { createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagesApp, recordFacts } from "../../src/index.js";

/**
 * EACH KIND WORDS ITS OWN END OF A SHARED RELATION. An edge's name was one
 * relation to every surface, so `by` on a song ("their songs") and on an
 * album ("their releases") listed thirty-five songs and six albums together
 * under "Their releases", and `graview check` refused the two sets of words.
 * n-dx's `under` sits on six kinds: a change wants "the tasks inside it",
 * a zone "the zones inside it". A record now lists what reaches it by each
 * reading — kinds that say a relation alike together, kinds that word it
 * their own way apart, each under its own words.
 */
const artist = defineNode("artist", { fields: z.object({ name: z.string() }), label: (node) => node.name });
const song = defineNode("song", {
  fields: z.object({ name: z.string() }),
  label: (node) => node.name,
  edges: { by: { to: ["artist"], description: "the artist whose song it is", inverse: "their songs" } },
});
const album = defineNode("album", {
  fields: z.object({ name: z.string() }),
  label: (node) => node.name,
  edges: { by: { to: ["artist"], description: "the artist whose release it is", inverse: "their releases" } },
});
const single = defineNode("single", {
  fields: z.object({ name: z.string() }),
  label: (node) => node.name,
  edges: { by: { to: ["artist"], description: "the artist whose release it is", inverse: "their releases" } },
});
const store = () =>
  new Store({
    schema: createSchema([artist, song, album, single]),
    mutations: [],
    snapshot: {
      nodes: [
        { id: "blue", kind: "artist", name: "Blue Hour" },
        { id: "s1", kind: "song", name: "Arc" },
        { id: "s2", kind: "song", name: "Dust" },
        { id: "a1", kind: "album", name: "Cold Water" },
        { id: "x1", kind: "single", name: "Echo" },
      ] as never,
      edges: [
        { kind: "by", from: "s1", to: "blue" },
        { kind: "by", from: "s2", to: "blue" },
        { kind: "by", from: "a1", to: "blue" },
        { kind: "by", from: "x1", to: "blue" },
      ] as never,
    },
  });

describe("a record reached by a relation several kinds declare", () => {
  it("lists each reading apart, under each kind's own words, and kinds that say it alike together", () => {
    const facts = recordFacts(store(), "blue");
    const links = (facts?.links ?? []).map((link) => [link.description, link.targets.map((target) => target.id)]);
    expect(links).toEqual(
      expect.arrayContaining([
        ["their songs", ["s1", "s2"]],
        ["their releases", ["a1", "x1"]],
      ]),
    );
    expect(links).toHaveLength(2);
  });

  it("draws both on the record's page, each under its heading", () => {
    const html = renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath="/artists/blue" />);
    expect(html).toContain(">Their songs<");
    expect(html).toContain(">Their releases<");
  });
});

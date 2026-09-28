import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, layout } from "../../src/index.js";

/**
 * THE CITY STANDS WHERE IT CAN BE SEEN. The rail down the left of the scene
 * covers what is under it, so a district laid out there is a district
 * nobody can read — which a five-kind discography did at 1280, its fifth
 * district a hundred pixels under the rail, because "off the edge" was
 * measured against the canvas rather than the room the rails leave.
 */
const fields = z.object({ label: z.string() });
const song = defineNode("song", {
  fields,
  plural: "Songs",
  edges: { by: { to: ["artist"] }, features: { to: ["artist"] }, "produced-by": { to: ["artist"] }, about: { to: ["theme"] } },
});
const album = defineNode("album", { fields, plural: "Albums", edges: { tracks: { to: ["song"] }, by: { to: ["artist"] } } });
const artist = defineNode("artist", { fields, plural: "Artists" });
const theme = defineNode("theme", { fields, plural: "Themes" });
const era = defineNode("era", { fields, plural: "Eras", edges: { spans: { to: ["album", "song"] } } });
const schema = createSchema([song, album, artist, theme, era]);
const many = (kind: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${kind}-${index}`, kind, label: `${kind} ${index}` }));
const graph = () =>
  Graph.from(schema, {
    nodes: [...many("song", 32), ...many("album", 6), ...many("artist", 6), ...many("theme", 6), ...many("era", 1)] as never,
    edges: [],
  });

describe("the city beside the rail", () => {
  for (const [width, height, inset] of [
    [1280, 860, { left: 264, right: 128 }],
    [1560, 940, { left: 264, right: 128 }],
  ] as const) {
    it(`lays no district under the rail at ${width}`, () => {
      const result = layout(graph(), schema, { ...EMPTY_VIEW, overview: true }, { width, height, inset, unit: 16, cityOrder: ["album", "artist", "era", "song", "theme"] });
      const districts = result.nodes.filter((node) => node.plane === 2);
      expect(districts).toHaveLength(5);
      for (const card of districts) {
        expect(card.x, card.id).toBeGreaterThanOrEqual(inset.left);
        expect(card.x + card.width, card.id).toBeLessThanOrEqual(width - inset.right);
      }
    });
  }
});

import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { bandAggregateWords } from "../../src/index.js";

/**
 * A BAND IS NAMED IN WORDS. The seat called a band's group by its id —
 * "album|released-by|in|type=album" — in its header and to a screen reader.
 */
const artist = defineNode("artist", { fields: z.object({ label: z.string() }), plural: "Artists" });
const album = defineNode("album", {
  fields: z.object({ label: z.string(), releaseType: z.enum(["album", "single"]) }),
  edges: { "released-by": { to: ["artist"], description: "who released it", inverse: "what they released" } },
  plural: "Albums",
});
const schema = createSchema([artist, album]);

describe("a band aggregate", () => {
  it("is its kind, the relation it is on as seen from the focus, and the group's value", () => {
    expect(bandAggregateWords("aggregate:album|released-by|in|releaseType=album", schema)).toBe(
      "Albums — what they released, release type: album",
    );
  });
  it("says the rest of a relation as more of the kind", () => {
    expect(bandAggregateWords("aggregate:album|released-by|in|more", schema)).toBe("More albums — what they released");
  });
  it("is not a band when it is a kind's own group", () => {
    expect(bandAggregateWords("aggregate:album", schema)).toBeNull();
  });
});

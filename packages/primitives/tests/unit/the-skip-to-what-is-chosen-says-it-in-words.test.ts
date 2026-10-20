import { createSchema, defineNode, Store, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { wordsForChosen } from "../../src/subject.js";

/**
 * THE SKIP TO WHAT IS CHOSEN SAYS IT IN WORDS (0.1.40's keyboard reach, found
 * by the watch on the discography). A band of an artist's albums chosen on the
 * scene put "Skip to aggregate:album|released-by|in|more…" in the bar: the
 * skip named its choice by id where the subject line already had words for it.
 */
const artist = defineNode("artist", { fields: z.object({ label: z.string() }), plural: "Artists" });
const album = defineNode("album", {
  fields: z.object({ label: z.string(), releaseType: z.enum(["album", "single"]) }),
  edges: { "released-by": { to: ["artist"], description: "who released it", inverse: "what they released" } },
  plural: "Albums",
});
const store = new Store({ schema: createSchema([artist, album]), mutations: [], invariants: [], snapshot: { nodes: [], edges: [] } });

describe("what is chosen, in words", () => {
  it("is a band by what it gathers, never its id", () => {
    expect(wordsForChosen(store, "aggregate:album|released-by|in|more")).toBe("More albums — what they released");
  });
  it("is a group of kinds by their plurals", () => {
    expect(wordsForChosen(store, "aggregate:album+artist")).toBe("Albums and Artists");
  });
  it("is nothing for an id it does not know, so the skip says 'what is chosen'", () => {
    expect(wordsForChosen(store, "elsewhere:nothing")).toBeNull();
  });
});

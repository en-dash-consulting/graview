import { createSchema, defineNode } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildConstellation } from "../../src/index.js";

/**
 * The overview needs no bindings at all — it reads the declaration and
 * nothing else — so the only fixture it needs is a schema.
 */
const author = defineNode("author", {
  fields: z.object({ label: z.string() }),
  edges: { wrote: { to: ["book"], description: "what they wrote" } },
  plural: "Authors",
});
const book = defineNode("book", {
  fields: z.object({ label: z.string() }),
  edges: { "shelved-in": { to: ["shelf"] } },
  plural: "Books",
});
const shelf = defineNode("shelf", { fields: z.object({ label: z.string() }), plural: "Shelves" });
const note = defineNode("note", {
  fields: z.object({ label: z.string() }),
  edges: { about: { to: "*" } },
  plural: "Notes",
});
const schema = createSchema([author, book, shelf, note]);

const counts = { author: 3, book: 12, shelf: 2, note: 0 };
const edgeCounts = { wrote: 12, "shelved-in": 0 };

describe("the constellation", () => {
  it("draws every declared kind, from the declaration alone", () => {
    const shape = buildConstellation(schema, counts, edgeCounts);
    expect(shape.kinds.map((kind) => kind.kind)).toEqual(["author", "book", "note", "shelf"]);
  });

  it("places kinds in a stable order, never by connectivity", () => {
    // A picture that rearranges itself when the data changes is a picture you
    // cannot remember, which is the same rule the layout follows.
    const a = buildConstellation(schema, counts, edgeCounts);
    const b = buildConstellation(schema, { ...counts, book: 900 }, { wrote: 900 });
    expect(a.kinds.map((k) => [k.kind, k.x, k.y])).toEqual(b.kinds.map((k) => [k.kind, k.x, k.y]));
  });

  it("draws a relation for every declared edge between two drawn kinds", () => {
    const shape = buildConstellation(schema, counts, edgeCounts);
    expect(shape.links.map((link) => link.id).sort()).toEqual([
      "shelved-in:book:shelf",
      "wrote:author:book",
    ]);
  });

  it("carries the edge's own words, so the picture explains itself", () => {
    const shape = buildConstellation(schema, counts, edgeCounts);
    expect(shape.links.find((l) => l.edge === "wrote")?.description).toBe("what they wrote");
  });

  it("separates a relation that exists from one only declared", () => {
    // Drawn differently on screen: an intention rather than a fact.
    const shape = buildConstellation(schema, counts, edgeCounts);
    expect(shape.links.find((l) => l.edge === "wrote")?.count).toBe(12);
    expect(shape.links.find((l) => l.edge === "shelved-in")?.count).toBe(0);
  });

  it("marks a kind that may point at anything rather than drawing a hairball", () => {
    const shape = buildConstellation(schema, counts, edgeCounts);
    expect(shape.kinds.find((kind) => kind.kind === "note")?.universal).toBe(true);
    // And no link is drawn for it.
    expect(shape.links.some((link) => link.from === "note")).toBe(false);
  });

  it("says how many of each kind there are, including none", () => {
    const shape = buildConstellation(schema, counts, edgeCounts);
    expect(shape.kinds.find((kind) => kind.kind === "note")?.count).toBe(0);
    expect(shape.kinds.find((kind) => kind.kind === "book")?.count).toBe(12);
  });

  it("marks a kind implicated in a violation", () => {
    const shape = buildConstellation(schema, counts, edgeCounts, ["book"]);
    expect(shape.kinds.find((kind) => kind.kind === "book")?.flagged).toBe(true);
    expect(shape.kinds.find((kind) => kind.kind === "shelf")?.flagged).toBe(false);
  });

  it("leaves out what an app asks it to", () => {
    const shape = buildConstellation(schema, counts, edgeCounts, [], { omit: ["note"] });
    expect(shape.kinds.map((kind) => kind.kind)).not.toContain("note");
  });
});

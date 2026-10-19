import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { linksOfRecords, LINKS_TO_EACH, placeLabels } from "../../src/record-links.js";

/*
 * A CHOSEN RECORD DRAWS ITS OWN LINKS, AND NOTHING ELSE, each in its kind's
 * words: solid to a record the map draws on its own, one line into a
 * district for the records in it the map does not, and one line with a
 * count where a relation reaches more than a handful.
 */
const area = defineNode("area", { fields: z.object({ name: z.string() }), plural: "areas", noun: "area" });
const feature = defineNode("feature", {
  fields: z.object({ name: z.string() }),
  plural: "features",
  noun: "feature",
  edges: { partOf: { to: ["area"], description: "the part it lives in", inverse: "what this part does" } },
});
const schema = createSchema([area, feature]);
const features = Array.from({ length: 12 }, (_, i) => `f${i}`);
const kindOf = (id: string) => (id.startsWith("a") ? "area" : id.startsWith("f") ? "feature" : undefined);

describe("a chosen record draws its own links", () => {
  it("lands on the record when the map draws it, in the words of the kind it is read from", () => {
    const links = linksOfRecords(["f1"], [{ kind: "partOf", from: "f1", to: "a1" }], kindOf, () => true, schema);
    expect(links).toEqual([
      { self: "f1", edge: "partOf", direction: "out", kind: "area", others: ["a1"], lands: "record", words: "the part it lives in" },
    ]);
  });

  it("reads a relation from its far end in the declaration's inverse words", () => {
    const links = linksOfRecords(["a1"], [{ kind: "partOf", from: "f1", to: "a1" }], kindOf, () => true, schema);
    expect(links[0]).toMatchObject({ direction: "in", kind: "feature", words: "what this part does" });
  });

  it("reaches the district for the records the map does not draw one by one", () => {
    const edges = features.slice(0, 4).map((id) => ({ kind: "partOf", from: id, to: "a1" }));
    const links = linksOfRecords(["a1"], edges, kindOf, (id) => id === "f0", schema);
    expect(links.map((link) => [link.lands, link.others])).toEqual([
      ["record", ["f0"]],
      ["district", ["f1", "f2", "f3"]],
    ]);
  });

  it("says a relation reaching more than a handful as one line into the district, with how many", () => {
    const edges = features.map((id) => ({ kind: "partOf", from: id, to: "a1" }));
    expect(features.length).toBeGreaterThan(LINKS_TO_EACH);
    const links = linksOfRecords(["a1"], edges, kindOf, () => true, schema);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ lands: "district", others: features });
  });

  /*
   * Asking whether the map draws a record measures the page, and a hub's
   * thousand songs asked one by one held up the rise to the city for a
   * frame of 70 ms (verify-scale), for a line that went to the district
   * whatever the answers were.
   */
  it("never asks whether the map draws a record whose relation is said as one line into its district", () => {
    const edges = features.map((id) => ({ kind: "partOf", from: id, to: "a1" }));
    const asked: string[] = [];
    linksOfRecords(["a1"], edges, kindOf, (id) => (asked.push(id), true), schema);
    expect(asked).toEqual([]);
  });

  it("asks once for each record a line might land on", () => {
    const edges = features.slice(0, 4).map((id) => ({ kind: "partOf", from: id, to: "a1" }));
    const asked: string[] = [];
    linksOfRecords(["a1"], edges, kindOf, (id) => (asked.push(id), id === "f0"), schema);
    expect(asked).toEqual(["f0", "f1", "f2", "f3"]);
  });

  it("draws nothing between two chosen records twice, and nothing for a link the graph cannot name", () => {
    const links = linksOfRecords(["f1", "a1"], [{ kind: "partOf", from: "f1", to: "a1" }, { kind: "partOf", from: "f2", to: "zz" }], kindOf, () => true, schema);
    expect(links).toEqual([]);
  });
});

describe("where a link's words go", () => {
  it("stacks labels that would land on each other into a short column", () => {
    const placed = placeLabels([
      { key: "a", x: 100, y: 100, width: 80, height: 20 },
      { key: "b", x: 104, y: 102, width: 80, height: 20 },
      { key: "c", x: 400, y: 100, width: 80, height: 20 },
    ]);
    const a = placed.get("a")!;
    const b = placed.get("b")!;
    expect(b.y).toBeGreaterThanOrEqual(a.y + 20);
    // One far away keeps its own place.
    expect(placed.get("c")).toEqual({ x: 360, y: 80 });
  });
});

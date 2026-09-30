import { createSchema, defineNode, Store } from "@graview/core";
import { edgeSelectionId } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { nameOf } from "../../src/index.js";

/**
 * A SELECTED LINE IS HEADED BY WHAT IT MEANS. Select the line from Priya
 * Raman to North lot and its menu was headed "Works at" — the edge's name,
 * spaced — with "where they work" under it. On a deal's line to its vehicle
 * the heading read "For vehicle", on a test drive's line to its car
 * "Drives". A heading that names the edge kind is the bug class.
 */
const location = defineNode("location", { fields: z.object({ label: z.string() }), plural: "Locations" });
const staff = defineNode("staff", {
  fields: z.object({ label: z.string() }),
  plural: "Staff",
  edges: { "works-at": { to: ["location"], description: "where they work", inverse: "who works here" } },
});
const schema = createSchema([location, staff]);

describe("a selected line's name", () => {
  it("is the relation in its declaration's words", () => {
    const store = new Store({
      schema,
      mutations: [],
      snapshot: {
        nodes: [
          { id: "north", kind: "location", label: "North lot" },
          { id: "priya", kind: "staff", label: "Priya Raman" },
        ] as never,
        edges: [{ kind: "works-at", from: "priya", to: "north" }],
      },
    });
    const id = edgeSelectionId("works-at", "priya", "north");
    expect(nameOf(store as never, id)).toBe("Where they work");
  });
});

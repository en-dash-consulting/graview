import { createSchema, defineNode, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * AN OBSERVATION READS A VALUE AS THE CARD DOES. Three duties at 8:30
 * were "3 share the at 510" in homeflow's rail: the minutes as stored and
 * the key as declared. The declaration's own label and format are the
 * words, and the stored value only where there is no format.
 */
const clock = (minutes: unknown) => `${Math.floor(Number(minutes) / 60)}:${String(Number(minutes) % 60).padStart(2, "0")}`;
const duty = defineNode("duty", {
  fields: z.object({ label: z.string(), at: z.number(), day: z.string() }),
  plural: "Duties",
  display: { labels: { at: "Starts" }, format: { at: clock } },
});
const schema = createSchema([duty]);
const store = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "d1", kind: "duty", label: "School run", at: 510, day: "mon" },
        { id: "d2", kind: "duty", label: "Swim club", at: 510, day: "mon" },
        { id: "d3", kind: "duty", label: "Piano", at: 510, day: "wed" },
      ] as never,
      edges: [],
    },
  });

describe("an observation about a shared value", () => {
  it("says the value through the field's declared format", () => {
    const texts = deriveAffordances(store(), ["d1", "d2", "d3"]).observations.map((o) => o.text);
    expect(texts).toContain("all 3 share the starts 8:30");
  });

  it("keeps the stored value, quoted, where the field has no format", () => {
    const texts = deriveAffordances(store(), ["d1", "d2", "d3"]).observations.map((o) => o.text);
    expect(texts).toContain('2 share the day "mon"; "Piano" does not');
  });
});

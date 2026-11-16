import { createSchema, defineNode, markCites, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { dream } from "../../src/tidy.js";

/*
 * THE APP'S OWN ACTOR SAYS WHAT IS UNCITED (Roadmap f-field-cites-marker).
 * A field that declares `cites` names where its value's citation is kept.
 * A run of the actor says each record holding a value there with nothing
 * cited, and changes nothing for it: only a person knows a source.
 */
const claim = defineNode("claim", {
  fields: z.object({ label: z.string(), figure: markCites(z.number().optional(), "source"), source: z.string().optional() }),
  label: (node) => node.label,
});
const schema = createSchema([claim]);

describe("a run of the app's own actor", () => {
  it("says the records holding a cited value with nothing cited, and suggests nothing for them", async () => {
    const store = new Store<AnySchema>({
      schema,
      snapshot: {
        nodes: [
          { id: "c1", kind: "claim", label: "Rainfall", figure: 1200 },
          { id: "c2", kind: "claim", label: "Snowfall", figure: 40, source: "The almanac" },
          { id: "c3", kind: "claim", label: "Hail" },
        ] as never,
        edges: [],
      },
    });
    const report = await dream(store, { now: "2026-11-16T09:00:00.000Z" });
    expect(report.uncited.map(({ record, field, words }) => ({ record, field, words }))).toEqual([{ record: "c1", field: "figure", words: "Rainfall's figure cites no source" }]);
    expect(report.outcomes.filter((one) => one.outcome === "suggested")).toEqual([]);
    expect(report.said).toBe("Nothing to tidy. One value says nowhere where it came from, which only a person can add: Rainfall's figure cites no source.");
    expect(store.log.all()).toEqual([]);
  });
});

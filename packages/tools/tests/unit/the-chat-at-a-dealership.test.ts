import { createSchema, defineNode, Store, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { graphResponder } from "../../src/index.js";

/**
 * THE CHAT ON A REAL LOT. Asked about a vehicle it said "(8C9DCWU1ADJZLWE6S,
 * year 2026, tesla)": the make lower-cased as if it were a word, and the VIN
 * a bare string with nothing saying what it is. Asked for "Subaru Outback"
 * it listed two "2025 Subaru Outback Base (vehicle)" nobody could tell
 * apart; and "tell me about the 2026 Tesla Model Y Performance", on a lot
 * with three, described the first one found as if it were the only one.
 */
const vehicle = defineNode("vehicle", {
  fields: z.object({ vin: z.string(), year: z.number(), make: z.string(), model: z.string() }),
  plural: "Vehicles",
  label: (node) => `${node.year} ${node.make} ${node.model}`,
  display: { labels: { vin: "VIN" } },
});
const schema = createSchema([vehicle]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "v1", kind: "vehicle", vin: "8C9DCWU1ADJZLWE6S", year: 2026, make: "Tesla", model: "Model Y" },
        { id: "v2", kind: "vehicle", vin: "3VP1SNH5LG8UKNNRM", year: 2025, make: "Subaru", model: "Outback" },
        { id: "v3", kind: "vehicle", vin: "H3KKJJ57BZSKA9ZWV", year: 2025, make: "Subaru", model: "Outback" },
      ] as never,
      edges: [],
    },
  });
const ask = graphResponder<typeof schema>();

describe("the chat on a dealership's lot", () => {
  it("keeps a value's own capitals and says what a bare value is", async () => {
    const said = (await ask(store(), "tell me about the 2026 Tesla Model Y")).say;
    expect(said).toContain("VIN 8C9DCWU1ADJZLWE6S");
    expect(said).toContain("make Tesla");
    expect(said).not.toContain("tesla)");
  });

  it("tells two of one name apart, and does not answer for one of them as if it were the only one", async () => {
    const said = (await ask(store(), "tell me about the 2025 Subaru Outback")).say;
    expect(said).toMatch(/Two things are called/);
    expect(said).toContain("3VP1SNH5LG8UKNNRM");
    expect(said).toContain("H3KKJJ57BZSKA9ZWV");
  });

  it("keeps a one-letter word, because Model Y is not Model", async () => {
    const said = (await ask(store(), "any Model Y?")).say;
    expect(said).toContain("“model y”");
  });
});

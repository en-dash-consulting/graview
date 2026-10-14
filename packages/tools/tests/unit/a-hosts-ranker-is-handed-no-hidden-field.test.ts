import "@graview/core/field-sight";
import type { NearCandidate, SearchRanker } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";
import { parent, world } from "../../../core/tests/support/hidden-phones.js";

/**
 * A HOST'S RANKER IS HANDED NO FIELD THE SEAT MAY NOT SEE (Roadmap
 * f-field-sight, f-semantic-search). The candidates are the records the
 * seat sees, and each one's texts are what it is served of it: a parent's
 * search hands the host's model no player's phone number or medical note,
 * and the same candidates whether a phone number is there or not.
 */
const handedFor = async (phone: string | undefined) => {
  const handed: NearCandidate[] = [];
  const near: SearchRanker = async (_query, candidates) => {
    handed.push(...candidates);
    return [];
  };
  await createToolRuntime(world(phone), { author: parent, near }).call("search_graph", { query: "somebody to call" });
  return handed;
};

describe("a host's ranker, asked for a seat whose sight keeps a field", () => {
  it("is handed no kept field's words, and the same whether the field holds a value or not", async () => {
    const withPhone = await handedFor("555 0101");
    expect(withPhone.length).toBeGreaterThan(0);
    expect(JSON.stringify(withPhone)).not.toMatch(/0101|asthma/);
    expect(JSON.stringify(withPhone)).toBe(JSON.stringify(await handedFor(undefined)));
  });
});

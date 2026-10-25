import { bindSchema, createSchema, defineNode, Store, type AnySchema, type Author } from "@graview/core";
import { declined, declineSuggestion, suggest, suggestions, withdrawSuggestion } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dream } from "../../src/tidy.js";

/*
 * THE APP'S OWN ACTOR WITHDRAWS WHAT FALLS BELOW ITS BAR (Roadmap
 * f-withdraw-own-suggestions). Graview Cloud raised its merge floor to 0.8,
 * and the merges already waiting at 0.56–0.61 stayed in the tray: a decline
 * records a person's "never again", and only a new suggestion is given an
 * expiry. Now a run takes back each of its own suggestions still waiting
 * that is below the band it is given — out of the tray, and recorded as
 * nobody's decline, so it may be suggested again should it come to be sure
 * enough. What a person suggested, and what is still sure enough, stay.
 */
const vendor = defineNode("vendor", { fields: z.object({ label: z.string() }) });
const schema = createSchema([vendor]);
bindSchema(schema);
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nick: Author = { kind: "human", id: "nick", name: "Nick" };
const NOW = "2026-10-25T09:00:00.000Z";

function storeOf() {
  return new Store<AnySchema>({
    schema,
    now: () => NOW,
    snapshot: {
      nodes: [
        { id: "vendor:acme", kind: "vendor", label: "Acme Supply" },
        { id: "vendor:bloom", kind: "vendor", label: "Bloom Florals" },
        { id: "vendor:harbor", kind: "vendor", label: "Harbor Catering" },
        { id: "vendor:quill", kind: "vendor", label: "Quill Stationers" },
      ] as never,
      edges: [],
    },
  });
}

const merge = (id: string, into: string) => [{ name: "merge-vendor", args: { id, into } }];
const suggested = (store: Store<AnySchema>, calls: ReturnType<typeof merge>, confidence: number, author: Author = actor) =>
  suggest(store, calls, { author, lineage: { basis: "Names alike", confidence, actor: "duplicates" } })!;

describe("a run given a higher bar", () => {
  it("withdraws its own waiting suggestions below it, and declines none of them", async () => {
    const store = storeOf();
    const low = suggested(store, merge("vendor:bloom", "vendor:acme"), 0.58);
    const lower = suggested(store, merge("vendor:quill", "vendor:acme"), 0.56);
    const sure = suggested(store, merge("vendor:harbor", "vendor:acme"), 0.86);
    const report = await dream(store, { principal: actor, bands: { merge: { ask: 0.8 } }, judges: [] });

    expect(report.outcomes.filter((one) => one.outcome === "withdrawn").map((one) => one.id).sort()).toEqual([low.id, lower.id].sort());
    expect(report.said).toBe("Withdrew 2 suggestions now below the bar.");
    expect(suggestions(store).map((one) => one.id)).toEqual([sure.id]);
    // Nobody said no: neither is recorded as declined, and the same change may be suggested again.
    expect(declined(store, merge("vendor:bloom", "vendor:acme"))).toBeUndefined();
    expect(declined(store, merge("vendor:quill", "vendor:acme"))).toBeUndefined();
    expect(suggested(store, merge("vendor:bloom", "vendor:acme"), 0.9)).toBeDefined();
  });

  it("leaves what a person suggested, and what is sure enough for the bar it is given", async () => {
    const store = storeOf();
    const theirs = suggested(store, merge("vendor:bloom", "vendor:acme"), 0.5, nick);
    const sure = suggested(store, merge("vendor:harbor", "vendor:acme"), 0.81);
    const report = await dream(store, { principal: actor, bands: { merge: { ask: 0.8 } }, judges: [] });
    expect(report.outcomes.filter((one) => one.outcome === "withdrawn")).toEqual([]);
    expect(suggestions(store).map((one) => one.id).sort()).toEqual([theirs.id, sure.id].sort());
    expect(report.said).toBe("Nothing to tidy.");
  });
});

describe("withdrawing a suggestion", () => {
  it("is only for who made it: a person declines one, and that decline is kept", () => {
    const store = storeOf();
    const one = suggested(store, merge("vendor:bloom", "vendor:acme"), 0.6);
    expect(() => withdrawSuggestion(store, one.id, { author: nick })).toThrow("Only who made a suggestion withdraws it");
    declineSuggestion(store, one.id, { author: nick });
    expect(declined(store, merge("vendor:bloom", "vendor:acme"))).toBeDefined();
    expect(() => suggested(store, merge("vendor:bloom", "vendor:acme"), 0.9)).toThrow(/declined/);
  });

  it("is taken back by an undo, and the suggestion waits again", () => {
    const store = storeOf();
    const one = suggested(store, merge("vendor:bloom", "vendor:acme"), 0.6);
    const withdrawn = withdrawSuggestion(store, one.id, { author: actor });
    expect(suggestions(store)).toEqual([]);
    store.undo(withdrawn.batch, { author: actor });
    expect(suggestions(store).map((waiting) => waiting.id)).toEqual([one.id]);
  });
});

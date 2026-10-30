import { describe, expect, it } from "vitest";
import { checkViewRevisionHost } from "../../src/conformance/index.js";
import { memoryViews, withMemoryRevisions } from "../../src/views/kept.js";

/*
 * THE HOST'S VIEW DOOR KEEPS A SECTION'S REVISION (Roadmap
 * f-make-this-section-better). Keep on a section's draft hands the whole
 * new code to `KeptViews.revise`; the host keeps it as it keeps a view a
 * chat replaced, answers its one way back, and offers revising only to a
 * seat that may change views. The conformance check runs a host through it
 * as the page does.
 */
describe("a host's views, revising a view", () => {
  it("keep the revision in memory, said so, and one undo puts the code before back", async () => {
    const keeper = withMemoryRevisions(memoryViews());
    const answer = await keeper.revise!({ name: "home", title: "Home", source: "after", before: "before", section: "This week", said: "Laid out the days." });
    expect(keeper.revised!("home")).toBe("after");
    expect(answer && answer.note).toBe("Kept until this page reloads.");
    await (answer && answer.undo!());
    expect(keeper.revised!("home")).toBeUndefined();
  });

  it("are not offered for revising without revisions, and refuse a seat that may not change views", async () => {
    expect(memoryViews().revise).toBeUndefined();
    const visitor = withMemoryRevisions(memoryViews({ may: { views: false, lenses: false } }));
    expect(() => visitor.revise!({ name: "home", title: "Home", source: "a", before: "b", section: "x", said: "" })).toThrow("Only someone who may change this app's views");
  });

  it("pass the conformance check a host is held to", async () => {
    const report = await checkViewRevisionHost(withMemoryRevisions(memoryViews()), { name: "home", before: "graview.render('a');", after: "graview.render('b');" });
    expect(report).toEqual({ ok: true, claims: { offersRevising: true, keepsTheRevision: true, undoPutsItBack: true }, said: [] });
  });

  it("fail it, said in words, where the host keeps nothing it was handed", async () => {
    const keeper = { ...withMemoryRevisions(memoryViews()), revise: () => undefined };
    const report = await checkViewRevisionHost(keeper, { name: "home", before: "a", after: "b" });
    expect(report.ok).toBe(false);
    expect(report.claims.keepsTheRevision).toBe(false);
    expect(report.said).toContain("After revise, the host does not keep the code it was handed.");
  });
});

describe("a section's revision, as a telling", () => {
  it("is kept as a revision of its section, said so, and a section with no name is refused", async () => {
    const { tellingOf, tellingDidWords } = await import("../../src/told.js");
    const by = { kind: "human", id: "p1" } as const;
    const telling = tellingOf({ words: "Make “This week” better", target: { on: "place", place: "home" }, decided: { type: "view", section: "This week" }, outcome: "previewed" }, by);
    expect(telling?.decided).toEqual({ type: "view", section: "This week" });
    expect(tellingDidWords(telling!)).toBe("A revision of “This week”");
    expect(tellingOf({ words: "x", target: { on: "place", place: "home" }, decided: { type: "view", section: " " } as never, outcome: "previewed" }, by)).toBeUndefined();
  });
});

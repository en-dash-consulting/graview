import { createSchema, defineNode, Store, z, type AnySchema, type Author } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { dream } from "../../src/tidy.js";
import { blocksOf, type LinkBlock } from "../../src/tidy/blocking.js";
import type { JudgeContext } from "../../src/tidy/judges.js";

/*
 * A PLACEMENT IS NOT SUGGESTED ON ONE SHARED WORD (Roadmap
 * f-suggestion-card-one-line). A book app's inbox, on 0.1.66: "Place in
 * chapter: What I steer by", because the note and the chapter "09 · Without
 * a Map" shared the word "what", and another because two shared "opening".
 * f-tidying-link-evidence-not-one-word held the far record's NAME to its
 * telling words, but an empty one-link relation — a note's chapter — still
 * put a far record forward on any one word the two records' texts shared,
 * and a model then judged it at 0.95. Now one shared word is no evidence:
 * the far record is put forward when the record's text says its name or its
 * telling words, or when the two share two telling words; and a run
 * withdraws its own waiting link suggestion that rests on one shared word.
 */
const chapter = defineNode("chapter", { fields: z.object({ label: z.string(), summary: z.string().optional() }) });
const note = defineNode("note", { fields: z.object({ label: z.string(), text: z.string().optional() }), edges: { "in-chapter": { to: ["chapter"], cardinality: "one" } } });
const schema = createSchema([chapter, note]);
const NOW = "2026-11-04T09:00:00.000Z";
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };

type Record = { readonly id: string; readonly kind: string } & { readonly [field: string]: unknown };

const storeOf = (nodes: readonly Record[]) => new Store<AnySchema>({ schema: schema as unknown as AnySchema, now: () => NOW, snapshot: { nodes, edges: [] } as never });

/** The chapters the actor would ask a model about, for each note. */
async function offered(nodes: readonly Record[]) {
  const store = storeOf(nodes);
  const context: JudgeContext = { store, now: new Date(NOW).getTime(), touched: new Map(), quietFor: 0, olderThanDays: 30 };
  const blocks = await blocksOf(context, { families: new Set(["links", "missing-links"]) });
  return blocks.records.flatMap((record) => record.links.flatMap((link: LinkBlock) => link.targets.map((target) => ({ note: record.node.id, to: target.node.id, evidence: target.evidence }))));
}

const chapters: Record[] = [
  { id: "chapter:9", kind: "chapter", label: "09 · Without a Map", summary: "Opening years of wandering, and what it meant to have no plan" },
  { id: "chapter:2", kind: "chapter", label: "02 · Early Work", summary: "First jobs and the people in them" },
];

describe("a note's empty chapter", () => {
  it("is not given a chapter the note shares one word with", async () => {
    expect(await offered([...chapters, { id: "note:1", kind: "note", label: "What I steer by (my values, as one example)", text: "An opening thought on values" }])).toEqual([]);
  });

  it("is given the chapter the note shares two telling words with", async () => {
    expect(await offered([...chapters, { id: "note:1", kind: "note", label: "Leaving home", text: "The opening stretch felt like wandering" }])).toEqual([
      { note: "note:1", to: "chapter:9", evidence: "they share the words “opening” and “wandering”" },
    ]);
  });

  it("is given the chapter whose name the note says", async () => {
    expect(await offered([...chapters, { id: "note:1", kind: "note", label: "A thought", text: "Belongs in 02 · Early Work, I think" }])).toEqual([
      { note: "note:1", to: "chapter:2", evidence: "“02 · Early Work” appears in its text" },
    ]);
  });
});

describe("a run of the app's own actor", () => {
  it("withdraws its own waiting placement that rests on one shared word, and keeps one on evidence", async () => {
    const store = storeOf([...chapters, { id: "note:1", kind: "note", label: "What I steer by" }, { id: "note:2", kind: "note", label: "Leaving home" }]);
    const oneWord = suggest(store, [{ name: "connect-note-in-chapter", args: { id: "note:1", to: "chapter:9" } }], {
      author: actor,
      lineage: { basis: "Jev: 0.95 that the in chapter of “What I steer by” is “09 · Without a Map” (they share the word “what”)", confidence: 0.95, actor: "missing-links" },
    });
    const newer = suggest(store, [{ name: "connect-note-in-chapter", args: { id: "note:2", to: "chapter:9" } }], { author: actor, lineage: { basis: "They share the word “opening”", confidence: 0.9, actor: "missing-links" } });
    const named = suggest(store, [{ name: "connect-note-in-chapter", args: { id: "note:2", to: "chapter:2" } }], { author: actor, lineage: { basis: "“02 · Early Work” appears in its text", confidence: 0.7, actor: "missing-links" } });
    const report = await dream(store, { principal: actor, judges: [] });
    expect(report.outcomes.filter((one) => one.outcome === "withdrawn").map((one) => one.id).sort()).toEqual([oneWord!.id, newer!.id].sort());
    expect(suggestions(store).map((one) => one.id)).toEqual([named!.id]);
  });
});

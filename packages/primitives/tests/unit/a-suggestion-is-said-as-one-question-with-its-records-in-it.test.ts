import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type AnySchema, type Author } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { suggestionGroups, suggestionSentence, whyWords } from "../../src/suggestion-sentence.js";

/*
 * A SUGGESTION IS SAID AS ONE QUESTION, WITH ITS RECORDS IN IT (Roadmap
 * f-suggestion-card-one-line). A book app's inbox, on 0.1.66, said one
 * placement three times: "Graview, tidying suggests Place in chapter: What I
 * steer by (my values, as one example)", then "Jev: 0.95 that the in chapter
 * of … is “09 · Without a Map” (they share the word “what”) · 95% sure ·
 * jev-latest", then two chips naming both records. Now it is one sentence
 * read off the call and the declaration — "Put “What I steer by …” in 09 ·
 * Without a Map?" — its records named in it for a page to link; several
 * alike are one group, "3 notes to put in chapters"; and why it was
 * suggested is the maker's reason alone, never a probability or a model.
 */
const chapter = defineNode("chapter", { fields: z.object({ label: z.string() }), plural: "Chapters" });
const note = defineNode("note", {
  fields: z.object({ label: z.string(), mood: z.enum(["calm", "urgent"]).optional() }),
  edges: { "in-chapter": { to: ["chapter"], cardinality: "one" }, "waits-for": { to: ["note"] }, venue: { to: ["chapter"], cardinality: "one" }, tags: { to: ["chapter"] } },
});
const schema = createSchema([chapter, note]);
const { defineMutation } = bindSchema(schema);
const setMood = defineMutation("set-mood", {
  title: "Set mood",
  subject: { kinds: ["note"], arg: "id" },
  input: z.object({ id: nodeRef(["note"]), mood: z.enum(["calm", "urgent"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { mood: args.mood });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const STEER = "What I steer by (my values, as one example)";

function storeOf() {
  return new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    mutations: [setMood] as never,
    snapshot: {
      nodes: [
        { id: "ch9", kind: "chapter", label: "09 · Without a Map" },
        { id: "ch2", kind: "chapter", label: "02 · Early Work" },
        { id: "steer", kind: "note", label: STEER },
        { id: "home", kind: "note", label: "Leaving home" },
        { id: "first", kind: "note", label: "First job" },
        { id: "home2", kind: "note", label: "Leaving home again" },
      ] as never,
      edges: [],
    },
  });
}

const said = (store: Store<AnySchema>, name: string, args: Record<string, unknown>, actorName = "missing-links") => {
  suggest(store, [{ name, args }], { author: actor, lineage: { basis: "Both are about direction", confidence: 0.8, actor: actorName } });
  const one = suggestions(store).find((each) => each.calls[0]!.name === name && JSON.stringify(each.calls[0]!.args) === JSON.stringify(args))!;
  return suggestionSentence(store, one);
};

describe("a suggestion said as one question", () => {
  it("puts a note in its chapter, the note quoted and both named as records", () => {
    const sentence = said(storeOf(), "connect-note-in-chapter", { id: "steer", to: "ch9" });
    expect(sentence.text).toBe(`Put “${STEER}” in 09 · Without a Map?`);
    expect(sentence.parts).toEqual(["Put ", { record: "steer", label: STEER, quoted: true }, " in ", { record: "ch9", label: "09 · Without a Map" }, "?"]);
  });

  it("says a relation that is a verb as a question about it", () => {
    expect(said(storeOf(), "connect-note-waits-for", { id: "home", to: "first" }).text).toBe("Should “Leaving home” wait for First job?");
  });

  it("says a relation that is a noun as what the far record would be", () => {
    expect(said(storeOf(), "connect-note-venue", { id: "home", to: "ch2" }).text).toBe("Make 02 · Early Work the venue of “Leaving home”?");
    expect(said(storeOf(), "connect-note-tags", { id: "home", to: "ch2" }).text).toBe("Add 02 · Early Work to the tags of “Leaving home”?");
  });

  it("says a merge, a setting aside and a choice filled in", () => {
    expect(said(storeOf(), "merge-note", { id: "home2", into: "home" }, "duplicates").text).toBe("Merge “Leaving home again” into Leaving home?");
    expect(said(storeOf(), "archive-note", { id: "first" }, "archive").text).toBe("Set “First job” aside?");
    expect(said(storeOf(), "set-mood", { id: "first", mood: "urgent" }, "categorize").text).toBe("Mark “First job” as Urgent?");
  });

  it("never says a probability, a model or a field's raw name", () => {
    const sentence = said(storeOf(), "connect-note-in-chapter", { id: "steer", to: "ch9" });
    expect(sentence.text).not.toMatch(/\d%|0\.\d|jev|the in chapter of|suggests/i);
  });
});

describe("several suggestions alike", () => {
  it("are one group, said as how many and what", () => {
    const store = storeOf();
    for (const id of ["steer", "home", "first"]) suggest(store, [{ name: "connect-note-in-chapter", args: { id, to: "ch9" } }], { author: actor, lineage: { basis: "Both are about direction", confidence: 0.8, actor: "missing-links" } });
    suggest(store, [{ name: "archive-note", args: { id: "home2" } }], { author: actor, lineage: { basis: "Finished", confidence: 0.7, actor: "archive" } });
    const groups = suggestionGroups(store, suggestions(store));
    expect(groups.map((group) => [group.words, group.suggestions.length])).toEqual([
      ["3 notes to put in chapters", 3],
      [undefined, 1],
    ]);
  });
});

describe("why a suggestion was made", () => {
  it("is the maker's reason alone", () => {
    expect(whyWords({ basis: "Both are about direction" })).toBe("Both are about direction.");
  });

  it("is the reason inside a basis written before 0.1.66, without the model or the probability", () => {
    expect(whyWords({ basis: "Jev: 0.95 that the in chapter of “What I steer by” is “09 · Without a Map” (both are about direction)" })).toBe("Both are about direction.");
    expect(whyWords({ basis: "Jev: no status plainly fits “Roof” (0.62)" })).toBe("No reason was kept.");
  });
});

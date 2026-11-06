import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, Store, type AnySchema, type Author } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { suggestionGroups, suggestionSentence } from "../../src/suggestion-sentence.js";

/*
 * SUGGESTIONS ABOUT ONE RECORD STAND UNDER ITS NAME (Roadmap
 * f-suggestions-grouped-by-record). Three suggestions about one note — put
 * it in a chapter, link it to another, set it aside — read as three cards,
 * each saying the note's name again. Now the record they share is said
 * once, heading them, and each says only what differs: "Put in 09 ·
 * Without a Map?", "Wait for First job?", "Set aside?". Several alike about
 * different records still stand together by kind.
 */
const chapter = defineNode("chapter", { fields: z.object({ label: z.string() }), plural: "Chapters" });
const note = defineNode("note", {
  fields: z.object({ label: z.string() }),
  edges: { "in-chapter": { to: ["chapter"], cardinality: "one" }, "waits-for": { to: ["note"] }, venue: { to: ["chapter"], cardinality: "one" }, tags: { to: ["chapter"] } },
});
const schema = createSchema([chapter, note]);
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const STEER = "What I steer by";

function storeOf() {
  return new Store<AnySchema>({
    schema: schema as unknown as AnySchema,
    snapshot: {
      nodes: [
        { id: "ch9", kind: "chapter", label: "09 · Without a Map" },
        { id: "ch2", kind: "chapter", label: "02 · Early Work" },
        { id: "steer", kind: "note", label: STEER },
        { id: "home", kind: "note", label: "Leaving home" },
        { id: "first", kind: "note", label: "First job" },
        { id: "steer2", kind: "note", label: "What I steer by, again" },
      ] as never,
      edges: [],
    },
  });
}

const ask = (store: Store<AnySchema>, name: string, args: Record<string, unknown>, by = "missing-links") =>
  suggest(store, [{ name, args }], { author: actor, lineage: { basis: "Both are about direction", confidence: 0.8, actor: by } });
const alone = (store: Store<AnySchema>, name: string, args: Record<string, unknown>, by?: string) => {
  ask(store, name, args, by);
  const one = suggestions(store).find((each) => each.calls[0]!.name === name)!;
  const sentence = suggestionSentence(store, one);
  return { subject: sentence.subject, text: sentence.alone.map((part) => (typeof part === "string" ? part : part.label)).join("") };
};

describe("a suggestion said under the record it is about", () => {
  it("names the record it is about and says the rest without it", () => {
    expect(alone(storeOf(), "connect-note-in-chapter", { id: "steer", to: "ch9" })).toEqual({ subject: { record: "steer", label: STEER }, text: "Put in 09 · Without a Map?" });
    expect(alone(storeOf(), "connect-note-waits-for", { id: "steer", to: "first" }).text).toBe("Wait for First job?");
    expect(alone(storeOf(), "connect-note-venue", { id: "steer", to: "ch2" }).text).toBe("Make 02 · Early Work the venue?");
    expect(alone(storeOf(), "connect-note-tags", { id: "steer", to: "ch2" }).text).toBe("Add 02 · Early Work to the tags?");
    expect(alone(storeOf(), "merge-note", { id: "steer2", into: "steer" }, "duplicates").text).toBe("Merge into What I steer by?");
    expect(alone(storeOf(), "archive-note", { id: "steer" }, "archive").text).toBe("Set aside?");
  });

  it("keeps the far record a link in what it says", () => {
    const store = storeOf();
    ask(store, "connect-note-in-chapter", { id: "steer", to: "ch9" });
    expect(suggestionSentence(store, suggestions(store)[0]!).alone).toEqual(["Put in ", { record: "ch9", label: "09 · Without a Map" }, "?"]);
  });
});

describe("several suggestions about one record", () => {
  it("are one group headed by the record, in the order they came", () => {
    const store = storeOf();
    ask(store, "connect-note-in-chapter", { id: "steer", to: "ch9" });
    ask(store, "connect-note-waits-for", { id: "steer", to: "first" });
    ask(store, "archive-note", { id: "steer" }, "archive");
    const groups = suggestionGroups(store, suggestions(store));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.record).toEqual({ record: "steer", label: STEER });
    expect(groups[0]!.words).toBeUndefined();
    expect(groups[0]!.suggestions.map((one) => one.calls[0]!.name)).toEqual(["connect-note-in-chapter", "connect-note-waits-for", "archive-note"]);
  });

  it("win over a group by kind, which keeps the rest", () => {
    const store = storeOf();
    for (const id of ["steer", "home", "first"]) ask(store, "connect-note-in-chapter", { id, to: "ch9" });
    ask(store, "archive-note", { id: "steer" }, "archive");
    const groups = suggestionGroups(store, suggestions(store));
    expect(groups.map((group) => [group.record?.label, group.words, group.suggestions.length])).toEqual([
      [STEER, undefined, 2],
      [undefined, "2 notes to put in chapters", 2],
    ]);
  });

  it("are not grouped when only the far record is shared", () => {
    const store = storeOf();
    for (const id of ["steer", "home"]) ask(store, "connect-note-in-chapter", { id, to: "ch9" });
    expect(suggestionGroups(store, suggestions(store)).map((group) => [group.record, group.words])).toEqual([[undefined, "2 notes to put in chapters"]]);
  });

  it("leave one alone about its record a row of its own", () => {
    const store = storeOf();
    ask(store, "connect-note-in-chapter", { id: "steer", to: "ch9" });
    ask(store, "archive-note", { id: "home" }, "archive");
    expect(suggestionGroups(store, suggestions(store)).map((group) => [group.record, group.words, group.suggestions.length])).toEqual([
      [undefined, undefined, 1],
      [undefined, undefined, 1],
    ]);
  });
});

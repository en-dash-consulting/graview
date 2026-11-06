import { describe, expect, it } from "vitest";
import { drawnFindings, rowSays, type DrawnRead } from "../../src/section.js";

/*
 * WORDS AS THE COMPUTER KEEPS THEM ARE THE COMPUTER'S, NOT ORDINARY
 * ENGLISH (Roadmap f-better-ui-computer-words-false-alarms,
 * f-better-ui-facts-beside-their-record). A book's fields are draft,
 * story, type, status, summary and point: "draft 3 · revising 0 · done 0"
 * said a count of chapters in draft, and failed as a field's name; a
 * story whose own text says "true" failed as a value the computer keeps.
 * A field's name counts only with its own value as kept beside it, and a
 * word a record's text says is the person's. A count is held by its
 * number, and nothing may be said as "no".
 */
const FIELDS = ["draft", "story", "type", "status", "summary", "point", "title", "wordCount"];
const VALUES = { status: ["draft", "revising", "done", "candidate", "keeper"], type: ["person", "study"], story: ["He said it was true: you cannot connect the dots looking forward."], title: ["01 · The End"] };
const before: DrawnRead = { headings: ["The book"], records: [{ label: "01 · The End", top: 0, left: 0, size: 16, facts: ["Draft"] }], text: "The book 01 · The End Draft Chapters: 1 in draft · 0 revising · 0 done" };
const drawn = (text: string): DrawnRead => ({ ...before, records: [{ ...before.records[0]!, row: "01 · The End Draft" }], text: `The book 01 · The End Draft ${text}` });

describe("a draft's words judged against what the computer keeps", () => {
  it("passes “draft 3” for chapters in draft, “story 2”, and a story whose text says true", () => {
    expect(drawnFindings(before, drawn("Chapters: draft 3 · revising 0 · done 0 · story 2"), { fields: FIELDS, values: VALUES })).toEqual([]);
    expect(drawnFindings(before, drawn("He said it was true: you cannot connect the dots looking forward."), { fields: FIELDS, values: VALUES })).toEqual([]);
  });

  it("still fails a field's name with its own value beside it, a camelCase key, and a raw value no record says", () => {
    expect(drawnFindings(before, drawn("status: candidate"), { fields: FIELDS, values: VALUES }).join(" ")).toContain("“status”, a field's name");
    expect(drawnFindings(before, drawn("wordCount 0"), { fields: FIELDS, values: VALUES }).join(" ")).toContain("“wordCount”, a field's name");
    expect(drawnFindings(before, drawn("Revising: false"), { fields: FIELDS, values: VALUES }).join(" ")).toContain("“false”");
    expect(drawnFindings(before, drawn("Notes: undefined"), { fields: FIELDS, values: VALUES }).join(" ")).toContain("“undefined”");
    // Where a record's values are not known, a key and a raw value written as code still are.
    expect(drawnFindings(before, drawn("done: true"), { fields: ["done"] }).join(" ")).toContain("“done”");
  });

  it("holds a count by its number, a nothing said as “no” and a small one in words", () => {
    expect(rowSays("1 chapter · no stories or ideas yet", "0 stories")).toBe(true);
    expect(rowSays("1 chapter · no stories or ideas yet", "1 chapters")).toBe(true);
    expect(rowSays("one chapter so far", "1 chapters")).toBe(true);
    expect(rowSays("2 chapters · 3 stories", "0 stories")).toBe(false);
    expect(rowSays("2 chapters", "1 chapters")).toBe(false);
  });
});

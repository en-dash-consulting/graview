import { describe, expect, it } from "vitest";
import { compileDocument } from "@graview/core/check";
import { diffDocuments, editDocument, type DocumentEdit, type GraviewDocument } from "@graview/core/document";
import { describeApp } from "../../src/cli/describe.js";
import tasks from "../document/fixtures/tasks.gdd.json";

/**
 * A KIND'S LIST OPENS AS A PICTURE (`pages.lists.<kind>.opens`), which is
 * what "Other ways to show this" keeps on a kind's list: the place it names
 * is drawn under the list's own heading at the list's own address, and the
 * list the app draws by itself stays one link away.
 */
const document = tasks as unknown as GraviewDocument;
const board: DocumentEdit = { op: "add-lens", title: "Tasks by status", lens: "columns", on: "task", bindings: { task: { column: "status" } } };
const edited = (from: GraviewDocument, ...edits: DocumentEdit[]) => {
  const answer = editDocument(from, edits);
  if (!answer.ok) throw new Error(JSON.stringify(answer.findings));
  return answer;
};

describe("a kind's list opens as a place of its own", () => {
  it("is one edit, said as a person reads it, and the compiled app carries it", () => {
    const answer = edited(document, board, { op: "arrange-pages", opens: { task: "Tasks by status" } });
    expect(answer.document.pages?.lists?.["task"]?.opens).toBe("Tasks by status");
    expect(diffDocuments(document, answer.document).sentences.join(" ")).toMatch(/task list opens as "Tasks by status"/);
    const compiled = compileDocument(answer.document);
    expect(compiled.ok).toBe(true);
    if (compiled.ok) expect(compiled.app.pages?.lists?.["task"]?.opens).toBe("Tasks by status");
  });

  it("names a place of that kind, and nothing else", () => {
    const refused = editDocument(document, [{ op: "arrange-pages", opens: { task: "No such place" } }]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.findings[0]!.message).toMatch(/No such place/);
    expect(editDocument(document, [{ op: "arrange-pages", opens: { nothing: "Tasks by status" } }]).ok).toBe(false);
  });

  it("gives the list back when asked, or when its place goes", () => {
    const opened = edited(document, board, { op: "arrange-pages", opens: { task: "Tasks by status" } }).document;
    expect(edited(opened, { op: "arrange-pages", opens: { task: null } }).document.pages?.lists?.["task"]?.opens).toBeUndefined();
    expect(edited(opened, { op: "remove-lens", title: "Tasks by status" }).document.pages?.lists?.["task"]?.opens).toBeUndefined();
  });

  it("follows its place when the place takes another title", () => {
    const opened = edited(document, board, { op: "arrange-pages", opens: { task: "Tasks by status" } }).document;
    const renamed = edited(opened, { ...board, title: "The new board", replace: "Tasks by status" });
    expect(renamed.document.pages?.lists?.["task"]?.opens).toBe("The new board");
  });

  it("changes only the list of the kind whose lens it is, when another kind has a lens of that title", () => {
    const two = edited(document, board, { op: "add-lens", title: "Tasks by status", lens: "blocks", on: "person", options: { blocks: [{ list: "all('person')" }] } }, { op: "arrange-pages", opens: { task: "Tasks by status", person: "Tasks by status" } }).document;
    const removed = edited(two, { op: "remove-lens", title: "Tasks by status", on: "task" }).document;
    expect(removed.pages?.lists?.["task"]?.opens).toBeUndefined();
    expect(removed.pages?.lists?.["person"]?.opens).toBe("Tasks by status");
    const renamed = edited(two, { ...board, title: "The new board", replace: "Tasks by status" }).document;
    expect(renamed.pages?.lists?.["task"]?.opens).toBe("The new board");
    expect(renamed.pages?.lists?.["person"]?.opens).toBe("Tasks by status");
  });

  it("is named when arrange-pages is asked for nothing", () => {
    const refused = editDocument(document, [{ op: "arrange-pages" }]);
    if (refused.ok) throw new Error("refused");
    expect(refused.findings[0]!.message).toMatch(/"opens"/);
  });

  it("is said by describeApp, so an agent can tell what the list's address shows", () => {
    const compiled = compileDocument(edited(document, board, { op: "arrange-pages", opens: { task: "Tasks by status" } }).document);
    if (!compiled.ok) throw new Error("it compiles");
    const said = describeApp(compiled.app as never);
    expect(said).toMatch(/\/tasks opens as "Tasks by status"; the list itself is at \/tasks\?drawn=built-in\./);
    const plain = compileDocument(document);
    if (!plain.ok) throw new Error("it compiles");
    expect(describeApp(plain.app as never)).not.toMatch(/opens as/);
  });

  it("is warned of by the checker when written by hand to name no place", () => {
    const bad = { ...document, pages: { ...(document.pages ?? {}), lists: { task: { opens: "Nowhere" } } } } as GraviewDocument;
    const compiled = compileDocument(bad);
    if (!compiled.ok) throw new Error("the document compiles, with a warning");
    expect(compiled.findings.some((finding) => finding.code === "check:list-opens-no-place")).toBe(true);
  });
});

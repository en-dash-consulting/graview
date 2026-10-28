import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { diffDocuments, editDocument, readDocument } from "../../src/document/index.js";

/*
 * THE APP SAYS WHEN A SUGGESTION IS MADE, BY AN EDIT. `tidying.autoAcceptAt`
 * at the top of a document is the votes at which the app's own actor makes
 * a suggestion; `set-tidying` covers only a kind or a relation, so a chat
 * set it with a JSON Patch. `set-app-tidying` sets it and takes it away in
 * the edit vocabulary, said in a sentence, and the preview of the same
 * change says the same sentence.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const edit = (document: typeof vendors, autoAcceptAt: number | null) => {
  const edited = editDocument(document, [{ op: "set-app-tidying", autoAcceptAt }]);
  if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
  return edited;
};

describe("set-app-tidying", () => {
  it("sets the votes at which the app makes a suggestion, said the same by the edit and the preview", () => {
    const edited = edit(vendors, 4);
    expect(edited.document.tidying).toEqual({ autoAcceptAt: 4 });
    expect(edited.said).toEqual(["The app makes a suggestion on its own once 4 people vote for it."]);
    expect(diffDocuments(vendors, edited.document).sentences).toContain(edited.said[0]);
    expect(compileDocument(edited.document).ok).toBe(true);
  });

  it("says one person in the singular", () => {
    expect(edit(vendors, 1).said).toEqual(["The app makes a suggestion on its own once one person votes for it."]);
  });

  it("takes it away with null, leaving no empty tidying behind", () => {
    const set = edit(vendors, 4).document;
    const cleared = edit(set, null);
    expect(cleared.document.tidying).toBeUndefined();
    expect(cleared.said).toEqual(["A suggestion now waits for somebody who may decide, however many vote for it."]);
    expect(diffDocuments(set, cleared.document).sentences).toContain(cleared.said[0]);
  });

  it("says when it was already so", () => {
    const set = edit(vendors, 4).document;
    expect(edit(set, 4).said).toEqual(["The app already made a suggestion on its own once 4 people voted for it."]);
  });

  it("refuses a count the document cannot hold", () => {
    for (const autoAcceptAt of [0, 2.5, 10_001]) expect(editDocument(vendors, [{ op: "set-app-tidying", autoAcceptAt }]).ok, String(autoAcceptAt)).toBe(false);
    expect(editDocument(vendors, [{ op: "set-app-tidying" }]).ok).toBe(false);
  });
});

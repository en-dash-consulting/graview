import { describe, expect, it } from "vitest";
import { editDocument, readDocument } from "../../src/document/index.js";
import { pluralWords } from "../../src/document/policy-words.js";
import { lowerFirst } from "../../src/words.js";

/**
 * AN ACRONYM IS NEVER LOWER-CASED IN A SENTENCE. Threat Watch's kind said
 * "CVE", plural "CVEs", and a change's summary read "the list of cVEs":
 * the plural's first letter was lower-cased as any word's is inside a
 * sentence. A word whose second letter is upper case is said as written.
 */
const threatWatch = readDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Threat Watch",
  kinds: {
    cve: { noun: "CVE", plural: "CVEs", label: "{name}", fields: { name: { type: "string", required: true }, score: { type: "number" } } },
    task: { plural: "Tasks", label: "{name}", fields: { name: { type: "string", required: true } } },
  },
  acts: { "add-cve": { title: "Add a CVE", creates: "cve" } },
}).document!;

describe("an acronym in a sentence", () => {
  it("CVEs stays CVEs, Tasks reads tasks", () => {
    expect(pluralWords(threatWatch.kinds, "cve")).toBe("CVEs");
    expect(pluralWords(threatWatch.kinds, "task")).toBe("tasks");
  });

  it("a change's summary says the list of CVEs, never cVEs", () => {
    const made = editDocument(threatWatch, [{ op: "set-computed", kind: "cve", name: "severe", expr: "score > 7" }]);
    if (!made.ok) throw new Error(JSON.stringify(made.findings));
    const outcome = editDocument(made.document, [{ op: "set-computed", kind: "cve", name: "severe", expr: "score > 8" }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.said.join(" ")).toContain("How CVEs work out");
    expect(outcome.said.join(" ")).toContain("CVEs");
    expect(outcome.said.join(" ")).not.toContain("cVEs");
  });

  it("lowerFirst leaves AI, URL and CVEs as written and lowers a word", () => {
    expect(["CVEs", "AI uses", "URL", "Tasks", "A"].map(lowerFirst)).toEqual(["CVEs", "AI uses", "URL", "tasks", "a"]);
  });
});

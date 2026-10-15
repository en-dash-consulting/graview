import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";

/**
 * GRAVIEW CHECK SAYS WHAT `pages.first` DOES BESIDE A DRAWN HOME, AND WHEN
 * A PLACE HAS THE NAME OF A KIND'S LIST.
 *
 * The review app declared a home and `pages.first: "This week"`, and its
 * author read the app's landing on This week as the home replaced. And a
 * blocks place titled "Root causes" beside the kind whose plural is "root
 * causes" put two "Root causes" on the bar. The check says each, and what
 * the bar does about it.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const findingsOf = (document: unknown) => {
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
  return compiled.findings;
};

describe("pages.first beside a drawn home", () => {
  it("is a note saying where a new visit lands and that the home stays Home", () => {
    const note = findingsOf(review).find((finding) => finding.code === "check:pages-first-beside-home");
    expect(note).toMatchObject({ severity: "note", path: "pages.first" });
    expect(note?.message).toBe('pages.first lands a new visit on "This week"; the home the declaration draws stays Home — on the bar, and at "/" for every press and link after the visit lands.');
  });

  it("is not said when the app opens on its home, or has no home drawn", () => {
    expect(findingsOf({ ...review, pages: { first: "home" } }).some((finding) => finding.code === "check:pages-first-beside-home")).toBe(false);
    const { home: _, ...views } = review.views;
    expect(findingsOf({ ...review, views }).some((finding) => finding.code === "check:pages-first-beside-home")).toBe(false);
  });
});

describe("a place titled as a kind's list is", () => {
  it("is a warning naming the list and what the bar does", () => {
    const warning = findingsOf(review).find((finding) => finding.code === "check:pages-place-named-as-a-list");
    expect(warning).toMatchObject({ severity: "warning" });
    expect(warning?.message).toBe('The place "Root causes" has the name of the list of every root cause, so the bar names the place "Root causes" and folds the list into More as "All root causes" (still at /root-causes).');
  });

  it("is not said of a place with a name of its own", () => {
    const renamed = structuredClone(review);
    renamed.lenses[0].title = "Why it happened";
    expect(findingsOf(renamed).some((finding) => finding.code === "check:pages-place-named-as-a-list")).toBe(false);
  });
});

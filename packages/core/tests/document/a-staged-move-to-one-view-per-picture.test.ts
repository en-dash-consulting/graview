import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { upgradeDocument } from "../../src/document/upgrade.js";

/**
 * A HOST MOVES ITS APPS TO ONE VIEW PER PICTURE ONE APP AT A TIME
 * (docs/pages-and-lenses-are-one.md, "Upgrading to 0.2").
 *
 * 0.2 changes no stored format: an app's document as it was still compiles
 * and draws, and its duplicate views are said by the check as warnings, not
 * errors, each with the edit that folds it. The host applies those edits
 * to one app, as a version of its own, and leaves the next app as it was
 * until it chooses — both run side by side. Reading a document upgrades it
 * in memory only, and reading it again changes nothing.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const compile = (document: unknown) => compileDocument(document, { today: () => "2026-10-15" });
const folds = (document: unknown) => {
  const compiled = compile(document);
  return compiled.findings.filter((finding) => finding.code === "check:view-duplicates-another" && finding.edits);
};

describe("a staged move to one view per picture", () => {
  it("compiles an app not yet moved, saying what the move would fold, as warnings", () => {
    const compiled = compile(review);
    expect(compiled.ok).toBe(true);
    const found = folds(review);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((finding) => finding.severity === "warning")).toBe(true);
  });

  it("runs a moved app and an unmoved one side by side, both compiling", () => {
    const unmoved = structuredClone(review);
    const moved = editDocument(structuredClone(review), folds(review).flatMap((finding) => finding.edits ?? []));
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(compile(unmoved).ok).toBe(true);
    expect(compile(moved.document).ok).toBe(true);
    expect(folds(moved.document)).toEqual([]);
    expect(folds(unmoved).length).toBeGreaterThan(0);
  });

  it("upgrades a document in memory the same way however often it is read, and leaves the one handed untouched", () => {
    const handed = structuredClone(review);
    const once = upgradeDocument(handed).document;
    const twice = upgradeDocument(once).document;
    expect(twice).toEqual(once);
    expect(handed).toEqual(review);
  });
});

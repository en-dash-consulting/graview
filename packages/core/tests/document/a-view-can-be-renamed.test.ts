import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { editDocument, readDocument, type GraviewDocument } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";
import type { HostView } from "../../src/views/types.js";

/*
 * A VIEW CAN BE RENAMED (Roadmap f-rename-view). A remixed app's views keep
 * the names they were written under — its home is still "eagles-nest" —
 * and replacing one goes by name. `rename-view` moves the name: every
 * `view:<name>` the arrangement holds (the order, the place it opens on,
 * the bar) follows it, and a name already taken or not a name is refused
 * with a sentence. The views and their kept versions are the host's; the
 * edit is what tells the host to move them.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const views: readonly HostView[] = [
  { name: "eagles-nest", title: "Eagle's nest", attach: "vendor", cardinality: "many" },
  { name: "front-door", attach: "home" },
  { name: "shortlist", title: "Shortlist", attach: "vendor", cardinality: "many" },
];
const arranged = (): GraviewDocument => {
  const outcome = editDocument(vendors, [{ op: "arrange-pages", order: ["view:eagles-nest", "vendor"], first: "view:eagles-nest", primary: ["view:eagles-nest", "vendor"] }], { views });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome.document;
};

describe("a view can be renamed", () => {
  it("moves every place that names it, and the document still checks clean", () => {
    const outcome = editDocument(arranged(), [{ op: "rename-view", view: "eagles-nest", to: "vendor-board" }], { views });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.pages?.order).toEqual(["view:vendor-board", "vendor"]);
    expect(outcome.document.pages?.first).toBe("view:vendor-board");
    expect(outcome.document.pages?.primary).toEqual(["view:vendor-board", "vendor"]);
    expect(JSON.stringify(outcome.document)).not.toContain("eagles-nest");
    expect(outcome.said).toEqual(['The view "Eagle\'s nest" is now called "vendor-board"; the order, the place the app opens on and the bar name it so.']);
    const renamed = views.map((view) => (view.name === "eagles-nest" ? { ...view, name: "vendor-board" } : view));
    const compiled = compileDocument(outcome.document, { views: renamed });
    expect(compiled.ok).toBe(true);
    // Clean as the fixture is: what it says is the fixture's own money warnings, and nothing of the views.
    expect(compiled.findings.map((finding) => finding.code)).toEqual(compileDocument(vendors).findings.map((finding) => finding.code));
    // The host that kept the old name would be told the arrangement names a view it does not keep.
    expect(compileDocument(outcome.document, { views }).findings.some((finding) => finding.message.includes("vendor-board"))).toBe(true);
  });

  it("renames the home's own view, which nothing in the document names", () => {
    const outcome = editDocument(vendors, [{ op: "rename-view", view: "view:front-door", to: "welcome" }], { views });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document).toEqual(vendors);
    expect(outcome.said).toEqual(['The home\'s view "front-door" is now called "welcome".']);
  });

  it("a later edit in the same batch names it by its new name", () => {
    const outcome = editDocument(vendors, [{ op: "rename-view", view: "eagles-nest", to: "vendor-board" }, { op: "arrange-pages", first: "view:vendor-board" }], { views });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.pages?.first).toBe("view:vendor-board");
    const stale = editDocument(vendors, [{ op: "rename-view", view: "eagles-nest", to: "vendor-board" }, { op: "arrange-pages", first: "view:eagles-nest" }], { views });
    expect(stale.ok).toBe(false);
  });

  it("refuses a name another view has", () => {
    const outcome = editDocument(arranged(), [{ op: "rename-view", view: "eagles-nest", to: "shortlist" }], { views });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings.map((finding) => [finding.path, finding.message])).toEqual([["edits.0.to", 'another view is already called "shortlist" (Shortlist)']]);
  });

  it("refuses a name that is not one, and a view the host does not keep", () => {
    const bad = editDocument(vendors, [{ op: "rename-view", view: "eagles-nest", to: "Vendor Board" }], { views });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.findings[0]!.message).toBe('"Vendor Board" is not a view\'s name: lower-case letters, digits and hyphens, like "vendor-board"');
    const unknown = editDocument(vendors, [{ op: "rename-view", view: "osprey", to: "vendor-board" }], { views });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.findings[0]!.message).toBe('the host keeps no view named "osprey"');
  });

  it("without the host's views, renames what the document names and refuses a name it already holds", () => {
    const outcome = editDocument(arranged(), [{ op: "rename-view", view: "eagles-nest", to: "vendor-board" }]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
    expect(outcome.document.pages?.first).toBe("view:vendor-board");
    const taken = editDocument(arranged(), [{ op: "rename-view", view: "eagles-nest", to: "eagles-nest" }]);
    expect(taken.ok).toBe(false);
    const none = editDocument(vendors, [{ op: "rename-view", view: "eagles-nest", to: "vendor-board" }]);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.findings[0]!.message).toBe('nothing in this app names a view "eagles-nest", and its host did not say its views');
  });
});

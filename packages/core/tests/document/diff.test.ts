import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyPatch, diffDocuments, PatchError, readDocument, type GraviewDocument } from "../../src/document/index.js";

const vendors = readDocument(JSON.parse(readFileSync(new URL("./fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;

describe("a change, in words", () => {
  it("nothing changed says so", () => {
    expect(diffDocuments(vendors, structuredClone(vendors))).toMatchObject({ unchanged: true, breaking: false });
  });

  it("adding a field is not breaking; removing one is, and names the loss", () => {
    const added = applyPatch(vendors, [{ op: "add", path: "/kinds/vendor/fields/deposit", value: { type: "number" } }]);
    const d1 = diffDocuments(vendors, added);
    expect(d1.breaking).toBe(false);
    expect(d1.sentences).toContain("vendor gains a field, deposit (number).");

    const removed = applyPatch(vendors, [{ op: "remove", path: "/kinds/vendor/fields/notes" }]);
    const d2 = diffDocuments(vendors, removed);
    expect(d2.breaking).toBe(true);
    expect(d2.removedFields).toEqual([{ kind: "vendor", field: "notes" }]);
    expect(d2.sentences).toContain("vendor loses its notes field, and every value in it.");
  });

  it("dropping an enum option and retyping a field are breaking", () => {
    const after = applyPatch(vendors, [
      { op: "replace", path: "/kinds/vendor/fields/status/options", value: ["researching", "booked", "declined"] },
      { op: "replace", path: "/kinds/vendor/fields/due/type", value: "string" },
    ]);
    const d = diffDocuments(vendors, after);
    expect(d.droppedOptions).toEqual([{ kind: "vendor", field: "status", options: ["contacted"] }]);
    expect(d.retypedFields).toEqual([{ kind: "vendor", field: "due", from: "date", to: "string" }]);
    expect(d.breaking).toBe(true);
  });

  it("removing a kind is breaking and said plainly", () => {
    const after: GraviewDocument = structuredClone(vendors);
    delete (after.kinds as Record<string, unknown>)["category"];
    expect(diffDocuments(vendors, after).sentences[0]).toBe("The category kind is removed, and every category with it.");
  });
});

describe("JSON patch", () => {
  it("add, replace, remove, move, copy, test", () => {
    const doc = { a: { b: 1 }, list: [1, 2] };
    expect(applyPatch(doc, [{ op: "add", path: "/list/-", value: 3 }])).toEqual({ a: { b: 1 }, list: [1, 2, 3] });
    expect(applyPatch(doc, [{ op: "replace", path: "/a/b", value: 2 }])).toEqual({ a: { b: 2 }, list: [1, 2] });
    expect(applyPatch(doc, [{ op: "remove", path: "/list/0" }])).toEqual({ a: { b: 1 }, list: [2] });
    expect(applyPatch(doc, [{ op: "move", from: "/a/b", path: "/c" }])).toEqual({ a: {}, list: [1, 2], c: 1 });
    expect(applyPatch(doc, [{ op: "copy", from: "/list", path: "/copy" }])).toEqual({ a: { b: 1 }, list: [1, 2], copy: [1, 2] });
    expect(() => applyPatch(doc, [{ op: "test", path: "/a/b", value: 9 }])).toThrow(PatchError);
    expect(doc).toEqual({ a: { b: 1 }, list: [1, 2] });
  });

  it("refuses to patch what is not there", () => {
    expect(() => applyPatch({}, [{ op: "replace", path: "/nope", value: 1 }])).toThrow(/nothing at/);
    expect(() => applyPatch({}, [{ op: "add", path: "nope", value: 1 }])).toThrow(/JSON pointer/);
  });
});

describe("format upgrades", () => {
  it("run each step in order and land on the current format", async () => {
    const { upgradeDocument } = await import("../../src/document/index.js");
    const steps = { 1: (d: Record<string, unknown>) => ({ ...d, name: `${d["name"]} (v2)` }), 2: (d: Record<string, unknown>) => ({ ...d, description: "upgraded twice" }) };
    const out = upgradeDocument({ format: "graview-document", formatVersion: 1, name: "Old" }, steps, 3);
    expect(out).toEqual({ from: 1, document: { format: "graview-document", formatVersion: 3, name: "Old (v2)", description: "upgraded twice" } });
  });

  it("a current document passes through untouched; a missing step is a sentence", async () => {
    const { upgradeDocument } = await import("../../src/document/index.js");
    const doc = { format: "graview-document", formatVersion: 1, name: "Now" };
    expect(upgradeDocument(doc)).toEqual({ document: doc });
    expect(() => upgradeDocument(doc, {}, 2)).toThrow(/no upgrade from format 1 to 2/);
  });
});

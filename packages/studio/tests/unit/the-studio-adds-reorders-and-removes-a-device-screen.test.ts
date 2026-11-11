import { readFileSync } from "node:fs";
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { readDocument, type GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import { createStudio } from "../../src/index.js";
import { screenId } from "../../src/meta.js";

/*
 * THE STUDIO ADDS, REORDERS AND REMOVES A DEVICE SCREEN (Roadmap
 * f-device-nav-bar): each screen of the strip is a node of the declaration,
 * in the strip's order; the studio's acts on it are said to the document as
 * `add-device-screen`, `move-device-screen` and `remove-device-screen`, and
 * the document it hands back has the strip as the studio left it.
 */
const vendors = readDocument(JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/vendors.gdd.json", import.meta.url), "utf8"))).document!;
const studioOf = (document: GraviewDocument) => {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  return createStudio(compiled.app as never, { document } as never);
};
const withStrip = { ...vendors, devices: { screens: [{ place: "home", label: "Today" }, { place: "vendors", label: "Vendors" }] } } as GraviewDocument;

describe("a device's screens in the studio", () => {
  it("reads the strip in its order", () => {
    const studio = studioOf(withStrip);
    const screens = studio.store.graph.nodesOfKind("screen" as never) as unknown as { id: string; label: string; place: string; at: number }[];
    expect(screens.map((screen) => [screen.id, screen.label, screen.place, screen.at])).toEqual([
      ["screen:home", "Today", "home", 0],
      ["screen:vendors", "Vendors", "vendors", 1],
    ]);
    expect(studio.edits()).toEqual([]);
  });

  it("adds a screen, last, as add-device-screen", () => {
    const studio = studioOf(withStrip);
    studio.store.apply({ name: "add-screen", args: { place: "categories", label: "Categories" } } as never);
    expect(studio.edits()).toEqual([{ op: "add-device-screen", screen: { place: "categories", label: "Categories" } }]);
    const document = studio.document();
    expect(document?.ok).toBe(true);
    if (document?.ok) expect(document.document.devices?.screens?.map((screen) => screen.place)).toEqual(["home", "vendors", "categories"]);
  });

  it("reorders a screen as move-device-screen", () => {
    const studio = studioOf(withStrip);
    studio.store.apply({ name: "move-screen", args: { id: screenId("vendors"), to: 0 } } as never);
    expect(studio.edits()).toEqual([{ op: "move-device-screen", place: "vendors", to: 0 }]);
    const document = studio.document();
    if (document?.ok) expect(document.document.devices?.screens).toEqual([{ place: "vendors", label: "Vendors" }, { place: "home", label: "Today" }]);
    expect(document?.ok).toBe(true);
  });

  it("removes a screen as remove-device-screen, and the last one takes the strip with it", () => {
    const studio = studioOf(withStrip);
    studio.store.apply({ name: "remove-screen", args: { id: screenId("home") } } as never);
    expect(studio.edits()).toEqual([{ op: "remove-device-screen", place: "home" }]);
    studio.store.apply({ name: "remove-screen", args: { id: screenId("vendors") } } as never);
    const document = studio.document();
    expect(document?.ok).toBe(true);
    if (document?.ok) expect(document.document.devices).toBeUndefined();
  });

  it("refuses a screen for a place the app does not have, as the checker words it", () => {
    const studio = studioOf(withStrip);
    studio.store.apply({ name: "add-screen", args: { place: "venues", label: "Venues" } } as never);
    const document = studio.document();
    expect(document?.ok).toBe(false);
    if (document && !document.ok) expect(JSON.stringify(document)).toMatch(/device-screen-place/);
  });

  it("carries a screen along when its kind is renamed, in the app it applies and the document it hands back", () => {
    const studio = studioOf(withStrip);
    studio.store.apply({ name: "rename-kind", args: { id: "declared:vendor", label: "supplier" } } as never);
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    expect(applied.app.devices?.screens).toEqual([{ place: "home", label: "Today" }, { place: "/suppliers", label: "Vendors" }]);
    const document = studio.document();
    if (!document?.ok) throw new Error(JSON.stringify(document));
    expect(document.document.devices?.screens).toEqual([{ place: "home", label: "Today" }, { place: "/suppliers", label: "Vendors" }]);
  });

  it("takes a screen off the strip when the kind it shows is removed", () => {
    const studio = studioOf(withStrip);
    studio.store.apply({ name: "remove-kind", args: { id: "declared:vendor" } } as never);
    const applied = studio.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    expect(applied.app.devices?.screens).toEqual([{ place: "home", label: "Today" }]);
  });

  it("carries a TypeScript app's screen along a renamed kind, and drops one whose kind is removed", () => {
    const note = defineNode("note", { fields: z.object({ label: z.string() }) });
    const tag = defineNode("tag", { fields: z.object({ label: z.string() }), plural: "tags" });
    const app = defineApp({ name: "notes", schema: createSchema([note, tag]), devices: { screens: [{ place: "home", label: "Home" }, { place: "notes", label: "Notes" }, { place: "/tags", label: "Tags" }] } });
    const renamed = createStudio(app as never);
    renamed.store.apply({ name: "rename-kind", args: { id: "declared:note", label: "memo" } } as never);
    const applied = renamed.apply();
    if (!applied.ok) throw new Error(JSON.stringify(applied.check.findings));
    expect(applied.app.devices?.screens).toEqual([{ place: "home", label: "Home" }, { place: "/memos", label: "Notes" }, { place: "/tags", label: "Tags" }]);
    const removed = createStudio(app as never);
    removed.store.apply({ name: "remove-kind", args: { id: "declared:tag" } } as never);
    const without = removed.apply();
    if (!without.ok) throw new Error(JSON.stringify(without.check.findings));
    expect(without.app.devices?.screens?.map((screen) => screen.place)).toEqual(["home", "notes"]);
  });
});


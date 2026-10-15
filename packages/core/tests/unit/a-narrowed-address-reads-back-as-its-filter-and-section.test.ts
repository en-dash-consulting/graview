import { describe, expect, it } from "vitest";
import { parseArrangement } from "../../src/arrange.js";
import { narrowedPath, sectionSlug } from "../../src/navigate.js";

/**
 * A NARROWED ADDRESS READS BACK AS ITS FILTER AND ITS SECTION. Where a view
 * sent somebody — `navigate({ place: "features", where: { stage:
 * "building" }, section: "Shipping soon" })` — is a path with the `filter`
 * the list's arranging line already writes and a section after `#`, so it
 * can be shared and opens the same list, narrowed the same way, at the
 * same heading: the URL round trip.
 */
describe("a narrowed address", () => {
  it("makes an address that reads back as the same filter and section", () => {
    const address = narrowedPath("/features", { filter: "stage:building,done:false", section: "Shipping soon" });
    expect(address).toBe("/features?filter=stage%3Abuilding%2Cdone%3Afalse#shipping-soon");
    const url = new URL(address, "https://app.example");
    expect(parseArrangement({ filter: url.searchParams.get("filter")! }).filter).toEqual([
      { key: "stage", value: "building" },
      { key: "done", value: "false" },
    ]);
    expect(url.hash).toBe(`#${sectionSlug("Shipping soon")}`);
  });

  it("keeps a place's own words beside the filter, and says nothing it was not asked", () => {
    expect(narrowedPath("/places/the-board?of=features", { filter: "stage:idea" })).toBe("/places/the-board?of=features&filter=stage%3Aidea");
    expect(narrowedPath("/features/feature-1", { section: "Notes" })).toBe("/features/feature-1#notes");
    expect(narrowedPath("/features")).toBe("/features");
  });

  it("says a section as an address does: lower-cased and hyphenated, in any script", () => {
    expect(sectionSlug("Shipping soon!")).toBe("shipping-soon");
    expect(sectionSlug("Été à venir")).toBe("été-à-venir");
  });
});

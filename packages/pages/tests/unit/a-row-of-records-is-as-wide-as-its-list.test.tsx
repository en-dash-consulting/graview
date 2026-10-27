// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { beforeAll, describe, expect, it } from "vitest";
import { rendered } from "./the-review.js";

/**
 * A ROW OF RECORDS IS AS WIDE AS ITS LIST. `{"list": "all('finding')",
 * "as": "row"}` of a kind with no row of its own drew each record as the
 * scene's chip — about 240 pixels, its name cut at about thirty characters
 * — down a page 1440 wide. Each is a line of the list now, its whole name
 * in it, wrapping where it must.
 */
beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

describe("a row of records is as wide as its list", () => {
  it("draws each record of a kind with no row as a line holding its whole name, not a chip", async () => {
    const { host, done } = await rendered("/");
    const items = [...host.querySelectorAll('[data-testid="home-view"] .graview-spec-list[data-as="row"] > li')];
    expect(items.map((li) => li.getAttribute("data-graview-listed"))).toEqual(["f1", "f2", "f3", "f4"]);
    for (const li of items) {
      expect(li.querySelector('[data-graview-primitive="chip"]')).toBeNull();
      // Its whole name — and, where a broken rule names the record, the kit's flag after it (Roadmap f-blocks-home-flagged).
      const title = li.querySelector('.graview-spec-row[data-graview-kind="finding"] .graview-spec-title')?.textContent ?? "";
      const flagged = li.hasAttribute("data-graview-flagged");
      expect(title.endsWith(" ⚠")).toBe(flagged);
      expect(flagged ? title.slice(0, -2) : title).toBe(li.querySelector("a")?.getAttribute("aria-label"));
    }
    expect(items[0]!.textContent).toContain("The headline inside a nested group is drawn at the page title's size");
    await done();
  });
});

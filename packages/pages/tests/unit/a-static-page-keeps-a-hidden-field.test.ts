import "@graview/core/field-sight";
import { defineApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import { renderPlace } from "../../src/static.js";
import { coach, MUTATIONS, parent, policy, schema, world } from "../../../core/tests/support/hidden-phones.js";

/**
 * A STATIC PAGE KEEPS A FIELD ITS VIEWER MAY NOT SEE (Roadmap f-field-sight).
 * A printed list and a record's page are drawn from the viewer's seat view,
 * so a field a sight keeps from it is not on the page — and the page is the
 * same with a value there as without one.
 */
const app = defineApp({ name: "roster", schema, mutations: MUTATIONS, policy });
const page = (phone: string | undefined, viewer = parent, at = "/players/player%3Aann") => renderPlace(world(phone), app, at, { viewer, today: "2026-10-13" }).html;

describe("a static page under a sight that hides a field", () => {
  it("prints no phone number a parent may not see, on a record's page or its kind's list", () => {
    for (const at of ["/players/player%3Aann", "/players"]) {
      expect(page("555 0101", parent, at)).not.toMatch(/0101|asthma/);
      expect(page("555 0101", parent, at)).toBe(page(undefined, parent, at));
    }
  });

  it("prints it for the coach", () => {
    expect(page("555 0101", coach)).toContain("555 0101");
  });
});

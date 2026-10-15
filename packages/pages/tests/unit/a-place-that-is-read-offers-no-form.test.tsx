// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { beforeAll, describe, expect, it } from "vitest";
import { rendered } from "./the-review.js";

/**
 * A PLACE THAT IS READ OFFERS NO FORM. Every place ended with the form for
 * the kind it stands on; a lens declared `"create": false` — a summary —
 * leaves it off, and a place that says nothing keeps it.
 */
beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

describe("a place that is read offers no form", () => {
  it("leaves off the forms that begin its kind where it says create: false", async () => {
    const { host, done } = await rendered("/places/the-summary");
    expect(host.querySelector('[data-testid="place-lens"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="place-creators"]')).toBeNull();
    expect(host.querySelector('[data-testid="form-add-finding"]')).toBeNull();
    await done();
  });

  it("keeps them where it says nothing", async () => {
    const { host, done } = await rendered("/places/every-finding");
    expect(host.querySelector('[data-testid="place-creators"]')?.textContent).toContain("Add a finding");
    await done();
  });
});

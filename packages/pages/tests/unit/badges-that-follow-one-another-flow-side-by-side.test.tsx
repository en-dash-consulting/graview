// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { beforeAll, describe, expect, it } from "vitest";
import { rendered } from "./the-review.js";

/**
 * BADGES THAT FOLLOW ONE ANOTHER FLOW SIDE BY SIDE. A card with three
 * badges drew each on a line of its own, the view being a column; on the
 * record's page too. A run of badges is one line that wraps, as chips are.
 */
beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

const runs = (root: ParentNode) => [...root.querySelectorAll(".graview-spec-badges")].map((run) => [...run.children].map((badge) => (badge.classList.contains("graview-spec-badge") ? badge.textContent : `not a badge: ${badge.className}`)));

describe("badges that follow one another flow side by side", () => {
  it("on a card", async () => {
    const { host, done } = await rendered("/places/every-finding");
    const card = host.querySelector('[data-graview-listed="f1"] [data-graview-spec="card"]')!;
    expect(runs(card)).toEqual([["high", "layout", "now"]]);
    await done();
  });

  it("on a record's page", async () => {
    const { host, done } = await rendered("/findings/f3");
    const page = host.querySelector('[data-graview-spec="page"][data-graview-kind="finding"]')!;
    expect(runs(page)).toEqual([["low", "words", "later"]]);
    await done();
  });
});

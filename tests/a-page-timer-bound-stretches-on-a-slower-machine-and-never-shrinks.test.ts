import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, typed by its use here.
import { factorOf, PACE_CEILING, REFERENCE_MS } from "../scripts/lib/page-pace.mjs";

/**
 * A PAGE'S TIMER, HELD AT THE REFERENCE'S PACE (HQ feature
 * f-guest-holds-on-verify-runner). The guest harness's "the page's own timer
 * kept time" claims were set on a laptop and failed on GitHub's runners,
 * whose pages are slower at the same work. Their 250 ms stretches by how
 * much slower this machine runs a fixed reference than the laptop did.
 */
describe("how much slower this machine's pages are", () => {
  it("is the reference's time here over its time where the bound was set, to a hundredth", () => {
    expect(factorOf(REFERENCE_MS.chromium * 2, "chromium")).toBe(2);
    expect(factorOf(REFERENCE_MS.webkit * 1.5, "webkit")).toBe(1.5);
  });

  it("never shrinks a bound on a faster machine", () => {
    expect(factorOf(REFERENCE_MS.firefox / 3, "firefox")).toBe(1);
  });

  it("stretches no further than the host stretches a view's own budgets on a slow device", () => {
    expect(factorOf(REFERENCE_MS.chromium * 10, "chromium")).toBe(PACE_CEILING);
  });

  it("leaves a bound as set for an engine with no reference, or a time that is not a number", () => {
    expect(factorOf(40, "lynx")).toBe(1);
    expect(factorOf(Number.NaN, "chromium")).toBe(1);
  });
});

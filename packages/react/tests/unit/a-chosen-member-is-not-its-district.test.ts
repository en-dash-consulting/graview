import { describe, expect, it } from "vitest";
import { altitudeOpacity } from "../../src/index.js";

/**
 * CLICKING A NAME IN AN OPENED DISTRICT MUST CHANGE THE PICTURE.
 *
 * At altitude a selection is resolved to the card that stands for it —
 * right for asking which CARDS a line touches, wrong for asking which LINE.
 * With the volunteers opened, all seven covered-by strands end at the
 * volunteers card, so choosing Ada lit Bo's shifts too and the scene said
 * the same thing before and after the click.
 */
describe("how strongly a line is drawn at altitude", () => {
  const lit = 0.9;
  const receded = 0.12;

  it("draws only the chosen member's own lines when the selection names members", () => {
    const chosen = { emphasized: false, stressed: false, anyChosen: true, touches: true };
    expect(altitudeOpacity({ ...chosen, mine: true })).toBe(lit);
    // The other six end at the same card, and that is no longer enough.
    expect(altitudeOpacity({ ...chosen, mine: false })).toBe(receded);
  });

  it("falls back to the card rule when the selection names no strand", () => {
    // A district chosen as a district: its own lines stand, the rest recede.
    const asCard = { emphasized: false, stressed: false, anyChosen: false, mine: false };
    expect(altitudeOpacity({ ...asCard, touches: true })).toBe(lit);
    expect(altitudeOpacity({ ...asCard, touches: false })).toBe(receded);
  });

  it("lets a stressed relation kind outrank both", () => {
    const hovering = { emphasized: true, anyChosen: true, mine: false, touches: false };
    expect(altitudeOpacity({ ...hovering, stressed: true })).toBe(0.95);
    expect(altitudeOpacity({ ...hovering, stressed: false })).toBe(0.08);
  });

  it("says nothing is chosen the same way it always did", () => {
    // Nothing selected: `touches` is true for every line, and every line stands.
    expect(altitudeOpacity({ emphasized: false, stressed: false, anyChosen: false, mine: false, touches: true })).toBe(lit);
  });

  /**
   * A bundle is unpicked so each line can start at the thing it is about —
   * the week draws every shift as its own span, and a line leaving the span
   * says which shifts are covered. Seven of them arriving at one closed
   * district, each at the weight of a single fact, is a starburst over the
   * whole picture.
   */
  it("draws a relation quieter the more lines it is drawing at once", () => {
    const resting = (siblings: number) =>
      altitudeOpacity({ emphasized: false, stressed: false, anyChosen: false, mine: false, touches: true, siblings });
    expect(resting(1)).toBe(lit);
    expect(resting(7)).toBeLessThan(0.45);
    // It quietens, and it never disappears.
    expect(resting(40)).toBeGreaterThanOrEqual(0.34);
    expect(resting(3)).toBeGreaterThan(resting(6));
  });

  it("brings a crowded line all the way back when it is the chosen one", () => {
    // The crowd rule is about REST. A choice outranks it.
    expect(
      altitudeOpacity({ emphasized: false, stressed: false, anyChosen: true, mine: true, touches: true, siblings: 12 }),
    ).toBe(lit);
  });
});

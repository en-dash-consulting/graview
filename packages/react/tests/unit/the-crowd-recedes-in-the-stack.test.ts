import { describe, expect, it } from "vitest";
import { DEFAULT_KIT } from "@graview/core";
import { altitudeOpacity, stackOpacity } from "../../src/index.js";

/**
 * SELECTING SOMETHING MUST CALM THE REST OF THE PICTURE.
 *
 * At altitude it always did: `altitudeOpacity` drops an untouched line to
 * 0.12 the moment anything is chosen. Inside the stack the same rule was
 * written in the component's own comment — "Selecting DRAWS ITS RELATIONS
 * and recedes the rest" — and never implemented. Every unlit line kept its
 * resting weight whatever was selected, so choosing one volunteer lit two
 * lines and left fifteen others at full strength across the same picture.
 */
const kit = DEFAULT_KIT.emphasis;
const own = 0.85; // What `connectorStyle` gives a line that says nothing else.

describe("how strongly a line is drawn inside the stack", () => {
  it("recedes an unlit line once something else is lit", () => {
    const quiet = stackOpacity({ edgeChosen: false, lit: false, anyLit: false, own, kit });
    const receded = stackOpacity({ edgeChosen: false, lit: false, anyLit: true, own, kit });
    expect(receded).toBeLessThan(quiet);
    // Far enough under the lit line to read as background rather than as a
    // second answer: the gap altitude has had all along.
    expect(stackOpacity({ edgeChosen: false, lit: true, anyLit: true, own, kit }) / receded).toBeGreaterThan(5);
  });

  it("recedes for a stressed relation kind too, not only a selection", () => {
    // `anyLit` is the question; where the light came from is the caller's.
    expect(stackOpacity({ edgeChosen: false, lit: false, anyLit: true, own, kit })).toBe(own * kit.dim);
  });

  it("leaves the resting picture where it was", () => {
    // Nothing chosen: the crowd keeps `rest`, which is what it always kept.
    expect(stackOpacity({ edgeChosen: false, lit: false, anyLit: false, own, kit })).toBe(own * kit.rest);
  });

  it("carries a line's own declared opacity through every step", () => {
    // A relation a brand made faint stays fainter than its neighbours.
    const faint = stackOpacity({ edgeChosen: false, lit: false, anyLit: false, own: 0.2, kit });
    expect(faint).toBeLessThan(stackOpacity({ edgeChosen: false, lit: false, anyLit: false, own: 0.9, kit }));
  });

  it("agrees with altitude about how far a receded line falls", () => {
    // Two altitudes, one picture: an untouched line should not be twice as
    // loud down here as it is up there.
    const here = stackOpacity({ edgeChosen: false, lit: false, anyLit: true, own: 1, kit });
    const up = altitudeOpacity({ emphasised: false, stressed: false, anyChosen: true, mine: false, touches: false });
    expect(here).toBeCloseTo(up, 2);
  });

  it("puts the chosen edge above its own neighbours", () => {
    expect(stackOpacity({ edgeChosen: true, lit: true, anyLit: true, own, kit })).toBeGreaterThan(
      stackOpacity({ edgeChosen: false, lit: true, anyLit: true, own, kit }),
    );
  });
});

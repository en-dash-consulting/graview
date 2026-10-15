import { describe, expect, it } from "vitest";
import { channelD } from "../../src/routes.js";

/**
 * A TIE THROUGH THE GUTTERS TAKES THE KIT'S ROUTE. Since a tie on the ground
 * runs whole through the gutters between the chips, its corners were always
 * eased, whatever the kit said: the garden's kit on graview.dev offers
 * "right-angled" and the line on the screen went on curving at every turn.
 * The gutters decide where the line goes; the kit decides how it turns.
 */
const gutter = [
  { x: 38.5, y: 192.8 },
  { x: 16.5, y: 192.8 },
  { x: 16.5, y: 251.5 },
  { x: 28.5, y: 251.5 },
];

describe("a tie through the gutters", () => {
  it("eases its corners on the kit's default curve", () => {
    expect(channelD(gutter, "curve")).toMatch(/ Q /);
  });

  it("turns square where the kit asks for right angles, through the same gutters", () => {
    const square = channelD(gutter, "orthogonal");
    expect(square).not.toMatch(/ Q /);
    expect(square).toMatch(/^M 38\.5 192\.8 L 16\.5 192\.8 L 16\.5 251\.5 L 28\.5 251\.5$/);
  });
});

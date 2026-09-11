import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Chip, Roster } from "../../src/index.js";

/**
 * A LENS BUILT FROM THE FRAMEWORK'S OWN PRIMITIVES CAN MAKE THE FRAMEWORK'S
 * OWN CLAIM.
 *
 * `graview-lens` step 5: "Expose what you decide as `data-graview-emphasis`
 * so it can be checked — a claim about a picture that exists only as a colour
 * cannot be checked by anything, not a test and not a person reading the
 * tree." The three shipped lenses all say it, on elements of their own. The
 * primitive an app would naturally reach for to draw a list of nodes —
 * `Roster`, whose `pick` makes every chip a target — had no way to say it, so
 * an app's lens got pick targets emphasised by opacity alone and `audit-ui`'s
 * `halfSaid` would report the view as half-said the moment anything else in
 * it spoke.
 *
 * The contract is only a contract if the primitives can keep it.
 */
describe("a mark drawn with the shipped primitives", () => {
  it("can say what it claims about the selection", () => {
    const markup = renderToStaticMarkup(<Chip label="Ana" pickId="owner:ana" emphasis="lit" />);
    expect(markup).toContain('data-graview-pick="owner:ana"');
    expect(markup).toContain('data-graview-emphasis="lit"');
  });

  it("says nothing when there is nothing to say", () => {
    const markup = renderToStaticMarkup(<Chip label="Ana" pickId="owner:ana" />);
    expect(markup).not.toContain("data-graview-emphasis");
  });

  it("carries it through a roster, per item, alongside the pick", () => {
    const markup = renderToStaticMarkup(
      <Roster
        pick
        items={[
          { id: "item:a", label: "A", emphasis: "lit" },
          { id: "item:b", label: "B", emphasis: "dimmed" },
        ]}
      />,
    );
    const picked = [...markup.matchAll(/data-graview-pick="([^"]+)"/g)].map(([, id]) => id);
    const said = [...markup.matchAll(/data-graview-emphasis="([^"]+)"/g)].map(([, e]) => e);
    expect(picked).toEqual(["item:a", "item:b"]);
    // All of them or none: a roster with some marks said and some not is
    // exactly the half-said picture the audit counts.
    expect(said).toEqual(["lit", "dimmed"]);
    expect(said.length).toBe(picked.length);
  });
});

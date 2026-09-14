import { placeSlug } from "@graview/core";
import { describe, expect, it } from "vitest";
import { placeHref, spatialHref } from "../../src/index.js";

/**
 * A PAGE CAN LINK TO A PICTURE.
 *
 * The routed face and the scene are one app with shared ids, and a page has
 * always been able to link to a NODE in the scene. A picture was the gap: a
 * map desk that had just drawn three areas could only say "open the scene and
 * press The grounds", because the stop that shows a lens needs the aggregate
 * id of the kind behind it, and a page has no business knowing how the layout
 * spells one.
 *
 * A place's name is enough. `useUrlSync` looks it up in the registry and
 * focuses the group the picture is of — verified on the other side of the
 * boundary in `@graview/react`, whose scene is the thing that adopts it.
 */
describe("the link a page makes to a place", () => {
  it("names the place and nothing about the layout", () => {
    expect(placeHref("the-grounds")).toBe("/#view=the-grounds");
    expect(placeHref("the-grounds")).not.toContain("aggregate");
  });

  it("takes the scene's own address when the face is not at the root", () => {
    expect(placeHref("the-week", "/scene")).toBe("/scene#view=the-week");
  });

  it("is built from a registered title through placeSlug", () => {
    expect(placeHref(placeSlug("The grounds"))).toBe("/#view=the-grounds");
  });

  it("leaves the node link alone — they answer different questions", () => {
    expect(spatialHref("lawn")).toBe("/#focus=lawn");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { FIELD_SIGHT } from "../../src/index.js";
import { parent, world } from "../support/hidden-phones.js";

/**
 * A SIGHT THAT HIDES A FIELD FAILS CLOSED UNTIL IT CAN BE JUDGED (Roadmap
 * f-field-sight). Judging one is `@graview/core/field-sight`'s, which a
 * host that serves seats loads (`@graview/ship`'s `openStore` and server) and a hosted page does not carry up front. A store without it
 * cannot keep a field, so it keeps the record: a sight with `hide` or
 * `fields` shows nothing — never the whole record. A store whose host
 * already served it what one seat may see (`openRemote`'s) is a mirror and
 * shows what it was served. This file never loads field sight.
 */
afterEach(() => {
  delete FIELD_SIGHT.on;
});

describe("a sight that hides a field, not yet judged", () => {
  it("is not loaded here", () => {
    expect(FIELD_SIGHT.lens).toBeUndefined();
  });

  it("shows nothing: the parent is served no player only that sight shows — never one with its phone number", () => {
    const view = world("555 0101").seenBy(parent);
    expect(view.graph.getNode("player:ann")).toBeUndefined();
    expect(JSON.stringify(view.snapshot())).not.toContain("555 0101");
    expect(JSON.stringify(view.log.all())).not.toContain("555 0101");
    // A record another sight shows whole is shown: Pat's own child.
    expect(view.graph.getNode("player:bea")).toMatchObject({ phone: "444 0303" });
  });

  it("in a mirror of what a host served, shows what it holds: the host judged it", () => {
    FIELD_SIGHT.on = true;
    const served = world(undefined).seenBy(parent);
    expect(served.graph.getNode("player:ann")).toMatchObject({ name: "Annie" });
  });
});

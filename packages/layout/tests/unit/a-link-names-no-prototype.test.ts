import { describe, expect, it } from "vitest";
import { fromUrl } from "../../src/index.js";

/**
 * A LINK NAMES PINS AND A VIEW'S DIMENSIONS, NEVER WHAT THEY INHERIT.
 *
 * A stop's `pin.<id>` and `in.<key>` are read from a URL anybody can write
 * and send. Kept in a plain object, `#pin.__proto__=1,2` gave the pins a
 * prototype of its own, so every id the object was asked for — `pins.x` —
 * answered from it, and `#in.toString=…` named nothing a view declares but
 * was read back as if it did. The address names only its own keys.
 */
describe("a link names no prototype", () => {
  it("gives pins and dimensions no prototype a link can set", () => {
    const view = fromUrl("#pin.__proto__=1,2&in.__proto__=x&in.view=map");
    expect(Object.getPrototypeOf(view.pins)).toBeNull();
    expect((view.pins as Record<string, unknown>)["x"]).toBeUndefined();
    expect(Object.keys(view.pins)).toEqual(["__proto__"]);
    expect(view.within?.["view"]).toBe("map");
    expect(Object.getPrototypeOf(view.within)).toBeNull();
  });

  it("answers nothing for a name a plain object inherits", () => {
    const view = fromUrl("#in.view=map");
    expect((view.within as Record<string, unknown>)["toString"]).toBeUndefined();
    expect((view.pins as Record<string, unknown>)["constructor"]).toBeUndefined();
  });
});

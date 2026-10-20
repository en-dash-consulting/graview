import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHIPPED_LENSES, SHIPPED_LENS_NAMES } from "../../src/places.js";

/**
 * THE SKILL'S TABLE IS THE TABLE. `graview-shipped-lens` lists each lens
 * the framework draws with what it binds, its roles and the options it
 * takes, so an agent declaring one reads a key rather than guessing it —
 * the guess `add-lens` now refuses (FR-190). A table copied into prose
 * goes stale the day a lens takes another option, so each row is held to
 * `SHIPPED_LENSES` here.
 */
const skill = readFileSync(new URL("../../../skills/skills/graview-shipped-lens/SKILL.md", import.meta.url), "utf8");
const rows = new Map(
  [...skill.matchAll(/^\| `([a-z]+)` \| (\w+) \| ([^|]*) \| ([^|]*) \|$/gm)].map(([, name, binds, roles, options]) => [
    name!,
    { binds: binds!, roles: [...roles!.matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]!), options: [...options!.matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]!) },
  ]),
);

describe("the shipped-lens skill's table", () => {
  it("has a row for every lens the framework ships, and no other", () => {
    expect([...rows.keys()].sort()).toEqual([...SHIPPED_LENS_NAMES].sort());
  });

  it("says what each binds, its roles and every option it takes, as SHIPPED_LENSES does", () => {
    for (const name of SHIPPED_LENS_NAMES) {
      const shipped = SHIPPED_LENSES[name];
      expect(rows.get(name), name).toEqual({ binds: shipped.binds, roles: [...shipped.requiredRoles], options: [...shipped.options] });
    }
  });
});

import { describe, expect, it } from "vitest";
import { scaffoldLens, validateLensOptions } from "../../src/scaffold/lens.js";

/**
 * THERE IS A SCAFFOLDER FOR A LENS.
 *
 * `graview figure` draws line art for a kind, and nothing generated a lens.
 * The graview-lens skill is excellent about the rules — bind roles not field
 * names, fail loudly on a bad binding, mark every target, three fidelities,
 * a title that makes it a place — and those are exactly the rules that are
 * easy to agree with and easy to forget at line 300. So they arrive in the
 * file, and the one instruction nothing can enforce arrives RED.
 */
const map = scaffoldLens({ name: "grounds-map", roles: ["regions", "markers"], binds: "entities" });
const lens = map.find((file) => file.path.endsWith("grounds-map.tsx"))!.contents;
const reuse = map.find((file) => file.path.endsWith(".reuse.test.tsx"))!.contents;

describe("the lens a scaffolder writes", () => {
  it("names the roles once, as a constant the app binds against", () => {
    expect(lens).toContain('GROUNDS_MAP_REQUIRED_ROLES = ["regions", "markers"]');
    expect(lens).toContain("interface GroundsMapRoles");
  });

  it("carries the rules that are easy to forget", () => {
    /* Loud on a bad binding, with the hint the scene's panel prints. */
    expect(lens).toContain("class GroundsMapBindingError");
    expect(lens).toContain("readonly hint: string");
    /* Three fidelities, and the glyph is a chip rather than a small panel. */
    expect(lens).toContain('props.fidelity === "glyph"');
    /* Every real thing is a target, and emphasis is checkable. */
    expect(lens).toContain("data-graview-pick={mark.id}");
    expect(lens).toContain("data-graview-emphasis");
    /* The factory shape the registry expects. */
    expect(lens).toContain("export function createGroundsMapLens");
  });

  it("starts the reuse claim as a red test in a domain the app is not about", () => {
    expect(reuse).toContain("in a domain nothing here is about");
    expect(reuse).toContain("expect.fail(");
    /* A rota is nobody's grounds app. */
    expect(reuse).toContain('defineNode("shift"');
    expect(reuse).toContain("you have written a view");
  });

  it("binds fields when asked for fields, and entities when asked for entities", () => {
    const fields = scaffoldLens({ name: "the-week", roles: ["start"] })
      .find((file) => file.path.endsWith("the-week.tsx"))!.contents;
    expect(fields).toContain("readonly start: string;");
    expect(lens).toContain("readonly regions: { readonly kind: string } | { readonly edge: string };");
  });

  it("refuses a name or a role that is not one, before writing anything", () => {
    expect(validateLensOptions({ name: "Grounds Map", roles: ["rows"] })[0]).toContain("is not a slug");
    expect(validateLensOptions({ name: "grounds-map", roles: [] })[0]).toContain("at least one role");
    expect(validateLensOptions({ name: "grounds-map", roles: ["Not A Role"] })[0]).toContain("is not a role name");
    expect(validateLensOptions({ name: "grounds-map", roles: ["rows"] })).toEqual([]);
  });

  it("puts both files where a lens lives, or where it was told", () => {
    expect(map.map((file) => file.path)).toEqual([
      "src/ui/lens/grounds-map.tsx",
      "src/ui/lens/grounds-map.reuse.test.tsx",
    ]);
    expect(
      scaffoldLens({ name: "the-week", roles: ["start"], dir: "app/src/lens" })[0]!.path,
    ).toBe("app/src/lens/the-week.tsx");
  });
});

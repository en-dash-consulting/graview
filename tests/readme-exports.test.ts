import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module of the scripts, with no declarations.
import { exportsOf, namedIn, unexported } from "../scripts/lib/readme-exports.mjs";

/** FR-15: inspect-pack fails when a README names an export the tarball lacks. */
describe("what a README names, a tarball has", () => {
  const dir = mkdtempSync(join(tmpdir(), "graview-readme-"));
  writeFileSync(join(dir, "inner.d.ts"), "export declare function seenBy(): void;\n");
  writeFileSync(join(dir, "index.d.ts"), 'export { seenBy } from "./inner.js";\nexport interface Policy { readonly grants: readonly string[] }\n');

  it("reads the exports of a packed entry, re-exports included", () => {
    const names = exportsOf([join(dir, "index.d.ts")]);
    expect([...names].sort()).toEqual(["Policy", "seenBy"]);
  });

  it("names what a README promises and the tarball does not have", () => {
    writeFileSync(join(dir, "README.md"), "Use `seenBy()` with a `Policy`, then `sightedKinds` — kept in `localStorage`, at `seq`.\n");
    expect([...namedIn("`seenBy()` `Policy` `seq` `localStorage`")]).toEqual(["seenBy", "Policy"]);
    expect(unexported(join(dir, "README.md"), exportsOf([join(dir, "index.d.ts")]))).toEqual(["sightedKinds"]);
  });
});

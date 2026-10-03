import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { capabilities, FORMATS, FRAMEWORK_VERSION, WIRE_PROTOCOL } from "../../src/index.js";
import { FORMAT, FORMAT_VERSION } from "../../src/document/schema.js";

/**
 * FR-30. A host reads what a build ships instead of guessing from its
 * version: the version, the wire protocol, the document and stored formats,
 * and the FR ids of the seams it ships.
 */
const root = resolve(import.meta.dirname, "../../../..");
/** Every FR id a changeset waiting to ship, or a published changelog, names as shipped by it. */
function named(): Set<string> {
  const texts = [
    ...readdirSync(resolve(root, ".changeset"))
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .map((file) => readFileSync(resolve(root, ".changeset", file), "utf8")),
    ...readdirSync(resolve(root, "packages")).map((pkg) => {
      try {
        return readFileSync(resolve(root, "packages", pkg, "CHANGELOG.md"), "utf8");
      } catch {
        return "";
      }
    }),
  ];
  return new Set(texts.flatMap((text) => [...text.matchAll(/\((FR-\d+)(?:, (FR-\d+))*\)/g)].flatMap((match) => match[0].match(/FR-\d+/g) ?? [])));
}

describe("capabilities()", () => {
  it("says the version, the protocol, the formats and the seams shipped", () => {
    const said = capabilities();
    expect(said.version).toBe(FRAMEWORK_VERSION);
    expect(said.protocol).toBe(WIRE_PROTOCOL);
    expect(said.formats).toEqual(FORMATS);
    expect(said.documentFormats).toEqual([`${FORMAT}@${FORMAT_VERSION}`]);
    for (const id of said.shipped) expect(id).toMatch(/^FR-\d+$/);
    expect(new Set(said.shipped).size).toBe(said.shipped.length);
  });

  it("lists exactly the FR ids the changesets say they shipped", () => {
    expect([...capabilities().shipped].sort()).toEqual([...named()].sort());
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileDocumentFiles } from "../../src/testing.js";

/**
 * n-dx's face tested the document n-dx emits by copying it into
 * tests/fixtures and holding the copy to the original with a drift test.
 * `compileDocumentFiles` reads the document and its seed from where they
 * live, so there is no copy to drift.
 */
const ORG = new URL("../document/fixtures/org.gdd.json", import.meta.url);
const ORG_SEED = new URL("../document/fixtures/org.seed.json", import.meta.url);

describe("a document tested from where it lives", () => {
  it("compiles with the checker and opens a fresh store over its seed each time it is asked", () => {
    const opened = compileDocumentFiles(ORG, { seed: ORG_SEED });
    expect(opened.app.name).toBe("En Dash Org");
    const one = opened.store();
    expect(one.graph.allNodes().length).toBe(opened.seed?.nodes.length);
    expect(opened.store()).not.toBe(one);
  });

  it("refuses a document that does not compile, saying why", () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-files-"));
    try {
      writeFileSync(join(dir, "broken.json"), JSON.stringify({ format: "graview-document", formatVersion: 1, name: "Broken", kinds: { task: { fields: { done: { type: "nope" } } } } }));
      expect(() => compileDocumentFiles(join(dir, "broken.json"))).toThrow(/does not compile/);
      writeFileSync(join(dir, "seed.json"), JSON.stringify({ nodes: [] }));
      expect(() => compileDocumentFiles(ORG, { seed: join(dir, "seed.json") })).toThrow(/needs "nodes" and "edges"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

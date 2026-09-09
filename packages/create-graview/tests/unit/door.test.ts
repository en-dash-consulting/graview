import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `npm create graview` finds this package by name and runs its bin. The
 * bin has to be exactly a door to `graview create` — the same project either
 * way — so this pins that it delegates rather than growing its own opinion.
 */
describe("create-graview", () => {
  const here = resolve(import.meta.dirname, "../..");

  it("is the package npm create looks for", () => {
    const manifest = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8")) as {
      name: string;
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(manifest.name).toBe("create-graview");
    expect(manifest.bin["create-graview"]).toBe("./dist/cli.js");
    expect(Object.keys(manifest.dependencies)).toEqual(["@graview/core"]);
  });

  it("delegates to graview create, and only that", () => {
    const source = readFileSync(resolve(here, "src/index.ts"), "utf8");
    expect(source).toContain('from "@graview/core/cli"');
    expect(source).toContain('main(["create", ...argv])');
    expect(source).not.toMatch(/writeFileSync|scaffoldProject/);
  });
});

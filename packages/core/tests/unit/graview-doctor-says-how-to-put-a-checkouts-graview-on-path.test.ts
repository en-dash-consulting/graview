import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkoutFindings, diagnose } from "../../src/cli/doctor.js";

/**
 * On a machine with the framework checked out and nothing published
 * installed there was no `graview` command: every use was `node
 * <checkout>/packages/graview/dist/cli.js`, and nothing said there was a
 * shorter way. The checkout has `pnpm graview:link` for it, and `graview
 * doctor`, run from a checkout with no graview on PATH, says so.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cli = join(repo, "packages/graview/dist/cli.js");
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "graview-path-"));
  made.push(dir);
  return dir;
};

describe("graview doctor, run from a checkout", () => {
  it("says how to put graview on PATH when it is not there, with the script that does it", () => {
    const [finding] = checkoutFindings({ cli, path: scratch() });
    expect(finding?.level).toBe("note");
    expect(finding?.says).toContain(`runs from the checkout at ${repo}`);
    expect(finding?.fix).toContain("pnpm graview:link");
    expect(finding?.fix).toContain(cli);
    // Said even where there is no product to diagnose: the folder holding only a document.
    expect(diagnose(scratch(), { cli, path: "" }).some((one) => one.fix?.includes("pnpm graview:link"))).toBe(true);
  });

  it("says nothing of it once a graview is on PATH, or when it runs from an install", () => {
    const bin = scratch();
    writeFileSync(join(bin, "graview"), "#!/bin/sh\n");
    chmodSync(join(bin, "graview"), 0o755);
    expect(checkoutFindings({ cli, path: bin })).toEqual([]);
    const installed = scratch();
    mkdirSync(join(installed, "node_modules/graview/dist"), { recursive: true });
    writeFileSync(join(installed, "node_modules/graview/dist/cli.js"), "");
    expect(checkoutFindings({ cli: join(installed, "node_modules/graview/dist/cli.js"), path: "" })).toEqual([]);
  });

  it("has the script it names, linking packages/graview, in the checkout's package.json, README and AGENTS.md", () => {
    const scripts = (JSON.parse(readFileSync(join(repo, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts;
    expect(scripts["graview:link"]).toMatch(/packages\/graview.*pnpm link --global/);
    expect(readFileSync(join(repo, "README.md"), "utf8")).toContain("pnpm graview:link");
    expect(readFileSync(join(repo, "AGENTS.md"), "utf8")).toContain("pnpm graview:link");
  });
});

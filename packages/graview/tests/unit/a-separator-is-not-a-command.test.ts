import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../../src/index.js";

/**
 * `pnpm graview -- create ../walk7` is how AGENTS.md says to run the CLI
 * from a checkout, and pnpm hands the `--` on to the script: the command
 * line answered `graview: unknown command "--"` to the first thing a walk
 * types. The separator is the package manager's, never a command.
 */
describe("the separator a package manager passes on", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is read past, so the command after it is the command", async () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => (written.push(String(chunk)), true));
    expect(await main(["--", "--help"])).toBe(0);
    expect(written.join("")).toContain("graview create <dir>");
    expect(written.join("")).not.toContain('unknown command "--"');
  });
});

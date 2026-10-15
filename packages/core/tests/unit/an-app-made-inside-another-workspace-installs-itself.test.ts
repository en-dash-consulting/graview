import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { create, type CreateIo } from "../../src/cli/create.js";

/*
 * The tenth walk made its app in a directory under a pnpm workspace that did
 * not list it. `pnpm install` there installed the OTHER workspace, said
 * "Done", and left the new app without a node_modules: create then said
 * "graview did not install, so the authoring skills were not written" and
 * forty type errors about modules it could not find.
 */
let scratch: string;
let cwd: string;
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "graview-create-nested-"));
  cwd = process.cwd();
  process.chdir(scratch);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(scratch, { recursive: true, force: true });
});

function io() {
  const out: string[] = [];
  const ran: { command: string; args: readonly string[]; cwd: string }[] = [];
  const handle: CreateIo = {
    stdout: (text) => void out.push(text),
    stderr: (text) => void out.push(text),
    // A pnpm that installs the workspace it finds above, never this directory.
    run: (command, args, dir) => {
      ran.push({ command, args, cwd: dir });
      return true;
    },
    ask: () => undefined,
  };
  return { handle, out: () => out.join(""), ran };
}

describe("an app made inside another pnpm workspace", () => {
  it("is made a workspace of its own and installed again, and says why", async () => {
    writeFileSync(resolve(scratch, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    const t = io();
    const code = await create(["walk", "--pm", "pnpm", "--no-git", "--no-skills"], t.handle);
    expect(code).toBe(0);
    const installs = t.ran.filter((r) => r.command === "pnpm" && r.args[0] === "install");
    expect(installs).toHaveLength(2);
    expect(readFileSync(resolve(scratch, "walk/pnpm-workspace.yaml"), "utf8")).toContain("- .");
    expect(t.out()).toContain("inside the pnpm workspace at");
  });

  it("is left alone where nothing above it is a workspace", async () => {
    const t = io();
    await create(["walk", "--pm", "pnpm", "--no-git", "--no-skills"], t.handle);
    expect(t.ran.filter((r) => r.args[0] === "install")).toHaveLength(1);
    expect(existsSync(resolve(scratch, "walk/pnpm-workspace.yaml"))).toBe(false);
  });
});

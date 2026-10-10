import { LINKED_PACKAGES } from "../../src/scaffold/index.js";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { create, packageManagerFromEnv, type CreateIo } from "../../src/cli/create.js";

/**
 * The command, against a real directory but a fake package manager: what it
 * writes, what it refuses, and what it says to do next.
 */

let scratch: string;
let cwd: string;
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "graview-create-cmd-"));
  cwd = process.cwd();
  process.chdir(scratch);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(scratch, { recursive: true, force: true });
});

function io({ identity = true }: { readonly identity?: boolean } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const ran: { command: string; args: readonly string[]; cwd: string }[] = [];
  const handle: CreateIo = {
    stdout: (text) => void out.push(text),
    stderr: (text) => void err.push(text),
    run: (command, args, dir) => {
      ran.push({ command, args, cwd: dir });
      return true;
    },
    // git's identity, as `git config user.name` answers it: a name, or nothing set.
    ask: (command, args) => (command === "git" && args[0] === "config" && identity ? "Ada\n" : undefined),
  };
  return { handle, out: () => out.join(""), err: () => err.join(""), ran };
}

describe("graview create", () => {
  it("writes the project and says what to do next", async () => {
    const t = io();
    const code = await create(["notes", "--name", "Field Notes", "--kind", "note", "--pm", "npm", "--no-install", "--no-git"], t.handle);
    expect(code).toBe(0);
    expect(readdirSync(resolve(scratch, "notes")).sort()).toEqual(
      [".github", ".gitignore", "AGENTS.md", "CLAUDE.md", "README.md", "embed.html", "index.html", "package.json", "src", "tests", "tsconfig.build.json", "tsconfig.json", "vite.config.ts"].sort(),
    );
    expect(t.out()).toContain("22 files → notes");
    expect(t.out()).toContain("npm run dev");
    expect(t.out()).toContain("npm run verify");
    expect(t.ran).toEqual([]);
  });

  it("takes the name from the directory when none is given", async () => {
    const t = io();
    await create(["my-field-notes", "--no-install"], t.handle);
    const brand = readFileSync(resolve(scratch, "my-field-notes/src/domain/brand.ts"), "utf8");
    expect(brand).toContain('name: "My Field Notes"');
  });

  it("initializes a repository, installs, writes the skills and the agent docs, then commits everything", async () => {
    const t = io();
    mkdirSync(resolve(scratch, "app/node_modules/.bin"), { recursive: true });
    writeFileSync(resolve(scratch, "app/node_modules/.bin/graview"), "");
    const code = await create(["app", "--name", "Field Notes", "--pm", "pnpm", "--force"], t.handle);
    expect(code).toBe(0);
    expect(t.ran.map((r) => [r.command.split("/").pop(), ...r.args])).toEqual([
      ["git", "init", "--quiet"],
      ["pnpm", "install"],
      ["graview", "skills", "install", "."],
      ["pnpm", "run", "docs"],
      ["git", "add", "-A"],
      ["git", "commit", "--quiet", "-m", "Field Notes, on Graview"],
    ]);
    expect(t.out()).toContain('The first commit is "Field Notes, on Graview"');
    expect(t.out()).not.toContain("git commit -m");
  });

  it("stages everything and says so in one line when git does not know who is committing", async () => {
    const t = io({ identity: false });
    const code = await create(["notes", "--name", "Field Notes", "--pm", "pnpm", "--no-install"], t.handle);
    expect(code).toBe(0);
    expect(t.ran.map((r) => [r.command, ...r.args])).toEqual([
      ["git", "init", "--quiet"],
      ["git", "add", "-A"],
    ]);
    expect(t.out().split("\n").filter((line) => line.includes("user.name"))).toHaveLength(1);
    expect(t.out()).toContain('git commit -m "Field Notes, on Graview"');
  });

  it("leaves git alone inside an existing repository, or when told to", async () => {
    mkdirSync(resolve(scratch, ".git"));
    const t = io();
    await create(["inside", "--no-install"], t.handle);
    expect(t.ran).toEqual([]);
    rmSync(resolve(scratch, ".git"), { recursive: true });
    const u = io();
    await create(["plain", "--no-install", "--no-git"], u.handle);
    expect(u.ran).toEqual([]);
  });

  it("refuses a directory with things in it, unless forced", async () => {
    mkdirSync(resolve(scratch, "busy"));
    writeFileSync(resolve(scratch, "busy/keep.txt"), "mine");
    const t = io();
    expect(await create(["busy", "--no-install"], t.handle)).toBe(2);
    expect(t.err()).toMatch(/is not empty/);
    expect(readdirSync(resolve(scratch, "busy"))).toEqual(["keep.txt"]);
    expect(await create(["busy", "--no-install", "--force"], t.handle)).toBe(0);
  });

  it("takes the plural as a person types it, and writes the slug the generator wants", async () => {
    const t = io();
    // "Shifts" was refused as not a slug; the word is what a person types.
    expect(await create(["roster", "--kind", "shift", "--plural", "Shifts", "--no-install", "--no-git"], t.handle)).toBe(0);
    const schema = readFileSync(resolve(scratch, "roster", "src", "domain", "schema.ts"), "utf8");
    expect(schema).toContain('plural: "Shifts"');
  });

  it("refuses a kind that is not a slug, before writing anything", async () => {
    const t = io();
    expect(await create(["bad", "--kind", "Bad Kind", "--no-install"], t.handle)).toBe(2);
    expect(t.err()).toMatch(/must be a slug/);
    expect(readdirSync(scratch)).toEqual([]);
  });

  it("in link mode, writes a relative path and pins nothing into the framework's store", async () => {
    // A pretend framework checkout beside the project, with pnpm's symlinked zod.
    mkdirSync(resolve(scratch, "fw/node_modules/.pnpm/zod@4.4.3/node_modules/zod"), { recursive: true });
    mkdirSync(resolve(scratch, "fw/packages/core/node_modules"), { recursive: true });
    symlinkSync("../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod", resolve(scratch, "fw/packages/core/node_modules/zod"));
    for (const pkg of LINKED_PACKAGES) {
      mkdirSync(resolve(scratch, `fw/packages/${pkg}/dist`), { recursive: true });
      writeFileSync(resolve(scratch, `fw/packages/${pkg}/dist/index.js`), "");
    }
    const t = io();
    const code = await create(["product", "--link", "fw", "--no-install"], t.handle);
    expect(code).toBe(0);
    const manifest = JSON.parse(readFileSync(resolve(scratch, "product/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies["@graview/core"]).toBe("link:../fw/packages/core");
    /*
     * NOTHING POINTS INTO ANOTHER REPOSITORY'S PACKAGE MANAGER. This used to
     * write a `paths` entry naming an exact zod version inside the
     * framework's pnpm store, which typechecks until the framework bumps zod
     * and then fails as a missing file in somebody else's internals. The
     * project imports `z` from "@graview/core" instead: one copy, by
     * re-export, with nothing to keep in step.
     */
    const tsconfig = JSON.parse(readFileSync(resolve(scratch, "product/tsconfig.json"), "utf8")) as {
      compilerOptions: { paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths).toBeUndefined();
    const manifestText = readFileSync(resolve(scratch, "product/package.json"), "utf8");
    expect(manifestText).not.toContain("zod");
    expect(readFileSync(resolve(scratch, "product/src/domain/schema.ts"), "utf8")).toContain(
      'import { z } from "@graview/core"',
    );
  });

  it("refuses a framework that is not built, and says how to build it", async () => {
    mkdirSync(resolve(scratch, "fw/packages/core"), { recursive: true });
    const t = io();
    expect(await create(["product", "--link", "fw", "--no-install"], t.handle)).toBe(2);
    expect(t.err()).toMatch(/not built \(no dist in core, layout/);
    expect(t.err()).toMatch(/pnpm -C fw install && pnpm -C fw build/);
    expect(readdirSync(scratch)).toEqual(["fw"]);
  });

  it("warns when the project would land inside the framework's own tree", async () => {
    mkdirSync(resolve(scratch, "fw/packages/core/node_modules"), { recursive: true });
    for (const pkg of LINKED_PACKAGES) {
      mkdirSync(resolve(scratch, `fw/packages/${pkg}/dist`), { recursive: true });
      writeFileSync(resolve(scratch, `fw/packages/${pkg}/dist/index.js`), "");
    }
    const t = io();
    expect(await create(["fw/my-app", "--link", "fw", "--no-install", "--no-git"], t.handle)).toBe(0);
    expect(t.err()).toMatch(/inside the framework checkout/);
  });

  it("refuses a --link that is not a framework checkout", async () => {
    mkdirSync(resolve(scratch, "elsewhere"));
    const t = io();
    expect(await create(["product", "--link", "elsewhere", "--no-install"], t.handle)).toBe(2);
    expect(t.err()).toMatch(/not a framework checkout/);
    expect(readdirSync(scratch)).toEqual(["elsewhere"]);
  });

  it("knows which package manager invoked it", () => {
    expect(packageManagerFromEnv({ npm_config_user_agent: "pnpm/10.0.0 npm/? node/v22" })).toBe("pnpm");
    expect(packageManagerFromEnv({ npm_config_user_agent: "npm/10.0.0 node/v22" })).toBe("npm");
    expect(packageManagerFromEnv({})).toBe("npm");
  });
});

/**
 * A DIRECTORY THAT ALREADY EXISTS IS THE NORMAL CASE.
 *
 * The realistic start is a repository somebody already made — a README they
 * wrote, a license, CI, instruction files from another tool. `--force` is
 * too blunt for that: it writes over the README. Two products independently
 * worked around the refusal by scaffolding into `app/` and hand-writing a
 * workspace root around it, which is a scaffolder gap rather than a taste
 * they happened to share.
 */
describe("starting in a repository that already exists", () => {
  const existing = () => {
    mkdirSync(resolve(scratch, "grounds"), { recursive: true });
    writeFileSync(resolve(scratch, "grounds/README.md"), "# Groundskeeper\n", "utf8");
    writeFileSync(resolve(scratch, "grounds/LICENSE"), "MIT\n", "utf8");
  };
  const run = (...argv: string[]) =>
    create(["grounds", "--name", "Groundskeeper", "--kind", "zone", "--pm", "npm", "--no-install", "--no-git", ...argv], io().handle);

  it("still refuses to write into it, and names both ways forward", async () => {
    existing();
    const t = io();
    const code = await create(["grounds", "--pm", "npm", "--no-install", "--no-git"], t.handle);
    expect(code).toBe(2);
    expect(t.err()).toContain("--merge");
    expect(t.err()).toContain("--force");
  });

  it("writes only what is missing under --merge, and leaves the rest untouched", async () => {
    existing();
    expect(await run("--merge")).toBe(1);
    expect(readFileSync(resolve(scratch, "grounds/README.md"), "utf8")).toBe("# Groundskeeper\n");
    expect(readFileSync(resolve(scratch, "grounds/LICENSE"), "utf8")).toBe("MIT\n");
    /* And everything that was not there is there now. */
    expect(readdirSync(resolve(scratch, "grounds")).sort()).toContain("package.json");
    expect(readdirSync(resolve(scratch, "grounds/src")).sort()).toEqual(["domain", "embed.tsx", "main.tsx", "ui"]);
  });

  it("names every collision and exits non-zero, so nothing mistakes it for a clean write", async () => {
    existing();
    const t = io();
    const code = await create(
      ["grounds", "--name", "Groundskeeper", "--kind", "zone", "--pm", "npm", "--merge", "--no-install", "--no-git"],
      t.handle,
    );
    expect(code).toBe(1);
    expect(t.err()).toContain("README.md");
    expect(t.err()).toContain("left exactly as it was");
  });

  it("keeps --force meaning exactly what it meant", async () => {
    existing();
    expect(await run("--force")).toBe(0);
    expect(readFileSync(resolve(scratch, "grounds/README.md"), "utf8")).not.toBe("# Groundskeeper\n");
  });
});

/**
 * The skills are the single highest-leverage thing the framework ships, and
 * they arrive through the package manager — so `--no-install` skips them,
 * and it used to skip them in silence. An agent then starts on a fresh
 * product without the instructions that teach it how.
 */
describe("what --no-install says about the skills", () => {
  it("says they were skipped, and how to get them", async () => {
    const t = io();
    await create(["notes", "--name", "Notes", "--pm", "pnpm", "--no-install", "--no-git"], t.handle);
    expect(t.out()).toContain("skills: skipped (needs install");
    expect(t.out()).toContain("pnpm skills");
  });

  it("says nothing about them when the person asked for neither", async () => {
    const t = io();
    await create(["notes", "--name", "Notes", "--pm", "pnpm", "--no-install", "--no-skills", "--no-git"], t.handle);
    expect(t.out()).not.toContain("skills: skipped");
  });
});

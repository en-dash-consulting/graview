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

function io() {
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
  };
  return { handle, out: () => out.join(""), err: () => err.join(""), ran };
}

describe("graview create", () => {
  it("writes the project and says what to do next", async () => {
    const t = io();
    const code = await create(["notes", "--name", "Field Notes", "--kind", "note", "--pm", "npm", "--no-install", "--no-git"], t.handle);
    expect(code).toBe(0);
    expect(readdirSync(resolve(scratch, "notes")).sort()).toEqual(
      [".github", ".gitignore", "README.md", "index.html", "package.json", "src", "tests", "tsconfig.build.json", "tsconfig.json", "vite.config.ts"].sort(),
    );
    expect(t.out()).toContain("18 files → notes");
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

  it("initialises a repository, installs with the package manager, then the skills", async () => {
    const t = io();
    mkdirSync(resolve(scratch, "app/node_modules/.bin"), { recursive: true });
    writeFileSync(resolve(scratch, "app/node_modules/.bin/graview-skills"), "");
    const code = await create(["app", "--pm", "pnpm", "--force"], t.handle);
    expect(code).toBe(0);
    expect(t.ran.map((r) => [r.command.split("/").pop(), ...r.args])).toEqual([
      ["git", "init", "--quiet"],
      ["pnpm", "install"],
      ["graview-skills", "install", "."],
    ]);
    expect(t.out()).toContain("git add -A && git commit");
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

  it("warns that a private core cannot be installed from a registry, whatever its version", async () => {
    const t = io();
    await create(["plain", "--no-install"], t.handle);
    expect(t.err()).toMatch(/unpublished|--link/);
  });

  it("in link mode, writes a relative path and dedupes the framework's zod", async () => {
    // A pretend framework checkout beside the project, with pnpm's symlinked zod.
    mkdirSync(resolve(scratch, "fw/node_modules/.pnpm/zod@4.4.3/node_modules/zod"), { recursive: true });
    mkdirSync(resolve(scratch, "fw/packages/core/node_modules"), { recursive: true });
    symlinkSync("../../../node_modules/.pnpm/zod@4.4.3/node_modules/zod", resolve(scratch, "fw/packages/core/node_modules/zod"));
    for (const pkg of ["core", "layout", "tools", "render", "react", "primitives", "pages", "ship", "embed", "skills"]) {
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
    expect(t.err()).not.toMatch(/unpublished/);
    const tsconfig = JSON.parse(readFileSync(resolve(scratch, "product/tsconfig.json"), "utf8")) as {
      compilerOptions: { paths: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths["zod"]).toEqual(["../fw/node_modules/.pnpm/zod@4.4.3/node_modules/zod"]);
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
    for (const pkg of ["core", "layout", "tools", "render", "react", "primitives", "pages", "ship", "embed", "skills"]) {
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

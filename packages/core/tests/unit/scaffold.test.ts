import { describe, expect, it } from "vitest";
import {
  GRAVIEW_PACKAGES,
  scaffoldProject,
  slugify,
  validateScaffoldOptions,
} from "../../src/scaffold/index.js";

/**
 * The generator decides what a new project IS. `scripts/smoke-create.mjs`
 * proves the project it makes installs, verifies and runs; this pins the
 * shape, so that a change to it is a deliberate one.
 */

const file = (name: string, path: string) => {
  const found = scaffoldProject({ name }).files.find((f) => f.path === path);
  if (!found) throw new Error(`no ${path}`);
  return found.contents;
};

describe("what a project starts with", () => {
  it("is the shape the graview-new-app skill describes", () => {
    const paths = scaffoldProject({ name: "Field Notes", kind: "note" }).files.map((f) => f.path);
    expect(paths).toEqual([
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
      "vite.config.ts",
      "index.html",
      "embed.html",
      ".gitignore",
      "README.md",
      "src/domain/schema.ts",
      "src/domain/mutations.ts",
      "src/domain/invariants.ts",
      "src/domain/brand.ts",
      "src/domain/app.ts",
      "src/ui/views.tsx",
      "src/ui/app.tsx",
      "src/ui/pages.tsx",
      "src/main.tsx",
      "src/embed.tsx",
      "tests/domain.test.ts",
      ".github/workflows/ci.yml",
    ]);
  });

  it("writes the other face's page in the kind's own words, over the derived defaults", () => {
    const pages = file("Field Notes", "src/ui/pages.tsx");
    expect(pages).toContain('register("item", "record", ItemPage');
    expect(pages).toContain("pageStyles");
    expect(pages).toContain("recordFacts(store, id");
    expect(file("Field Notes", "src/main.tsx")).toContain("registry={pages()}");
  });

  it("keeps React out of the domain, so graview check can load it", () => {
    const domain = scaffoldProject({ name: "Field Notes" }).files.filter((f) => f.path.startsWith("src/domain/"));
    expect(domain.length).toBe(5);
    for (const f of domain) {
      expect(f.contents, f.path).not.toMatch(/from "react|@graview\/(react|primitives|render|pages)/);
    }
  });

  it("depends on every package, and verifies with the project's own scripts", () => {
    const manifest = JSON.parse(file("Field Notes", "package.json")) as {
      name: string;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(manifest.name).toBe("field-notes");
    for (const pkg of GRAVIEW_PACKAGES) expect(manifest.dependencies[`@graview/${pkg}`]).toBeDefined();
    expect(manifest.devDependencies["@graview/skills"]).toBeDefined();
    expect(manifest.scripts["check"]).toBe("pnpm build:domain && graview check ./dist/domain/app.js");
    expect((manifest as { engines: { node: string } }).engines.node).toBe(">=22");
    expect((manifest as { pnpm?: { onlyBuiltDependencies: string[] } }).pnpm?.onlyBuiltDependencies).toEqual(["esbuild"]);
    const viaNpm = JSON.parse(scaffoldProject({ name: "X", packageManager: "npm" }).files.find((f) => f.path === "package.json")!.contents) as { pnpm?: unknown; scripts: Record<string, string> };
    expect(viaNpm.pnpm).toBeUndefined();
    expect(viaNpm.scripts["check"]).toBe("npm run build:domain && graview check ./dist/domain/app.js");
    expect(manifest.scripts["verify"]).toMatch(/typecheck.*test.*build.*check/);
  });

  it("pins the range it was asked to, so a project tracks what made it", () => {
    const manifest = JSON.parse(
      scaffoldProject({ name: "X", range: "^0.3.0" }).files.find((f) => f.path === "package.json")!.contents,
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@graview/core"]).toBe("^0.3.0");
  });
});

describe("the first kind", () => {
  it("is declared with creates, connects, severs, writes, a lifecycle and a repair", () => {
    const schema = file("Field Notes", "src/domain/schema.ts");
    const mutations = file("Field Notes", "src/domain/mutations.ts");
    const invariants = file("Field Notes", "src/domain/invariants.ts");
    expect(schema).toContain('defineNode("item"');
    expect(schema).toContain('lifecycle: { field: "status", retired: ["closed"] }');
    expect(mutations).toContain('creates: ["item"]');
    expect(mutations).toContain('connects: ["depends-on"]');
    expect(mutations).toContain('severs: ["depends-on"]');
    expect(mutations).toContain('writes: ["status"]');
    expect(invariants).toContain('repairs: ["close-item"]');
  });

  it("takes the kind's name everywhere it matters", () => {
    const s = scaffoldProject({ name: "Field Notes", kind: "field-note", plural: "field-notes" });
    const all = s.files.map((f) => f.contents).join("\n");
    expect(all).toContain('defineNode("field-note"');
    expect(all).toContain('plural: "Field Notes"');
    expect(all).toContain("addFieldNote");
    expect(all).toContain('"add-field-note"');
    expect(all).not.toContain("add-item");
    expect(s.kind).toBe("field-note");
  });

  it("names the product in the brand, the app and the page title", () => {
    const s = scaffoldProject({ name: 'Nick\'s "Notes"' });
    // Every string literal the name lands in stays a string literal.
    const schema = s.files.find((f) => f.path === "src/domain/schema.ts")!.contents;
    const mutations = s.files.find((f) => f.path === "src/domain/mutations.ts")!.contents;
    expect(schema).toContain('something Nick\'s \\"Notes\\" keeps track of.');
    expect(mutations).toContain('into Nick\'s \\"Notes\\".');
    const brand = s.files.find((f) => f.path === "src/domain/brand.ts")!.contents;
    const html = s.files.find((f) => f.path === "index.html")!.contents;
    expect(brand).toContain('name: "Nick\'s \\"Notes\\""');
    expect(html).toContain("<title>Nick's \"Notes\"</title>");
    expect(s.packageName).toBe("nick-s-notes");
  });
});

describe("link mode", () => {
  it("consumes the framework by path, aliases its sources, and dedupes zod for tsc", () => {
    const s = scaffoldProject({ name: "Linked", link: "../graview", dedupeTypes: { zod: "../graview/node_modules/.pnpm/zod@4.4.3/node_modules/zod" } });
    const manifest = JSON.parse(s.files.find((f) => f.path === "package.json")!.contents) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies["@graview/core"]).toBe("link:../graview/packages/core");
    const vite = s.files.find((f) => f.path === "vite.config.ts")!.contents;
    expect(vite).toContain("dedupe");
    expect(vite).toContain('"@graview/ship/browser"');
    expect(vite).toContain("searchForWorkspaceRoot");
    const tsconfig = JSON.parse(s.files.find((f) => f.path === "tsconfig.json")!.contents) as {
      compilerOptions: { paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths?.["zod"]).toEqual(["../graview/node_modules/.pnpm/zod@4.4.3/node_modules/zod"]);
    expect(s.linked).toBe(true);
  });

  it("does none of that for a published project", () => {
    const s = scaffoldProject({ name: "Plain" });
    const vite = s.files.find((f) => f.path === "vite.config.ts")!.contents;
    expect(vite).not.toContain("alias");
    const tsconfig = JSON.parse(s.files.find((f) => f.path === "tsconfig.json")!.contents) as {
      compilerOptions: { paths?: unknown };
    };
    expect(tsconfig.compilerOptions.paths).toBeUndefined();
    expect(s.linked).toBe(false);
  });
});

describe("what it refuses", () => {
  it("says why before writing anything", () => {
    expect(validateScaffoldOptions({ name: "" })).toEqual([
      "a name is required — the product's name, as a person would say it",
    ]);
    expect(validateScaffoldOptions({ name: "X", kind: "Note" })[0]).toMatch(/must be a slug/);
    expect(validateScaffoldOptions({ name: "X", kind: "node" })[0]).toMatch(/the framework uses for itself/);
    expect(validateScaffoldOptions({ name: "X", accent: "green" })[0]).toMatch(/hex colour/);
    expect(validateScaffoldOptions({ name: "X", plural: "Bad Plural" })[0]).toMatch(/plural .* must be a slug/);
    expect(validateScaffoldOptions({ name: "X", port: 70000 })[0]).toMatch(/not a port/);
    expect(validateScaffoldOptions({ name: "Field Notes", kind: "note" })).toEqual([]);
    expect(() => scaffoldProject({ name: "X", kind: "Bad Kind" })).toThrow(/slug/);
  });

  it("slugs a name the way npm would want it", () => {
    expect(slugify("  Field Notes! ")).toBe("field-notes");
    expect(slugify("Équipe 2")).toBe("quipe-2");
  });
});

describe("the CI it writes", () => {
  it("in link mode, checks the framework out beside the app and builds it first", () => {
    const ci = scaffoldProject({ name: "X", link: "../graview", frameworkRepo: "en-dash-consulting/graview" }).files.find((f) => f.path === ".github/workflows/ci.yml")!.contents;
    expect(ci).toContain("repository: en-dash-consulting/graview");
    expect(ci).toContain("path: graview");
    expect(ci).toContain("path: app");
    expect(ci).toContain("pnpm install --frozen-lockfile && pnpm build");
    expect(ci).toContain("FRAMEWORK_TOKEN");
    const unknown = scaffoldProject({ name: "X", link: "../fw" }).files.find((f) => f.path === ".github/workflows/ci.yml")!.contents;
    expect(unknown).toContain("OWNER/graview");
  });

  it("runs the project's own verify with the package manager it was made with", () => {
    const pnpm = scaffoldProject({ name: "X", packageManager: "pnpm" }).files.find((f) => f.path === ".github/workflows/ci.yml")!.contents;
    expect(pnpm).toContain("pnpm/action-setup");
    expect(pnpm).toContain("pnpm verify");
    const npm = scaffoldProject({ name: "X", packageManager: "npm" }).files.find((f) => f.path === ".github/workflows/ci.yml")!.contents;
    expect(npm).not.toContain("pnpm");
    expect(npm).toContain("npm run verify");
  });
});

/**
 * "Add a item" is a sentence the scaffolder wrote, and a stranger reads it
 * on the very first screen. The article is derived from the kind's own word
 * now, so the generated prose is checked as prose — every "a" in it, against
 * the word that follows.
 */
/*
 * The pages skill's last section tells a project to mount itself into
 * somebody else's page with `@graview/embed`. A project scaffolded without
 * that dependency — and without the dev alias the other packages get — could
 * not follow it.
 */
/*
 * THE GENERATED SOURCE PARSES.
 *
 * A template is a string, and a string can be malformed in ways nothing
 * here noticed: `label: ${name}` where `label: "${name}"` was meant shipped
 * a project whose own typecheck died on "',' expected". `smoke:create`
 * catches it — after packing tarballs, installing and building, minutes
 * later. TypeScript's own parser catches it in milliseconds.
 */
describe("every generated file is syntactically whole", () => {
  it("parses every .ts and .tsx the scaffolder writes", async () => {
    const ts = await import("typescript");
    for (const kind of ["note", "item", "work-order"]) {
      for (const file of scaffoldProject({ name: "Field Notes", kind }).files) {
        if (!/\.tsx?$/.test(file.path)) continue;
        const parsed = ts.createSourceFile(
          file.path,
          file.contents,
          ts.ScriptTarget.ES2022,
          true,
          file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const problems = (parsed as unknown as { parseDiagnostics: readonly ts.Diagnostic[] })
          .parseDiagnostics;
        expect(
          problems.map((one) => ts.flattenDiagnosticMessageText(one.messageText, " ")),
          `${kind}: ${file.path}`,
        ).toEqual([]);
      }
    }
  });

  it("writes JSON files that are JSON", () => {
    for (const file of scaffoldProject({ name: "Field Notes", kind: "note" }).files) {
      if (!file.path.endsWith(".json")) continue;
      expect(() => JSON.parse(file.contents), file.path).not.toThrow();
    }
  });
});

describe("a project can do what its own skills tell it to", () => {
  it("depends on every package the skills reach for, including the embed", () => {
    const manifest = JSON.parse(file("Walk", "package.json")) as {
      dependencies: Record<string, string>;
    };
    for (const pkg of GRAVIEW_PACKAGES) {
      expect(Object.keys(manifest.dependencies), pkg).toContain(`@graview/${pkg}`);
    }
    expect(GRAVIEW_PACKAGES).toContain("embed");
  });

  it("aliases every one of them for the linked dev server", () => {
    const vite = scaffoldProject({ name: "Walk", link: "../framework" }).files.find(
      (one) => one.path === "vite.config.ts",
    )!.contents;
    for (const pkg of GRAVIEW_PACKAGES) {
      expect(vite, pkg).toContain(`"@graview/${pkg}"`);
    }
  });
});

describe("the article agrees with the kind", () => {
  const prose = (kind: string): string =>
    scaffoldProject({ name: "Walk", kind })
      .files.filter((f) => /^(src|README)/.test(f.path))
      .map((f) => f.contents)
      .join("\n");

  it("says an item, not a item", () => {
    const written = prose("item");
    expect(written).toContain('title: "Add an item"');
    expect(written).toContain('description: "An item: something Walk keeps track of.');
    expect(written).not.toMatch(/\ba item\b/);
  });

  it("keeps a before a consonant, and spells a hyphenated kind", () => {
    expect(prose("note")).toContain('title: "Add a note"');
    expect(prose("work-order")).toContain('title: "Add a work order"');
  });

  it("writes no 'a' before a vowel anywhere in a generated project", () => {
    for (const kind of ["item", "asset", "order", "issue", "epic", "invoice"]) {
      const offending = prose(kind).match(/\ba (?=[aeiou])[a-z]+/g) ?? [];
      expect(offending, `kind "${kind}"`).toEqual([]);
    }
  });
});

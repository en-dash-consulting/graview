import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("what a project starts with passes its own checks", () => {
  it("bounds the label a model may fill, so graview check has nothing to say about a fresh project", () => {
    // label-unbounded: a declared provider may create one, and an unbounded name draws a paragraph.
    expect(file("Field Notes", "src/domain/schema.ts")).toContain("label: z.string().min(1).max(60),");
    expect(file("Field Notes", "src/domain/mutations.ts")).toContain("input: z.object({ label: z.string().min(1).max(60) }),");
  });

  it("hands the routed home page's Begin its store, since the pages face has no provider", () => {
    expect(file("Field Notes", "src/ui/pages.tsx")).toMatch(/<Begin\s+store=\{context\.store\}/);
  });

  it("reads the record's place on the horizon from the lifecycle, not from status words it casts to", () => {
    // A discography renamed "open"/"closed" to "released"/"demo"/"scrapped"
    // and its own record page went on saying "Still open." of a released
    // song, the cast keeping the typecheck quiet (W-099).
    const pages = file("Field Notes", "src/ui/pages.tsx");
    expect(pages).not.toMatch(/as \{[^}]*status/);
    expect(pages).not.toContain('"closed"');
    expect(pages).toContain("isCurrent(store.schema.tryDefinition(node.kind), node)");
  });

  it("submits a tie under the words its heading uses, from this end (W-100)", () => {
    expect(file("Field Notes", "src/ui/pages.tsx")).toMatch(/<DerivedForm<S>[^>]*label=\{affordance\.label\}/);
  });

  it("frames only Begin's own door, so the derived home comes back as the whole page it is", () => {
    const pages = file("Field Notes", "src/ui/pages.tsx");
    expect(pages).toContain("frame={(door) => (");
    expect(pages).not.toMatch(/<PageMain[^>]*>\s*<Begin/);
  });

  it("opens the studio door in development, so Apply writes into src/domain", () => {
    const config = file("Field Notes", "vite.config.ts");
    expect(config).toContain('import { studioDoor } from "@graview/ship/dev";');
    expect(config).toContain("plugins: [studioDoor()],");
  });
});

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

  it("hands the pages face the same views the scene draws from, so a new app lands on a gallery", () => {
    const main = file("Field Notes", "src/main.tsx");
    expect(main).toContain('import { views } from "./ui/views.js";');
    expect(main).toContain("views: views(),");
    expect(main).toContain("settings: fieldNotesApp.settings ?? []");
  });

  /*
   * The page it writes claims, in its own comment, that "everything it shows
   * still comes from the same derivations, so a page you write cannot drift
   * from what the graph says". It reached for the act by NAME instead — an
   * act that is always there — and handed the form no candidates, so the
   * record was offered as the answer to its own edge and, at one record,
   * was the only answer. The claim has to be true of the file that makes it.
   */
  it("takes the act it offers from the derivation, with the candidates the derivation narrowed", () => {
    const pages = file("Field Notes", "src/ui/pages.tsx");
    expect(pages).toContain("facts.actions.affordances.filter(");
    expect(pages).toContain("open={affordance.open}");
    expect(pages).toContain("prefilled={affordance.args}");
    // Never the raw lookup as the thing that decides whether to offer it.
    expect(pages).not.toMatch(/const link = store\.allMutations\(\)/);
  });

  /*
   * AND THE SAME CLAIM ABOUT ITS TIES. The page said "Depends on X" from
   * `out(id, "depends-on")` and offered one form found by the mutation name
   * `link-<kind>` — so the moment a project followed `graview-node-kind`
   * and declared a second kind with an edge to it, the record page silently
   * left the new relation out and offered no way to make one. Following the
   * next skill in the set must not break the page the last one wrote.
   */
  /*
   * AND SAYS WHAT THIS SEAT MAY NOT DO. An act the policy refuses is not in
   * `affordances`; it is in `withheld`, with the policy's own sentence on
   * it. The page drew the first list and dropped the second, so declaring a
   * policy — `graview-permissions`, the next skill in the set — made whole
   * sections of this page vanish for a narrower seat with nothing said. The
   * derived record page beside it has always struck them through.
   */
  it("submits its forms as the person at the keyboard", () => {
    /*
     * The page asks "may I?" as the principal and then pressed submit as
     * nobody: under a policy every act it offered live was refused on
     * press. The same principal goes to the form.
     */
    expect(file("Field Notes", "src/ui/pages.tsx")).toMatch(/<DerivedForm<S>[^>]*principal/);
  });

  it("says what a seat may not do rather than dropping it", () => {
    const pages = file("Field Notes", "src/ui/pages.tsx");
    expect(pages).toContain("facts.actions.withheld");
    expect(pages).toContain("<s>{withheld.label}</s>");
    expect(pages).toContain("withheld.refusal.message");
  });

  it("reads its ties and its acts from the declaration, naming neither by hand", () => {
    const pages = file("Field Notes", "src/ui/pages.tsx");
    expect(pages).toContain("facts.links");
    const code = pages
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line))
      .join("\n");
    // No edge kind and no mutation of its own: "depends-on", "link-item".
    expect(code).not.toMatch(/"depends-on"/);
    expect(code).not.toMatch(/"link-item"/);
    expect(code).not.toMatch(/graph\.(out|in)\(/);
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
    expect(manifest.devDependencies["graview"]).toBeDefined();
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
  it("consumes the framework by path, aliases its sources, and pins nothing", () => {
    const s = scaffoldProject({ name: "Linked", link: "../graview" });
    const manifest = JSON.parse(s.files.find((f) => f.path === "package.json")!.contents) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies["@graview/core"]).toBe("link:../graview/packages/core");
    const vite = s.files.find((f) => f.path === "vite.config.ts")!.contents;
    expect(vite).toContain("dedupe");
    expect(vite).toContain('"@graview/ship/browser"');
    expect(vite).toContain("searchForWorkspaceRoot");
    /*
     * And no `paths` into anyone's package manager. The project's schemas
     * are built with the `z` that "@graview/core" re-exports — one copy for
     * types and runtime, with nothing to keep in step — where this used to
     * name an exact zod version inside the framework's own pnpm store.
     */
    const tsconfig = JSON.parse(s.files.find((f) => f.path === "tsconfig.json")!.contents) as {
      compilerOptions: { paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions.paths).toBeUndefined();
    expect(s.files.find((f) => f.path === "package.json")!.contents).not.toContain("zod");
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

/**
 * THE LAYOUT EVERY REAL PRODUCT ENDS UP WITH.
 *
 * `graview create` wrote a single standalone package, and no first-party
 * product is one: a real product accretes sibling things — `scripts/` for
 * the harnesses, `docs/`, a PRD, a second surface. The harnesses are the
 * tell. The framework documents survey, audit-ui and a11y as the things a
 * serious product should steal, and then scaffolded a layout with nowhere
 * to put them, so two products independently hand-wrote a workspace root
 * around the scaffold.
 */
describe("a workspace, which is what a product actually is", () => {
  const ws = scaffoldProject({ name: "Field Notes", kind: "note", workspace: true });
  const at = (path: string) => ws.files.find((file) => file.path === path);

  it("puts the app under app/ and the product's own things at the root", () => {
    expect(at("app/src/domain/schema.ts")).toBeDefined();
    expect(at("app/package.json")).toBeDefined();
    expect(at("package.json")).toBeDefined();
    expect(at("pnpm-workspace.yaml")?.contents).toContain("- app");
    expect(at("tsconfig.base.json")).toBeDefined();
    expect(at("vitest.config.ts")).toBeDefined();
    /* Read first, verified whole, ignored once: all three are the product's. */
    expect(at("README.md")).toBeDefined();
    expect(at(".gitignore")).toBeDefined();
    expect(at(".github/workflows/ci.yml")).toBeDefined();
    expect(at("app/README.md")).toBeUndefined();
  });

  /*
   * THE SEED IS SOURCE, the served store is not. `data/` alone also matched
   * `src/data/`, and no project ever committed the graph it opens on.
   */
  it("ignores the served store and keeps the seed, in either layout", () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-ignore-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: dir });
      writeFileSync(join(dir, ".gitignore"), at(".gitignore")!.contents);
      const ignored = (path: string) => {
        try {
          execFileSync("git", ["check-ignore", "-q", path], { cwd: dir });
          return true;
        } catch {
          return false;
        }
      };
      expect(ignored("data/store.json")).toBe(true);
      expect(ignored("app/data/store.json")).toBe(true);
      expect(ignored("src/data/seed.json")).toBe(false);
      expect(ignored("app/src/data/seed.json")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("gives the harnesses somewhere to live, saying what each would measure", () => {
    for (const name of ["survey", "audit-ui", "a11y"]) {
      const stub = at(`scripts/${name}.mjs`);
      expect(stub, name).toBeDefined();
      /* A green verdict from a script that measured nothing is a claim, so
         a stub says it has not been written and exits non-zero. */
      expect(stub!.contents).toContain("has not been written yet");
      expect(stub!.contents).toContain("process.exit(1)");
      expect(stub!.contents).toContain(`scripts/${name}.mjs in the`);
    }
    const root = JSON.parse(at("package.json")!.contents) as { scripts: Record<string, string> };
    expect(root.scripts["audit-ui"]).toBe("node scripts/audit-ui.mjs");
    /* And they are NOT in verify: a stub must not fail the build. */
    expect(root.scripts["verify"]).not.toContain("audit-ui");
  });

  it("delegates the app's own scripts and keeps pnpm's field where it works", () => {
    const root = JSON.parse(at("package.json")!.contents) as {
      scripts: Record<string, string>;
      pnpm?: { onlyBuiltDependencies?: readonly string[] };
    };
    expect(root.scripts["dev"]).toContain("--filter field-notes");
    expect(root.pnpm?.onlyBuiltDependencies).toEqual(["esbuild"]);
    /* pnpm warns when the field is in a workspace member, so it is not. */
    const app = JSON.parse(at("app/package.json")!.contents) as { pnpm?: unknown };
    expect(app.pnpm).toBeUndefined();
    expect(JSON.parse(at("app/tsconfig.json")!.contents).extends).toBe("../tsconfig.base.json");
  });

  it("lengthens the link by one directory, because the app is one deeper", () => {
    const linked = scaffoldProject({ name: "Field Notes", kind: "note", workspace: true, link: "../graview" });
    const app = JSON.parse(linked.files.find((f) => f.path === "app/package.json")!.contents) as {
      dependencies: Record<string, string>;
    };
    expect(app.dependencies["@graview/core"]).toBe("link:../../graview/packages/core");
  });

  it("is not what you get unless you ask", () => {
    const flat = scaffoldProject({ name: "Field Notes", kind: "note" });
    expect(flat.files.some((file) => file.path.startsWith("app/"))).toBe(false);
  });
});

/**
 * A scaffold's first build used to print a performance warning about the
 * framework, on the first command anybody runs.
 */
describe("what a first build says", () => {
  it("splits the framework from the app along the framework's own tier boundary", () => {
    for (const options of [{ name: "Field Notes" }, { name: "Field Notes", link: "../graview" }]) {
      const config = scaffoldProject(options).files.find((f) => f.path === "vite.config.ts")!.contents;
      expect(config).toContain("manualChunks");
      /* The headless half is the tiers with no React in them. */
      expect(config).toContain('["core", "layout", "tools", "ship"].includes(name)');
      expect(config).toContain('["react", "primitives", "pages", "render", "embed", "studio"].includes(name)');
      /* React keeps its own, because it changes on nobody's schedule but its own. */
      expect(config).toContain('return "vendor"');
    }
  });
});

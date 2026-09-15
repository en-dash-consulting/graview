/**
 * A new project, as a list of files.
 *
 * This module writes nothing. It takes a name and a first kind and returns
 * every file a product on Graview starts with — the declaration split into
 * domain and UI, the shell, the tests, the CI — so that the CLI can put them
 * on disk, a test can assert on them without a filesystem, and a host that
 * provisions apps from a declaration can call the same thing in-process.
 *
 * The shape here IS the shape the `graview-new-app` skill describes. When one
 * changes, the other has to, and `scripts/smoke-create.mjs` is what notices:
 * it scaffolds a project from the packed tarballs, installs it the way a
 * stranger would, and runs the project's own `verify`.
 */
import { withArticle } from "../schema/define-node.js";

export interface ScaffoldOptions {
  /** The product's name, as a person would say it: "Field Notes". */
  readonly name: string;
  /** The first node kind, as a slug: "note". Defaults to "item". */
  readonly kind?: string;
  /** The kind's plural, for districts and routes. Defaults to `${kind}s`. */
  readonly plural?: string;
  /** The npm package name. Defaults to the name, slugged. */
  readonly packageName?: string;
  /**
   * The version range every `@graview/*` dependency takes. A published
   * project wants the version of the packages that scaffolded it.
   */
  readonly range?: string;
  /**
   * A path to the framework repository, relative to the new project, for a
   * project that consumes the framework by path rather than from a registry
   * (`link:` dependencies, aliases into its sources, the dev server allowed
   * to read it). This is how the first-party products are wired.
   */
  readonly link?: string;
  /**
   * In link mode: the framework's repository as "owner/name", so the
   * project's CI can check it out as a sibling and build it before verify.
   * Without it the workflow says what to fill in.
   */
  readonly frameworkRepo?: string;
  /** Which package manager the project's scripts and CI assume. */
  readonly packageManager?: "pnpm" | "npm";
  /** The dev server's port. */
  readonly port?: number;
  /** The brand accent, as a hex colour. */
  readonly accent?: string;
  /**
   * THE LAYOUT EVERY REAL PRODUCT ENDS UP WITH: a workspace root with the
   * app under `app/`.
   *
   * A single standalone package is what this wrote, and no first-party
   * product is one — because a real product accretes sibling things:
   * `scripts/` for the harnesses, `docs/`, a PRD, a second surface. The
   * harnesses are the tell. The framework documents `survey`, `audit-ui`,
   * `a11y`, `shrunk` and `seat` as the things a serious product should
   * steal, and then scaffolded a layout with nowhere to put them, so two
   * products independently hand-wrote a workspace root around the scaffold.
   * Two is a gap rather than a taste.
   */
  readonly workspace?: boolean;
}

export interface ScaffoldFile {
  readonly path: string;
  readonly contents: string;
}

export interface Scaffold {
  readonly files: readonly ScaffoldFile[];
  readonly name: string;
  readonly packageName: string;
  readonly kind: string;
  readonly plural: string;
  readonly packageManager: "pnpm" | "npm";
  readonly port: number;
  readonly linked: boolean;
}

/** The packages a product depends on, in the order the skill lists them. */
export const GRAVIEW_PACKAGES = [
  "core",
  "layout",
  "tools",
  "render",
  "react",
  "primitives",
  "pages",
  "ship",
  /*
   * `embed` too, because the pages skill's last section tells a project to
   * `mount` itself into somebody else's page — and a project scaffolded
   * without it could not, in a repository that ships the package.
   */
  "embed",
  /*
   * `studio` too: the studio skill opens the project's own declaration as a
   * graph, and a project without the package could not follow it.
   */
  "studio",
] as const;

const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function camel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function pascal(slug: string): string {
  const c = camel(slug);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * The reasons a name or a kind cannot be used, said before any file exists.
 * A kind is a TypeScript identifier and a URL segment and an edge target,
 * so it is held to the strictest of those.
 */
export function validateScaffoldOptions(options: ScaffoldOptions): readonly string[] {
  const problems: string[] = [];
  if (!options.name || options.name.trim().length === 0) {
    problems.push("a name is required — the product's name, as a person would say it");
  }
  const kind = options.kind ?? "item";
  if (!SLUG.test(kind)) {
    problems.push(`the kind "${kind}" must be a slug: lowercase letters, digits and hyphens, starting with a letter`);
  }
  const plural = options.plural ?? `${kind}s`;
  if (!SLUG.test(plural)) {
    problems.push(`the plural "${plural}" must be a slug like the kind: lowercase letters, digits and hyphens`);
  }
  if (["kind", "edge", "node", "rule", "graph"].includes(kind)) {
    problems.push(`the kind "${kind}" is a word the framework uses for itself; pick the thing your product is about`);
  }
  if (options.packageName !== undefined && !/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9-._]*$/.test(options.packageName)) {
    problems.push(`the package name "${options.packageName}" is not one npm accepts`);
  }
  if (options.port !== undefined && !(Number.isInteger(options.port) && options.port > 0 && options.port < 65536)) {
    problems.push(`the port ${String(options.port)} is not a port`);
  }
  if (options.accent !== undefined && !/^#[0-9a-fA-F]{6}$/.test(options.accent)) {
    problems.push(`the accent "${options.accent}" must be a six-digit hex colour like #2e7d32`);
  }
  return problems;
}

export function scaffoldProject(options: ScaffoldOptions): Scaffold {
  const problems = validateScaffoldOptions(options);
  if (problems.length > 0) throw new Error(problems.join("\n"));

  const name = options.name.trim();
  const kind = options.kind ?? "item";
  const plural = options.plural ?? `${kind}s`;
  const packageName = options.packageName ?? slugify(name);
  const packageManager = options.packageManager ?? "pnpm";
  const port = options.port ?? 5170;
  const range = options.range ?? "*";
  const workspace = options.workspace === true;
  const rootLink = options.link?.replace(/\/+$/, "");
  /*
   * Every path the APP writes is one directory deeper in a workspace, so
   * the link it consumes the framework by is one `../` longer. The root's
   * own files use the link as given.
   */
  const link = rootLink === undefined ? undefined : workspace ? `../${rootLink}` : rootLink;
  // A worked green that clears the checker's contrast pairs in both schemes.
  const accent = options.accent ?? "#2e7d32";

  // "work-order" is an identifier; a button says "work order".
  const spoken = kind.replace(/-/g, " ");
  const spokenPlural = plural.replace(/-/g, " ");
  /*
   * "Add a item" is what a template writes when the article is a literal.
   * The kind is the author's word and half of them begin with a vowel, so
   * every generated sentence takes its article from `withArticle` — the same
   * one the checker and the strip use, so the project a stranger reads and
   * the framework talking about it cannot disagree.
   */
  const aSpoken = withArticle(kind);
  const ASpoken = aSpoken.charAt(0).toUpperCase() + aSpoken.slice(1);
  const ids = {
    name,
    kind,
    plural,
    spoken,
    spokenPlural,
    aSpoken,
    ASpoken,
    Kind: titleCase(kind),
    Plural: titleCase(plural),
    kindVar: camel(kind),
    KindPascal: pascal(kind),
    appVar: `${camel(slugify(name))}App`,
    brandVar: `${camel(slugify(name))}Brand`,
    schemaVar: `${camel(slugify(name))}Schema`,
    SchemaType: `${pascal(slugify(name))}Schema`,
    StoreType: `${pascal(slugify(name))}Store`,
    AppComponent: `${pascal(slugify(name))}App`,
    accent,
    port,
    link,
    frameworkRepo: options.frameworkRepo,
    range,
    packageManager,
    packageName,
  };

  const files: ScaffoldFile[] = [
    { path: "package.json", contents: packageJson(ids, workspace) },
    { path: "tsconfig.json", contents: tsconfig(ids, workspace) },
    { path: "tsconfig.build.json", contents: tsconfigBuild() },
    { path: "vite.config.ts", contents: viteConfig(ids) },
    { path: "index.html", contents: indexHtml(ids) },
    { path: "embed.html", contents: embedHtml(ids) },
    { path: ".gitignore", contents: gitignore() },
    { path: "README.md", contents: readme(ids) },
    { path: "src/domain/schema.ts", contents: schemaTs(ids) },
    { path: "src/domain/mutations.ts", contents: mutationsTs(ids) },
    { path: "src/domain/invariants.ts", contents: invariantsTs(ids) },
    { path: "src/domain/brand.ts", contents: brandTs(ids) },
    { path: "src/domain/app.ts", contents: appTs(ids) },
    { path: "src/ui/views.tsx", contents: viewsTsx(ids) },
    { path: "src/ui/app.tsx", contents: uiAppTsx(ids) },
    { path: "src/ui/pages.tsx", contents: pagesTsx(ids) },
    { path: "src/main.tsx", contents: mainTsx(ids) },
    { path: "src/embed.tsx", contents: embedTsx(ids) },
    { path: "tests/domain.test.ts", contents: domainTest(ids) },
    { path: ".github/workflows/ci.yml", contents: ciYml(ids) },
  ];

  if (!workspace) {
    return { files, name, packageName, kind, plural, packageManager, port, linked: link !== undefined };
  }

  /*
   * THE WORKSPACE: the app under `app/`, and a root that has somewhere to
   * put the things a product accretes. The harnesses are the point — they
   * want to live at a root and drive the app — so they are written as stubs
   * that say what they would measure rather than as a `scripts/` directory
   * somebody has to invent.
   */
  /*
   * What belongs to the PRODUCT rather than to the app package stays at the
   * root: the README a person reads first, the CI that verifies the whole
   * workspace, and the one .gitignore.
   */
  const atRoot = new Set(["README.md", ".gitignore", ".github/workflows/ci.yml"]);
  const rooted: ScaffoldFile[] = files.map((file) =>
    atRoot.has(file.path) ? file : { ...file, path: `app/${file.path}` },
  );
  return {
    files: [
      { path: "package.json", contents: workspaceRoot(ids, rootLink) },
      ...(packageManager === "pnpm"
        ? [{ path: "pnpm-workspace.yaml", contents: "packages:\n  - app\n" }]
        : []),
      { path: "tsconfig.base.json", contents: tsconfigBase() },
      { path: "vitest.config.ts", contents: rootVitest() },
      { path: "scripts/survey.mjs", contents: harness("survey", SURVEY_SAYS, ids) },
      { path: "scripts/audit-ui.mjs", contents: harness("audit-ui", AUDIT_SAYS, ids) },
      { path: "scripts/a11y.mjs", contents: harness("a11y", A11Y_SAYS, ids) },
      ...rooted,
    ],
    name,
    packageName,
    kind,
    plural,
    packageManager,
    port,
    linked: link !== undefined,
  };
}

const SURVEY_SAYS = [
  "Photograph every place a person can land, at both widths and in both schemes,",
  "and write the shots somewhere a person can flick through them. A screenshot",
  "of every state is the cheapest way to find the one that is wrong.",
];

const AUDIT_SAYS = [
  "Ask the questions a photograph makes you squint at, in numbers: is a control",
  "under 24px, is one card drawn on top of another, is a caption cut mid-word,",
  "is the same string on screen twice, does anything paint past the edge with",
  "nowhere to scroll. Every one of these is found by eye first, which is exactly",
  "why it belongs in a script.",
];

const A11Y_SAYS = [
  "Run axe-core over every route at both widths in both schemes, and read the",
  "real accessibility tree rather than assuming it. A populated tree is",
  "necessary, not sufficient — it does not replace a screen-reader pass.",
];

/**
 * A harness that has not been written yet, and says so rather than passing.
 *
 * A green verdict from a script that measured nothing is worse than no
 * script: it is a claim. This one exits non-zero, names what it is for, and
 * points at the framework's own implementation to steal.
 */
function harness(name: string, says: readonly string[], ids: Ids): string {
  const quoted = (line: string) => JSON.stringify(line);
  return `#!/usr/bin/env node
/**
 * ${name} — NOT WRITTEN YET.
 *
${says.map((line) => ` * ${line}`).join("\n")}
 *
 * The framework's own is the one to steal: scripts/${name}.mjs in the
 * Graview checkout. Run the app on http://localhost:${ids.port} and drive it.
 */
for (const line of [
  ${quoted(`${name}: this harness has not been written yet.`)},
${says.map((line) => `  ${quoted(`  ${line}`)},`).join("\n")}
  "",
  ${quoted(`  Steal the framework's scripts/${name}.mjs and point it at this app.`)},
]) {
  console.error(line);
}
process.exit(1);
`;
}

/** The workspace root: what the app is, and where the harnesses go. */
function workspaceRoot(ids: Ids, link: string | undefined): string {
  const run = ids.packageManager === "pnpm" ? "pnpm" : "npm run";
  const inApp = (script: string) =>
    ids.packageManager === "pnpm" ? `pnpm --filter ${ids.packageName} ${script}` : `npm run ${script} --workspace app`;
  return `${JSON.stringify(
    {
      name: `${ids.packageName}-workspace`,
      version: "0.0.0",
      private: true,
      type: "module",
      description: `${ids.name}, on Graview.`,
      engines: { node: ">=22" },
      ...(ids.packageManager === "npm" ? { workspaces: ["app"] } : {}),
      scripts: {
        dev: inApp("dev"),
        build: inApp("build"),
        test: "vitest run",
        typecheck: inApp("typecheck"),
        check: inApp("check"),
        verify: `${run} typecheck && ${run} test && ${run} build && ${run} check`,
        // The harnesses, at the root, driving the app. Stubs until written.
        survey: "node scripts/survey.mjs",
        "audit-ui": "node scripts/audit-ui.mjs",
        a11y: "node scripts/a11y.mjs",
      },
      ...(ids.packageManager === "pnpm" ? { pnpm: { onlyBuiltDependencies: ["esbuild"] } } : {}),
      devDependencies: { typescript: "^5.7.2", vitest: "^2.1.8" },
      ...(link ? { graview: { link } } : {}),
    },
    null,
    2,
  )}\n`;
}

/** The compiler options both the app and anything beside it share. */
function tsconfigBase(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        isolatedModules: true,
        verbatimModuleSyntax: true,
        skipLibCheck: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        jsx: "react-jsx",
      },
    },
    null,
    2,
  )}\n`;
}

/** One test run for the whole workspace, whatever grows beside the app. */
function rootVitest(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["app/tests/**/*.test.ts?(x)", "tests/**/*.test.ts?(x)"] },
});
`;
}

type Ids = {
  name: string;
  kind: string;
  plural: string;
  spoken: string;
  spokenPlural: string;
  /** The kind spoken with its article: "an item", "a work order". */
  aSpoken: string;
  /** The same, capitalised for the head of a sentence. */
  ASpoken: string;
  Kind: string;
  Plural: string;
  kindVar: string;
  KindPascal: string;
  appVar: string;
  brandVar: string;
  schemaVar: string;
  SchemaType: string;
  StoreType: string;
  AppComponent: string;
  accent: string;
  port: number;
  link: string | undefined;
  frameworkRepo: string | undefined;
  range: string;
  packageManager: "pnpm" | "npm";
  packageName: string;
};

/* ------------------------------------------------------------ manifests */

function packageJson(ids: Ids, workspace: boolean): string {
  const dep = (pkg: string) =>
    ids.link ? `link:${ids.link}/packages/${pkg}` : ids.range;
  const graview = Object.fromEntries(GRAVIEW_PACKAGES.map((pkg) => [`@graview/${pkg}`, dep(pkg)]));
  const run = ids.packageManager === "pnpm" ? "pnpm" : "npm run";
  const manifest = {
    name: ids.packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    description: `${ids.name}, on Graview.`,
    // Top-level await in main.tsx, and the framework's own floor.
    engines: { node: ">=22" },
    scripts: {
      dev: "vite",
      typecheck: "tsc -p tsconfig.json",
      test: "vitest run",
      // The declaration as plain modules — what check, docs and a host load.
      "build:domain": "tsc -p tsconfig.build.json",
      build: `${run} build:domain && vite build`,
      // Each of these builds what it needs, so any one works cold.
      check: `${run} build:domain && graview check ./dist/domain/app.js`,
      docs: `${run} build:domain && graview docs ./dist/domain/app.js --out docs`,
      skills: "graview-skills install .",
      verify: `${run} typecheck && ${run} test && ${run} build && ${run} check`,
    },
    /*
     * pnpm 10 refuses postinstall scripts it was not told about, and says so
     * on every install; esbuild's is the one this project has. In a
     * workspace the field only takes effect at the ROOT — pnpm warns about
     * it here — so the root carries it and this does not.
     */
    ...(ids.packageManager === "pnpm" && !workspace
      ? { pnpm: { onlyBuiltDependencies: ["esbuild"] } }
      : {}),
    dependencies: {
      ...graview,
      react: "^19.2.0",
      "react-dom": "^19.2.0",
      "react-router-dom": "^7.1.1",
      /*
       * NO ZOD. A kind's fields are a `z.ZodObject`, and a second copy of
       * zod makes them a nominally different type — which tsc reports by
       * exhausting its heap rather than by saying so. `@graview/core`
       * re-exports `z`, so the project builds its schemas with exactly the
       * copy the framework was built with and has nothing to keep in step.
       */
    },
    devDependencies: {
      "@graview/skills": dep("skills"),
      "@types/node": "^22.10.0",
      "@types/react": "^19.2.0",
      "@types/react-dom": "^19.2.0",
      typescript: "^5.7.2",
      vite: "^5.4.11",
      vitest: "^2.1.8",
    },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function tsconfig(ids: Ids, workspace: boolean): string {
  /*
   * NOTHING POINTS INTO ANOTHER REPOSITORY'S PACKAGE MANAGER.
   *
   * This used to carry a `paths` entry for zod naming an exact version
   * inside the framework's pnpm store — `../../graview/node_modules/.pnpm/
   * zod@4.4.3/node_modules/zod` — because two copies of zod make a declared
   * field schema a nominally different type. It typechecked, and it broke on
   * the day the framework bumped zod, as a missing file in somebody else's
   * internals rather than as a version bump. The project imports `z` from
   * `@graview/core` now: one copy, by re-export, with nothing to pin.
   */
  return `${JSON.stringify(
    {
      /* In a workspace the shared half lives at the root, where a second
         package beside the app can extend the same one. */
      ...(workspace ? { extends: "../tsconfig.base.json" } : {}),
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        strict: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        noFallthroughCasesInSwitch: true,
        isolatedModules: true,
        verbatimModuleSyntax: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        types: ["node"],
        noEmit: true,
      },
      include: ["src", "tests", "vite.config.ts"],
    },
    null,
    2,
  )}\n`;
}

function tsconfigBuild(): string {
  // The domain compiled to plain modules, so `graview check` and the docs
  // generator can load the declaration with no bundler in the way. No
  // declaration files: nothing imports this project, and emitting them
  // would make the framework's zod a named dependency of every type.
  return `${JSON.stringify(
    {
      extends: "./tsconfig.json",
      compilerOptions: {
        noEmit: false,
        rootDir: "src",
        outDir: "dist",
        declaration: false,
        sourceMap: true,
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`;
}

function viteConfig(ids: Ids): string {
  if (!ids.link) {
    return `import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // The declaration compiles to dist/ for \`graview check\`; the site goes
  // somewhere else so neither build overwrites the other. ES2022 because
  // main.tsx awaits the store at the top level, and every browser the
  // framework supports (Safari 16.4+, Firefox 101+, Chromium 99+) has it.
  /*
   * THE FRAMEWORK SPLIT FROM THE APP, ALONG THE FRAMEWORK'S OWN TIER
   * BOUNDARY.
   *
   * A one-kind scaffold's first build used to print
   * "(!) Some chunks are larger than 500 kB" — a performance warning about
   * the framework, on the first command anybody runs. It was not wrong; it
   * was simply the first impression, and a scaffold that warns on its first
   * run teaches people to ignore build output.
   *
   * Measured on a one-kind app: as one bundle, 700 kB and a warning; as
   * framework-and-app, 512 + 189 and still a warning; headless / UI / app,
   * 218 + 295 + 189 and no warning at all. The headless half is core,
   * layout, tools and ship — the tiers with no React in them — and it
   * changes on a different schedule from the UI binding, so a returning
   * visitor keeps the larger half cached across every change to the app.
   */
  build: {
    outDir: "build",
    target: "es2022",
    rollupOptions: {
      output: {
        /*
         * Which half a module belongs to, from its path alone: rollup ids
         * use forward slashes on every platform, and a framework package is
         * under "@graview/<name>" installed, or "packages/<name>" linked.
         */
        manualChunks(id: string) {
          const parts = id.split("/");
          const owner = Math.max(parts.lastIndexOf("@graview"), parts.lastIndexOf("packages"));
          const name = owner === -1 ? undefined : parts[owner + 1];
          if (name && ["core", "layout", "tools", "ship"].includes(name)) return "graview";
          if (name && ["react", "primitives", "pages", "render", "embed", "studio"].includes(name)) {
            return "graview-ui";
          }
          const vendor = parts.lastIndexOf("node_modules");
          const from = vendor === -1 ? undefined : parts[vendor + 1];
          // Zod rides with the headless half, which is what declares against
          // it: in the other chunk the two would import each other.
          if (from === "zod") return "graview";
          // React and the router keep their own, because they change on
          // nobody's schedule but their own.
          if (from && ["react", "react-dom", "react-router", "react-router-dom", "scheduler"].includes(from)) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: { port: ${ids.port}, strictPort: true },
  test: { environment: "node" },
});
`;
  }
  return `import { searchForWorkspaceRoot } from "vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/*
 * THE FRAMEWORK IS A SIBLING CHECKOUT. This project consumes \`@graview/*\`
 * by path (\`link:\` dependencies) and, in development, straight from the
 * framework's sources. Two things follow: the dev server must be allowed
 * to serve files from that directory, and React must be deduplicated, or
 * the framework's components and this app's would each hold their own copy
 * and hooks would break. Build the framework first: \`pnpm -C ${ids.link} build\`.
 */
const framework = (p: string) =>
  fileURLToPath(new URL(\`${ids.link}/packages/\${p}\`, import.meta.url));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  /*
   * THE FRAMEWORK SPLIT FROM THE APP, ALONG THE FRAMEWORK'S OWN TIER
   * BOUNDARY.
   *
   * A one-kind scaffold's first build used to print
   * "(!) Some chunks are larger than 500 kB" — a performance warning about
   * the framework, on the first command anybody runs. It was not wrong; it
   * was simply the first impression, and a scaffold that warns on its first
   * run teaches people to ignore build output.
   *
   * Measured on a one-kind app: as one bundle, 700 kB and a warning; as
   * framework-and-app, 512 + 189 and still a warning; headless / UI / app,
   * 218 + 295 + 189 and no warning at all. The headless half is core,
   * layout, tools and ship — the tiers with no React in them — and it
   * changes on a different schedule from the UI binding, so a returning
   * visitor keeps the larger half cached across every change to the app.
   */
  build: {
    outDir: "build",
    target: "es2022",
    rollupOptions: {
      output: {
        /*
         * Which half a module belongs to, from its path alone: rollup ids
         * use forward slashes on every platform, and a framework package is
         * under "@graview/<name>" installed, or "packages/<name>" linked.
         */
        manualChunks(id: string) {
          const parts = id.split("/");
          const owner = Math.max(parts.lastIndexOf("@graview"), parts.lastIndexOf("packages"));
          const name = owner === -1 ? undefined : parts[owner + 1];
          if (name && ["core", "layout", "tools", "ship"].includes(name)) return "graview";
          if (name && ["react", "primitives", "pages", "render", "embed", "studio"].includes(name)) {
            return "graview-ui";
          }
          const vendor = parts.lastIndexOf("node_modules");
          const from = vendor === -1 ? undefined : parts[vendor + 1];
          // Zod rides with the headless half, which is what declares against
          // it: in the other chunk the two would import each other.
          if (from === "zod") return "graview";
          // React and the router keep their own, because they change on
          // nobody's schedule but their own.
          if (from && ["react", "react-dom", "react-router", "react-router-dom", "scheduler"].includes(from)) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    /*
     * React and the router, and NOT zod. Two copies of React break hooks,
     * so they are forced to one — resolved from this project, which has
     * them. Zod is not this project's dependency at all any more: the
     * schemas are built with the copy "@graview/core" re-exports, and
     * listing it here would force the framework's own import to resolve
     * from a place that does not have it.
     */
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: {
      "@graview/core": framework("core/src/index.ts"),
      "@graview/layout": framework("layout/src/index.ts"),
      "@graview/tools": framework("tools/src/index.ts"),
      // The subpath first: an alias for the bare name would swallow it.
      "@graview/render/gpu": framework("render/src/gpu.ts"),
      "@graview/render": framework("render/src/index.ts"),
      "@graview/react": framework("react/src/index.ts"),
      "@graview/primitives": framework("primitives/src/index.ts"),
      "@graview/pages": framework("pages/src/index.ts"),
      // The browser entry, so the file adapter's node:fs never meets the bundler.
      "@graview/ship/browser": framework("ship/src/browser.ts"),
      "@graview/ship": framework("ship/src/index.ts"),
      "@graview/embed": framework("embed/src/index.ts"),
      "@graview/studio": framework("studio/src/index.ts"),
    },
  },
  server: {
    port: ${ids.port},
    strictPort: true,
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        fileURLToPath(new URL("${ids.link}", import.meta.url)),
      ],
    },
  },
  test: { environment: "node" },
});
`;
}

function indexHtml(ids: Ids): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ids.name)}</title>
<style>
  /* The theme is injected by src/main.tsx from the declared brand; this is
     only the pre-paint ground so the page never flashes white. */
  html, body { margin: 0; background: #0b0d0b; color: #eaf0ea; }
</style>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
`;
}

/**
 * SOMEBODY ELSE'S PAGE. The last rung of the `graview-pages` skill, shipped
 * as a page rather than as a paragraph — so a project has a place to put an
 * embed, and so the project's own `pnpm typecheck` covers the embed surface.
 * Delete both files if the app is never going anywhere but its own address.
 */
function embedHtml(ids: Ids): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ids.name)}, on somebody else's page</title>
<style>
  /* THE HOST PAGE'S OWN LOOK. Nothing here is ${escapeHtml(ids.name)}'s, and
     nothing ${escapeHtml(ids.name)} draws may reach out and change it: the
     embed themes itself inside its own element. */
  body {
    margin: 0 auto;
    max-width: 44rem;
    padding: 3rem 1.25rem 6rem;
    background: #fbfaf7;
    color: #1c1b19;
    font: 17px/1.7 Georgia, "Times New Roman", serif;
  }
  h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 1.2rem; }
  p { margin: 0 0 1.2rem; }
  .figure { margin: 1.5rem 0 2rem; height: 520px; }
</style>

<!-- The HOST page's own landmark. The embed brings a named region of its
     own and deliberately no <main>: the page it lands on owns that, and two
     mains is one landmark said twice. -->
<main>
  <h1>An ordinary page</h1>
  <p>
    Written in its own typeface, on its own paper. The picture below is
    ${escapeHtml(ids.name)}, mounted into one element of it.
  </p>
  <div class="figure" id="here"></div>
  <p>
    And the page carries on afterwards, untouched.
  </p>
</main>

<script type="module" src="/src/embed.tsx"></script>
`;
}

function embedTsx(ids: Ids): string {
  return `import { mount } from "@graview/embed";
import { ${ids.appVar}, createStore } from "./domain/app.js";
import { views } from "./ui/views.js";

/**
 * ${escapeTemplate(ids.name).toUpperCase()} ON SOMEBODY ELSE'S PAGE.
 *
 * The embed brings its own strip, its own theme scoped to the element it is
 * given, and this app's named places — no Shell, nothing on the host page
 * touched. Pass \`seats\` once a policy exists and the reader can sit in each
 * one: the strip, the pages and the acts all narrow together.
 */
const store = createStore();

mount(document.getElementById("here")!, {
  app: ${ids.appVar},
  store,
  // The app's own registry, in the app's own schema — no casts.
  views,
  scheme: "auto",
  stop: "#overview=1",
  label: "${escapeString(ids.name)}",
});
`;
}

function gitignore(): string {
  return `node_modules/
dist/
build/
docs/llms.txt
docs/agents.md
*.tsbuildinfo
.DS_Store
`;
}

function readme(ids: Ids): string {
  const pm = ids.packageManager;
  const run = pm === "pnpm" ? "pnpm" : "npm run";
  const linked = ids.link
    ? `
This project consumes the framework **by path** from \`${ids.link}\`. Build it
first (\`pnpm -C ${ids.link} build\`) and again whenever its sources change; the
dev server reads the framework's sources directly, so in development you see
framework edits without a rebuild.
`
    : "";
  return `# ${ids.name}

A product on [Graview](https://github.com/en-dash-consulting/graview): a typed
context graph that **is** the interface. Everything below the shell is
derived from one declaration in \`src/domain/\`.
${linked}
\`\`\`sh
${pm} install
${run} dev        # http://localhost:${ids.port}  — the scene; /pages is the routed face
${run} verify     # typecheck, tests, build, and graview check
${run} skills     # the authoring skills, for Claude Code and Codex
\`\`\`

## Where things are

\`\`\`
src/domain/      the declaration — no React in here; this is what graview check reads
  schema.ts      the ${ids.kind} kind: its fields, its one edge, its horizon
  mutations.ts   add, link, unlink, close — every change is a named, typed act
  invariants.ts  one rule, and the repair it names
  brand.ts       name, mark, typeface, palette — derived from one accent
  app.ts         defineApp: the whole surface, in one object
src/ui/
  views.tsx      registerDefaultViews, then your own where the generic one is wrong
  app.tsx        the provider, the Shell primitive, and a seat — under sixty lines
  pages.tsx      the ${ids.kind}'s page on the routed face, in your words, over the derived ones
src/main.tsx     the theme, the store that remembers, the two faces
tests/           the rule fires on a graph that breaks it, and its repair resolves it
\`\`\`

## The loop

Declare something, run the check, look at it, declare more:

\`\`\`sh
${run} build && ${run} check
\`\`\`

The useful early findings are \`mutation-untitled\`, \`mutation-undescribed\` and
\`required-invariant-unregistered\` — things that look fine until somebody reads
the interface, or an agent reads a tool schema.

## What comes for free

- **The empty state is generative.** \`creates\` on a mutation is how an empty
  ${ids.Plural} district offers its own beginnings.
- **Lines are actionable.** \`connects\` and \`severs\` on a mutation make the
  drawn relation selectable, and offer the acts from either end.
- **The past is a horizon.** \`lifecycle\` on the kind keeps a closed ${ids.spoken}
  in the record and out of the counts; \`?past=1\` widens the view.
- **A seat, a chat, a tool surface.** The agent seat in the activity rail, the
  chat panel and the derived tool schemas all read the same declaration.
- **Two faces.** \`/\` is the spatial workbench; \`/pages\` is the same app as
  ordinary routed pages, at phone widths — lists, records, forms and problems
  derived from the declaration, and any of them replaceable with a page you
  write (see \`src/ui/pages.tsx\`).
- **It remembers.** Edits persist in this browser, attributed and undoable;
  "Start fresh" is the way back.
`;
}

/* --------------------------------------------------------------- domain */

function schemaTs(ids: Ids): string {
  return `import { createSchema, defineNode } from "@graview/core";
import { z } from "@graview/core";

/**
 * The first kind. Model one thing well before modelling the domain: the
 * loop that matters on day one is declare → \`graview check\` → look at it →
 * declare more.
 */
export const ${ids.kindVar} = defineNode("${ids.kind}", {
  description: "${ids.ASpoken}: something ${escapeString(ids.name)} keeps track of.",
  fields: z.object({
    label: z.string().min(1),
    status: z.enum(["open", "closed"]),
  }),
  edges: {
    // An edge to a kind nobody declared is a typecheck failure, not a
    // runtime surprise.
    // One edge, two readings: each end is captioned in its own words.
    "depends-on": {
      to: ["${ids.kind}"],
      description: "what has to be closed first",
      inverse: "what is waiting on this",
    },
  },
  plural: "${ids.Plural}",
  label: (node) => node.label,
  /*
   * The horizon: a closed ${ids.spoken} leaves the counts but never the graph.
   * Districts say "+N past" instead of drowning, and \`past=1\` widens the view.
   */
  lifecycle: { field: "status", retired: ["closed"] },
});

export const ${ids.schemaVar} = createSchema([${ids.kindVar}]);
export type ${ids.SchemaType} = typeof ${ids.schemaVar};
`;
}

function mutationsTs(ids: Ids): string {
  return `import { bindSchema, nodeRef, type GraphReader } from "@graview/core";
import { z } from "@graview/core";
import { ${ids.schemaVar} } from "./schema.js";

const { defineMutation } = bindSchema(${ids.schemaVar});

type Reader = GraphReader<{ id: string; kind: string } & Record<string, unknown>>;
const nameOf = (graph: Reader, id: string): string => {
  const node = graph.getNode(id);
  return typeof node?.["label"] === "string" ? (node["label"] as string) : id;
};

/**
 * Every change is a named act. The title is the label in the strip and the
 * instruction in an agent's tool schema, so an opaque one costs twice.
 */

export const add${ids.KindPascal} = defineMutation("add-${ids.kind}", {
  title: "Add ${ids.aSpoken}",
  description: "Bring a new ${ids.spoken} into ${escapeString(ids.name)}.",
  // Says what it brings into existence: an EMPTY district offers this act
  // as its own beginning, which is the whole onboarding of a blank graph.
  creates: ["${ids.kind}"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => \`Add \${args.label}\`,
  apply(ctx, args) {
    ctx.addNode({
      id: ctx.freshId(args.label, "${ids.kind}"),
      kind: "${ids.kind}",
      label: args.label,
      status: "open",
    });
  },
});

export const link${ids.KindPascal} = defineMutation("link-${ids.kind}", {
  title: "Depends on",
  description: "Say one ${ids.spoken} has to be closed before another.",
  subject: { kinds: ["${ids.kind}"], arg: "id" },
  // Names the edge kind it makes: the drawn line becomes selectable, and
  // the act is offered from either end.
  connects: ["depends-on"],
  input: z.object({ id: nodeRef(["${ids.kind}"]), dependsOn: nodeRef(["${ids.kind}"]) }),
  describe: (args, graph) =>
    \`\${nameOf(graph as Reader, args.id)} depends on \${nameOf(graph as Reader, args.dependsOn)}\`,
  apply(ctx, args) {
    if (args.id === args.dependsOn) return;
    ctx.addEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});

export const unlink${ids.KindPascal} = defineMutation("unlink-${ids.kind}", {
  title: "No longer depends on",
  description: "Take back a dependency between two ${ids.spokenPlural}.",
  subject: { kinds: ["${ids.kind}"], arg: "id" },
  // Names the edge kind it breaks: a relation you can make but never unmake
  // is a check warning, and a drawn line with nothing to sever hides the act.
  severs: ["depends-on"],
  input: z.object({ id: nodeRef(["${ids.kind}"]), dependsOn: nodeRef(["${ids.kind}"]) }),
  describe: (args, graph) =>
    \`\${nameOf(graph as Reader, args.id)} no longer depends on \${nameOf(graph as Reader, args.dependsOn)}\`,
  apply(ctx, args) {
    ctx.removeEdge({ kind: "depends-on", from: args.id, to: args.dependsOn });
  },
});

export const close${ids.KindPascal} = defineMutation("close-${ids.kind}", {
  title: "Close it",
  description: "Mark ${ids.aSpoken} closed. It leaves the picture, never the record.",
  subject: { kinds: ["${ids.kind}"], arg: "id" },
  // Writes the status without asking for it, and says so.
  writes: ["status"],
  input: z.object({ id: nodeRef(["${ids.kind}"]) }),
  describe: (args, graph) => \`Close \${nameOf(graph as Reader, args.id)}\`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "closed" });
  },
});

export const mutations = [add${ids.KindPascal}, link${ids.KindPascal}, unlink${ids.KindPascal}, close${ids.KindPascal}];
`;
}

function invariantsTs(ids: Ids): string {
  return `import { bindSchema, type Violation } from "@graview/core";
import { ${ids.schemaVar} } from "./schema.js";

const { defineInvariant } = bindSchema(${ids.schemaVar});

/**
 * The first rule, and the repair it names. A rule that only complains is
 * half a rule: the repairs below become one-click fixes in the interface
 * and legal moves for an agent, so name the mutation that resolves it.
 *
 * It judges the OPEN ${ids.spoken}: a closed one is behind the horizon, and
 * the horizon is exactly the promise that what is closed stops asking for
 * attention. What is wrong here is that something closed still leans on
 * something open.
 */
export const closedInOrder = defineInvariant("closed-in-order", {
  label: "Closed in order",
  description: "Nothing closed may still depend on an open ${ids.spoken}.",
  scope: { kind: "${ids.kind}" },
  repairs: ["close-${ids.kind}"],
  evaluate({ graph, subject }): Violation[] {
    if (subject.status === "closed") return [];
    const closed = graph
      .in(subject.id, "depends-on")
      .filter((other) => (other as { status: string }).status === "closed");
    if (closed.length === 0) return [];
    return [
      {
        invariant: "closed-in-order",
        subjectId: subject.id,
        label: subject.label,
        message: \`\${subject.label} is still open, but \${closed.length} closed \${closed.length === 1 ? "${ids.spoken} depends" : "${ids.spokenPlural} depend"} on it\`,
        nodeIds: [subject.id, ...closed.map((other) => other.id)],
        repairs: [
          {
            mutation: "close-${ids.kind}",
            args: { id: subject.id },
            label: \`Close \${subject.label}\`,
          },
        ],
      },
    ];
  },
});

export const invariants = [closedInOrder];
`;
}

function brandTs(ids: Ids): string {
  return `import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/**
 * One accent, and both schemes derived from it. \`graview check\` measures
 * every text pair against AA rather than trusting the colour; if the accent
 * cannot label a pending action legibly, the derivation says which pair
 * failed and why instead of shipping it.
 */
const ACCENT = "${ids.accent}";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(
    \`${escapeTemplate(ids.name)} cannot be derived from \${ACCENT} alone. Needs: \${derived.missing.join(", ")} — \${derived.why}\`,
  );
}

export const ${ids.brandVar}: Brand = {
  name: "${escapeString(ids.name)}",
  // A mark: replace it with your own. Sixteen pixels, currentColor.
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  typography: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  shape: { radius: 10, density: 1 },
  // Colour-by-kind, declared rather than hashed: one hue per kind.
  accents: { "${ids.kind}": 150 },
  schemes: derived.schemes,
};
`;
}

function appTs(ids: Ids): string {
  return `import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
import { ${ids.brandVar} } from "./brand.js";
import { invariants } from "./invariants.js";
import { mutations } from "./mutations.js";
import { ${ids.schemaVar}, type ${ids.SchemaType} } from "./schema.js";

/**
 * The whole surface, in one object. \`graview check\` reads this; so do the
 * docs generator, the tool surface, the pages face and the scene. Keep React
 * out of this directory and the declaration stays inspectable by a build, a
 * CLI and an agent.
 */
export const ${ids.appVar} = defineApp({
  name: "${escapeString(ids.name)}",
  schema: ${ids.schemaVar},
  mutations,
  invariants,
  brand: ${ids.brandVar},
  /*
   * What belongs to the READER rather than to this installation: how big
   * the words are, and whether things move. The profile pane on the bar
   * draws exactly what is declared here, and the shell has already carried
   * the answer to the root element — every surface is sized in \`rem\`, so
   * one answer resizes the picture, the panes and the pages together.
   */
  settings: readerSettings(),
  /*
   * The intelligence, declared. The starter provider proposes first data
   * from the schema alone (no key, no model); a real model plugs the same
   * seam with one completion function. Both may only call what is listed.
   */
  intelligence: [
    {
      name: "starter",
      kind: "graph",
      description: "Proposes first data and open repairs from the declaration alone.",
      may: ["add-${ids.kind}", "link-${ids.kind}", "unlink-${ids.kind}", "close-${ids.kind}"],
    },
  ],
});

export type ${ids.StoreType} = Store<${ids.SchemaType}>;

export function createStore(options: Partial<StoreOptions<${ids.SchemaType}>> = {}): ${ids.StoreType} {
  return new Store<${ids.SchemaType}>({ schema: ${ids.schemaVar}, mutations, invariants, ...options });
}

export default ${ids.appVar};
`;
}

/* ------------------------------------------------------------------- ui */

function viewsTsx(ids: Ids): string {
  return `import { createViews } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { ${ids.schemaVar} } from "../domain/schema.js";

/**
 * Nothing custom yet, on purpose. \`registerDefaultViews\` renders every kind
 * at every fidelity from the declaration alone. Write a view for a kind when
 * the generic one is genuinely wrong, not on principle — see the framework's
 * \`apps/todo/src/ui/views.tsx\` for one that earns its place. Give a group
 * view a title and it is a PLACE, listed by name in the bar:
 *
 *   .register("${ids.kind}", { cardinality: "many", fidelity: "full" }, lens.View, { title: "…" })
 */
export function views() {
  return registerDefaultViews(${ids.schemaVar}, createViews(${ids.schemaVar}));
}
`;
}

function uiAppTsx(ids: Ids): string {
  return `import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, useGraph, useGraview, type Scheme } from "@graview/react";
import { AgentSeat, Shell } from "@graview/primitives";
import { StudioPlace } from "@graview/studio";
import { templateIntelligence, type ToolCall } from "@graview/tools";
import { useMemo, useState } from "react";
import { ${ids.appVar}, createStore, type ${ids.StoreType} } from "../domain/app.js";
import { ${ids.brandVar} } from "../domain/brand.js";
import type { ${ids.SchemaType} } from "../domain/schema.js";
import { views } from "./views.js";

type S = ${ids.SchemaType};

/**
 * The app opens from ALTITUDE: every kind a district, each saying how many
 * it holds — or "none yet", which is an invitation rather than a void.
 */
export const INITIAL_VIEW: ViewState = { ...EMPTY_VIEW, overview: true };

export interface ${ids.AppComponent}Props {
  readonly store?: ${ids.StoreType};
  readonly initialView?: ViewState;
  readonly syncUrl?: boolean;
  readonly initialScheme?: Scheme;
  readonly onSchemeChange?: (scheme: Scheme) => void;
  /** Whether the store behind this app is remembered in the browser (see main.tsx). */
  readonly remembers?: boolean;
}

/**
 * The whole application. \`Shell\` is the command bar, the scene, the
 * inspector and the rail, derived; what ${escapeTemplate(ids.name)} adds is a
 * sentence for when nothing is wrong and a seat for an agent. If this file
 * grows, ask whether the declaration should have grown instead.
 */
export function ${ids.AppComponent}({
  store,
  initialView = INITIAL_VIEW,
  syncUrl = false,
  initialScheme = "light",
  onSchemeChange,
  remembers = false,
}: ${ids.AppComponent}Props) {
  const created = useMemo(() => store ?? createStore(), [store]);
  const registry = useMemo(() => views(), []);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  return (
    <GraviewProvider
      store={created}
      views={registry}
      initialView={initialView}
      scheme={scheme}
      brand={${ids.brandVar}}
      settings={${ids.appVar}.settings ?? []}
    >
      <Shell<S>
        standing="Everything is in order"
        /*
         * THE APP'S OWN DECLARATION, one press away and in place. The
         * kinds, fields, edges, acts and rules of \`src/domain\` are a graph
         * here: change one with the ordinary acts, watch the checker judge
         * it, and apply to get the files to write back. Offered to the seat
         * that administers where there is one, and to whoever is here where
         * there is not — which is this project, today.
         */
        studio={<StudioPlace app={${ids.appVar}} />}
        seat={(onCall) => <Starter onCall={onCall} />}
        remembers={remembers}
        syncUrl={syncUrl}
        scheme={scheme}
        onScheme={(next) => {
          setScheme(next);
          onSchemeChange?.(next);
        }}
      />
    </GraviewProvider>
  );
}

/**
 * The seat at zero. An empty graph plus a seat that proposes starter data is
 * the "describe your domain, get a working app" moment. Every proposal is an
 * ordinary mutation through the derived tool surface — logged, attributed to
 * the seat, reviewable, undoable.
 */
function Starter({ onCall }: { onCall: (call: ToolCall) => void }) {
  const { store } = useGraview<S>();
  const nodes = useGraph();
  const empty = nodes.length === 0;
  return (
    <AgentSeat<S>
      who="starter"
      testId="agent-starter"
      count={empty ? 1 : 0}
      gate="add-${ids.kind}"
      label={() => "Add some starter data"}
      busyLabel="Adding…"
      idle="There is something here already"
      onCall={onCall}
      run={async (agent) => {
        const starter = templateIntelligence<S>();
        for (const proposal of await starter.propose(store)) {
          await agent.run(proposal.mutation, { ...proposal.args });
        }
      }}
    />
  );
}
`;
}

function pagesTsx(ids: Ids): string {
  return `import { Begin } from "@graview/primitives";
import {
  createPageRegistry,
  DefaultHomePage,
  DerivedForm,
  PageMain,
  pageStyles,
  recordFacts,
  Repairs,
  spatialHref,
  useStoreTick,
  type PageComponent,
  type PageContext,
} from "@graview/pages";
import { useParams } from "react-router-dom";
import { ${ids.schemaVar}, type ${ids.SchemaType} } from "../domain/schema.js";

type S = ${ids.SchemaType};

/**
 * THE OTHER FACE, IN YOUR OWN WORDS. /pages is an ordinary routed web
 * application derived from the declaration: a list and a record per kind,
 * forms from the mutations, a problems page from the rules. Every one of
 * those can be replaced per kind — or per surface: shell, home, problems —
 * with a page you write. This is the ${ids.spoken}'s record page; delete it
 * and the derived page takes over again. Everything it shows still comes
 * from the same derivations (\`recordFacts\`, \`DerivedForm\`), so a page
 * you write cannot drift from what the graph says.
 */
function ${ids.KindPascal}Page({ context }: { context: PageContext<S> }) {
  const { store, principal, invariantContext } = context;
  useStoreTick(store);
  const id = decodeURIComponent(useParams()["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const node = store.graph.getNode(id) as { label: string; status: "open" | "closed" } | undefined;
  if (!facts || !node) {
    return (
      <PageMain context={context}>
        <h1 style={pageStyles.h1}>Nothing lives at this address.</h1>
      </PageMain>
    );
  }
  /*
   * THE TIES, AS THE DECLARATION READS THEM.
   *
   * \`facts.links\` is every edge on this record, both directions, each
   * carrying the caption the declaration gives THAT end. Asking the graph
   * for one edge by name here instead — \`out(id, "depends-on")\` — is a
   * page that stops telling the truth the day the schema grows a second
   * edge, which is the first thing every project does.
   */
  const ties = facts.links;
  /*
   * THE ACTS AS THE DERIVATION OFFERS THEM, not as the declaration lists
   * them. Reaching for a mutation by name gets an act that is always there;
   * an affordance is an act that can actually be taken RIGHT NOW, and it
   * carries its candidates — everything not already tied, and never this
   * record itself. With one ${ids.spoken} in the graph there is nothing to
   * point at, so there is no form, rather than a heading over a picker with
   * one wrong answer in it.
   */
  const connecting = facts.actions.affordances.filter((affordance) => affordance.ties === true);

  return (
    <PageMain context={context} data-testid="${ids.kind}-page">
      <header style={{ display: "grid", gap: 10 }}>
        <p style={pageStyles.eyebrow}>${ids.ASpoken} in ${escapeTemplate(ids.name)}</p>
        <h1 style={pageStyles.h1}>{node.label}</h1>
        <p style={pageStyles.lede}>
          {node.status === "closed" ? "Closed." : "Still open."}{" "}
          {ties.length === 0 ? "Connected to nothing yet." : null}
        </p>
        <a href={spatialHref(id)} style={{ ...pageStyles.link, ...pageStyles.quiet }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
      </header>
      {facts.violations.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 10 }} data-testid="record-violations">
          {facts.violations.map((violation, index) => (
            <div key={index} style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
              {/*
                * A repair that needs nothing is one press; one that still has
                * an argument to choose is an ask. \`Repairs\` is the same
                * component the derived problems page uses, so a page you
                * write cannot get this wrong on its own.
                */}
              <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
            </div>
          ))}
        </section>
      ) : null}
      {ties.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-ties">
          {ties.map((group) => (
            <div key={\`\${group.edgeKind}|\${group.direction}\`} style={{ display: "grid", gap: 6 }}>
              {/* The edge's own words for THIS end — its description read
                  from the end that declared it, its inverse read from the
                  other. */}
              <h2 style={pageStyles.h2}>
                {(group.description ?? group.edgeKind).replace(/^./, (first) => first.toUpperCase())}
              </h2>
              <p style={{ margin: 0 }}>{group.targets.map((target) => target.label).join(", ")}</p>
            </div>
          ))}
        </section>
      ) : null}
      {/*
        * WITHHELD, NOT HIDDEN. The affordances above are what this seat may
        * do; an act the policy refuses is in withheld, carrying the policy's
        * own sentence. Dropping it teaches a person the software is broken —
        * they watched a colleague do this yesterday and now the control is
        * gone — so it is drawn struck through with the reason beside it, the
        * way the derived pages and the scene's strip both draw it.
        */}
      {facts.actions.withheld.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 8 }} data-testid="record-withheld">
          {facts.actions.withheld.map((withheld) => (
            <p key={withheld.id} style={{ margin: 0, ...pageStyles.quiet }}>
              <s>{withheld.label}</s> — {withheld.refusal.message}
            </p>
          ))}
        </section>
      ) : null}
      {connecting.length > 0 ? (
        <section style={{ ...pageStyles.rule, display: "grid", gap: 14 }} data-testid="record-actions">
          {connecting.map((affordance) => {
            const act = store.allMutations().find((mutation) => mutation.name === affordance.mutation);
            return act ? (
              <div key={affordance.id} style={{ display: "grid", gap: 10 }}>
                {/* The act's own title, and the arguments the derivation
                    already settled — never a subject name written out here. */}
                <h2 style={pageStyles.h2}>{affordance.label}</h2>
                <DerivedForm<S> store={store} mutation={act} prefilled={affordance.args} open={affordance.open} {...(principal ? { principal } : {})} />
              </div>
            ) : null;
          })}
        </section>
      ) : null}
    </PageMain>
  );
}

/**
 * THE WAY IN, on the home page, until there is a way past it.
 *
 * Every product ships empty once and it is the state its author never sees —
 * your own graph has had data in it since the first afternoon. \`Begin\` is
 * derived: it reads the chain your declaration already states (which acts
 * \`create\` which kinds, and what those acts must be handed first), offers
 * the ones that can run now, and says what everything else is waiting for.
 * It stands down on its own once every kind has something in it, which is
 * why the derived home is what it hands back to.
 */
function Home({ context }: { context: PageContext<S> }) {
  useStoreTick(context.store);
  return (
    <PageMain context={context} data-testid="home">
      <Begin whenFull={<DefaultHomePage context={context} />} />
    </PageMain>
  );
}

/** Your pages: every derived page, with the ${ids.spoken}'s record in your own words. */
export function pages() {
  return createPageRegistry<S, PageComponent<S>>(${ids.schemaVar})
    .register("${ids.kind}", "record", ${ids.KindPascal}Page as PageComponent<S>)
    .surface("home", Home as PageComponent<S>);
}
`;
}

function mainTsx(ids: Ids): string {
  return `import { PagesApp } from "@graview/pages";
import { themeCss, type Scheme } from "@graview/primitives";
import { browserStartsFresh, createBrowserAdapter, forgetFreshParam, openStore } from "@graview/ship/browser";
import { createRoot } from "react-dom/client";
import { ${ids.appVar} } from "./domain/app.js";
import { ${ids.brandVar} } from "./domain/brand.js";
import { ${ids.AppComponent} } from "./ui/app.js";
import { pages } from "./ui/pages.js";

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];

const STORED = "graview:scheme";

function initialScheme(): Scheme {
  const asked = new URLSearchParams(window.location.search).get("theme");
  if (asked === "light" || asked === "dark") return asked;
  try {
    const stored = localStorage.getItem(STORED);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A scheme that cannot be remembered still applies for this visit.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyScheme(scheme: Scheme): void {
  sheet.replaceSync(themeCss(scheme, ${ids.brandVar}));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();
applyScheme(scheme);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");

/*
 * THE APP REMEMBERS. Persistence is the op log; \`openStore\` is the lifecycle
 * every deployment repeats. Here it is the browser adapter, so an edit
 * survives a reload, attributed and undoable. \`?fresh=1\` returns to empty;
 * a driven browser starts fresh unless it asks to remember (\`?remember=1\`),
 * so a harness specifies the app rather than its own residue.
 */
const opened = await openStore({
  app: ${ids.appVar},
  adapter: createBrowserAdapter(),
  fresh: browserStartsFresh(),
});
forgetFreshParam();

if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp
      basename="/pages"
      context={{ store: opened.store, brand: ${ids.brandVar}, sceneHref: "/", remembers: true }}
      // Your own pages over the derived ones: see ui/pages.tsx.
      registry={pages()}
    />,
  );
} else {
  createRoot(root).render(
    <${ids.AppComponent} store={opened.store} remembers syncUrl initialScheme={scheme} onSchemeChange={applyScheme} />,
  );
}

// A flag a harness can wait for, rather than a timer and a hope.
(window as unknown as Record<string, unknown>)["__graviewReady"] = { scheme };
`;
}

/* ---------------------------------------------------------------- tests */

function domainTest(ids: Ids): string {
  return `import { checkApp } from "@graview/core";
import { kindCardId } from "@graview/layout";
import { deriveAffordances } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { ${ids.appVar}, createStore } from "../src/domain/app.js";

/**
 * The domain tier has no DOM in it, so these run headless. The test worth
 * having is the one that catches a real regression: the rule fires on a
 * graph that breaks it, and the repair it names resolves it.
 */

describe("the declaration", () => {
  it("passes its own check", () => {
    const result = checkApp(${ids.appVar});
    expect(result.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("offers an empty district its own beginnings, through creates", () => {
    const store = createStore();
    const { affordances } = deriveAffordances(store, [kindCardId("${ids.kind}")], {
      kindSelection: ["${ids.kind}"],
    });
    expect(affordances.map((a) => a.mutation)).toContain("add-${ids.kind}");
  });
});

describe("the rule", () => {
  const broken = () => {
    const store = createStore();
    store.apply({ name: "add-${ids.kind}", args: { label: "First" } });
    store.apply({ name: "add-${ids.kind}", args: { label: "Second" } });
    const [first, second] = store.graph.nodesOfKind("${ids.kind}");
    store.apply({ name: "link-${ids.kind}", args: { id: second!.id, dependsOn: first!.id } });
    store.apply({ name: "close-${ids.kind}", args: { id: second!.id } });
    return store;
  };

  it("fires when a closed ${ids.spoken} still depends on an open one", () => {
    // One rule at a time: the second rule you declare must not fail this test.
    const violations = broken().violations().filter((v) => v.invariant === "closed-in-order");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/still open, but 1 closed/);
    expect(violations[0]?.repairs).toHaveLength(1);
  });

  it("is resolved by the repair it names", () => {
    const store = broken();
    const repair = store.violations().find((v) => v.invariant === "closed-in-order")!.repairs[0]!;
    store.apply({ name: repair.mutation, args: { ...repair.args } });
    expect(store.violations().filter((v) => v.invariant === "closed-in-order")).toEqual([]);
  });

  it("keeps a closed ${ids.spoken} in the record, behind the horizon", () => {
    const store = broken();
    const closed = store.graph.nodesOfKind("${ids.kind}").filter((n) => n.status === "closed");
    expect(closed).toHaveLength(1);
  });
});
`;
}

/* ------------------------------------------------------------------- ci */

function ciYml(ids: Ids): string {
  const pnpm = ids.packageManager === "pnpm";
  if (ids.link) return linkedCiYml(ids, pnpm);
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${pnpm ? "      - uses: pnpm/action-setup@v4\n" : ""}      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: ${pnpm ? "pnpm" : "npm"}
      - run: ${pnpm ? "pnpm install --frozen-lockfile" : "npm ci"}
      # typecheck: an edge to an undeclared kind fails here.
      # test: the rule fires, and its repair resolves it.
      # build, then check: everything tsc cannot see — a repair naming a
      # mutation nobody registered, a palette pair below AA. Errors fail
      # the build; warnings are a judgement call.
      - run: ${pnpm ? "pnpm verify" : "npm run verify"}
`;
}

/**
 * A project that consumes the framework by path needs the framework on the
 * runner, at the same relative path, built. The project is checked out into
 * a directory of its own and the framework beside it, so \`link:../<name>\`
 * resolves exactly as it does on a laptop.
 */
function linkedCiYml(ids: Ids, pnpm: boolean): string {
  const link = ids.link ?? "../graview";
  const sibling = link.split("/").filter((part) => part && part !== "..").pop() ?? "graview";
  const repo = ids.frameworkRepo ?? "OWNER/graview   # ← the framework repository";
  const install = pnpm ? "pnpm install --frozen-lockfile" : "npm ci";
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

# This project consumes the framework by path (link:${link}). The runner
# needs the framework checked out at that path and built, so both are
# checked out side by side inside the workspace. A private framework
# repository needs a token that can read it in the FRAMEWORK_TOKEN secret.

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: app
      - uses: actions/checkout@v4
        with:
          repository: ${repo}
          path: ${sibling}
          token: \${{ secrets.FRAMEWORK_TOKEN || github.token }}
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Build the framework
        working-directory: ${sibling}
        run: pnpm install --frozen-lockfile && pnpm build
      - name: Verify the app
        working-directory: app
        run: ${install} && ${pnpm ? "pnpm verify" : "npm run verify"}
`;
}

/* -------------------------------------------------------------- escapes */

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeTemplate(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\`").replace(/\$\{/g, "\${");
}

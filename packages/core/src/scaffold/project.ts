import type { Ids } from "./names.js";
import { documentReadmeLayout } from "./from-template.js";

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
  /*
   * `guest` too: a view somebody else wrote is registered with `guestView`
   * from `@graview/guest/host`, and the frame it draws loads the guest half.
   */
  "guest",
] as const;

/**
 * Everything a linked project resolves from the framework checkout: the
 * packages a product imports, plus the skills and the tool it takes as
 * devDependencies. Each must be built before `--link` can work.
 */
export const LINKED_PACKAGES: readonly string[] = [...GRAVIEW_PACKAGES, "skills", "graview"];

/*
 * THE PROJECT AROUND THE APP: its manifest, its compilers, its dev server,
 * its README, its CI and the harnesses its own verify runs.
 */

export const SURVEY_SAYS = [
  "Photograph every place a person can land, at both widths and in both schemes,",
  "and write the shots somewhere a person can flick through them. A screenshot",
  "of every state is the cheapest way to find the one that is wrong.",
];

export const AUDIT_SAYS = [
  "Ask the questions a photograph makes you squint at, in numbers: is a control",
  "under 24px, is one card drawn on top of another, is a caption cut mid-word,",
  "is the same string on screen twice, does anything paint past the edge with",
  "nowhere to scroll. Every one of these is found by eye first, which is exactly",
  "why it belongs in a script.",
];

export const A11Y_SAYS = [
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
export function harness(name: string, says: readonly string[], ids: Ids): string {
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
export function workspaceRoot(ids: Ids, link: string | undefined): string {
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
export function tsconfigBase(): string {
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
export function rootVitest(): string {
  return `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["app/tests/**/*.test.ts?(x)", "tests/**/*.test.ts?(x)"] },
});
`;
}

/* ------------------------------------------------------------ manifests */

export function packageJson(ids: Ids, workspace: boolean): string {
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
      // The store where the data is, and the door an agent comes in by. Both
      // build the declaration first, so either works cold.
      serve: `${run} build:domain && graview serve ./dist/domain/app.js --data data`,
      mcp: `${run} build:domain && graview mcp ./dist/domain/app.js --data data`,
      skills: "graview skills install .",
      verify: `${run} typecheck && ${run} test && ${run} build && ${run} check`,
      // Made from a template: set a store up from it — its acts, as one batch one undo takes back.
      ...(ids.fromTemplate
        ? { "apply-template": `${run} build:domain && graview apply ./dist/domain/app.js --template template.json --data data` }
        : {}),
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
      // The tool: `graview check`, `graview docs`, `graview skills`. The
      // framework is the @graview/* above; this is the command line over it.
      graview: dep("graview"),
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

export function tsconfig(workspace: boolean): string {
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

export function tsconfigBuild(): string {
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

export function viteConfig(ids: Ids): string {
  if (!ids.link) {
    return `import { studioDoor } from "@graview/ship/dev";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // The studio writes a declaration change into src/domain through this, in development only.
  plugins: [studioDoor()],
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
  return `import { studioDoor } from "@graview/ship/dev";
import { searchForWorkspaceRoot } from "vite";
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
  // The studio writes a declaration change into src/domain through this, in development only.
  plugins: [studioDoor()],
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
    /*
     * Every subpath before its bare name: an alias is a prefix, so
     * "@graview/core" alone would take "@graview/core/testing" too and
     * point it inside core's index file.
     */
    alias: {
      "@graview/core/testing": framework("core/src/testing.ts"),
      "@graview/core/document": framework("core/src/document/index.ts"),
      "@graview/core/conformance": framework("core/src/conformance/index.ts"),
      "@graview/core/cli": framework("core/src/cli/index.ts"),
      "@graview/core/scaffold": framework("core/src/scaffold/index.ts"),
      "@graview/core/sqlite": framework("core/src/persistence/sqlite.ts"),
      "@graview/core": framework("core/src/index.ts"),
      "@graview/layout": framework("layout/src/index.ts"),
      "@graview/tools/cli": framework("tools/src/cli.ts"),
      "@graview/tools": framework("tools/src/index.ts"),
      "@graview/render/gpu": framework("render/src/gpu.ts"),
      "@graview/render": framework("render/src/index.ts"),
      "@graview/react": framework("react/src/index.ts"),
      "@graview/primitives": framework("primitives/src/index.ts"),
      "@graview/pages": framework("pages/src/index.ts"),
      // The browser entry, so the file adapter's node:fs never meets the bundler.
      "@graview/ship/browser": framework("ship/src/browser.ts"),
      "@graview/ship/runtime": framework("ship/src/runtime.ts"),
      "@graview/ship/dev": framework("ship/src/dev.ts"),
      "@graview/ship/cli": framework("ship/src/cli.ts"),
      "@graview/ship": framework("ship/src/index.ts"),
      "@graview/embed/pages": framework("embed/src/pages.tsx"),
      "@graview/embed": framework("embed/src/index.ts"),
      "@graview/guest/host": framework("guest/src/host/index.ts"),
      "@graview/guest/react": framework("guest/src/react.ts"),
      "@graview/guest": framework("guest/src/index.ts"),
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

/*
 * `data/` is the store `graview serve --data data` writes, wherever the app
 * sits — and alone it also matched `src/data/`, so every project's seed, the
 * graph it opens on, was quietly never committed. The seed is the source.
 */
export function gitignore(): string {
  return `node_modules/
dist/
build/
data/
!**/src/data/
docs/llms.txt
docs/agents.md
*.tsbuildinfo
.DS_Store
`;
}

export function readme(ids: Ids): string {
  const pm = ids.packageManager;
  const run = pm === "pnpm" ? "pnpm" : "npm run";
  const layout = ids.fromTemplate
    ? documentReadmeLayout(ids, run)
    : `src/domain/      the declaration — no React in here; this is what graview check reads
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
tests/           the rule fires on a graph that breaks it, and its repair resolves it`;
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
${layout}
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
  ordinary routed pages, at phone widths. It lands on a gallery of the app's
  pictures — every kind drawn as a card until you title a lens, then the lens
  by its name — with lists, records, forms, the map and the problems derived
  from the declaration, and any of them replaceable with a page you write
  (see \`src/ui/pages.tsx\`).
- **It remembers.** Edits persist in this browser, attributed and undoable;
  "Start fresh" is the way back.
`;
}

/* ------------------------------------------------------------------- ci */

export function ciYml(ids: Ids): string {
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
export function linkedCiYml(ids: Ids, pnpm: boolean): string {
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

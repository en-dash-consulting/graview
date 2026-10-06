#!/usr/bin/env node
/**
 * Do the tarballs actually work when a stranger installs them?
 *
 * Inside the workspace every import resolves through a symlink and a
 * TypeScript path mapping, so an `exports` map can be wrong for a year and
 * nothing here notices. This packs all six, installs them into a scratch
 * project with no workspace and no path mapping, and builds a trivial app
 * from them — the first moment the published surface is exercised as
 * published.
 *
 *   node scripts/smoke-install.mjs [--keep]
 *
 * Writes docs/smoke.json.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const scratch = mkdtempSync(join(tmpdir(), "graview-smoke-"));
const report = { at: new Date().toISOString(), scratch, steps: {} };

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

try {
  // ------------------------------------------------------------ pack
  const tarballs = {};
  for (const name of readdirSync(resolve(repoRoot, "packages")).sort()) {
    const dir = resolve(repoRoot, "packages", name);
    const manifest = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
    /*
     * `pnpm pack`, not `npm pack`. Only pnpm rewrites `workspace:*` into a
     * real version range, and a tarball carrying the literal `workspace:*` is
     * uninstallable anywhere outside this repo. Nothing else here would have
     * noticed: inside the workspace it resolves fine.
     */
    run("pnpm", ["pack", "--pack-destination", scratch], dir);
    tarballs[manifest.name] = resolve(
      scratch,
      `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`,
    );
  }
  report.steps.packed = Object.keys(tarballs);

  /*
   * A project that has never heard of this workspace.
   *
   * `file:` specifiers pointing at the tarballs, so npm resolves the packages
   * the way a stranger's registry install would — through the `exports` map,
   * against what was actually packed, with no symlink to fall back on.
   */
  const app = resolve(scratch, "app");
  mkdirSync(resolve(app, "src"), { recursive: true });
  writeFileSync(
    resolve(app, "package.json"),
    `${JSON.stringify(
      {
        name: "graview-smoke",
        private: true,
        type: "module",
        dependencies: {
          ...Object.fromEntries(
            Object.entries(tarballs).map(([name, file]) => [name, `file:${file}`]),
          ),
          react: "^19.2.0",
          "react-dom": "^19.2.0",
          zod: "^4.4.3",
        },
        /*
         * The packages depend on each other by version, and the version is
         * 0.0.0, which is not on any registry. Overrides point every one of
         * those at the local tarball so the whole set resolves to what was
         * just built rather than to something published earlier.
         */
        overrides: Object.fromEntries(
          Object.entries(tarballs).map(([name, file]) => [name, `file:${file}`]),
        ),
        devDependencies: {
          typescript: "^5.7.2",
          "@types/react": "^19.2.0",
          "@types/react-dom": "^19.2.0",
          "@types/node": "^22.10.0",
        },
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    resolve(app, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          // Deliberately strict and deliberately WITHOUT paths: the whole
          // point is to resolve through the published exports map.
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );

  /*
   * The smallest thing that is genuinely a Graview app: a kind, a mutation,
   * an invariant that names its repair, a view, a store and a scene. If the
   * published surface is missing anything an app needs, it is missing it
   * here.
   */
  writeFileSync(
    resolve(app, "src/app.tsx"),
    `import {
  bindSchema,
  createSchema,
  defineApp,
  defineNode,
  nodeRef,
  Store,
  DARK,
  LIGHT,
  type Violation,
} from "@graview/core";
import { checkApp } from "@graview/core/check";
import { EMPTY_VIEW, layout } from "@graview/layout";
import { deriveAffordances, createToolRuntime } from "@graview/tools";
import { planFrame } from "@graview/render";
import { createViews, GraviewProvider, Scene, type ViewProps } from "@graview/react";
import { Panel, registerDefaultViews, themeCss } from "@graview/primitives";
import { PagesApp, recordFacts, pluralSlug } from "@graview/pages";
import { createFileAdapter, exportBundle, health, openStore } from "@graview/ship";
import { createBrowserAdapter } from "@graview/ship/browser";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean() }),
  plural: "Tasks",
  edges: { "blocked-by": { to: ["task"], description: "what has to happen first" } },
});
const schema = createSchema([task]);
const { defineMutation, defineInvariant } = bindSchema(schema);

const finish = defineMutation("finish", {
  title: "Mark it done",
  description: "Say a task is finished.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { done: true });
  },
});

const order = defineInvariant("order", {
  scope: { kind: "task" },
  repairs: ["finish"],
  evaluate({ graph, subject }): Violation[] {
    if (!subject.done) return [];
    const open = graph.out(subject.id, "blocked-by").filter((other) => !(other as { done: boolean }).done);
    return open.length === 0
      ? []
      : [
          {
            invariant: "order",
            subjectId: subject.id,
            label: subject.label,
            message: subject.label + " is done but " + open.length + " thing(s) it waits on are not",
            nodeIds: [subject.id, ...open.map((other) => other.id)],
            repairs: open.map((other) => ({
              mutation: "finish",
              args: { id: other.id },
              label: "Finish " + (other as { label: string }).label + " too",
            })),
          },
        ];
  },
});

const app = defineApp({ name: "smoke", schema, mutations: [finish], invariants: [order] });

const TaskView = ({ node }: ViewProps<typeof schema, "task">) =>
  node ? <Panel title={node.label} fit /> : null;

export async function build() {
  const store = new Store({
    schema,
    mutations: [finish],
    invariants: [order],
    snapshot: {
      nodes: [
        { id: "a", kind: "task", label: "First", done: false },
        { id: "b", kind: "task", label: "Second", done: true },
      ],
      edges: [{ kind: "blocked-by", from: "b", to: "a" }],
    },
  });

  const views = registerDefaultViews(schema, createViews(schema)).register(
    "task",
    { cardinality: "one", fidelity: "full" },
    TaskView,
  );

  const view = { ...EMPTY_VIEW, focusId: "a" };
  const placed = layout(store.graph, schema, view);
  const derived = deriveAffordances(store, ["b"]);
  const seat = createToolRuntime(store, { author: { kind: "agent" } });
  const frame = planFrame(
    placed.nodes.map((n) => ({ id: n.id, plane: n.plane, x: n.x, y: n.y, width: n.width, height: n.height })),
    placed.connectors.map((c) => ({ id: c.id, kind: c.kind, from: c.from, to: c.to })),
    { canvasWidth: placed.width, canvasHeight: placed.height },
  );

  return {
    check: checkApp(app),
    violations: store.violations().length,
    placed: placed.nodes.length,
    affordances: derived.affordances.length,
    tools: seat.definitions.length,
    draws: frame.draws.length,
    css: themeCss("dark").length,
    palettes: [DARK.accent, LIGHT.accent],
    scene: <GraviewProvider store={store} views={views} initialView={view}><Scene renderer="dom" /></GraviewProvider>,
    // The other face, from the same store: routes off the plural, facts off
    // the shared derivations.
    slug: pluralSlug(schema, "task"),
    record: recordFacts(store, "a")?.fields.length ?? -1,
    pages: <PagesApp context={{ store }} initialPath="/tasks" />,
    // Deployment, rehearsed: one declaration plus one adapter, opened,
    // written to, reopened, health-checked, exported.
    shipped: await (async () => {
      const adapter = createFileAdapter(mkdtempSync(join(tmpdir(), "graview-smoke-ship-")));
      const opened = await openStore({ app, adapter, seed: store.snapshot() });
      opened.store.apply({ name: "finish", args: { id: "a" } });
      await opened.flush();
      opened.close();
      const reopened = await openStore({ app, adapter });
      const bundle = exportBundle(app, reopened.store);
      const well = health(reopened.store);
      reopened.close();
      return well.ok && bundle.snapshot.nodes.length > 0;
    })(),
    // The browser adapter, through the SAME lifecycle, against a Map dressed
    // as localStorage: the sample apps' persistence, rehearsed from tarballs.
    remembered: await (async () => {
      const map = new Map<string, string>();
      const storage = {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        removeItem: (key: string) => void map.delete(key),
      };
      const adapter = createBrowserAdapter({ storage });
      const opened = await openStore({ app, adapter, seed: store.snapshot() });
      const done = opened.store.apply({ name: "finish", args: { id: "a" } });
      await opened.flush();
      opened.close();
      const again = await openStore({ app, adapter, seed: store.snapshot() });
      const survived = (again.store.graph.getNode("a") as { done: boolean }).done === true;
      const undoable = again.store.canUndo(done.batch).ok;
      again.close();
      const fresh = await openStore({ app, adapter, seed: store.snapshot(), fresh: true });
      const reset = (fresh.store.graph.getNode("a") as { done: boolean }).done === false;
      fresh.close();
      return survived && undoable && reset;
    })(),
  };
}
`,
  );

  writeFileSync(
    resolve(app, "src/run.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
import { build } from "./app.js";

const built = await build();
const html = renderToStaticMarkup(built.scene);
const result = {
  checkOk: built.check.ok,
  checkFindings: built.check.findings.length,
  violations: built.violations,
  placed: built.placed,
  affordances: built.affordances,
  tools: built.tools,
  draws: built.draws,
  cssBytes: built.css,
  palettes: built.palettes,
  renderedViews: (html.match(/data-graview-view=/g) ?? []).length,
  pagesRendered: renderToStaticMarkup(built.pages).includes("Tasks"),
  recordFields: built.record,
  slug: built.slug,
  shipped: built.shipped,
  remembered: built.remembered,
};
process.stdout.write(JSON.stringify(result));
`,
  );

  report.steps.installing = true;
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], app);
  report.steps.installed = true;

  // Typecheck against the PUBLISHED declaration files, with no path mapping.
  run("npx", ["tsc", "-p", "tsconfig.json"], app);
  report.steps.typechecked = true;

  // And run it, so the exports map is exercised at runtime as well as by tsc.
  run("npx", ["tsc", "-p", "tsconfig.json", "--noEmit", "false", "--outDir", "out"], app);
  const out = run("node", ["out/run.js"], app);
  report.result = JSON.parse(out);
  report.steps.ran = true;
} catch (error) {
  // `tsc` writes its diagnostics to stdout, not stderr, and an empty stderr
  // reported as "the error" is how a failure becomes invisible.
  report.error = [error.stdout, error.stderr, error.message]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 6000);
} finally {
  if (!process.argv.includes("--keep")) rmSync(scratch, { recursive: true, force: true });
}

const r = report.result ?? {};
report.verdict = {
  installedFromTarballs: report.steps.installed === true,
  // The exports map resolves for `tsc` with no path mapping in sight.
  typesResolveWithoutPathMapping: report.steps.typechecked === true,
  runsAtRuntime: report.steps.ran === true,
  // And the app it built is a real one, not an import smoke screen.
  theCheckerPasses: r.checkOk === true,
  theInvariantFired: r.violations === 1,
  theLayoutPlacedNodes: (r.placed ?? 0) > 0,
  affordancesWereDerived: (r.affordances ?? 0) > 0,
  anAgentSeatWasGenerated: (r.tools ?? 0) > 0,
  theRendererPlannedAFrame: (r.draws ?? 0) > 0,
  theSceneRendered: (r.renderedViews ?? 0) > 0,
  // The other face renders, and its routes derive from the plurals.
  thePagesRendered: r.pagesRendered === true && r.slug === "tasks" && (r.recordFields ?? 0) > 0,
  // One declaration plus one adapter deployed, persisted, reopened, exported.
  theDeploymentShipped: r.shipped === true,
  // The browser adapter slots into the same lifecycle: survives, undoes, resets.
  theBrowserRemembered: r.remembered === true,
  theThemeEmitted: (r.cssBytes ?? 0) > 500,
};
report.passed = Object.values(report.verdict).every(Boolean) && !report.error;

mkdirSync(resolve(repoRoot, "docs"), { recursive: true });
writeFileSync(resolve(repoRoot, "docs/smoke.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report.verdict, null, 2)}\n`);
if (report.error) process.stdout.write(`\n${report.error}\n`);
process.exit(report.passed ? 0 : 1);

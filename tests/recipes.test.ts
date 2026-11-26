import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE RECIPES ON GRAVIEW.DEV HOLD UP.
 *
 * A recipe is the prompt on the front page with a different task, and what
 * an agent made of it: a declaration document and a seed under
 * docs/site/recipes/<slug>/. CI cannot run an agent, so what it holds is the
 * committed result of the run — that the declaration passes the checker,
 * that the seed is a believable size and loads under it, that every problem
 * the rules find offers a repair that acts on the record it is about, and
 * that the recipe's page embeds the running app. And that start.md, the page
 * the agent reads, names only commands the CLI has.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = (...parts: string[]) => resolve(repoRoot, "docs/site", ...parts);
const read = (...parts: string[]) => readFileSync(site(...parts), "utf8");
const CLI = resolve(repoRoot, "packages/graview/dist/cli.js");

interface Entry {
  readonly slug: string;
  readonly task: string;
  readonly title: string;
}
const index = JSON.parse(read("recipes", "recipes.json")) as { prompt: string; recipes: Entry[] };

type Node = { id: string; kind: string } & Record<string, unknown>;
type Edge = { id: string; kind: string; from: string; to: string };
const seedOf = (slug: string) => JSON.parse(read("recipes", slug, "seed.json")) as { nodes: Node[]; edges: Edge[] };
const documentOf = (slug: string) => JSON.parse(read("recipes", slug, "app.json")) as Record<string, unknown> & { kinds: Record<string, { edges?: Record<string, { to: string[] }> }> };

async function compiled(slug: string) {
  const { compileDocument } = (await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/check.js")).href)) as {
    compileDocument: (document: unknown) => { ok: boolean; app: { schema: unknown; mutations?: { name: string; subject?: { kinds: readonly string[] } }[]; invariants?: unknown[]; policy?: unknown } };
  };
  const result = compileDocument(documentOf(slug));
  expect(result.ok, slug).toBe(true);
  return result.app;
}

describe("every recipe", () => {
  it("has at least three, each with the prompt's own task", () => {
    expect(index.recipes.length).toBeGreaterThanOrEqual(3);
    expect(index.prompt).toContain("{task}");
    for (const recipe of index.recipes) expect(recipe.task.length, recipe.slug).toBeGreaterThan(0);
  });

  for (const recipe of index.recipes) {
    describe(recipe.slug, () => {
      it("passes graview check --document with no error and no warning", () => {
        // Exits 1 on an error; a warning is a line starting with "!", a note one with "·".
        const said = execFileSync(process.execPath, [CLI, "check", "--document", site("recipes", recipe.slug, "app.json")], { cwd: repoRoot, encoding: "utf8" });
        expect(said.split("\n").filter((line) => line.startsWith("!"))).toEqual([]);
      });

      it("seeds a believable amount of the repository, every record of a declared kind and every relation between records that exist", () => {
        const document = documentOf(recipe.slug);
        const seed = seedOf(recipe.slug);
        expect(seed.nodes.length).toBeGreaterThanOrEqual(30);
        expect(seed.edges.length).toBeGreaterThanOrEqual(20);
        const ids = new Map(seed.nodes.map((node) => [node.id, node]));
        expect(ids.size, "unique ids").toBe(seed.nodes.length);
        for (const node of seed.nodes) expect(Object.keys(document.kinds), node.id).toContain(node.kind);
        for (const edge of seed.edges) {
          const from = ids.get(edge.from);
          const to = ids.get(edge.to);
          expect(from && to, `${edge.id}: ${edge.from} → ${edge.to}`).toBeTruthy();
          const declared = document.kinds[from!.kind]?.edges?.[edge.kind];
          expect(declared, `${edge.id}: ${from!.kind} declares no "${edge.kind}"`).toBeDefined();
          expect(declared!.to, edge.id).toContain(to!.kind);
        }
      });

      it("finds problems in its seed, each with a repair that acts on the record the problem is about", async () => {
        const app = await compiled(recipe.slug);
        const { Store } = (await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/index.js")).href)) as {
          Store: new (options: Record<string, unknown>) => { violations: () => { subjectId?: string; repairs?: { mutation: string }[] }[]; graph: { getNode: (id: string) => { kind: string } | undefined } };
        };
        const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: seedOf(recipe.slug) });
        const problems = store.violations();
        expect(problems.length).toBeGreaterThan(0);
        for (const problem of problems) {
          expect(problem.repairs?.length ?? 0, problem.subjectId).toBeGreaterThan(0);
          const kind = store.graph.getNode(problem.subjectId!)?.kind;
          for (const repair of problem.repairs ?? []) {
            const act = (app.mutations ?? []).find((m) => m.name === repair.mutation);
            // A declared act names the kinds it is on; a derived one (edit-<kind>, archive-<kind>…) is named for its kind.
            if (act) expect(act.subject?.kinds ?? [], `${repair.mutation} on ${problem.subjectId}`).toContain(kind);
            else expect(repair.mutation, `${repair.mutation} on ${problem.subjectId}`).toMatch(new RegExp(`^[a-z]+-${kind}$`));
          }
        }
      });

      it("has a page that embeds the running app, from a bundle that carries its declaration", () => {
        const page = read("docs", "recipes", `${recipe.slug}.html`);
        expect(page).toContain(`data-graview-recipe="${recipe.slug}"`);
        expect(page).toContain('<script src="../../chapters.js"></script>');
        expect(page).toContain(`href="../../recipes/${recipe.slug}/app.json"`);
        expect(page).toContain(index.prompt.replace("{task}", recipe.task));
        // The bundle is built from the committed file: the document's own description is in it.
        const description = String(documentOf(recipe.slug)["description"]);
        expect(read("chapters.js")).toContain(JSON.stringify(description).slice(1, 40));
      });
    });
  }
});

describe("the home", () => {
  it("hands an agent the prompt start.md answers first, and links the recipes from the docs", () => {
    /*
     * The front page no longer opens on a recipe: it draws one story and
     * ends on one prompt, the ask to map the repository, which start.md
     * takes first. The recipes are the same procedure with a task named,
     * one press away in the docs.
     */
    const landing = read("index.html");
    const prompt = /<code id="prompt">([\s\S]*?)<\/code>/.exec(landing)?.[1] ?? "";
    expect(prompt.replace(/&rsquo;/g, "'")).toBe("Read https://graview.dev/start.md, then map this repo as a Graview app and show me what's in it.");
    expect(landing).toContain('href="docs/index.html"');
    expect(read("docs/index.html")).toContain('href="recipes.html"');
    for (const recipe of index.recipes) expect(read("docs/recipes.html"), recipe.slug).toContain(`href="recipes/${recipe.slug}.html"`);
    expect(landing).toContain("npm create graview@latest");
  });
});

describe("start.md, the page the agent reads", () => {
  const start = read("start.md");
  const help = execFileSync(process.execPath, [CLI, "--help"], { cwd: repoRoot, encoding: "utf8" });
  const commands = [...start.matchAll(/npx graview ([a-z-]+)([^\n`]*)/g)];

  it("is linked from llms.txt", () => {
    expect(read("llms.txt")).toContain("https://graview.dev/start.md");
  });

  it("takes the home's prompt, map this repo and show me what is in it: the part chosen and said, the app shown, then the report", () => {
    /*
     * The ask on the front page leaves the choice to the agent, so the page
     * it reads says how to make it (a part that maps clearly, with relations
     * and a gap a rule can find, seeded from what is there), to say what it
     * chose, and to end by showing the person the app before reporting.
     */
    expect(start).toMatch(/\*\*Map this repo and show me what is in it\.\*\*/);
    const choose = /1\. \*\*If the task is to map the repository, choose the part first\.\*\*([\s\S]*?)\n2\. /.exec(start)?.[1] ?? "";
    expect(choose).toMatch(/maps most clearly/);
    expect(choose).toMatch(/relations between them/);
    expect(choose).toMatch(/a rule has something to find/);
    expect(choose).toMatch(/Say what you chose and why/);
    const report = start.slice(start.indexOf("## 6. Report back"));
    expect(report).toMatch(/^## 6\. Report back\n\nShow the person the app first/);
    expect(report).toContain("which part of the repository you mapped and why you chose it");
    // And the asks it already took are still there: a named part, and a domain in words.
    expect(start).toMatch(/\*\*An app from a named part of the repository\*\*/);
    expect(start).toMatch(/\*\*An app for something named in words\*\*/);
  });

  it("walks the six steps in order", () => {
    const steps = [...start.matchAll(/^## (\d)\. (.+)$/gm)].map(([, n, title]) => `${n} ${title}`);
    expect(steps).toEqual(["1 Scaffold", "2 Read the root file and the skills", "3 Declare", "4 Check", "5 Preview", "6 Report back"]);
  });

  it("names only subcommands and flags the CLI has", () => {
    expect(commands.length).toBeGreaterThanOrEqual(4);
    for (const [whole, command, rest] of commands) {
      expect(help, whole).toContain(`graview ${command} `);
      for (const [flag] of rest!.matchAll(/--[a-z-]+/g)) expect(help, `${whole}: ${flag}`).toContain(flag);
    }
    // The scaffold's door, and the flag it passes through.
    expect(start).toContain("npm create graview@latest graview-app -- --no-git");
    expect(help).toContain("--no-git");
  });

  it("carries an example document that compiles and checks clean", async () => {
    const example = JSON.parse(/```json\n([\s\S]*?)```/.exec(start)![1]!);
    const { compileDocument, checkApp } = (await import(pathToFileURL(resolve(repoRoot, "packages/core/dist/check.js")).href)) as {
      compileDocument: (d: unknown) => { ok: boolean; app: unknown };
      checkApp: (app: unknown) => { ok: boolean; warnings: number };
    };
    const result = compileDocument(example);
    expect(result.ok).toBe(true);
    const verdict = checkApp(result.app);
    expect(verdict.ok).toBe(true);
    expect(verdict.warnings).toBe(0);
  });

  it("points at a JSON Schema path the published package has", () => {
    const schema = /`node_modules\/@graview\/core\/([^`]+)`/.exec(start)?.[1];
    expect(schema).toBe("dist/document.schema.json");
    const files = JSON.parse(readFileSync(resolve(repoRoot, "packages/core/package.json"), "utf8")).files as string[];
    expect(files.some((entry) => entry === "dist" || entry.startsWith("dist"))).toBe(true);
  });
});

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error — a plain .mjs module, without types.
import { hasSideEffects } from "../scripts/lib/side-effects.mjs";

/**
 * TYPING TOGETHER, IN A BUNDLE THAT TREE-SHAKES (FR-209).
 *
 * `@graview/ship/runtime` loads `@graview/core/typing` for its effect — it
 * teaches every store the `type-text` act — with a bare import, and a
 * bundler that tree-shakes (wrangler's esbuild, Graview Cloud's) keeps such
 * an import only when the package says the file has effects. Core's
 * `sideEffects` named field sight and publishing and not typing, so a
 * deployed room refused every keystroke as an act the app could not do,
 * while vitest, which bundles nothing, passed. So: the published entries
 * bundled the way a Worker is, resolved by esbuild itself and nothing of
 * ours, and a keystroke sent to the handler that bundle serves; and every
 * file any package imports only for its effect is one its package names.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "graview-typing-bundled-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("a server bundled the way a Worker is", () => {
  it("still knows and applies a keystroke typed together", async () => {
    const esbuild = await import("esbuild");
    const outfile = join(dir, "worker.mjs");
    await esbuild.build({
      // From ship's own folder, so `@graview/ship/runtime` and `@graview/core` resolve as a stranger's install does: each package's `exports`, and its `sideEffects`.
      stdin: { contents: `export { createStoreHandler } from "@graview/ship/runtime";\nexport { createSchema, defineApp, defineNode, Store, z } from "@graview/core";\n`, resolveDir: join(repo, "packages/ship"), loader: "js" },
      bundle: true,
      format: "esm",
      platform: "neutral",
      mainFields: ["module", "main"],
      conditions: ["workerd", "worker", "browser"],
      treeShaking: true,
      outfile,
      logLevel: "silent",
    });
    const bundled = (await import(pathToFileURL(outfile).href)) as typeof import("@graview/ship/runtime") & typeof import("@graview/core");
    const { createSchema, createStoreHandler, defineApp, defineNode, Store, z } = bundled;
    const note = defineNode("note", { fields: z.object({ title: z.string(), body: z.string().max(5000).optional() }) });
    const schema = createSchema([note]);
    const app = defineApp({ name: "notes", schema, mutations: [], version: 1 });
    const store = new Store({ schema, mutations: [], snapshot: { nodes: [{ id: "n1", kind: "note", title: "Plan", body: "Hello world" }], edges: [] } as never });
    const handler = await createStoreHandler({ app, store, seatOf: () => ({ kind: "human", id: "ana", name: "Ana" }) });
    try {
      const answer = await handler.handle(
        new Request("https://room.example/graview/ops", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ calls: [{ name: "type-text", args: { node: "n1", field: "body", at: 5, remove: 0, insert: "," } }] }),
        }),
      );
      const body = (await answer.json()) as { error?: string };
      expect(body.error ?? "").toBe("");
      expect(answer.status).toBe(200);
      expect((store.graph.getNode("n1") as { body?: string }).body).toBe("Hello, world");
    } finally {
      await handler.close();
    }
  });
});

describe("every file a package imports only for its effect", () => {
  it("is one its package's sideEffects names, so a bundler keeps it", () => {
    const missing: string[] = [];
    const packages = readdirSync(join(repo, "packages"));
    for (const pkg of packages) {
      const src = join(repo, "packages", pkg, "src");
      let files: string[];
      try {
        files = (readdirSync(src, { recursive: true }) as string[]).filter((file) => /\.tsx?$/.test(file));
      } catch {
        continue;
      }
      for (const file of files) {
        const lines = readFileSync(join(src, file), "utf8").split("\n");
        for (const line of lines) {
          // A door imports a barrel to tie chunks, never for an effect (TIED DOORS, packages/primitives/src/frame.ts).
          const bare = line.match(/^import\s+["']([^"']+)["'];?\s*(\/\/.*)?$/);
          if (!bare || /\.css$/.test(bare[1]!) || bare[2]?.includes("A door:")) continue;
          const target = bare[1]!;
          let owner: string;
          let module: string;
          if (target.startsWith(".")) {
            owner = pkg;
            module = relative(join(repo, "packages", pkg), resolve(dirname(join(src, file)), target)).replace(/\.js$/, ".ts");
          } else if (target.startsWith("@graview/")) {
            const [, name, ...rest] = target.split("/");
            owner = name!;
            const manifest = JSON.parse(readFileSync(join(repo, "packages", owner, "package.json"), "utf8")) as { exports: Record<string, { default: string }> };
            module = manifest.exports[rest.length === 0 ? "." : `./${rest.join("/")}`]!.default;
          } else {
            // Another package's own file: its manifest is its own to keep.
            continue;
          }
          const manifest = JSON.parse(readFileSync(join(repo, "packages", owner, "package.json"), "utf8")) as { sideEffects?: unknown };
          // The tarball's file, and the source a workspace bundle reads in its place: both are kept, or one bundle loses it.
          const path = module.replace(/^\.\//, "");
          const built = path.replace(/^src\//, "dist/").replace(/\.tsx?$/, ".js");
          const source = path.replace(/^dist\//, "src/").replace(/\.js$/, ".ts");
          for (const one of [built, source]) if (!hasSideEffects(manifest, one)) missing.push(`packages/${pkg}/src/${file} imports ${target} for its effect, and @graview/${owner}'s sideEffects does not name ${one}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { readSnapshot, writeSnapshot } from "@graview/core/snapshot";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { backendFrom, openStore, PRINCIPAL_KEY, rememberedPrincipal } from "../../src/index.js";

/**
 * ONE SNAPSHOT FORMAT, AND A PAGE THAT KNOWS ITS READER. A seed handed to
 * `graview serve` or `graview sync-seed` is read the way a page reads one —
 * the line format with its header, or an old `{ nodes, edges }` — and a
 * page seeded from one attributes what its reader does to them.
 */

const task = defineNode("task", { fields: z.object({ label: z.string() }) });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "tasks", schema, mutations: [rename], invariants: [], version: 1 });
const graph = { nodes: [{ id: "t1", kind: "task", label: "Write it" }], edges: [] };

let root: string | undefined;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

const storage = (held: Record<string, string>) => ({
  getItem: (key: string) => held[key] ?? null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

describe("a seed file", () => {
  it("is read in the line format or the old one, by the same flag", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-seed-"));
    writeFileSync(join(root, "seed.jsonl"), writeSnapshot(graph, { generatedAt: "2026-10-10T00:00:00.000Z" }));
    writeFileSync(join(root, "seed.json"), JSON.stringify(graph, null, 2));
    for (const file of ["seed.jsonl", "seed.json"]) {
      const backend = await backendFrom(["--data", join(root, "data"), "--seed", join(root, file)]);
      expect(backend.seed).toEqual(graph);
    }
    writeFileSync(join(root, "bad.json"), '{"nodes":[]}');
    await expect(backendFrom(["--seed", join(root, "bad.json")])).rejects.toThrow(/bad\.json: .*"nodes" and "edges"/);
  });
});

describe("a page's reader", () => {
  it("is the name the browser keeps, or a reader with no name when it keeps none", () => {
    expect(rememberedPrincipal({ storage: storage({ [PRINCIPAL_KEY]: "ada" }) })).toEqual({ kind: "human", id: "ada" });
    expect(rememberedPrincipal({ storage: storage({}) })).toEqual({ kind: "human", id: "reader" });
    const locked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => undefined, removeItem: () => undefined };
    expect(rememberedPrincipal({ storage: locked, fallback: "guest" })).toEqual({ kind: "human", id: "guest" });
  });

  it("is who every act is attributed to on a store seeded from a snapshot over memory", async () => {
    const { snapshot } = readSnapshot(writeSnapshot(graph));
    const opened = await openStore({
      app,
      adapter: createMemoryAdapter(),
      seed: snapshot as never,
      fresh: true,
      storeOptions: { principal: rememberedPrincipal({ storage: storage({ [PRINCIPAL_KEY]: "ada" }) }) },
    });
    opened.store.apply({ name: "rename", args: { id: "t1", label: "Written" } });
    expect(opened.store.log.all().at(-1)!.author).toEqual({ kind: "human", id: "ada" });
    opened.close();
  });
});

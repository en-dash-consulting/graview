import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSchema, defineApp, defineNode } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { connectionsFileOf, createFileAdapter, frictionFileOf, learnedFileOf, openStore, subscriptionsFileOf } from "../../src/index.js";
import { viewsFileOf } from "../../src/cli.js";

/*
 * A STORE ON DISK NEVER LEAVES ITS DATA FOLDER: a scope — an app's name more
 * often than not, and a declaration document names itself — is one folder
 * directly beneath the root. A name that would climb out ("../victim"),
 * reach down ("a/b"), or start over ("/abs") is refused before any file is
 * read, written or removed, by the adapter and by every file kept beside it.
 */
const note = defineNode("note", { fields: z.object({ title: z.string() }) });
const schema = createSchema([note]);

describe("a store on disk", () => {
  it("refuses a scope that is not one folder beneath the root, touching nothing outside it", async () => {
    const base = mkdtempSync(join(tmpdir(), "graview-scope-"));
    const data = join(base, "data");
    const victim = join(base, "victim");
    mkdirSync(data, { recursive: true });
    mkdirSync(victim, { recursive: true });
    writeFileSync(join(victim, "keep.txt"), "kept\n");
    const adapter = createFileAdapter(data);
    for (const scope of ["../victim", "..", ".", "", "a/b", "/abs", "a\\b", "a\0b"]) {
      await expect(adapter.load(scope)).rejects.toThrow(/cannot name a store's folder|outside/);
      await expect(adapter.save(scope, { nodes: [], edges: [] } as never)).rejects.toThrow();
      await expect(adapter.appendOps!(scope, [{ seq: 0 } as never])).rejects.toThrow();
      await expect(adapter.delete(scope)).rejects.toThrow();
      for (const fileOf of [connectionsFileOf, subscriptionsFileOf, frictionFileOf, learnedFileOf, viewsFileOf]) expect(() => fileOf({ adapter, where: data }, scope)).toThrow();
    }
    const app = defineApp({ name: "../victim", schema });
    await expect(openStore({ app, adapter })).rejects.toThrow(/cannot name a store's folder/);
    await expect(openStore({ app, adapter, fresh: true })).rejects.toThrow();
    expect(readdirSync(victim)).toEqual(["keep.txt"]);
    expect(readdirSync(base).sort()).toEqual(["data", "victim"]);
  });

  it("keeps an ordinary name where it always did", async () => {
    const data = mkdtempSync(join(tmpdir(), "graview-scope-"));
    const adapter = createFileAdapter(data);
    const opened = await openStore({ app: defineApp({ name: "my app", schema }), adapter });
    await opened.flush?.();
    opened.close?.();
    expect(existsSync(join(data, "my app", "meta.json"))).toBe(true);
    expect(viewsFileOf({ adapter, where: data }, "my app")).toBe(join(data, "my app", "views.json"));
  });
});

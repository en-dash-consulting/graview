import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * THE FRAMEWORK, IN WORKERD (FR-09).
 *
 * A host that is not Node — a Cloudflare Worker, a Durable Object — imports
 * `@graview/core`, `@graview/tools` and `@graview/ship/runtime` and serves a
 * store. "It has no node: import" is a claim about source; this is the
 * claim run: the published entries bundled the way a Worker's bundler would,
 * loaded into workerd through Miniflare with no Node compatibility flag, and
 * asked to apply a call, to serve the wire from a Durable Object's own
 * SQLite, and to pass the adapter contract there.
 *
 * Where workerd cannot start (a platform with no binary), the suite says so
 * and skips. CI sets GRAVIEW_REQUIRE_WORKERD=1, so there it fails instead.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = process.env["GRAVIEW_REQUIRE_WORKERD"] === "1";

/** `@graview/<package>[/<entry>]` → that package's own `exports` → dist, the way a stranger's bundler resolves it. */
const publishedEntries = {
  name: "graview-published-entries",
  setup(build: { onResolve(options: { filter: RegExp }, fn: (args: { path: string }) => { path: string }): void }) {
    build.onResolve({ filter: /^@graview\// }, ({ path }) => {
      const [, name, ...rest] = path.split("/");
      const manifest = JSON.parse(readFileSync(resolve(root, "packages", name!, "package.json"), "utf8")) as {
        exports: Record<string, { default: string }>;
      };
      const entry = manifest.exports[rest.length === 0 ? "." : `./${rest.join("/")}`];
      if (!entry) throw new Error(`${path} is not an entry @graview/${name} exports`);
      return { path: resolve(root, "packages", name!, entry.default) };
    });
  },
};

type Miniflare = { dispatchFetch(url: string, init?: RequestInit): Promise<Response>; dispose(): Promise<void> };

async function start(): Promise<{ readonly mf: Miniflare } | { readonly why: string }> {
  let script: string;
  try {
    const esbuild = await import("esbuild");
    const built = await esbuild.build({
      entryPoints: [resolve(root, "tests/workerd/worker.ts")],
      bundle: true,
      format: "esm",
      platform: "browser",
      conditions: ["workerd", "worker", "browser"],
      external: ["cloudflare:workers"],
      write: false,
      logLevel: "silent",
      plugins: [publishedEntries as never],
    });
    script = built.outputFiles[0]!.text;
  } catch (error) {
    // A bundle that does not build is a real failure, never a skip: it is where a node: import shows.
    throw new Error(`the worker did not bundle: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const { Miniflare } = await import("miniflare");
    const mf = new Miniflare({
      modules: true,
      script,
      compatibilityDate: "2025-09-01",
      durableObjects: {
        CONTRACT: { className: "Contract", useSQLite: true },
        SERVED: { className: "Served", useSQLite: true },
      },
    }) as unknown as Miniflare;
    // The first request is what starts workerd; a platform without it fails here.
    await (await mf.dispatchFetch("http://worker/cases")).arrayBuffer();
    return { mf };
  } catch (error) {
    if (required) throw error;
    return { why: `workerd could not start here (${error instanceof Error ? error.message.split("\n")[0] : String(error)})` };
  }
}

const started = await start();
const mf = "mf" in started ? started.mf : undefined;
if (!mf) console.warn(`[the framework runs in workerd] skipped: ${"why" in started ? started.why : ""}`);
afterAll(async () => {
  await mf?.dispose();
});

const json = async <T>(response: Response | Promise<Response>): Promise<T> => (await (await response).json()) as T;
const cases = mf ? await json<{ adapter: string[]; sql: string[] }>(mf.dispatchFetch("http://worker/cases")) : { adapter: [], sql: [] };

describe.skipIf(!mf)("core, tools and ship's runtime entry, in workerd", () => {
  it("imports all three and applies a call through the tool runtime", async () => {
    const answer = await json<{ ok: boolean; done: boolean; author: { id: string }; tools: string[]; shipped: string[] }>(
      mf!.dispatchFetch("http://worker/tools"),
    );
    expect(answer).toMatchObject({ ok: true, done: true, author: { id: "claude" } });
    expect(answer.tools).toContain("finish");
    expect(answer.shipped).toContain("FR-09");
  });

  it("runs the live protocol from the runtime entry over state that is only JSON between messages (FR-41)", async () => {
    const answer = await json<{ heard: { t: string }[]; state: { cursor: number; via: string }; via: string }>(mf!.dispatchFetch("http://worker/live"));
    expect(answer.heard.map((message) => message.t)).toEqual(["welcome", "ack"]);
    expect(answer.state).toMatchObject({ cursor: 0, via: "mcp:Claude" });
    // The host's channel, not the client's (FR-52).
    expect(answer.via).toBe("mcp:Claude");
  });

  it("draws a picture of an app from a document and from a declared app, with no DOM in the isolate (FR-74)", async () => {
    const answer = await json<{ dom: string; fromDocument: string; fromApp: string }>(mf!.dispatchFetch("http://worker/thumbnail"));
    expect(answer.dom).toBe("undefined");
    expect(answer.fromDocument).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* viewBox="[^"]+"/);
    expect(answer.fromDocument).toContain("<title>Errands: 2 kinds");
    expect(answer.fromDocument).toContain('data-scheme="dark"');
    expect(answer.fromApp).toContain('data-kind="task"');
  });

  it("serves the WIRE from a Durable Object whose store is its own SQLite, and keeps what was applied", async () => {
    const seat = { "content-type": "application/json", "x-graview-seat": "u1", "x-graview-roles": "keeper" };
    const before = await json<{ snapshot: { nodes: { id: string; done: boolean }[] } }>(mf!.dispatchFetch("http://worker/graview/state", { headers: seat }));
    expect(before.snapshot.nodes).toMatchObject([{ id: "t1", done: false }]);

    const applied = await mf!.dispatchFetch("http://worker/graview/ops", {
      method: "POST",
      // The channel rides with the seat, in a header this host trusts as it trusts the seat (FR-52).
      headers: { ...seat, "x-graview-via": "web" },
      body: JSON.stringify({ calls: [{ name: "finish", args: { id: "t1" } }] }),
    });
    expect(applied.status).toBe(200);
    expect(await applied.json()).toMatchObject({ ops: [{ author: { id: "u1" }, via: "web" }] });

    const after = await json<{ snapshot: { nodes: { id: string; done: boolean }[] }; log: unknown[] }>(
      mf!.dispatchFetch("http://worker/graview/state", { headers: seat }),
    );
    expect(after.snapshot.nodes).toMatchObject([{ id: "t1", done: true }]);
    expect(after.log).toHaveLength(1);
    expect(await json(mf!.dispatchFetch("http://worker/graview/health"))).toMatchObject({ adapter: "sqlite", where: "a Durable Object" });
  });
});

describe.skipIf(!mf)("the SQL adapter passes the sqlite adapter's tests against Durable Object storage", () => {
  for (const [suite, names] of Object.entries(cases)) {
    names.forEach((name, index) => {
      it(`${suite}: ${name}`, async () => {
        const result = await json<{ ok: boolean; error?: string }>(mf!.dispatchFetch(`http://worker/contract/${suite}/${index}`));
        expect(result.error ?? "").toBe("");
        expect(result.ok).toBe(true);
      });
    });
  }

  it("ran every case the contract has, not none", () => {
    expect(cases.adapter.length).toBeGreaterThanOrEqual(6);
    expect(cases.sql.length).toBeGreaterThanOrEqual(3);
  });
});

/*
 * AND IN PLAIN NODE (FR-74). The published document entry, imported by a
 * bare `node` with nothing but its own globals — no DOM, no test runner's
 * environment — draws the same picture twice, byte for byte.
 */
describe("a picture of an app, in plain Node", () => {
  it("is drawn by the published entry with no DOM globals, and the same both times", () => {
    const entry = resolve(root, "packages/core/dist/document/index.js");
    const script = `
      const { sceneThumbnail } = await import(${JSON.stringify(new URL(`file://${entry}`).href)});
      const doc = { format: "graview-document", formatVersion: 1, name: "Errands", kinds: { errand: { fields: { label: { type: "string", required: true } } } } };
      const a = sceneThumbnail(doc, { scheme: "light" });
      const b = sceneThumbnail(JSON.stringify(doc), { scheme: "light" });
      process.stdout.write(JSON.stringify({ dom: [typeof document, typeof window, typeof HTMLElement], same: a === b, svg: a }));
    `;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
    expect(run.stderr).toBe("");
    const answer = JSON.parse(run.stdout) as { dom: string[]; same: boolean; svg: string };
    expect(answer.dom).toEqual(["undefined", "undefined", "undefined"]);
    expect(answer.same).toBe(true);
    expect(answer.svg).toContain("<title>Errands: one kind, errands</title>");
  });
});

import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A running `graview preview --data data` holds the graph in memory and
 * writes it back as it changes. `graview sync-seed --apply` against the same
 * folder used to report success while the open pages kept the old records,
 * and the preview's next write could put them back: a write lost with
 * nobody told. Now the preview holds the folder, and every other writer is
 * refused in a sentence that names the preview, its port and what to do.
 *
 * Real processes, as a person would run them, in a scratch folder.
 */
const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "packages/graview/dist/cli.js");
const fixtures = resolve(root, "packages/core/tests/document/fixtures");

let dir: string;
let seed: { nodes: { id: string; kind: string; name?: string }[]; edges: unknown[] };
const run = (args: readonly string[]) => {
  const ran = spawnSync("node", [cli, ...args], { cwd: dir, encoding: "utf8" });
  return { code: ran.status ?? 1, out: ran.stdout, err: ran.stderr };
};

/** A preview on a free port, resolved once it says where it is. */
function startPreview(): Promise<{ child: ChildProcess; url: string; said: string }> {
  const child = spawn("node", [cli, "preview", "app.json", "--seed", "seed.json", "--data", "data", "--port", "0"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((ready, failed) => {
    let said = "";
    const listen = (chunk: Buffer) => {
      said += String(chunk);
      const url = /on (http:\/\/[^\s]+)/.exec(said)?.[1];
      if (url && / nodes\./.test(said)) ready({ child, url, said });
    };
    child.stdout!.on("data", listen);
    child.stderr!.on("data", listen);
    child.on("exit", (code) => failed(new Error(`the preview exited ${code}: ${said}`)));
  });
}

const stop = (child: ChildProcess) =>
  new Promise<void>((done) => {
    if (child.exitCode !== null) return done();
    child.on("exit", () => done());
    child.kill("SIGTERM");
  });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "graview-held-"));
  copyFileSync(join(fixtures, "org.gdd.json"), join(dir, "app.json"));
  seed = JSON.parse(readFileSync(join(fixtures, "org.seed.json"), "utf8"));
  writeFileSync(join(dir, "seed.json"), JSON.stringify(seed));
  const person = seed.nodes.find((node) => node.kind === "person")!;
  const grown = { ...seed, nodes: [...seed.nodes, { ...person, id: "person-new", name: "Somebody New" }] };
  writeFileSync(join(dir, "seed-grown.json"), JSON.stringify(grown));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("a running preview holds its data folder", () => {
  it("refuses sync-seed --apply while it runs, naming the preview and its port, and writes nothing", async () => {
    const { child, url } = await startPreview();
    try {
      const port = new URL(url).port;
      const before = readFileSync(join(dir, "data", "graview.lock"), "utf8");
      expect(JSON.parse(before)).toMatchObject({ command: "preview", pid: child.pid, url });

      const dry = run(["sync-seed", "--document", "app.json", "--seed", "seed-grown.json", "--data", "data"]);
      expect(dry.code).toBe(0);
      expect(dry.out).toContain("stop it before adding --apply");

      const applied = run(["sync-seed", "--document", "app.json", "--seed", "seed-grown.json", "--data", "data", "--apply"]);
      expect(applied.code).toBe(1);
      expect(applied.err).toContain(`a preview on :${port}`);
      expect(applied.err).toContain("holds");
      expect(applied.err).toContain("nothing was written");
      expect(applied.out).not.toContain("landed");

      // Nor does any other writer get past it: apply and mcp are pointed at the server instead.
      const other = run(["apply", "--document", "app.json", "--data", "data", "--undo", "nothing"]);
      expect(other.code).toBe(1);
      expect(other.err).toContain(`--remote-url ${url}`);

      // And a second preview of the same folder is refused before it serves anything.
      const second = run(["preview", "app.json", "--data", "data", "--port", "0"]);
      expect(second.code).toBe(1);
      expect(second.err).toContain(`a preview on :${port}`);
    } finally {
      await stop(child);
    }
    expect(existsSync(join(dir, "data", "graview.lock"))).toBe(false);
  });

  it("lets sync-seed --apply land once the preview has stopped, and the next preview shows it", async () => {
    const applied = run(["sync-seed", "--document", "app.json", "--seed", "seed-grown.json", "--data", "data", "--apply"]);
    expect(applied.code, applied.err).toBe(0);
    expect(applied.out).toContain("landed");
    const { child, said } = await startPreview();
    try {
      expect(said).toContain(`${seed.nodes.length + 1} nodes.`);
      const snapshot = readFileSync(join(dir, "data", JSON.parse(readFileSync(join(dir, "app.json"), "utf8")).name, "snapshot.json"), "utf8");
      expect(snapshot).toContain("person-new");
    } finally {
      await stop(child);
    }
  });

  it("takes over a hold whose process has died, so a crash leaves nothing to delete by hand", () => {
    const gone = Number(execFileSync("node", ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" }));
    writeFileSync(join(dir, "data", "graview.lock"), JSON.stringify({ command: "preview", pid: gone, url: "http://127.0.0.1:1", since: "earlier" }));
    const applied = run(["sync-seed", "--document", "app.json", "--seed", "seed.json", "--data", "data", "--apply", "--prune"]);
    expect(applied.code, applied.err).toBe(0);
    expect(existsSync(join(dir, "data", "graview.lock"))).toBe(false);
  });
});

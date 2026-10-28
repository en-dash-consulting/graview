import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileDocument } from "@graview/core/check";
import type { GraviewApp } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workflow, workflowToolsFor } from "../../src/workflow-cli.js";

/*
 * `graview workflow` (Roadmap f-jobs-declared): without a name it lists
 * the app's workflows — each in a sentence, active or paused, when it next
 * runs and how its last run went; with one it runs it once by hand as the
 * app's own actor against the store on disk, its runs kept beside the
 * store so the first after a change is dry and the next is kept. And what
 * `graview mcp --workflows` hands its seat: a pause written into the
 * document, checked first.
 */

const FIXTURE = new URL("../../../core/tests/document/fixtures/workflows.gdd.json", import.meta.url);
const SEED = {
  nodes: [
    { id: "r1", kind: "routine", name: "Swim practice", active: true },
    { id: "r2", kind: "routine", name: "Piano lesson", active: true },
  ],
  edges: [],
};

let root: string;
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Runs the command, and what it wrote to stdout and stderr. */
async function run(argv: readonly string[]) {
  let out = "";
  let err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => ((out += String(chunk)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => ((err += String(chunk)), true));
  const code = await workflow(argv);
  vi.restoreAllMocks();
  return { code, out, err };
}

function household(): { entry: string; data: string; seed: string } {
  root = mkdtempSync(join(tmpdir(), "graview-workflow-"));
  const entry = join(root, "household.json");
  writeFileSync(entry, readFileSync(FIXTURE, "utf8"));
  const seed = join(root, "seed.json");
  writeFileSync(seed, JSON.stringify(SEED));
  return { entry, data: join(root, "data"), seed };
}

describe("graview workflow", () => {
  it("lists each workflow in a sentence, whether it is paused, when it next runs on the app's clock (6 PM in New York, the Sunday the clocks fall back), and dreaming as built in", async () => {
    const { entry } = household();
    const listed = await run([entry, "--now", "2026-10-28T12:00:00Z"]);
    expect(listed.code).toBe(0);
    expect(listed.out).toContain("next-weeks-events — Every Sunday at 6 PM: fill out next week's events\n    next 2026-11-01T23:00:00.000Z · Has not run yet");
    expect(listed.out).toContain("set-aside-done-lists — Every day at 3 AM: set aside done grocery lists\n    paused · Has not run yet");
    expect(listed.out).toContain("keep-events-in-step — When a plan item's name and date changes: keep events in step with plan items\n    runs on a change or by hand");
    expect(listed.out).toContain("dreaming (built in) — Every day at 3 AM: tidy the app overnight");
    const json = await run([entry, "--now", "2026-10-28T12:00:00Z", "--json"]);
    expect(JSON.parse(json.out).workflows.map((one: { name: string }) => one.name)).toEqual(["next-weeks-events", "keep-events-in-step", "set-aside-done-lists", "dreaming"]);
  });

  it("runs one against the store: dry the first time after a change, kept the next, nothing new the third — and says its last run when listed", async () => {
    const { entry, data, seed } = household();
    const base = [entry, "next-weeks-events", "--data", data, "--seed", seed];
    const first = await run([...base, "--now", "2026-11-01T18:00:00Z"]);
    expect(first.code).toBe(0);
    expect(JSON.parse(first.out)).toMatchObject({ workflow: "next-weeks-events", dry: true, made: ["event:wf.next-weeks-events.r1", "event:wf.next-weeks-events.r2"] });
    expect(first.err).toContain("“next-weeks-events” ok (a dry run: nothing was kept)");

    const kept = await run([...base, "--now", "2026-11-01T18:01:00Z"]);
    expect(JSON.parse(kept.out)).toMatchObject({ dry: false, outcome: "ok", made: ["event:wf.next-weeks-events.r1", "event:wf.next-weeks-events.r2"] });
    const again = await run([...base, "--now", "2026-11-01T18:02:00Z"]);
    expect(JSON.parse(again.out)).toMatchObject({ dry: false, outcome: "nothing-new", made: [] });

    const runs = JSON.parse(readFileSync(join(data, "The household", "workflow-runs.json"), "utf8")).runs["next-weeks-events"];
    expect(runs).toHaveLength(3);
    const listed = await run([entry, "--data", data, "--now", "2026-11-01T20:02:00Z"]);
    expect(listed.out).toContain("next 2026-11-01T23:00:00.000Z · Last ran 2 hours ago: nothing new");
  });

  it("keeps nothing when a dry run is asked for", async () => {
    const { entry, data, seed } = household();
    const base = [entry, "next-weeks-events", "--data", data, "--seed", seed];
    await run(base);
    const asked = await run([...base, "--dry"]);
    expect(JSON.parse(asked.out)).toMatchObject({ dry: true, made: ["event:wf.next-weeks-events.r1", "event:wf.next-weeks-events.r2"] });
    const kept = await run(base);
    expect(JSON.parse(kept.out)).toMatchObject({ dry: false, made: ["event:wf.next-weeks-events.r1", "event:wf.next-weeks-events.r2"] });
  });

  it("refuses a workflow the app does not have, sends dreaming to graview dream, and a remote store to its server", async () => {
    const { entry } = household();
    const unknown = await run([entry, "weekly-report"]);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toBe('graview workflow: The household has no workflow "weekly-report"; it has "next-weeks-events", "keep-events-in-step", "set-aside-done-lists".\n');
    expect((await run([entry, "dreaming"])).err).toContain("run it with graview dream");
    expect((await run([entry, "next-weeks-events", "--remote-url", "http://localhost:1"])).code).toBe(2);
  });
});

describe("graview mcp --workflows", () => {
  it("writes a pause into a document entry, checked, and the seat's app reads it at once; a TypeScript entry is offered no pause", async () => {
    const { entry } = household();
    const app = compileDocument(JSON.parse(readFileSync(entry, "utf8"))).app as GraviewApp;
    const tools = await workflowToolsFor(app, entry, join(root, "data", "friction.json"));
    expect(await tools.edit!({ op: "pause-workflow", name: "next-weeks-events" })).toMatchObject({ ok: true });
    expect(JSON.parse(readFileSync(entry, "utf8")).workflows["next-weeks-events"].status).toBe("paused");
    expect(app.workflows!["next-weeks-events"]!.status).toBe("paused");
    expect((await workflowToolsFor(app, join(root, "app.ts"), join(root, "friction.json"))).edit).toBeUndefined();
  });
});

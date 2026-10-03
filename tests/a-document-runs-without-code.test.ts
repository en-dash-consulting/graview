import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * FR-01. A host accepts a declaration from a stranger as a document and runs
 * it without running their code: `graview check`, `serve` and `mcp` take
 * `--document <file>` and need no TypeScript entry at all.
 */
const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "packages/graview/dist/cli.js");
const vendors = resolve(root, "packages/core/tests/document/fixtures/vendors.gdd.json");
const run = (args: readonly string[]) => {
  try {
    return { code: 0, out: execFileSync("node", [cli, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (error) {
    const failed = error as { status: number; stdout: string; stderr: string };
    return { code: failed.status, out: `${failed.stdout}${failed.stderr}` };
  }
};

describe("a document runs without code", () => {
  it("graview check --document checks it, and says so", () => {
    const checked = run(["check", "--document", vendors, "--json"]);
    expect(checked.code).toBe(0);
    expect(JSON.parse(checked.out).ok).toBe(true);
  });

  it("refuses a document that does not compile, with the JSON path of each finding", () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-doc-"));
    const broken = join(dir, "broken.json");
    writeFileSync(broken, JSON.stringify({ format: "graview-document", formatVersion: 1, name: "Broken", kinds: { task: { fields: { title: { type: "string" } }, edges: { for: { to: ["project"] } } } } }));
    const checked = run(["check", "--document", broken, "--json"]);
    expect(checked.code).toBe(1);
    const said = JSON.parse(checked.out) as { ok: boolean; findings: { severity: string; path: string; message: string }[] };
    const error = said.findings.find((finding) => finding.severity === "error");
    expect(error?.path).toBe("kinds.task.edges.for.to");
    expect(error?.message).toMatch(/project/);
  });

  it("graview mcp --document --list derives the tools from it, under the seat's policy", () => {
    // A seat holding no role is offered the reads only: the document's policy grants acts to planners.
    const reader = (JSON.parse(run(["mcp", "--document", vendors, "--list"]).out) as { tools: { name: string }[] }).tools.map((tool) => tool.name);
    expect(reader.some((name) => /vendor/.test(name))).toBe(false);
    const listed = run(["mcp", "--document", vendors, "--list", "--roles", "planner"]);
    expect(listed.code).toBe(0);
    const names = (JSON.parse(listed.out) as { tools: { name: string }[] }).tools.map((tool) => tool.name);
    expect(names).toContain("get_graph");
    expect(names.some((name) => /vendor/.test(name))).toBe(true);
  });

  it("graview serve --document serves it", async () => {
    const data = mkdtempSync(join(tmpdir(), "graview-doc-data-"));
    const server = spawn("node", [cli, "serve", "--document", vendors, "--data", data, "--port", "5689"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    try {
      await new Promise<void>((ready, fail) => {
        const timer = setTimeout(() => fail(new Error("graview serve did not start")), 20_000);
        server.stdout.on("data", (chunk) => {
          if (String(chunk).includes("graview serve:")) {
            clearTimeout(timer);
            ready();
          }
        });
        server.on("exit", (code) => fail(new Error(`graview serve exited ${code}`)));
      });
      const health = (await (await fetch("http://127.0.0.1:5689/graview/health")).json()) as { ok: boolean };
      expect(health.ok).toBe(true);
    } finally {
      server.kill();
    }
  }, 30_000);

  // FR-22: a rename from nothing would move nothing, and the values it meant to keep would be dropped.
  it("graview check --previous refuses a renamedFrom naming nothing in the previous version", () => {
    const dir = mkdtempSync(join(tmpdir(), "graview-doc-"));
    const doc = (fields: Record<string, unknown>) => ({ format: "graview-document", formatVersion: 1, name: "Chores", kinds: { chore: { fields } } });
    const previous = join(dir, "v1.json");
    writeFileSync(previous, JSON.stringify(doc({ title: { type: "string", required: true }, hours: { type: "number" } })));
    const right = join(dir, "v2.json");
    writeFileSync(right, JSON.stringify(doc({ title: { type: "string", required: true }, effort: { type: "number", renamedFrom: "hours" } })));
    const wrong = join(dir, "v2-wrong.json");
    writeFileSync(wrong, JSON.stringify(doc({ title: { type: "string", required: true }, effort: { type: "number", renamedFrom: "minutes" } })));
    expect(run(["check", "--document", right, "--previous", previous, "--json"]).code).toBe(0);
    const refused = run(["check", "--document", wrong, "--previous", previous, "--json"]);
    expect(refused.code).toBe(1);
    const finding = (JSON.parse(refused.out) as { findings: { code: string; path: string; message: string }[] }).findings.find((one) => one.code === "renamed-from-nothing");
    expect(finding?.path).toBe("kinds.chore.fields.effort.renamedFrom");
    expect(finding?.message).toMatch(/no field called minutes/);
  });
});


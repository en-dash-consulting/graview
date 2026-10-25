import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileDocument } from "@graview/core/check";
import { frictionEvent } from "@graview/core/friction";
import { learnFromUse } from "@graview/core/learn";
import { Store, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpAdapter } from "../../src/agent/adapters.js";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";
import { learn } from "../../src/cli.js";

/*
 * `graview learn` AND THE SEAT'S READ OF IT (Roadmap f-learned-suggestions):
 * what the app's own actor suggests changing in the app, read from the
 * store and the friction log beside it, printed with its edits — and
 * answered only by a person: a decline kept in learned.json, an accept
 * applied to a document entry through the editor. An agent lists them with
 * a read; a seat's context never carries them.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "wedding",
  kinds: { vendor: { noun: "vendor", plural: "vendors", fields: { name: { type: "string", required: true } } } },
  acts: { "add-vendor": { title: "Add a vendor", creates: "vendor" } },
};
const friction = ["ada", "bo", "cy"].map((id) => frictionEvent({ type: "search-miss", words: "supplier", kind: "vendor" }, { kind: "human", id })!);

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
  const code = await learn(argv);
  vi.restoreAllMocks();
  return { code, out, err };
}

describe("graview learn", () => {
  it("prints each suggestion with its edits and key, changing nothing; declined, it is not printed again; accepted, the document gains its edits", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-learn-"));
    const entry = join(root, "app.json");
    writeFileSync(entry, JSON.stringify(document));
    const data = join(root, "data");
    writeFileSync(join(root, "friction.json"), JSON.stringify({ events: friction }));
    const base = [entry, "--data", data, "--friction", join(root, "friction.json")];

    const listed = await run([...base, "--json"]);
    expect(listed.code).toBe(0);
    const { suggestions } = JSON.parse(listed.out) as { suggestions: { key: string; edits: unknown[] }[] };
    expect(suggestions).toMatchObject([{ key: "alias:vendor:supplier", edits: [{ op: "add-alias", kind: "vendor", alias: "supplier" }] }]);
    expect(JSON.parse(readFileSync(entry, "utf8"))).toEqual(document);

    const words = await run(base);
    expect(words.out).toMatch(/1\. Take “supplier” as another word for a vendor/);
    expect(words.out).toMatch(/key: alias:vendor:supplier/);

    const accepted = await run([...base, "--accept", "alias:vendor:supplier", "--as", "nick"]);
    expect(accepted.code).toBe(0);
    expect(JSON.parse(accepted.out)).toMatchObject({ key: "alias:vendor:supplier", lineage: { suggestion: "alias:vendor:supplier", actor: "learns from use" } });
    const written = JSON.parse(readFileSync(entry, "utf8"));
    expect(written.kinds.vendor.aliases).toEqual(["supplier"]);
    expect(compileDocument(written).ok).toBe(true);
    expect(JSON.parse(readFileSync(join(data, "wedding", "learned.json"), "utf8")).decisions).toMatchObject([{ key: "alias:vendor:supplier", answer: "accepted", by: { id: "nick" } }]);
  });

  it("a declined suggestion is kept beside the store and never printed again", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-learn-"));
    const entry = join(root, "app.json");
    writeFileSync(entry, JSON.stringify(document));
    writeFileSync(join(root, "friction.json"), JSON.stringify({ events: friction }));
    const base = [entry, "--data", join(root, "data"), "--friction", join(root, "friction.json")];
    expect((await run([...base, "--decline", "alias:vendor:supplier"])).code).toBe(0);
    expect(JSON.parse((await run([...base, "--json"])).out).suggestions).toEqual([]);
    expect((await run([...base, "--decline", "alias:vendor:supplier"])).code).toBe(1);
    expect(JSON.parse(readFileSync(entry, "utf8"))).toEqual(document);
  });
});

describe("the seat's read", () => {
  const compiled = compileDocument(document);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));

  it("lists list_app_suggestions only for a runtime handed what was learned, as a read", async () => {
    const store = new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations ?? [] });
    expect(createToolRuntime(store).definitions.some((tool) => tool.name === "list_app_suggestions")).toBe(false);
    const runtime = createToolRuntime(store, { learned: () => learnFromUse({ document: document as never, friction }) });
    const tool = runtime.definitions.find((one) => one.name === "list_app_suggestions");
    expect(tool).toMatchObject({ mutating: false, annotations: { readOnlyHint: true } });
    const answer = await createMcpAdapter(runtime).callTool("list_app_suggestions", {});
    expect(answer.isError).toBeFalsy();
    expect(JSON.parse(answer.content.map((part) => part.text).join(""))).toMatchObject({ data: { suggestions: [{ key: "alias:vendor:supplier", evidence: { people: 3, times: 3 } }] } });
    expect(toolDefinitions(compiled.app, { kind: "agent" }, { learned: true }).definitions.some((one) => one.name === "list_app_suggestions")).toBe(true);
  });
});

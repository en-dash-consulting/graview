import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, describe, expect, it, vi } from "vitest";
import { main } from "../../src/cli/index.js";
import { documentTypes } from "../../src/cli/types.js";
import { compileDocumentWithoutCheck } from "../../src/document/compile.js";
import type { GraviewDocument } from "../../src/document/schema.js";
import { Store } from "../../src/store.js";
import { typedReader } from "../../src/typed.js";

/**
 * TYPES FLOW FROM A DOCUMENT TO A FACE. n-dx's face read every record as
 * `{ id, kind } & Record<string, unknown>` and walked relations by bare
 * strings, so a renamed relation was a blank section. `graview types` writes
 * the document's kinds, fields and relations as TypeScript, and a product
 * that reads a store through them with `typedReader` stops compiling when a
 * field or relation it reads is renamed — which is the claim, compiled here
 * with tsc as a product compiles.
 */
const here = dirname(fileURLToPath(import.meta.url));
const typed = resolve(here, "../../src/typed.ts");
const tasks = JSON.parse(readFileSync(join(here, "fixtures/tasks.gdd.json"), "utf8")) as GraviewDocument;
const scratch = mkdtempSync(join(tmpdir(), "graview-types-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A face, as a product writes one over the generated types. */
const FACE = `
import { typedReader } from "@graview/core/typed";
import type { Task, Types } from "./document";

export function board(store: Parameters<typeof typedReader>[0]): string[] {
  const read = typedReader<Types>(store);
  return read.nodes("task").map((task: Task) => {
    const status: "todo" | "doing" | "done" = read.fieldOf(task, "status");
    const who = read.edgesOf(task, "assigned-to")[0]?.label ?? "nobody";
    return \`\${task.label} (\${status}) — \${who}\`;
  });
}
`;

/** Compiles the face against the types of a document, as a product's tsc would: what it says, by message. */
function compileFace(document: GraviewDocument, name: string): string[] {
  const dir = join(scratch, name);
  rmSync(dir, { recursive: true, force: true });
  ts.sys.createDirectory(dir);
  writeFileSync(join(dir, "document.d.ts"), documentTypes(document, "document.json"));
  writeFileSync(join(dir, "face.ts"), FACE);
  const program = ts.createProgram([join(dir, "face.ts")], {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
    paths: { "@graview/core/typed": [typed] },
  });
  return ts.getPreEmitDiagnostics(program).map((d) => `${d.file ? `${d.file.fileName.slice(dir.length + 1)}: ` : ""}${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
}

const renamed = (change: (document: any) => void): GraviewDocument => {
  const document = JSON.parse(JSON.stringify(tasks));
  change(document);
  return document;
};

describe("graview types", () => {
  it("writes each kind's record with its fields' own types, an enum's options as a union, and the kinds each relation reaches", () => {
    const text = documentTypes(tasks, "tasks.gdd.json");
    expect(text).toContain("export interface Task {");
    expect(text).toContain('readonly kind: "task";');
    expect(text).toContain("readonly label: string;");
    expect(text).toContain('readonly status: "todo" | "doing" | "done";');
    expect(text).toContain("readonly due?: string;");
    expect(text).toContain('readonly "assigned-to": "person";');
    expect(text).toContain("export type Types = { readonly kinds: Kinds; readonly edges: Edges };");
    expect(text).toContain("written by `graview types tasks.gdd.json`");
  });

  it("compiles a face that reads what the document declares", () => {
    expect(compileFace(tasks, "as-declared")).toEqual([]);
  }, 30_000);

  it("fails tsc in the face when a field it reads is renamed in the document", () => {
    const said = compileFace(
      renamed((d) => {
        d.kinds.task.fields.state = d.kinds.task.fields.status;
        delete d.kinds.task.fields.status;
      }),
      "field-renamed",
    );
    expect(said.join("\n")).toMatch(/face\.ts: Argument of type '"status"' is not assignable/);
  }, 30_000);

  it("fails tsc in the face when a relation it walks is renamed in the document", () => {
    const said = compileFace(
      renamed((d) => {
        d.kinds.task.edges.owner = d.kinds.task.edges["assigned-to"];
        delete d.kinds.task.edges["assigned-to"];
      }),
      "relation-renamed",
    );
    expect(said.join("\n")).toMatch(/face\.ts: Argument of type '"assigned-to"' is not assignable/);
  }, 30_000);

  it("fails tsc in the face when an option it names is taken out of an enum", () => {
    const said = compileFace(
      renamed((d) => (d.kinds.task.fields.status.options = ["todo", "doing", "finished"])),
      "option-renamed",
    );
    expect(said.join("\n")).toMatch(/face\.ts: Type '"todo" \| "doing" \| "finished"' is not assignable/);
  }, 30_000);

  it("writes the file a product commits with --out, and refuses a document that does not compile", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const complain = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const out = join(scratch, "cli", "document.d.ts");
      expect(await main(["types", join(here, "fixtures/tasks.gdd.json"), "--out", out])).toBe(0);
      expect(readFileSync(out, "utf8")).toBe(documentTypes(tasks, join(here, "fixtures/tasks.gdd.json").slice(process.cwd().length + 1)));
      expect(String(write.mock.calls.at(-1)?.[0])).toMatch(/wrote .*document\.d\.ts — 2 kinds and 1 relation/);
      const broken = join(scratch, "broken.json");
      writeFileSync(broken, JSON.stringify(renamed((d) => (d.kinds.task.fieldRoles = {}))));
      expect(await main(["types", broken])).toBe(1);
      expect(String(complain.mock.calls.at(-1)?.[0])).toContain('"fieldRoles" is not part of a Graview document here');
    } finally {
      write.mockRestore();
      complain.mockRestore();
    }
  });

  it("reads a store through the types: the records, their fields and the relations both ways", () => {
    const compiled = compileDocumentWithoutCheck(tasks);
    if (!compiled.ok) throw new Error("tasks does not compile");
    const store = new Store({
      schema: compiled.app.schema,
      snapshot: {
        nodes: [
          { id: "t1", kind: "task", label: "Paint the fence", status: "doing" },
          { id: "p1", kind: "person", label: "Ada" },
        ],
        edges: [{ id: "e1", kind: "assigned-to", from: "t1", to: "p1" }],
      } as never,
    });
    type Types = { kinds: { task: { readonly id: string; readonly kind: "task"; readonly label: string; readonly status: string }; person: { readonly id: string; readonly kind: "person"; readonly label: string } }; edges: { task: { "assigned-to": "person" }; person: {} } };
    const read = typedReader<Types>(store);
    const [task] = read.nodes("task");
    expect(read.fieldOf(task!, "status")).toBe("doing");
    expect(read.edgesOf(task!, "assigned-to").map((p) => p.label)).toEqual(["Ada"]);
    expect(read.inwardOf(read.node("p1", "person")!, "assigned-to").map((t) => t.label)).toEqual(["Paint the fence"]);
    expect(read.node("p1", "task")).toBeUndefined();
    expect(read.is(read.node("t1"), "task")).toBe(true);
  });
});

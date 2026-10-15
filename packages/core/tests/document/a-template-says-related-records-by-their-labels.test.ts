import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { resolveFor } from "../../src/describe.js";
import { Store, type AnySchema, type Principal } from "../../src/index.js";
import { parseTemplate, renderTemplate, shapesOfSchema } from "../../src/document/index.js";

/**
 * `| and` SAYS RECORDS BY THEIR LABELS, WHATEVER FIELD A LABEL READS.
 *
 * A review app's finding page said `{out('affects') | and}` as
 * "module:files, module:app-code and module:tsc", while
 * `{out('dependsOn') | and}` beside it said task titles. Both kinds
 * declare a label — `{path}` and `{title}` — and the formatter never read
 * either: it looked for a field called name, title or label, and said the
 * id when a record had none. A module's label reads its path.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/review.seed.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const compiled = compileDocument(review, { today: () => "2026-10-15" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
const app = compiled.app;
const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const finding = store.graph.getNode("f1")!;

describe("| and over related records", () => {
  it("says a module by its label, which reads its path, never by its id", () => {
    const page = resolveFor(store, owner, finding, { app });
    expect(page.find((block) => block.key === "affects")).toMatchObject({ t: "text", text: "src/files.ts, src/app.ts and tsconfig.json" });
  });

  it("says a task by its label too, as it did", () => {
    const page = resolveFor(store, owner, finding, { app });
    expect(page.find((block) => block.key === "depends")).toMatchObject({ t: "text", text: "Rotate the keys and Scrub the old logs" });
  });

  it("says them by their labels in a rule's sentence, which reads the graph's own schema", () => {
    const said = renderTemplate(parseTemplate("Found in {out('affects') | and}"), { node: finding, kinds: shapesOfSchema(app.schema as AnySchema), graph: store.graph, today: "2026-10-15" });
    expect(said).toBe("Found in src/files.ts, src/app.ts and tsconfig.json");
  });
});

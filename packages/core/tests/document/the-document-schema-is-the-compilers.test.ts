import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { documentJsonSchema, documentSchemaUrl } from "../../src/cli/document-schema.js";
import { readDocument } from "../../src/document/compile.js";
import { isGraviewTemplate } from "../../src/document/graview-template.js";

/**
 * THE DOCUMENT'S JSON SCHEMA IS THE COMPILER'S SHAPE. Generated from
 * `DocumentSpec` at build time (`@graview/core/document.schema.json`), so an
 * editor that reads a document's `$schema` says what `graview check` would:
 * every document the compiler reads validates, and a key the compiler
 * refuses — a kind's `roles`, which are its `fieldRoles`, among them — fails both.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const version = (JSON.parse(readFileSync(join(repo, "packages/core/package.json"), "utf8")) as { version: string }).version;
const schema = documentJsonSchema(version);
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

/** Every declaration document in the tree: core's fixtures, the studio's templates and the harnesses' — and n-dx's, as it shipped. */
const DIRS = ["packages/core/tests/document/fixtures", "packages/studio/tests/fixtures/templates", ...readdirSync(join(repo, "scripts/fixtures"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => `scripts/fixtures/${entry.name}`)];
const documents = DIRS.flatMap((dir) =>
  readdirSync(join(repo, dir))
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({ file: `${dir}/${file}`, json: JSON.parse(readFileSync(join(repo, dir, file), "utf8")) as Record<string, unknown> })),
)
  .map(({ file, json }) => ({ file, document: (isGraviewTemplate(json) ? json["document"] : json) as Record<string, unknown> }))
  .filter(({ document }) => document?.["format"] === "graview-document" && document["formatVersion"] === 1);

const compilerReads = (document: unknown) => readDocument(document).document !== undefined;
const schemaReads = (document: unknown) => validate(document) === true;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("the document's JSON Schema", () => {
  it("reads every document in the tree that the compiler reads", () => {
    const read = documents.filter(({ document }) => compilerReads(document));
    expect(read.length).toBeGreaterThan(15);
    expect(read.map(({ file }) => file)).toContain("packages/core/tests/document/fixtures/n-dx.gdd.json");
    for (const { file, document } of read) expect(schemaReads(document), `${file}: ${JSON.stringify(validate.errors?.slice(0, 3))}`).toBe(true);
  });

  it("reads a document's facts of the whole graph and a kind's field roles, as the compiler does", () => {
    const base = clone(documents.find(({ file }) => file.endsWith("/tasks.gdd.json"))!.document) as any;
    base.computed = { open: { expr: "count(all('task'))", label: "Open" }, any: "count(all('task')) > 0" };
    base.kinds.task.fieldRoles = { who: "label" };
    expect(compilerReads(base)).toBe(true);
    expect(schemaReads(base), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
  });

  it("refuses an unknown key wherever the compiler does — a kind's roles (its fieldRoles are the key), and one on a field, a relation, an act, a rule and the document", () => {
    const base = documents.find(({ file }) => file.endsWith("/tasks.gdd.json"))!.document;
    const unknown: [string, (d: any) => void][] = [
      ["a kind", (d) => (d.kinds.task.roles = { when: "label" })],
      ["a field", (d) => (d.kinds.task.fields.label.choices = ["a"])],
      ["a relation", (d) => (d.kinds.task.edges["assigned-to"].target = "person")],
      ["an act", (d) => (d.acts.assign.connect = "assigned-to")],
      ["the document", (d) => (d.relations = {})],
      ["a policy", (d) => (d.policy.grant = [])],
    ];
    expect(compilerReads(base) && schemaReads(base)).toBe(true);
    for (const [where, change] of unknown) {
      const changed = clone(base);
      change(changed);
      expect(compilerReads(changed), `the compiler, on ${where}`).toBe(false);
      expect(schemaReads(changed), `the schema, on ${where}`).toBe(false);
      expect(validate.errors?.some((error) => error.keyword === "additionalProperties"), where).toBe(true);
    }
  });

  it("refuses what the compiler's refinements refuse: no kinds, an enum without options, a field called id, a misspelled kind name", () => {
    const base = documents.find(({ file }) => file.endsWith("/tasks.gdd.json"))!.document;
    const wrong: [string, (d: any) => void][] = [
      ["no kinds", (d) => (d.kinds = {})],
      ["an enum without options", (d) => delete d.kinds.task.fields.status.options],
      ["options on a string", (d) => (d.kinds.task.fields.label.options = ["a"])],
      ["a field called id", (d) => (d.kinds.task.fields.id = { type: "string" })],
      ["a kind called Task", (d) => (d.kinds.Task = d.kinds.task)],
      ["a field type it does not have", (d) => (d.kinds.task.fields.label.type = "str")],
    ];
    for (const [what, change] of wrong) {
      const changed = clone(base);
      change(changed);
      expect(compilerReads(changed), `the compiler, on ${what}`).toBe(false);
      expect(schemaReads(changed), `the schema, on ${what}`).toBe(false);
    }
  });

  it("is named by a document's $schema, which the compiler reads past", () => {
    const base = clone(documents.find(({ file }) => file.endsWith("/tasks.gdd.json"))!.document);
    base["$schema"] = "./node_modules/@graview/core/dist/document.schema.json";
    expect(compilerReads(base)).toBe(true);
    expect(schemaReads(base)).toBe(true);
  });

  it("says the version it is the shape of, at the published file's own address", () => {
    expect(schema["$id"]).toBe(documentSchemaUrl(version));
    expect(schema["$id"]).toBe(`https://unpkg.com/@graview/core@${version}/dist/document.schema.json`);
    expect(String(schema["title"])).toContain(version);
    expect(schema["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");
  });
});

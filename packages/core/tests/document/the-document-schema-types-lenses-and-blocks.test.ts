import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { documentJsonSchema } from "../../src/cli/document-schema.js";
import { FIXTURES } from "../../src/conformance/fixtures.js";
import { BLOCK_KEYS } from "../../src/document/views.js";
import { SHIPPED_LENS_NAMES } from "../../src/places.js";

/**
 * A DOCUMENT'S LENSES AND VIEWS ARE TYPED FOR AN EDITOR. The schema said
 * `lenses` items were any object and a view's blocks any value, so an
 * editor offered nothing for a lens's name, its bindings, `options.blocks`
 * or a block's keys, and a misspelling surfaced only at `graview check`.
 * Now each lens is held to its name in `SHIPPED_LENSES` and the options
 * that lens takes, and every block — in a view, the home and a blocks lens
 * — to the block set `BLOCK_KEYS` names; and every example document in the
 * tree still validates.
 */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const schema = documentJsonSchema("0.0.0");
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

const isDocument = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && (value as { format?: unknown }).format === "graview-document";
/** Every document a file holds: itself, a template's document, or each of a list of them. */
const documentsIn = (json: unknown): Record<string, unknown>[] =>
  Array.isArray(json) ? json.flatMap(documentsIn) : isDocument(json) ? [json] : isDocument((json as { document?: unknown })?.document) ? [(json as { document: Record<string, unknown> }).document] : [];
const jsonFiles = (dir: string): string[] =>
  existsSync(join(repo, dir))
    ? readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? jsonFiles(`${dir}/${entry.name}`) : entry.name.endsWith(".json") ? [`${dir}/${entry.name}`] : []))
    : [];

const EXAMPLES = [
  ...["packages/core/tests/document/fixtures", "packages/studio/tests/fixtures/templates", "scripts/fixtures", "docs/site/recipes"].flatMap(jsonFiles),
  "apps/site/app.json",
].flatMap((file) => documentsIn(JSON.parse(readFileSync(join(repo, file), "utf8"))).map((document, at) => ({ where: `${file}#${at}`, document })));

const base = () =>
  ({
    format: "graview-document",
    formatVersion: 1,
    name: "Tasks",
    kinds: { task: { fields: { title: { type: "string", required: true }, due: { type: "date" }, status: { type: "enum", options: ["open", "done"] } } } },
  }) as Record<string, any>;
const errorsOf = (document: unknown) => (validate(document) ? [] : (validate.errors ?? []));

describe("the document schema types lenses and blocks", () => {
  it("validates every example document and fixture in the tree, and the conformance fixtures", () => {
    const conformance = FIXTURES.flatMap((fixture) => ("document" in fixture ? documentsIn(fixture.document).map((document) => ({ where: fixture.id, document })) : []));
    const all = [...EXAMPLES, ...conformance].filter(({ document }) => document["formatVersion"] === 1);
    expect(all.length).toBeGreaterThan(30);
    for (const { where, document } of all) expect(errorsOf(document).slice(0, 3), where).toEqual([]);
  });

  it("names the lenses Graview ships, and refuses a misspelled one", () => {
    const lens = (schema["properties"] as any).lenses.items;
    expect(lens.properties.name.enum).toEqual([...SHIPPED_LENS_NAMES]);
    const good = { ...base(), lenses: [{ name: "calendar", title: "Due", bindings: { task: { start: "due" } } }] };
    expect(errorsOf(good)).toEqual([]);
    const misspelled = { ...base(), lenses: [{ name: "calender", title: "Due", bindings: { task: { start: "due" } } }] };
    expect(errorsOf(misspelled).some((error) => error.instancePath === "/lenses/0/name")).toBe(true);
  });

  it("holds a lens's options to the ones that lens takes, and its bindings to roles bound to fields", () => {
    const option = { ...base(), lenses: [{ name: "calendar", title: "Due", bindings: { task: { start: "due" } }, options: { rang: "month" } }] };
    expect(errorsOf(option).some((error) => error.instancePath === "/lenses/0/options" && error.keyword === "additionalProperties")).toBe(true);
    const key = { ...base(), lenses: [{ name: "calendar", title: "Due", bindngs: { task: { start: "due" } } }] };
    expect(errorsOf(key).some((error) => error.params && (error.params as { additionalProperty?: string }).additionalProperty === "bindngs")).toBe(true);
    const binding = { ...base(), lenses: [{ name: "columns", title: "Board", bindings: { task: { column: 3 } } }] };
    expect(errorsOf(binding).length).toBeGreaterThan(0);
  });

  it("types a blocks lens's options.blocks and every view's blocks, and refuses a misspelled block or block key", () => {
    const blocksLens = (blocks: unknown[]) => ({ ...base(), lenses: [{ name: "blocks", title: "Summary", on: "task", options: { blocks } }] });
    expect(errorsOf(blocksLens([{ headline: "{count(all('task'))} tasks" }, { list: "all('task')", sort: { by: "due", direction: "asc" }, limit: 10, as: "row" }]))).toEqual([]);
    expect(errorsOf(blocksLens([{ headline: "x", tone: "good" }])).length).toBeGreaterThan(0);
    expect(errorsOf(blocksLens([{ headlin: "x" }])).length).toBeGreaterThan(0);

    const view = (card: unknown[]) => ({ ...base(), views: { task: { card }, home: [{ title: "Tasks" }] } });
    expect(errorsOf(view([{ title: "{title}" }, { badge: "{status}", tone: "good" }, { when: "status == 'done'", show: [{ divider: true }] }]))).toEqual([]);
    expect(errorsOf(view([{ titel: "{title}" }])).length).toBeGreaterThan(0);
    expect(errorsOf(view([{ badge: "{status}", tone: "green" }])).length).toBeGreaterThan(0);
    expect(errorsOf(view([{ field: "due", as: "date", shade: "red" }])).length).toBeGreaterThan(0);
    expect(errorsOf({ ...base(), views: { task: { cards: [{ title: "{title}" }] } } }).length).toBeGreaterThan(0);
  });

  it("says a shape for every block the checker knows", () => {
    const shapes = (schema["$defs"] as any).ViewBlock.anyOf as { required: string[] }[];
    expect(shapes.map((shape) => shape.required[0]).sort()).toEqual(Object.keys(BLOCK_KEYS).sort());
  });
});

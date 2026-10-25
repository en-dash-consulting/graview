import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument, designFindings } from "../../src/check.js";
import { ACCENT_PALETTE, accentFor, composeDesign, inferJobs, MOST_INFERRED_JOBS, type ComposeRecords } from "../../src/compose.js";
import { editDocument, readDocument, type GraviewDocument } from "../../src/document/index.js";
import { accentProblem, createSchema, defineApp, defineNode, z, type Brand } from "../../src/index.js";

/**
 * ONE DESIGN IS COMPOSED FROM THE DECLARATION, ITS JOBS AND ITS DATA (Roadmap
 * f-design-composer). An app looked generic until somebody told a model, over
 * and over, to make it usable and beautiful; a host's answer was a table from
 * field type to lens that only ever added. `inferJobs` guesses what people
 * come to do — conservatively, at most three — and `composeDesign` proposes
 * one whole design: those jobs where none are declared, the critic's own
 * edits, an accent where the brand has none. Applied, the document compiles
 * and the critic has no warning left.
 */
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as GraviewDocument;
const read = (raw: Record<string, unknown>): GraviewDocument => {
  const found = readDocument({ format: "graview-document", formatVersion: 1, ...raw });
  if (!found.document) throw new Error(JSON.stringify(found.findings));
  return found.document;
};
const warnings = (document: GraviewDocument) => designFindings(document).filter((finding) => finding.severity === "warning");
const errors = (document: GraviewDocument) => compileDocument(document).findings.filter((finding) => finding.severity === "error");
const applied = (document: GraviewDocument, edits: readonly unknown[]): GraviewDocument => {
  const outcome = editDocument(document, edits);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome.document;
};

const tasks = read({
  name: "Chores",
  kinds: {
    task: {
      fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["todo", "doing", "done", "canceled"], required: true, default: "todo" }, due: { type: "date" } },
      label: "{name}",
      edges: { owner: { to: ["person"], cardinality: "one" } },
    },
    person: { fields: { name: { type: "string", required: true } }, label: "{name}" },
  },
  acts: { finish: { title: "Finish", on: "task", sets: { status: "done" } } },
});

describe("inferring an app's jobs", () => {
  it("reads a choice that ends and the date a record is due by as a job, with the act that ends it", () => {
    expect(inferJobs(tasks)).toEqual([
      { name: "task-due-soon", ask: "Which tasks are due within a week and not yet done?", kind: "task", where: "not (status in ['done', 'canceled']) and days(today(), due) <= 7", sort: "due", act: "finish" },
    ]);
  });

  it("asks of the vendors what a couple asks: which are due soon and not yet booked", () => {
    const [job] = inferJobs(fixture("vendors.gdd.json"));
    expect(job).toMatchObject({ kind: "vendor", ask: "Which vendors are due within a week and not yet booked?", where: "not (status in ['booked', 'declined']) and days(today(), due) <= 7", sort: "due" });
  });

  it("reads a relation of one that many records lack as a job, only when it is handed the records", () => {
    const undated = read({ ...tasks, kinds: { ...tasks.kinds, task: { ...tasks.kinds["task"]!, fields: { name: { type: "string", required: true } } } }, acts: {} });
    expect(inferJobs(undated)).toEqual([]);
    const records: ComposeRecords = {
      nodes: [{ id: "p", kind: "person" }, ...["a", "b", "c", "d", "e"].map((id) => ({ id, kind: "task" }))],
      edges: [{ kind: "owner", from: "a", to: "p" }],
    };
    expect(inferJobs(undated, { records })).toEqual([{ name: "task-without-owner", ask: "Which tasks have no person?", kind: "task", where: "count(out('owner')) == 0", act: "connect-task-owner" }]);
    // One record waiting is not a hole in the data.
    expect(inferJobs(undated, { records: { ...records, edges: ["a", "b", "c", "d"].map((from) => ({ kind: "owner", from, to: "p" })) } })).toEqual([]);
  });

  it("reads a status whose first value a record waits at as a job, with the act allowed only there", () => {
    const requests = read({
      name: "Requests",
      kinds: { request: { fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["open", "accepted", "declined", "done"], required: true } }, label: "{name}" } },
      acts: { accept: { title: "Accept", on: "request", allowedWhen: "status == 'open'", sets: { status: "accepted" } } },
    });
    expect(inferJobs(requests)).toEqual([{ name: "request-still-open", ask: "Which requests are still open?", kind: "request", where: "status == 'open'", act: "accept" }]);
  });

  it("is conservative: nothing where the fields leave doubt, one job a kind, and never more than three", () => {
    expect(inferJobs(read({ name: "Notes", kinds: { note: { fields: { title: { type: "string" }, sort: { type: "enum", options: ["idea", "quote"] }, written: { type: "date" } } } } }))).toEqual([]);
    const many = read({ name: "Many", kinds: Object.fromEntries(["a", "b", "c", "d", "e"].map((kind) => [kind, tasks.kinds["task"]!])) as never });
    const jobs = inferJobs({ ...many, kinds: Object.fromEntries(Object.entries(many.kinds).map(([kind, spec]) => [kind, { ...spec, edges: {} }])) });
    expect(jobs).toHaveLength(MOST_INFERRED_JOBS);
    expect(new Set(jobs.map((job) => job.kind)).size).toBe(jobs.length);
  });
});

describe("composing one design", () => {
  it("proposes the inferred jobs only where the app declares none", () => {
    const composed = composeDesign(tasks);
    expect(composed.edits.filter((edit) => edit.op === "add-job")).toHaveLength(1);
    const declared = applied(tasks, [{ op: "add-job", job: { name: "mine", ask: "What's mine?", kind: "task" } }]);
    expect(composeDesign(declared).edits.filter((edit) => edit.op === "add-job")).toEqual([]);
  });

  it("gives an app with no accent one from the palette by its name, says so, and leaves a brand's own alone", () => {
    const composed = composeDesign(tasks);
    expect(composed.edits).toContainEqual({ op: "set-brand", accent: accentFor("Chores") });
    expect(composed.said.some((sentence) => sentence.includes(accentFor("Chores")) && sentence.includes("by its name"))).toBe(true);
    expect(accentFor("Chores")).toBe(accentFor("Chores"));
    const branded = applied(tasks, [{ op: "set-brand", accent: "#0f6e5c" }]);
    expect(composeDesign(branded).edits.some((edit) => edit.op === "set-brand")).toBe(false);
  });

  it("reads a TypeScript app as its document, its brand a color of its own", () => {
    const task = defineNode("task", { fields: z.object({ name: z.string(), status: z.enum(["todo", "done"]), due: z.string().optional() }), label: (node) => node.name });
    const app = defineApp({ name: "Chores", schema: createSchema([task]), mutations: [], brand: { name: "Chores", shape: { radius: 14 } } as Brand });
    expect(composeDesign(app).edits.some((edit) => edit.op === "set-brand")).toBe(false);
    expect(composeDesign({ ...app, brand: undefined }).edits).toContainEqual({ op: "set-brand", accent: accentFor("Chores") });
  });

  it("draws every color of the palette as a link reads on Graview's grounds", () => {
    expect(ACCENT_PALETTE.filter((accent) => accentProblem(accent) !== null)).toEqual([]);
  });

  it("carries the critic's own edits: a place that repeats another is removed, the main kind given a glance", () => {
    const board = { name: "columns", title: "Stage board", bindings: { feature: { column: "stage" } } };
    const roadmap = read({
      name: "Roadmap",
      kinds: {
        feature: { fields: { name: { type: "string", required: true }, summary: { type: "text" }, notes: { type: "text" }, stage: { type: "enum", options: ["considering", "building", "shipped"] } }, label: "{name}", edges: { partOf: { to: ["area"], cardinality: "one" } } },
        area: { fields: { name: { type: "string", required: true } }, label: "{name}" },
      },
      lenses: [board, { ...board, title: "Stages again" }],
      brand: { accent: "#0f6e5c" },
    });
    const composed = composeDesign(roadmap);
    expect(composed.edits).toEqual(expect.arrayContaining([{ op: "remove-lens", title: "Stages again" }, { op: "set-glance", kind: "feature", fields: ["stage"] }]));
    expect(composed.said.length).toBe(composed.edits.length);
  });

  /*
   * EVERY DOCUMENT WE HAVE: the fixtures, the apps' own and the ones the site
   * asks with — composed, applied in one change, compiled without an error,
   * and judged with no warning left.
   */
  const documents: [string, GraviewDocument, ComposeRecords | undefined][] = [];
  const fixtures = new URL("./fixtures/", import.meta.url);
  for (const name of readdirSync(fixtures).filter((file) => file.endsWith(".gdd.json"))) {
    const seed = new URL(name.replace(".gdd.json", ".seed.json"), fixtures);
    documents.push([name, fixture(name), existsSync(seed) ? (JSON.parse(readFileSync(seed, "utf8")) as ComposeRecords) : undefined]);
  }
  for (const template of JSON.parse(readFileSync(new URL("cloud-templates.json", fixtures), "utf8")) as { id: string; document: GraviewDocument }[]) documents.push([`template ${template.id}`, template.document, undefined]);
  const recipes = ["docs", "decisions", "dependencies"].map((name) => `../../../../docs/site/recipes/${name}/app.json`);
  for (const path of ["../../../../apps/site/app.json", "../../../../apps/site/asks/season/app.json", ...recipes]) documents.push([path.replace(/^(\.\.\/)+/, ""), JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as GraviewDocument, undefined]);

  for (const [name, document, records] of documents) {
    it(`leaves ${name} compiling, with nothing for the critic to warn of`, () => {
      const before = errors(document).length;
      const { edits, said } = composeDesign(document, records ? { records } : {});
      expect(said.length).toBeGreaterThanOrEqual(edits.length === 0 ? 0 : 1);
      const after = applied(document, edits);
      expect(errors(after).length).toBeLessThanOrEqual(before);
      if (before === 0) expect(errors(after)).toEqual([]);
      expect(warnings(after).map((finding) => `${finding.code}: ${finding.message}`)).toEqual([]);
    });
  }
});

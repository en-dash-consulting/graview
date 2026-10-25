import { describe, expect, it } from "vitest";
import { createSchema, defineApp, defineNode, z } from "../../src/index.js";
import { checkApp, compileDocument, designFindings } from "../../src/check.js";
import { editDocument, readDocument, sayFindings, type Finding, type GraviewDocument } from "../../src/document/index.js";

/**
 * THE CHECKER JUDGES THE LOOK (Roadmap f-design-critic). Nothing said an app
 * had too much: the Graview Roadmap app grew a "Stage board" and then four
 * "Stage: X" places showing one column of it each, and the advice that
 * proposed them only ever adds. `designFindings` says clutter, focus and
 * repetition as warnings — never errors, never notes — each with the edits
 * that fix it, removals included, and `graview check` says them beside the
 * rest. What the framework already derives well (a gallery home, a card
 * from a glance) is never flagged.
 */
const feature = {
  fields: {
    name: { type: "string", required: true },
    stage: { type: "enum", options: ["considering", "planned", "building", "shipped"], required: true, default: "considering" },
    layer: { type: "enum", options: ["framework", "cloud"] },
    summary: { type: "text", format: "markdown" },
  },
  label: "{name}",
  describe: "{stage}",
  glance: ["stage", "layer"],
  edges: { partOf: { to: ["area"], cardinality: "one" } },
};
const area = { fields: { name: { type: "string", required: true } }, label: "{name}" };
const slice = (stage: string) => ({ name: "blocks", on: "feature", title: `Stage: ${stage[0]!.toUpperCase()}${stage.slice(1)}`, options: { blocks: [{ headline: `{count(all('feature') where stage == '${stage}')} ${stage}` }, { as: "card", list: `all('feature') where stage == '${stage}'`, sort: { by: "name", direction: "asc" } }] } });
const board = { name: "columns", title: "Stage board", bindings: { feature: { column: "stage" } } };

const base = (more: Record<string, unknown> = {}): GraviewDocument => {
  const read = readDocument({ format: "graview-document", formatVersion: 1, name: "Roadmap", kinds: { feature, area }, ...more });
  if (!read.document) throw new Error(JSON.stringify(read.findings));
  return read.document;
};
const codes = (findings: readonly Finding[]) => findings.map((f) => f.code);
const only = (findings: readonly Finding[], code: string) => findings.filter((f) => f.code === code);

describe("the checker judges the look", () => {
  it("says nothing of an app with a few places, a derived home and cards that say more than their name", () => {
    expect(designFindings(base({ lenses: [board] }))).toEqual([]);
  });

  it("finds a board's columns shown again one place at a time, and removes the slices, keeping the board", () => {
    const document = base({ lenses: [board, slice("considering"), slice("planned"), slice("building"), slice("shipped")] });
    const [repeated, ...rest] = only(designFindings(document), "design-repeated-place");
    expect(rest).toEqual([]);
    expect(repeated).toMatchObject({ severity: "warning", path: "lenses.1" });
    expect(repeated!.message).toContain('"Stage board"');
    expect(repeated!.message).toContain('"Stage: Planned"');
    expect(repeated!.edits).toEqual(["Stage: Considering", "Stage: Planned", "Stage: Building", "Stage: Shipped"].map((title) => ({ op: "remove-lens", title })));
  });

  it("keeps the kind's own list where it is grouped by the field the slices split", () => {
    const document = base({ lenses: [slice("planned")], pages: { lists: { feature: { group: { by: "stage" } } } } });
    const [repeated] = only(designFindings(document), "design-repeated-place");
    expect(repeated!.message).toMatch(/the list of features/i);
    expect(repeated!.edits).toEqual([{ op: "remove-lens", title: "Stage: Planned" }]);
  });

  it("does not call a slice a repeat when nothing shows the whole split", () => {
    expect(only(designFindings(base({ lenses: [slice("planned"), slice("building")] })), "design-repeated-place")).toEqual([]);
  });

  it("finds two lenses bound the same way, and removes the later one", () => {
    const [repeated] = only(designFindings(base({ lenses: [board, { ...board, title: "Pipeline" }] })), "design-repeated-place");
    expect(repeated).toMatchObject({ path: "lenses.1", edits: [{ op: "remove-lens", title: "Pipeline" }] });
    expect(repeated!.message).toContain('"Stage board"');
  });

  it("applies the edits it carries, and the app they leave is not judged the same again", () => {
    const document = base({ lenses: [board, slice("considering"), slice("planned"), { ...board, title: "Pipeline" }] });
    const edits = designFindings(document).flatMap((f) => f.edits ?? []);
    const edited = editDocument(document, edits as never);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(codes(designFindings(edited.document))).not.toContain("design-repeated-place");
  });

  it("counts more places than the bar and its More hold, and hides the least specific by name, never one pages.primary stands up", () => {
    const pictures = Array.from({ length: 12 }, (_, i) => ({ name: "blocks", on: "feature", title: `Picture ${i + 1}`, options: { blocks: [{ as: "row", list: i % 2 ? `all('feature') where stage == 'shipped' and name != 'x${i}'` : `all('feature') | (all('area') where name != 'x${i}')` }] } }));
    const document = base({ lenses: [board, ...pictures], pages: { primary: ["Picture 12"] } });
    const [many] = only(designFindings(document), "design-too-many-places");
    // 2 lists and 13 pictures: 15 places, 3 past the 12 a person scans.
    expect(many).toMatchObject({ severity: "warning", path: "lenses" });
    expect(many!.message).toContain("15 places");
    expect(many!.edits).toHaveLength(3);
    for (const edit of many!.edits!) expect(edit).toMatchObject({ op: "set-lens-hidden", hidden: true });
    const hidden = many!.edits!.map((edit) => edit["title"]);
    // A slice of the split the board shows goes before a picture of several kinds; the board, and what primary names, stay.
    expect(hidden).toEqual(["Picture 10", "Picture 8", "Picture 6"]);
    expect(hidden).not.toContain("Stage board");
    expect(many!.fix).toContain('"Picture 10"');
  });

  it("hides a kind's bare list before the board that shows every one of them, and the edit applies", () => {
    const more = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`extra${i}`, { fields: { name: { type: "string", required: true } } }]));
    const document = base({ kinds: { feature, area, ...more }, lenses: [board] });
    const [many] = only(designFindings(document), "design-too-many-places");
    expect(many!.message).toContain("13 places");
    expect(many!.edits).toEqual([{ op: "set-lens-hidden", title: "feature", hidden: true }]);
    expect(many!.fix).toContain("the list of features");
    const edited = editDocument(document, many!.edits as never);
    if (!edited.ok) throw new Error(JSON.stringify(edited.findings));
    expect(edited.document.pages?.hide).toEqual(["feature"]);
    expect(only(designFindings(edited.document), "design-too-many-places")).toEqual([]);
  });

  it("asks a declared home for one headline: one written where there is none, a second said as words", () => {
    const none = only(designFindings(base({ views: { home: [{ text: "Hello" }, { as: "card", list: "all('feature')" }] } })), "design-home-unfocused")[0]!;
    expect(none.path).toBe("views.home");
    expect(none.edits).toEqual([{ op: "set-home", blocks: [{ headline: "{count(all('feature')) | words | capital} features" }, { text: "Hello" }, { as: "card", list: "all('feature')" }] }]);
    const two = only(designFindings(base({ views: { home: [{ headline: "One" }, { headline: "Two" }] } })), "design-home-unfocused")[0]!;
    expect(two.message).toContain("2 headlines");
    expect(two.edits).toEqual([{ op: "set-home", blocks: [{ headline: "One" }, { text: "Two" }] }]);
    expect(only(designFindings(base({ views: { home: [{ headline: "One" }, { group: [{ figure: "1", emphasis: "large" }, { figure: "2", emphasis: "large" }], direction: "row" }] } })), "design-home-unfocused")).toEqual([]);
  });

  it("finds a card that says only its name and a describe that says it again, and hands each back to what is derived", () => {
    const findings = designFindings(base({ kinds: { feature: { ...feature, describe: "{name}" }, area }, views: { feature: { card: [{ title: "{name}" }] } } }));
    const repeats = only(findings, "design-card-repeats-title");
    expect(repeats.map((f) => f.path).sort()).toEqual(["kinds.feature.describe", "views.feature.card"]);
    expect(repeats.flatMap((f) => f.edits)).toEqual(expect.arrayContaining([{ op: "set-view", kind: "feature", slot: "card", blocks: null }, { op: "set-describe", kind: "feature", describe: null }]));
  });

  it("finds an id shown where a person reads, and says the record by its name instead", () => {
    const findings = designFindings(base({ kinds: { feature: { ...feature, describe: "{partOf.id} · {stage}" }, area }, views: { feature: { card: [{ title: "{name}" }, { text: "#{id}" }, { badge: "{stage}" }] } } }));
    const raw = only(findings, "design-raw-value");
    expect(raw.find((f) => f.path === "kinds.feature.describe")?.edits).toEqual([{ op: "set-describe", kind: "feature", describe: "{partOf} · {stage}" }]);
    expect(raw.find((f) => f.path === "views.feature.card.1")?.message).toMatch(/id/);
  });

  it("finds the main kind with no card and no glance, when its derived card would pick by declaration order", () => {
    const busy = { fields: { name: { type: "string", required: true }, notes: { type: "text" }, code: { type: "string" }, due: { type: "date" }, status: { type: "enum", options: ["open", "done"] } }, label: "{name}", edges: { area: { to: ["area"] } } };
    const document = base({ kinds: { task: busy, area }, lenses: [{ name: "columns", title: "Board", bindings: { task: { column: "status" } } }] });
    const [main] = only(designFindings(document), "design-no-card-for-main-kind");
    expect(main).toMatchObject({ path: "kinds.task.glance", edits: [{ op: "set-glance", kind: "task", fields: ["status", "due", "code"] }] });
    expect(only(designFindings(base({ kinds: { task: { ...busy, glance: ["status"] }, area }, lenses: document.lenses })), "design-no-card-for-main-kind")).toEqual([]);
    expect(only(designFindings(base({ kinds: { task: { ...busy, fields: { name: busy.fields.name, status: busy.fields.status } }, area }, lenses: document.lenses })), "design-no-card-for-main-kind")).toEqual([]);
  });

  it("is said by graview check as warnings that never fail it, the edits beside the words", () => {
    const document = base({ lenses: [board, slice("planned")] });
    const compiled = compileDocument(document, { today: () => "2026-10-24" });
    expect(compiled.ok).toBe(true);
    const repeated = only(compiled.findings, "design-repeated-place");
    expect(repeated).toHaveLength(1);
    expect(compiled.findings.filter((f) => f.code.startsWith("design-") || f.code.startsWith("check:design-")).every((f) => f.severity === "warning" && !f.code.startsWith("check:"))).toBe(true);
    expect(sayFindings(repeated)).toContain('{"op":"remove-lens","title":"Stage: Planned"}');
  });

  it("is said of a TypeScript app by checkApp, with its edits", () => {
    const Task = defineNode("task", { fields: z.object({ title: z.string().min(1).max(80), status: z.enum(["open", "done"]) }) });
    const schema = createSchema([Task]);
    const app = defineApp({
      name: "tasks",
      schema,
      lenses: [
        { name: "columns", title: "By status", bindings: { task: { column: "status" } } },
        { name: "columns", title: "Status board", bindings: { task: { column: "status" } } },
      ],
    } as never);
    const result = checkApp(app);
    const repeated = result.findings.find((f) => f.code === "design-repeated-place");
    expect(repeated).toMatchObject({ severity: "warning", edits: [{ op: "remove-lens", title: "Status board" }] });
    expect(result.ok).toBe(true);
  });

  it("leaves a job's two findings to the jobs it is handed, and says nothing of them without any", () => {
    const document = base({ lenses: [board] });
    expect(designFindings(document, { jobs: [] })).toEqual([]);
    const homed = base({ lenses: [board], views: { home: [{ headline: "{count(all('feature'))} features" }] } });
    const said = designFindings(homed, { jobs: [{ name: "unfiled", ask: "Which areas have nothing in them?", kind: "area" }] });
    expect(codes(said)).toEqual(expect.arrayContaining(["design-job-unanswered", "design-place-for-no-job"]));
  });

  it("counts a job answered by the derived home, which opens on the jobs, and says it only of a declared home that lists none of its records", () => {
    const job = { name: "unplaced", ask: "Which features have no area?", kind: "feature", where: "count(out('partOf')) == 0", sort: "name" };
    const derived = base({ purpose: { jobs: [job] } });
    expect(only(designFindings(derived), "design-job-unanswered")).toEqual([]);

    const homed = base({ purpose: { jobs: [job] }, views: { home: [{ headline: "{count(all('feature'))} features" }] } });
    const [unanswered] = only(designFindings(homed), "design-job-unanswered");
    expect(unanswered).toMatchObject({ severity: "warning", path: "purpose.jobs.0" });
    expect(unanswered!.edits).toEqual([
      {
        op: "set-home",
        blocks: [
          { headline: "{count(all('feature'))} features" },
          { title: "Which features have no area?" },
          { list: "all('feature') where (count(out('partOf')) == 0)", as: "row", limit: 5, empty: "Nothing right now.", sort: { by: "name", direction: "asc" } },
        ],
      },
    ]);
    const answered = editDocument(homed, unanswered!.edits!);
    if (!answered.ok) throw new Error(JSON.stringify(answered.findings));
    expect(only(designFindings(answered.document), "design-job-unanswered")).toEqual([]);
    expect(compileDocument(answered.document).findings.filter((f) => f.severity === "error")).toEqual([]);
  });
});

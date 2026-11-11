import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Store } from "../../src/index.js";
import { questionAsked, readGraviewTemplate, TEMPLATE_QUESTION_TYPES } from "../../src/document/index.js";
import { instantiateTemplate, templateFindings } from "../../src/check.js";
import { create, type CreateIo } from "../../src/cli/create.js";
import { main } from "../../src/cli/index.js";

/**
 * THE TEMPLATE FORMAT, AS GRAVIEW CLOUD WRITES IT NOW (HQ feature
 * f-template-format-cloud-additions): a `time` question, `${id}` where a
 * letter follows the answer in setup words, and the views a template comes
 * with — `views`, curated from chats, beside `frameViews`. Held against a
 * Thanksgiving-shaped template written in those shapes.
 */
const fixture = resolve(import.meta.dirname, "fixtures/thanksgiving-dinner.template.json");
const raw = JSON.parse(readFileSync(fixture, "utf8")) as Record<string, unknown> & { setup: { act: string; args: Record<string, unknown> }[]; questions: { id: string; ask: string }[]; views: unknown[] };
const copy = () => JSON.parse(JSON.stringify(raw)) as typeof raw;
const made = (template: unknown, answers: Record<string, unknown> = {}) => {
  const result = instantiateTemplate(template, answers, { today: () => "2026-11-11" });
  if (!result.ok) throw new Error(result.findings.map((f) => `${f.path}: ${f.message}`).join("\n"));
  return result;
};

describe("a template in Graview Cloud's shapes", () => {
  it("round-trips through the reader unchanged: its time question, ${id} words and views kept as written", () => {
    const read = readGraviewTemplate(raw);
    if (!read.ok) throw new Error(JSON.stringify(read.findings));
    expect(JSON.parse(JSON.stringify(read.template))).toEqual(raw);
    expect(TEMPLATE_QUESTION_TYPES).toContain("time");
    expect(templateFindings(raw)).toEqual([]);
  });

  it("reads a time question's answer as HH:MM, from 3 PM or 15:00, and refuses one that is none", () => {
    expect(made(raw, { dinnerTime: "3:30 pm" }).answers["dinnerTime"]).toBe("15:30");
    expect(made(raw).answers["dinnerTime"]).toBe("15:00");
    const refused = instantiateTemplate(raw, { dinnerTime: "after the game" });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.findings.map((f) => f.message)).toEqual(['"dinnerTime" needs a time of day, like 15:00 or 3 PM — "after the game" is not one']);
  });

  it("reads ${id} into setup words where a letter follows the answer, and $id as the answer itself", () => {
    const { setup } = made(raw, { date: "2026-11-26", dinnerTime: "4 PM", host: "The Parkers", households: ["The Lees", "the parkers"] });
    const moments = setup.filter((call) => call.name === "add-moment").map((call) => call.args["at"]);
    expect(moments).toEqual(["2026-11-26T09:30:00", "2026-11-26T12:00:00", "2026-11-26T16:00:00", "2026-11-26T17:15:00"]);
    // A household asked twice is made once; a time answer set where the record keeps a time of day.
    expect(setup.filter((call) => call.name === "add-household").map((call) => call.args["name"])).toEqual(["The Parkers", "The Lees"]);
    expect(setup.find((call) => call.name === "add-dish" && call.args["name"] === "Roast turkey")?.args["ready"]).toBe("16:00");
  });

  it("sets a store up, the day's times on the date asked and a dish's time of day kept as one", () => {
    const result = made(raw, { date: "2026-11-26", dinnerTime: "15:00" });
    const app = result.compiled.app;
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [] });
    const author = { kind: "system" as const, id: "template:thanksgiving-dinner" };
    for (const call of result.setup) store.apply({ name: call.name, args: call.args }, { author, batch: "setup" });
    expect(store.graph.nodesOfKind("moment").map((n) => n["at"])).toContain("2026-11-26T15:00:00");
    expect(store.graph.nodesOfKind("dish").find((n) => n["name"] === "Roast turkey")?.["ready"]).toBe("15:00");
  });

  it("asks a question with the earlier answers its ${id} names", () => {
    expect(questionAsked({ ask: "Who is coming to ${place}?" }, { place: "our place" })).toBe("Who is coming to our place?");
    expect(questionAsked({ ask: "Bring something to ${place}" }, {})).toBe("Bring something to ");
  });
});

describe("graview check of a template", () => {
  it("refuses a setup word naming an id the template does not have, in either spelling", () => {
    const t = copy();
    t.setup.push({ act: "add-moment", args: { name: "Grace", at: "${date}T${grace}:00" } }, { act: "add-dish", args: { name: "$dish", course: "side" } });
    const findings = templateFindings(t);
    expect(findings.map((f) => [f.path, f.message.split(";")[0]])).toEqual([
      ["setup.9.args", '"$grace" is not one of the questions'],
      ["setup.10.args", '"$dish" is not one of the questions'],
    ]);
  });

  it("refuses a question naming an id the template does not have, or one asked after it", () => {
    const t = copy();
    t.questions[1]!.ask = "Is ${place} where ${guestCount} people fit?";
    const findings = templateFindings(t);
    expect(findings.map((f) => [f.path, f.message])).toEqual([
      ["questions.1.ask", '"${place}" is asked after this one, so its answer is not known yet'],
      ["questions.1.ask", '"${guestCount}" is not one of the questions'],
    ]);
  });

  it("refuses a view naming a kind, a relation or an act the document lacks, and two views of one name", () => {
    const t = copy();
    t.views.push({ name: "thanksgiving-album", attach: "photo", cardinality: "many", reads: { kinds: ["guest"], edges: ["takenBy"] }, acts: ["tag-photo"] });
    (t as Record<string, unknown>)["frameViews"] = [{ name: "seating", kind: "table", cardinality: "many" }];
    expect(templateFindings(t).map((f) => f.path)).toEqual(["frameViews.0.kind", "views.2.attach", "views.2.reads.kinds.0", "views.2.reads.edges.0", "views.2.acts.0"]);
    const twice = copy();
    twice.views.push({ ...(twice.views[0] as object) });
    expect(templateFindings(twice).map((f) => f.message)).toEqual(['two views are called "thanksgiving-home"']);
  });

  it("is what graview check says of a template file, and exits 1 on it", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "graview-check-template-"));
    try {
      const t = copy();
      t.setup.push({ act: "add-dish", args: { name: "$dish", course: "side" } });
      const file = join(scratch, "template.json");
      writeFileSync(file, JSON.stringify(t));
      const out: string[] = [];
      const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (out.push(String(chunk)), true));
      let code: number;
      try {
        code = await main(["check", file]);
      } finally {
        spy.mockRestore();
      }
      expect(code).toBe(1);
      expect(out.join("")).toContain('"$dish" is not one of the questions');
      writeFileSync(file, JSON.stringify(raw));
      const clean: string[] = [];
      const again = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => (clean.push(String(chunk)), true));
      try {
        expect(await main(["check", file])).toBe(0);
      } finally {
        again.mockRestore();
      }
      expect(clean.join("")).not.toContain("✗");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe("graview create --template, with views", () => {
  let scratch: string;
  let cwd: string;
  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "graview-create-views-"));
    cwd = process.cwd();
    process.chdir(scratch);
  });
  afterEach(() => {
    process.chdir(cwd);
    rmSync(scratch, { recursive: true, force: true });
  });

  it("writes each view found beside the template, its manifest with it, and says which were left out", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const io: CreateIo = { stdout: (t) => void out.push(t), stderr: (t) => void err.push(t), run: () => true, ask: () => undefined };
    expect(await create(["dinner", "--template", fixture, "--no-install", "--no-git"], io)).toBe(0);
    expect(err.join("")).toBe("");
    expect(readFileSync(join(scratch, "dinner/views/thanksgiving-home.js"), "utf8")).toContain("graview.onProps");
    expect(JSON.parse(readFileSync(join(scratch, "dinner/views/thanksgiving-home.manifest.json"), "utf8"))).toMatchObject({ name: "thanksgiving-home", attach: "home", acts: ["confirm-dish"] });
    expect(existsSync(join(scratch, "dinner/views/thanksgiving-day.js"))).toBe(false);
    expect(JSON.parse(readFileSync(join(scratch, "dinner/template.json"), "utf8"))).toEqual(raw);
    expect(out.join("")).toContain("It comes with a view, in views/: thanksgiving-home.");
    expect(out.join("")).toContain("thanksgiving-day (views/thanksgiving-dinner/thanksgiving-day.js)");
  });
});

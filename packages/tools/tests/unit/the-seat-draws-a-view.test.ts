import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { placesOf, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import type { GraviewDocument } from "@graview/core/document";
import { todoApp } from "../../../../apps/todo/src/domain/app.js";
import { createSeedbedStore, seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";
import {
  draftSight,
  draftView,
  isDraftFailure,
  refineDraft,
  templateDraft,
  withReaderLenses,
  type DraftResult,
  type SeatDraft,
} from "../../src/draft.js";
import { keepLens, takeBackLens } from "../../src/keep.js";

/*
 * THE SEAT DRAWS A VIEW ON THE FLY, AND KEEPS IT AS A LENS. Asked for a way
 * of seeing, it drafts a shipped lens bound to the app's own fields — no
 * model, no key — or, given a model, judges what the model wrote exactly as
 * a declared lens is judged. Kept, the draft is the add-lens edit, checked;
 * taken back, the remove-lens edit.
 */

const workshop = JSON.parse(readFileSync(new URL("../../../../scripts/fixtures/desk-bar/workshop.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const compiled = compileDocument(workshop);
if (!compiled.ok) throw new Error(`the workshop does not compile: ${compiled.findings.map((finding) => finding.message).join("; ")}`);
const workshopApp = compiled.app;

const todo = todoApp as unknown as GraviewApp;
const seedbed = seedbedApp as unknown as GraviewApp;

function drafted(result: DraftResult | undefined): SeatDraft {
  if (!result) throw new Error("no template read the ask");
  if (isDraftFailure(result)) throw new Error(result.failed);
  return result;
}

describe("a template draws from the declaration, with no model", () => {
  it("draws a board of tasks by a choice as columns on that choice — and the workshop's decisions by status", () => {
    const decisions = drafted(templateDraft("a board of decisions by status", { app: workshopApp }));
    expect(decisions.lens).toMatchObject({ name: "columns", on: "decision", bindings: { decision: { column: "status" } } });
    expect(decisions.title).toBe("Decisions by status");
    expect(decisions.said).toBe("A board of decisions by status.");
    expect(decisions.by).toBe("template");
    expect(decisions.drawn.lens).toBe("columns");
    expect(decisions.edit).toEqual({ op: "add-lens", title: "Decisions by status", lens: "columns", on: "decision", bindings: { decision: { column: "status" } } });

    const plantings = drafted(templateDraft("plantings by status", { app: seedbed }));
    expect(plantings.lens).toMatchObject({ name: "columns", bindings: { planting: { column: "status" } } });
  });

  it("draws a timeline of dates as a calendar on the date a kind declares, and the week as a timeline on its roles", () => {
    const dates = drafted(templateDraft("a timeline of dates", { app: todo }));
    expect(dates.lens).toMatchObject({ name: "calendar", on: "task", bindings: { task: { start: "due", done: "done" } } });

    const sown = drafted(templateDraft("a calendar of plantings", { app: seedbed }));
    expect(sown.lens).toMatchObject({ name: "calendar", on: "planting", bindings: { planting: { start: "sown", end: "harvested" } } });

    const week = drafted(templateDraft("a timeline of tasks", { app: todo }));
    expect(week.lens).toMatchObject({ name: "timeline", bindings: { task: { start: "plannedAt", end: "plannedUntil", column: "day" } } });
  });

  it("draws who covers what as a coverage grid over the relation that joins two kinds", () => {
    const covers = drafted(templateDraft("who covers what", { app: seedbed }));
    expect(covers.lens).toMatchObject({ name: "coverage", on: "plot", bindings: { rows: { kind: "plot" }, columns: { kind: "gardener" }, link: { edge: "tended-by" } } });
    expect(covers.title).toBe("Plots by gardener");
  });

  it("draws a list grouped by a choice from blocks, the vocabulary a document's views are written in", () => {
    const list = drafted(templateDraft("a list of decisions grouped by status", { app: workshopApp }));
    expect(list.lens.name).toBe("blocks");
    expect(list.lens.options).toEqual({ blocks: [{ list: "all('decision')", as: "row", group: "status", empty: "Nothing here yet." }] });
  });

  it("says in one line why an ask cannot be drawn, naming what is missing: the workshop's dates have no date field", () => {
    const result = templateDraft("a timeline of dates", { app: workshopApp });
    expect(result && isDraftFailure(result) ? result.failed : "").toBe("Couldn't draw that: no date field on dates.");
    const board = templateDraft("a board of deliverables by status", { app: workshopApp });
    expect(board && isDraftFailure(board) ? board.failed : "").toBe("Couldn't draw that: deliverables have no choice field to put in columns.");
  });

  it("reads no way of seeing in an ask that names none, and leaves it to a model", () => {
    expect(templateDraft("what is the meaning of this", { app: todo })).toBeUndefined();
  });

  it("gives a draft a title no place already has", () => {
    const again = { ...todo, lenses: [...(todo.lenses ?? []), { name: "calendar", title: "Tasks by month", bindings: { task: { start: "due" } } }] } as GraviewApp;
    expect(drafted(templateDraft("a calendar of tasks", { app: again })).title).toBe("Tasks by month 2");
  });
});

describe("a draft binds only what the seat may see", () => {
  const hidden = {
    ...seedbed,
    policy: { roles: ["visitor"], grants: [], sees: [{ roles: ["visitor"], kinds: ["plot", "planting", "rotation", "rule"] }] },
  } as unknown as GraviewApp;
  const sight = draftSight(hidden, { kind: "human", id: "v", roles: ["visitor"] });

  it("narrows the kinds by the policy's sights", () => {
    expect(sight.kinds).not.toContain("gardener");
    expect(draftSight(hidden, { kind: "system" } as never).kinds).toContain("gardener");
  });

  it("does not draw who covers what across a kind the seat may not see, and never names it", () => {
    const result = templateDraft("who tends what", { app: hidden, sight });
    expect(result && !isDraftFailure(result) ? JSON.stringify(result.lens) : "").not.toContain("gardener");
    if (result && isDraftFailure(result)) expect(result.failed).not.toContain("gardener");
  });

  it("refuses a model's lens over a hidden kind as one over a kind that does not exist", async () => {
    const complete = async () => JSON.stringify({ title: "Gardeners", lens: "blocks", on: "gardener", options: { blocks: [{ list: "all('gardener')" }] } });
    const result = await draftView("the gardeners as cards", { app: hidden, sight, complete });
    expect(isDraftFailure(result) ? result.failed : "").toBe("Couldn't draw that: Nothing by that name here.");
  });
});

describe("a model writes the same JSON, and it is judged before it is drawn", () => {
  it("draws what a template does not read when the model's lens holds", async () => {
    const prompts: string[] = [];
    const complete = async (prompt: string) => {
      prompts.push(prompt);
      return 'Here it is: {"title": "Open decisions", "lens": "blocks", "on": "decision", "options": {"blocks": [{"headline": "What is still open"}, {"list": "all(\'decision\') where status == \'open\'", "as": "card"}]}}';
    };
    const result = drafted(await draftView("what still needs deciding", { app: workshopApp, complete }));
    expect(result.by).toBe("model");
    expect(result.lens.name).toBe("blocks");
    expect(result.edit.op).toBe("add-lens");
    expect(prompts[0]).toContain("decision (\"decisions\")");
  });

  it("asks no model when a template reads the ask", async () => {
    let asked = 0;
    const result = drafted(await draftView("a board of decisions by status", { app: workshopApp, complete: async () => (asked++, "{}") }));
    expect(asked).toBe(0);
    expect(result.by).toBe("template");
  });

  it("refuses a lens the model made up, a field that is not there, and blocks that do not hold, in one line each — and keeps the last good draft", async () => {
    const good = drafted(templateDraft("a board of decisions by status", { app: workshopApp }));
    const answers = [
      '{"title": "Spiral", "lens": "spiral", "on": "decision"}',
      '{"title": "By owner", "lens": "columns", "on": "decision", "bindings": {"decision": {"column": "owner"}}}',
      '{"title": "Broken", "lens": "blocks", "on": "decision", "options": {"blocks": [{"list": "all(\'decision\') where nonsense ==", "as": "row"}]}}',
      "I cannot draw that.",
      '{"failed": "the workshop records no owners"}',
    ];
    for (const answer of answers) {
      const result = await draftView("something new", { app: workshopApp, complete: async () => answer, lastGood: good });
      expect(isDraftFailure(result)).toBe(true);
      if (!isDraftFailure(result)) continue;
      expect(result.failed).toMatch(/^Couldn't draw that: [^\n]+\.$/);
      expect(result.lastGood).toBe(good);
    }
    const said = await draftView("something new", { app: workshopApp, complete: async () => answers[4]!, lastGood: good });
    expect(isDraftFailure(said) ? said.failed : "").toBe("Couldn't draw that: the workshop records no owners.");
  });

  it("says plainly that a free ask needs a model when there is none", async () => {
    const result = await draftView("what is the meaning of this", { app: todo });
    expect(isDraftFailure(result) ? result.failed : "").toMatch(/needs AI, which isn.t on here/);
  });
});

describe("refining a draft by asking again", () => {
  it("groups by another choice, keeps to a window of dates, turns into another lens and takes a name", async () => {
    const board = drafted(await draftView("plantings by status", { app: seedbed }));
    const asCalendar = drafted(await refineDraft(board, "as a calendar", { app: seedbed }));
    expect(asCalendar.lens.name).toBe("calendar");
    expect(asCalendar.asks).toEqual(["plantings by status", "as a calendar"]);

    const month = drafted(await refineDraft(asCalendar, "only this week", { app: seedbed }));
    expect(month.lens.options).toEqual({ range: "week" });

    const tasks = drafted(await draftView("a board of tasks by day", { app: todo }));
    expect(tasks.lens).toMatchObject({ name: "columns", bindings: { task: { column: "day" } } });
    const soon = drafted(await refineDraft(tasks, "only this month", { app: todo }));
    expect(soon.lens.name).toBe("blocks");
    const list = (soon.lens.options!["blocks"] as Record<string, unknown>[])[0]!;
    expect(list["group"]).toBe("day");
    expect(list["list"]).toBe("all('task') where days(today(), due) >= 0 and days(today(), due) <= 30");

    const named = drafted(await refineDraft(soon, "call it The next month", { app: todo }));
    expect(named.title).toBe("The next month");
    expect(named.edit.title).toBe("The next month");
  });

  it("groups by a relation as who covers what, and refuses a name the kind does not have, keeping the draft", async () => {
    const plots = drafted(await draftView("a list of plots", { app: seedbed }));
    const byGardener = drafted(await refineDraft(plots, "group by gardener", { app: seedbed }));
    expect(byGardener.lens.name).toBe("coverage");

    const refused = await refineDraft(byGardener, "group by shade", { app: seedbed });
    expect(isDraftFailure(refused) ? refused.failed : "").toBe("Couldn't change that: plots have nothing called shade to group by.");
    expect(isDraftFailure(refused) ? refused.lastGood : undefined).toBe(byGardener);
  });

  it("hands a refinement no template reads to the model, with the draft on screen", async () => {
    const board = drafted(await draftView("a board of decisions by status", { app: workshopApp }));
    let prompt = "";
    const complete = async (asked: string) => {
      prompt = asked;
      return '{"title": "Decisions by status", "lens": "blocks", "on": "decision", "options": {"blocks": [{"list": "all(\'decision\')", "group": "status", "as": "card"}]}}';
    };
    const result = drafted(await refineDraft(board, "make it look friendlier", { app: workshopApp, complete }));
    expect(prompt).toContain('"name":"columns"');
    expect(result.asks).toEqual(["a board of decisions by status", "make it look friendlier"]);
  });
});

describe("keeping a draft as a lens", () => {
  it("adds it to a document app through editDocument, compileDocument and diffDocuments, and takes it back", async () => {
    const draft = drafted(templateDraft("a board of decisions by status", { app: workshopApp }));
    const kept = await keepLens({ document: workshop }, draft.edit);
    if (!kept.ok) throw new Error(kept.failed);
    expect(kept.said).toBe("Adds “Decisions by status” to the places.");
    expect(kept.sentences).toContain('A lens "Decisions by status" is added.');
    expect(kept.document!.lenses).toHaveLength((workshop.lenses?.length ?? 0) + 1);
    expect(compileDocument(kept.document!).ok).toBe(true);
    expect(placesOf(kept.app).map((place) => place.title)).toContain("Decisions by status");
    expect(kept.place).toMatchObject({ slug: "decisions-by-status", lens: "columns", kind: "decision" });
    expect(kept.undo).toEqual({ op: "remove-lens", title: "Decisions by status", on: "decision" });

    const back = await takeBackLens({ document: kept.document! }, kept.undo as never);
    if (!back.ok) throw new Error(back.failed);
    expect(back.document!.lenses).toEqual(workshop.lenses);
    expect(placesOf(back.app).map((place) => place.title)).not.toContain("Decisions by status");
    expect(back.undo).toMatchObject({ op: "add-lens", title: "Decisions by status", lens: "columns" });
  });

  it("adds it to a code-declared app, judged by graview check, so it is in the place list — and takes it back", async () => {
    const draft = drafted(templateDraft("a timeline of dates", { app: todo }));
    const kept = await keepLens({ app: todo }, draft.edit);
    if (!kept.ok) throw new Error(kept.failed);
    expect(kept.document).toBeUndefined();
    expect(placesOf(kept.app).some((place) => place.title === draft.title && place.lens === "calendar")).toBe(true);
    const back = await takeBackLens({ app: kept.app }, kept.undo as never);
    if (!back.ok) throw new Error(back.failed);
    expect(back.app.lenses).toEqual(todo.lenses);
  });

  it("refuses a lens graview check would refuse, in one line", async () => {
    const refused = await keepLens({ document: workshop }, { op: "add-lens", title: "Broken", lens: "columns", on: "decision", bindings: { decision: { column: "name" } } });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.failed).toMatch(/^Couldn't keep it: .+\.$/);
  });

  it("keeps a reader's own lenses beside a declaration's, passing over one that no longer draws", () => {
    const draft = drafted(templateDraft("plantings by status", { app: seedbed }));
    const mine = withReaderLenses(seedbed, [draft.edit, { op: "add-lens", title: "Gone", lens: "columns", on: "planting", bindings: { planting: { column: "shade" } } }]);
    const titles = placesOf(mine).map((place) => place.title);
    expect(titles).toContain("Plantings by status");
    expect(titles).not.toContain("Gone");
  });
});

describe("a connector's chat draws a view and keeps it, through the tool surface", () => {
  it("lists draft_view and keep_lens only when the host offers them, the same with a store as without", () => {
    const store = createSeedbedStore();
    const none = createToolRuntime(store, { app: seedbedApp });
    expect(none.definitions.map((tool) => tool.name)).not.toContain("draft_view");
    const keeping = createToolRuntime(store, { app: seedbedApp, drafts: { keep: async () => ({ ok: true }) } });
    expect(keeping.definitions.map((tool) => tool.name)).toEqual(expect.arrayContaining(["draft_view", "keep_lens"]));
    expect(keeping.definitions.find((tool) => tool.name === "draft_view")!.annotations.readOnlyHint).toBe(true);
    expect(toolDefinitions(seedbed, { kind: "agent" }, { drafts: "keep" }).hash).toBe(keeping.hash);
    const drawing = createToolRuntime(store, { app: seedbedApp, drafts: {} });
    expect(drawing.definitions.map((tool) => tool.name)).not.toContain("keep_lens");
    expect(toolDefinitions(seedbed, { kind: "agent" }, { drafts: "draw" }).hash).toBe(drawing.hash);
  });

  it("draws from an ask, checks a lens the model wrote, changes the one on screen, and keeps it through the host's write", async () => {
    const written: unknown[] = [];
    const runtime = createToolRuntime(createSeedbedStore(), { app: seedbedApp, drafts: { keep: async (edit) => (written.push(edit), { ok: true, said: "Kept." }) } });
    const drawn = await runtime.call("draft_view", { ask: "plantings by status" });
    expect(drawn.ok).toBe(true);
    const lens = (drawn as { data: { lens: Record<string, unknown> } }).data.lens;
    expect(lens).toMatchObject({ lens: "columns", on: "planting", title: "Plantings by status" });

    const checked = await runtime.call("draft_view", { lens: { title: "Spiral", lens: "spiral", on: "planting" } });
    expect(checked).toMatchObject({ ok: false, reason: "invalid" });

    const changed = await runtime.call("draft_view", { ask: "only this month", current: lens });
    expect((changed as { data: { lens: Record<string, unknown> } }).data.lens).toMatchObject({ lens: "blocks", on: "planting" });

    const kept = await runtime.call("keep_lens", lens);
    expect(kept).toMatchObject({ ok: true, data: { said: "Kept.", undo: { op: "remove-lens", title: "Plantings by status", on: "planting" } } });
    expect(written).toEqual([{ op: "add-lens", title: "Plantings by status", lens: "columns", on: "planting", bindings: { planting: { column: "status" } } }]);
  });
});

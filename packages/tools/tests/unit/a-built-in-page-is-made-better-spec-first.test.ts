import { readFileSync } from "node:fs";
import { composeAppChange } from "@graview/core/compose";
import type { GraviewDocument } from "@graview/core/document";
import { describe, expect, it } from "vitest";
import type { HostAi } from "../../src/ai.js";
import { aboutTheLook, cssFindings, describeChange, draftPageSpec, draftPageView, drawnFindings, forkManifest, notTheSpec, readPageViewReply, specCanSay, type DrawnRead } from "../../src/section.js";

/**
 * MAKE ANY PAGE BETTER (Roadmap f-make-any-page-better): words typed in the
 * menu about how a page looks go to "Make … better", the rest to the quick
 * ask; the view spec is tried first, held to its own ops and judged by the
 * checker before a draft is offered; what the spec cannot say is answered
 * so the page can offer a view of its own, written whole and repaired once.
 */
const document = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/tasks.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const part = { name: "Tasks", slot: "list" as const, kind: "task" };

/** A Fast slot that answers each Choice with the option `pick` names for its words. */
const fastSaying = (pick: (state: Record<string, unknown>, key: string) => string): HostAi => ({
  name: "fake",
  fast: {
    model: "fake-fast",
    decide: async (state, questions) => ({
      answers: Object.fromEntries(Object.keys(questions).map((key) => [key, { type: "choice" as const, choice: pick(state as Record<string, unknown>, key), confidence: 0.9, probabilities: {} }])),
      usage: { inputTokens: 1, outputTokens: 1 },
    }),
  },
});

/** Light and full slots that answer in turn from `answers`, keeping each prompt. */
function slots(light: readonly string[], full: readonly string[] = []): { ai: HostAi; asked: { slot: string; prompt: Record<string, unknown> }[] } {
  const asked: { slot: string; prompt: Record<string, unknown> }[] = [];
  const queue = { light: [...light], full: [...full] };
  const think = (slot: "light" | "full") => async ({ prompt }: { prompt: string }) => {
    asked.push({ slot, prompt: JSON.parse(prompt) });
    return { text: queue[slot].shift() ?? "no" };
  };
  return { ai: { name: "fake", light: { model: "fake-light", think: think("light") }, thinking: { model: "fake-full", think: think("full") } } as unknown as HostAi, asked };
}

const judgeByTheChecker = async (edits: readonly unknown[]) => {
  const composed = composeAppChange({ document, edits });
  return composed.ok ? [] : [composed.refused];
};

describe("words typed in the menu", () => {
  it("about the look go to make-better and about the records to the quick ask, as the Fast slot says", async () => {
    const ai = fastSaying((state) => (/close|assign/.test(String(state["typed"])) ? "records" : "look"));
    expect((await aboutTheLook(ai, "make this page look better", "Tasks")).about).toBe("look");
    expect((await aboutTheLook(ai, "close these", "Tasks")).about).toBe("records");
    expect((await aboutTheLook(ai, "assign to sam", "Tasks")).by).toBe("fast");
  });

  it("are read by their words where the host gave no Fast slot", async () => {
    expect((await aboutTheLook({}, "make the cards bigger", "Tasks")).about).toBe("look");
    expect((await aboutTheLook({}, "show the due date on each row", "Tasks")).about).toBe("look");
    expect((await aboutTheLook({}, "close these", "Tasks")).about).toBe("records");
  });
});

describe("whether the spec can say it", () => {
  it("is tried over the spec where the Fast slot is unsure it needs drawing", async () => {
    const unsure: HostAi = { fast: { model: "fake", decide: async () => ({ answers: { can: { type: "choice", choice: "drawing", confidence: 0.46, probabilities: {} } }, usage: { inputTokens: 1, outputTokens: 1 } }) } };
    expect((await specCanSay(unsure, "make this page look better", part)).can).toBe(true);
  });

  it("is the Fast slot's to say, and colors and sizes need a view of their own without one", async () => {
    expect((await specCanSay(fastSaying(() => "drawing"), "show it as a kanban", part)).can).toBe(false);
    expect((await specCanSay(fastSaying(() => "spec"), "sort by due date", part)).can).toBe(true);
    expect((await specCanSay({}, "make the rows bigger and blue", part)).can).toBe(false);
    expect((await specCanSay({}, "show the due date on each row", part)).can).toBe(true);
  });
});

describe("a draft over the view spec", () => {
  it("refuses an edit that is not the spec's", () => {
    expect(notTheSpec([{ op: "set-brand", accent: "#f00" }])[0]).toContain("set-brand");
    expect(notTheSpec([{ op: "arrange-pages", hide: ["task"] }])[0]).toContain("hide");
    expect(notTheSpec([{ op: "set-glance", kind: "task", fields: ["due"] }])).toEqual([]);
  });

  it("is offered only once the checker compiles it, the full model repairing what it refused", async () => {
    const { ai, asked } = slots([JSON.stringify({ edits: [{ op: "set-glance", kind: "task", fields: ["deadline"] }], said: "Shows the deadline." })], [JSON.stringify({ edits: [{ op: "set-glance", kind: "task", fields: ["due"] }], said: "Shows the due date on each row." })]);
    const drafted = await draftPageSpec({ ai, document, part, mode: "describe", words: "show the due date on each row", judge: judgeByTheChecker });
    expect(drafted.ok).toBe(true);
    if (!drafted.ok) return;
    expect(drafted.repaired).toBe(true);
    expect(drafted.edits).toEqual([{ op: "set-glance", kind: "task", fields: ["due"] }]);
    expect(asked.map((one) => one.slot)).toEqual(["light", "full"]);
    expect(asked[1]!.prompt["what_broke"]).toBeDefined();
  });

  it("answers what the spec cannot say, for the page to offer its own view", async () => {
    const { ai } = slots([JSON.stringify({ cannot: "Bigger rows need sizes the settings have no word for." })]);
    const drafted = await draftPageSpec({ ai, document, part, mode: "describe", words: "bigger rows", judge: judgeByTheChecker });
    expect(drafted.ok).toBe(false);
    if (drafted.ok) return;
    expect(drafted.cannot).toContain("no word");
  });

  it("is refused in words where the repair fails too", async () => {
    const bad = JSON.stringify({ edits: [{ op: "set-brand", accent: "#ff0000" }], said: "Red." });
    const { ai } = slots([bad], [bad]);
    const drafted = await draftPageSpec({ ai, document, part, mode: "just", judge: judgeByTheChecker });
    expect(drafted.ok).toBe(false);
    if (drafted.ok) return;
    expect(drafted.refused).toContain("not a change to how a page reads");
  });
});

describe("a page made its own view", () => {
  it("is a view of many that is the list page, of one that is the record's page, or the home's body", () => {
    const links = { kinds: ["person"], edges: ["assigned-to"] };
    expect(forkManifest(part, links)).toEqual({ name: "task-list", attach: "task", cardinality: "many", replaces: "page", reads: { kinds: ["person"], edges: ["assigned-to"] } });
    expect(forkManifest({ name: "Task page", slot: "record", kind: "task" }, links)?.cardinality).toBe("one");
    expect(forkManifest({ name: "Home", slot: "home" }, { kinds: [], edges: [] })).toEqual({ name: "home-page", attach: "home", cardinality: "many" });
    expect(forkManifest({ name: "The week", slot: "place", kind: "task" }, links)).toBeUndefined();
  });

  it("is written by the light model from the page as it stands, and handed back to it once with what broke", async () => {
    const first = JSON.stringify({ source: "graview.onProps(() => graview.render(graview.html`<p>x</p>`));", said: "First." });
    const second = JSON.stringify({ source: "graview.onProps((props) => graview.render(graview.html`<h2>Someday</h2>`));", said: "Kept the heading." });
    const { ai, asked } = slots([first, second], []);
    const manifest = forkManifest(part, { kinds: [], edges: [] })!;
    const drafted = await draftPageView({ ai, part, manifest, mode: "describe", words: "cards side by side", outline: "# Tasks\n## Someday\n- Write the brief", data: {}, judge: async (source) => (source.includes("<h2>Someday</h2>") ? [] : ["It no longer shows the heading “Someday”."]) });
    expect(drafted.ok).toBe(true);
    if (!drafted.ok) return;
    expect(drafted.repaired).toBe(true);
    expect(asked.map((one) => one.slot)).toEqual(["light", "light"]);
    expect(asked[0]!.prompt["as_it_stands"]).toContain("# Tasks");
    expect(asked[1]!.prompt["what_broke"]).toEqual(["It no longer shows the heading “Someday”."]);
  });

  it("goes to the full model once after the light one's repair, then says plainly it could not, showing nothing", async () => {
    const broken = JSON.stringify({ source: "graview.onProps(() => graview.render(graview.html`<p>x</p>`));", said: "Looks modern." });
    const { ai, asked } = slots([broken, broken], [broken]);
    const manifest = forkManifest(part, { kinds: [], edges: [] })!;
    const drafted = await draftPageView({ ai, part, manifest, mode: "just", outline: "# Tasks", data: {}, judge: async () => ["It no longer shows “Write the brief”."] });
    expect(drafted).toMatchObject({ ok: false, refused: "I couldn't make a version that looks right." });
    expect(asked.map((one) => one.slot)).toEqual(["light", "light", "full"]);
  });

  it("repairs a stylesheet the host would strip before drawing it, and iterates on the draft so far", async () => {
    const hosted = JSON.stringify({ source: "graview.style(`:host { display: block; } .pg { display: grid; }`); graview.onProps(() => graview.render(graview.html`<div class=\"pg\"></div>`));", said: "" });
    const fine = JSON.stringify({ source: "graview.style(`.pg { display: grid; }`); graview.onProps(() => graview.render(graview.html`<div class=\"pg\"></div>`));", said: "" });
    const { ai, asked } = slots([hosted, fine], []);
    let drawn = 0;
    const manifest = forkManifest(part, { kinds: [], edges: [] })!;
    const drafted = await draftPageView({ ai, part, manifest, mode: "describe", words: "bigger", current: "graview.render('old')", outline: "# Tasks", data: {}, judge: async () => (drawn++, []) });
    expect(drafted.ok).toBe(true);
    expect(drawn).toBe(1);
    expect(String(asked[1]!.prompt["what_broke"])).toContain(":host");
    expect(asked[0]!.prompt["your_view_so_far"]).toBe("graview.render('old')");
  });
});

describe("a draft read against the page it replaces", () => {
  const card = (label: string, top: number, left: number, size = 16) => ({ label, top, left, size });
  const before: DrawnRead = { headings: ["Lists", "Someday"], records: [card("Write the brief", 100, 0), card("Book the hall", 140, 0)], text: "Lists Someday Write the brief Due Sep 3 Book the hall" };

  it("finds what a draft lost, drew twice, or said as the computer keeps it", () => {
    const after: DrawnRead = { headings: ["Lists", "Lists", "Someday"], records: [card("Write the brief", 100, 0)], text: "Lists Lists Someday Write the brief 2026-09-03 order 2 true" };
    const found = drawnFindings(before, after, { fields: ["order", "due"] });
    expect(found.some((one) => one.includes("“Book the hall”"))).toBe(true);
    expect(found.some((one) => one.includes("drawn twice"))).toBe(true);
    expect(found.some((one) => one.includes("2026-09-03"))).toBe(true);
    expect(found.some((one) => one.includes("“true”"))).toBe(true);
    expect(found.some((one) => one.includes("“order”"))).toBe(true);
    expect(drawnFindings(before, { ...before, text: `${before.text} <section aria-labelledby="x"><h2>Today</h2>` }).some((one) => one.includes("markup as words"))).toBe(true);
    expect(drawnFindings(before, before)).toEqual([]);
  });

  /* What each record's row said, and the heading it sat under: the facts a draft must keep unless asked. */
  const row = (label: string, top: number, facts: string[], under: string) => ({ ...card(label, top, 0), facts, row: [label, ...facts].join(" "), under });
  const tasks: DrawnRead = {
    headings: ["Tasks", "This week", "Today"],
    records: [row("Write the brief", 100, ["Todo", "Sep 3, 2026"], "This week"), row("Book the hall", 140, ["Doing", "Sep 5, 2026"], "This week"), row("Pay the deposit", 200, ["Doing"], "Today")],
    text: "Tasks This week Write the brief Todo Sep 3, 2026 Book the hall Doing Sep 5, 2026 Today Pay the deposit Doing",
  };

  it("fails a draft whose cards dropped what each row said — its status, its date — unless that was asked", () => {
    const titles: DrawnRead = {
      headings: tasks.headings,
      records: tasks.records.map((one) => ({ ...one, facts: [], row: one.label })),
      text: "Tasks This week Write the brief Book the hall Today Pay the deposit",
    };
    const found = drawnFindings(tasks, titles);
    expect(found.some((one) => one.includes("“Todo” on “Write the brief”") && one.includes("“Sep 3, 2026” on “Write the brief”"))).toBe(true);
    expect(drawnFindings(tasks, titles, { asked: "just the names, nothing else" })).toEqual([]);
    // Hiding the dates excuses the dates and nothing else.
    const dated = drawnFindings(tasks, titles, { asked: "hide the dates" });
    expect(dated.some((one) => one.includes("“Todo”") && !one.includes("Sep 3"))).toBe(true);
    // Said in other words, or by the heading it now sits under, a fact is kept.
    const reworded: DrawnRead = {
      ...tasks,
      headings: ["Tasks", "This week", "Today", "Doing"],
      records: [row("Write the brief", 100, [], "This week"), row("Book the hall", 140, [], "This week"), row("Pay the deposit", 200, [], "Today")].map((one, at) => ({ ...one, row: [`${one.label} · to do · due 3 September`, `${one.label} doing, due Sep 5`, `${one.label} Doing`][at]! })),
    };
    expect(drawnFindings(tasks, reworded).filter((one) => one.includes("no longer says"))).toEqual([]);
  });

  it("fails a draft that moved a record under another heading, unless a regrouping was asked", () => {
    const regrouped: DrawnRead = { ...tasks, records: tasks.records.map((one) => (one.label === "Book the hall" ? { ...one, under: "Today" } : one)) };
    const found = drawnFindings(tasks, regrouped);
    expect(found.some((one) => one.includes("“Book the hall” is under “Today”, and was under “This week”"))).toBe(true);
    expect(drawnFindings(tasks, regrouped, { asked: "group these by status" })).toEqual([]);
  });

  it("says what changed from the readings, never the model's words", () => {
    const after: DrawnRead = { headings: ["Lists", "Someday"], records: [card("Book the hall", 100, 0, 20), card("Write the brief", 100, 300, 20)], text: before.text };
    expect(describeChange("Lists", before, after)).toBe("Lists now show side by side, two to a line, in bigger type and in a new order.");
    expect(describeChange("Lists", before, before)).toBeUndefined();
  });

  it("reads a script a model wrapped as a page would wrap it as the script inside", () => {
    const wrapped = JSON.stringify({ source: "<script>\ngraview.onProps(() => graview.render(graview.html`<p>x</p>`));\n</script>", said: "" });
    expect(readPageViewReply(wrapped)?.source).toBe("graview.onProps(() => graview.render(graview.html`<p>x</p>`));");
  });

  it("reads a stylesheet as the host's sanitizer does", () => {
    expect(cssFindings("graview.style(`.a { color: var(--graview-ink); }`);")).toEqual([]);
    expect(cssFindings("graview.style(`:host { display: block; }`);")[0]).toContain(":host");
  });
});

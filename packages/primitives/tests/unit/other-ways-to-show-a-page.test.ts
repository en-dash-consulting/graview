// @vitest-environment jsdom
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { composeAppChange } from "@graview/core/compose";
import type { GraviewDocument } from "@graview/core/document";
import { createViews } from "@graview/react";
import type { MenuTarget } from "@graview/react/provider";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasks from "../../../core/tests/document/fixtures/tasks.gdd.json";
import { createOptionSwitch, displayOptionsFor, forgetChoice, keepChoice, modelOption, rankOptions, readChoices, type DisplayOption } from "../../src/display-options.js";
import { displayOptionsSection, type SectionHere } from "../../src/section-menu.js";

/**
 * OTHER WAYS TO SHOW THIS (Roadmap f-display-options-switch): an owner flips
 * between a few strong ways to show a kind's list or a place, drawn ahead
 * in real data, and keeps one as an ordinary change to the app. No model is
 * needed for any of it.
 */
const document = tasks as unknown as GraviewDocument;
const SEED = {
  nodes: [
    { id: "t1", kind: "task", label: "Write the brief", status: "todo", due: "2026-09-03" },
    { id: "t2", kind: "task", label: "Book the hall", status: "doing", due: "2026-09-05" },
    { id: "t3", kind: "task", label: "Print the flyers", status: "doing" },
  ],
  edges: [],
};
const compiled = compileDocument(document);
if (!compiled.ok) throw new Error("the tasks fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const storeOf = (nodes: readonly object[] = SEED.nodes) => new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes, edges: [] } as never });
const compose = (change: { readonly document: GraviewDocument; readonly edits?: readonly unknown[] }) => composeAppChange({ document: change.document, edits: change.edits ?? [] }) as ReturnType<typeof composeAppChange>;
const input = (nodes = storeOf().graph.nodesOfKind("task"), more: Partial<Parameters<typeof displayOptionsFor>[0]> = {}) => ({ app, document, compose: compose as never, kind: "task", name: "Tasks", nodes, today: "2026-09-01", ...more });
const shapes = (options: readonly DisplayOption[]) => options.map((one) => one.shape);
const asked = (options: readonly DisplayOption[], shape: string) => options.find((one) => one.shape === shape)!;

const bare = compileDocument({ ...document, lenses: [], pages: {}, kinds: { ...document.kinds, note: { noun: "note", plural: "notes", fields: { label: { type: "string", required: true } } } } } as never);
if (!bare.ok) throw new Error("the plain fixture compiles");

describe("the options on offer", () => {
  it("are offered only where the fields can draw them", () => {
    const plain = bare.app as GraviewApp<AnySchema>;
    const notes = new Store<AnySchema>({ schema: plain.schema, snapshot: { nodes: [{ id: "n1", kind: "note", label: "A note" }], edges: [] } as never }).graph.nodesOfKind("note");
    // A kind with neither a choice nor a date is no board and no calendar.
    expect(shapes(displayOptionsFor({ app: plain, document: bare.document as GraviewDocument, compose: compose as never, kind: "note", name: "Notes", nodes: notes, today: "2026-09-01" }))).toEqual(["cards"]);
    // A date field no record fills draws no calendar.
    const undated = storeOf(SEED.nodes.map(({ due: _due, ...node }) => node)).graph.nodesOfKind("task");
    expect(shapes(displayOptionsFor(input(undated)))).not.toContain("calendar");
    expect(shapes(displayOptionsFor(input(undated)))).not.toContain("order");
    // Dates this month are a calendar; dates all elsewhere a list in their order, never an empty month.
    expect(shapes(displayOptionsFor(input()))).toContain("calendar");
    const later = displayOptionsFor(input(undefined, { today: "2027-02-01" }));
    expect(shapes(later)).toContain("order");
    expect(shapes(later)).not.toContain("calendar");
    // No records, nothing to show.
    expect(displayOptionsFor(input([]))).toEqual([]);
  });

  it("are two to four, the page as it stands not among them", () => {
    const options = displayOptionsFor(input());
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.length).toBeLessThanOrEqual(4);
    // On the place "The board", a board by status is what it already is.
    const onPlace = displayOptionsFor(input(undefined, { place: "The board" }));
    expect(onPlace.some((one) => one.shape === "board")).toBe(false);
  });

  it("say what they are in a person's words, never a field's or a kind's declared name beside its own value", () => {
    for (const one of displayOptionsFor(input())) expect(one.label).toMatch(/^[A-Z][a-z]/);
    expect(displayOptionsFor(input()).map((one) => one.label)).toContain("Calendar by due");
  });

  it("each passed the host's composer, and one it refuses is not offered", () => {
    const refusing = displayOptionsFor(input(undefined, { compose: (() => ({ ok: false, refused: "no" })) as never }));
    expect(refusing).toEqual([]);
  });
});

describe("keeping one", () => {
  const propose = () => vi.fn(async () => ({ applied: true as const, undo: vi.fn(), note: "Kept." }));
  const switchOf = (over: Partial<Parameters<typeof createOptionSwitch>[0]> = {}) => createOptionSwitch({ options: displayOptionsFor(input()), name: "Tasks", propose: propose() as never, ...over });

  it("writes nothing until it is kept", async () => {
    const store = storeOf();
    const before = store.log.all().length;
    const asks = propose();
    const hear = vi.fn();
    const flips = switchOf({ propose: asks as never, onKept: hear });
    for (const one of flips.get().options) flips.flip(one.key);
    flips.flip(null);
    expect(asks).not.toHaveBeenCalled();
    expect(hear).not.toHaveBeenCalled();
    expect(store.log.all().length).toBe(before);
    expect(readChoices("nothing-kept-here")).toEqual([]);
  });

  it("is one change, whose undo takes all of it back", async () => {
    const undo = vi.fn();
    const asks = vi.fn(async () => ({ applied: true as const, undo }));
    const options = displayOptionsFor(input());
    const cards = asked(options, "cards");
    const flips = createOptionSwitch({ options, name: "Tasks", propose: asks as never });
    flips.flip(cards.key);
    await flips.keep();
    expect(asks).toHaveBeenCalledTimes(1);
    const edits = (asks.mock.calls[0] as unknown as [{ edits: readonly { op: string }[] }])[0].edits;
    expect(edits.map((one) => one.op)).toEqual(["add-lens", "set-lens-hidden", "arrange-pages"]);
    expect(flips.get().phase).toBe("kept");
    // The one change composes whole: the list opens as the new place, and it stands on no list of its own.
    const after = composeAppChange({ document, edits: edits as never });
    if (!after.ok) throw new Error(after.refused);
    const title = (after.document.pages?.lists?.["task"] as { opens?: string }).opens!;
    expect(after.document.lenses?.find((one) => one.title === title)?.hidden).toBe(true);
    await flips.undo();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(flips.get().phase).toBe("undone");
    await flips.undo();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("keeps the place's title and address on a place", () => {
    const options = displayOptionsFor(input(undefined, { place: "The board" }));
    const edit = options[0]!.edits[0] as { op: string; title: string; replace?: string };
    expect(options[0]!.edits).toHaveLength(1);
    expect(edit).toMatchObject({ op: "add-lens", title: "The board", replace: "The board" });
  });

  it("opens a place the kind already has, with no new one", () => {
    const board = displayOptionsFor(input()).find((one) => one.label === "The board")!;
    expect(board.edits).toEqual([{ op: "arrange-pages", opens: { task: "The board" } }]);
  });

  it("stays as it was when the host declines or fails", async () => {
    const declining = switchOf({ propose: (async () => "declined") as never });
    declining.flip(declining.get().options[0]!.key);
    await declining.keep();
    expect(declining.get().phase).toBe("choosing");
    expect(declining.get().said).toBe("It wasn't kept.");
    const failing = switchOf({ propose: (async () => { throw new Error("no"); }) as never });
    failing.flip(failing.get().options[0]!.key);
    await failing.keep();
    expect(failing.get().phase).toBe("choosing");
    expect(failing.get().said).toBe("It couldn't be kept.");
  });

  it("has nothing to keep on the page as it stands", async () => {
    const asks = propose();
    const flips = switchOf({ propose: asks as never });
    flips.flip(null);
    await flips.keep();
    expect(asks).not.toHaveBeenCalled();
  });
});

describe("a choice", () => {
  beforeEach(() => localStorage.clear());

  it("ranks the next offer, its own kind's most and undoing it forgets it", () => {
    const options = displayOptionsFor(input());
    const cardsFirst = rankOptions(options, [{ key: "x", kind: "task", shape: "cards", from: "graview", at: "2026-09-01" }], "task");
    expect(cardsFirst[0]!.shape).toBe("cards");
    // A choice on another kind counts too, for less than one here.
    const both = rankOptions(options, [{ key: "x", kind: "person", shape: "cards", from: "graview", at: "2026-09-01" }, { key: "y", kind: "task", shape: "calendar", from: "graview", at: "2026-09-02" }], "task");
    expect(both[0]!.shape).toBe("calendar");
    expect(both[1]!.shape).toBe("cards");
    keepChoice("app", { key: "x", kind: "task", shape: "cards", from: "graview", at: "2026-09-01" });
    expect(displayOptionsFor(input(undefined, { choices: readChoices("app") }))[0]!.shape).toBe("cards");
    forgetChoice("app", "x", "2026-09-01");
    expect(readChoices("app")).toEqual([]);
  });

  it("is remembered when kept, and forgotten when undone", async () => {
    const options = displayOptionsFor(input());
    const cards = asked(options, "cards");
    const flips = createOptionSwitch({ options, name: "Tasks", kind: "task", appKey: "app", propose: (async () => ({ applied: true, undo: () => {} })) as never });
    flips.flip(cards.key);
    await flips.keep();
    expect(readChoices("app").map((one) => one.shape)).toEqual(["cards"]);
    await flips.undo();
    expect(readChoices("app")).toEqual([]);
  });
});

describe("a host's options", () => {
  const offer = { id: "by-who", label: "What others kept", lens: { lens: "columns", title: "Tasks by what others kept", bindings: { task: { column: "status" } } } } as const;

  it("join in, judged as the others are, and hear which was kept", async () => {
    const options = displayOptionsFor(input(undefined, { offers: [offer, { id: "broken", label: "Broken", lens: { lens: "calendar", title: "Nope", bindings: { task: { start: "nothing" } } } }] }));
    const theirs = options.find((one) => one.hostId === "by-who")!;
    expect(theirs.from).toBe("host");
    expect(theirs.label).toBe("What others kept");
    expect(options.some((one) => one.hostId === "broken")).toBe(false);
    expect(options.length).toBeLessThanOrEqual(4);
    const heard = vi.fn();
    const flips = createOptionSwitch({ options, name: "Tasks", kind: "task", appKey: "host-app", propose: (async () => ({ applied: true, undo: () => {} })) as never, onKept: heard });
    flips.flip(theirs.key);
    await flips.keep();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0]![0]).toMatchObject({ kept: { hostId: "by-who", from: "host", kind: "task" }, offered: expect.arrayContaining([theirs.key]), undone: false });
    await flips.undo();
    expect(heard.mock.calls[1]![0]).toMatchObject({ undone: true });
  });

  it("join after the first draw without moving what is shown", () => {
    const options = displayOptionsFor(input());
    const flips = createOptionSwitch({ options: options.slice(0, 2), name: "Tasks", propose: (async () => "applied") as never });
    const shown = options[0]!.key;
    flips.flip(shown);
    flips.join(options);
    expect(flips.get().shown).toBe(shown);
    expect(flips.get().options.length).toBe(options.length);
    flips.drop(shown);
    expect(flips.get().shown).toBeNull();
  });
});

describe("with no model", () => {
  const views = createViews(app.schema);
  const owner = { kind: "human" as const, id: "p1", roles: ["owner"] };
  const here = (more: Partial<SectionHere> = {}): SectionHere => ({ aiDesk: { record: () => {} }, ai: { off: true }, keptViews: undefined, store: storeOf(), principal: owner, onProposeChange: () => "applied", composeChange: compose, app, views, ...more }) as unknown as SectionHere;
  const page = (): MenuTarget => {
    window.document.body.innerHTML = `<main data-graview-page-main=""><h1>Tasks</h1></main>`;
    return { about: ["aggregate:task"], face: "pages", page: { about: ["aggregate:task"], at: window.document.querySelector("h1")! } } as unknown as MenuTarget;
  };

  it("is on the menu with AI off, for a person who may change the app", () => {
    const section = displayOptionsSection(page(), here());
    expect(section?.items?.map((one) => one.label)).toEqual(["Other ways to show this"]);
  });

  it("offers nothing to a person who may not change the app", () => {
    expect(displayOptionsSection(page(), here({ principal: { kind: "human", id: "v", roles: ["viewer"] } as never }))).toBeNull();
    expect(displayOptionsSection(page(), here({ onProposeChange: undefined }))).toBeNull();
    expect(displayOptionsSection(page(), here({ composeChange: undefined }))).toBeNull();
  });

  it("offers nothing on a list a product design replaces, which keeping one would not change, and still offers a place", () => {
    const designsTasks = (kind: string) => kind === "task";
    expect(displayOptionsSection(page(), here(), designsTasks)).toBeNull();
    window.document.body.innerHTML = `<main data-graview-page-main=""><h2 class="graview-group-head">Doing</h2></main>`;
    const group = { about: ["aggregate:task"], face: "pages", page: { about: ["aggregate:task"], at: window.document.querySelector("h2")! } } as unknown as MenuTarget;
    expect(displayOptionsSection(group, here(), designsTasks)).toBeNull();
    // Another kind's list, which the design left alone, is offered.
    expect(displayOptionsSection(page(), here(), (kind: string) => kind === "person")).not.toBeNull();
    // A place is drawn by its lens whatever the design: what draws it changes.
    window.document.body.innerHTML = `<main data-graview-page-main=""><h1>The board</h1></main>`;
    const place = { about: ["aggregate:task"], place: "the-board", face: "pages", page: { about: ["aggregate:task"], place: "the-board", at: window.document.querySelector("h1")! } } as unknown as MenuTarget;
    const placed = here({ views: { ...views, places: () => [{ as: "the-board", title: "The board", kind: "task" }] } as never });
    expect(displayOptionsSection(place, placed, designsTasks)).not.toBeNull();
  });

  it("offers nothing on a kind with no records, nor on a page that shows no list", () => {
    expect(displayOptionsSection(page(), here({ store: storeOf([]) }))).toBeNull();
    window.document.body.innerHTML = `<main data-graview-page-main=""><h1>Home</h1></main>`;
    const home = { about: [], face: "pages", page: { about: [], home: true, at: window.document.querySelector("h1")! } } as unknown as MenuTarget;
    expect(displayOptionsSection(home, here())).toBeNull();
  });

  it("offers board, calendar and cards from the declaration alone", () => {
    expect(shapes(displayOptionsFor(input()))).toEqual(expect.arrayContaining(["calendar", "cards"]));
  });

  it("takes a model's lens as one more option only where one was lent, and a bad answer as none", async () => {
    const drawn = await modelOption(input(), async () => ({ text: JSON.stringify({ lens: "calendar", title: "The month", on: "task", bindings: { task: { start: "due" } } }) }));
    expect(drawn?.from).toBe("model");
    expect(drawn?.label).toBe("The month");
    expect(await modelOption(input(), async () => ({ text: "no idea" }))).toBeUndefined();
    expect(await modelOption(input(), async () => { throw new Error("down"); })).toBeUndefined();
  });
});

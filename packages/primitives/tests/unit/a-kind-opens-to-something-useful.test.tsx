// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineInvariant, defineMutation, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { preloadArrangeLists, registerDefaultViews } from "../../src/index.js";
import { barPanes } from "../../src/bar-panes-door.js";
import { TABLE_PAGE } from "../../src/kind-shape.js";

/*
 * A KIND OPENS TO SOMETHING USEFUL (Nick, at the desk: "when I go in on a
 * Kind without a lens, the default view is really poorly handled").
 *
 * Gone into, a district with no picture of its own drew six chips and "+30
 * more" in a box in an empty field. It opens now to its stop: what the set
 * is, what is going on in it said in words, its first act first, and a
 * picture its data chooses — a board by its states, a table of facts that
 * say something — paged rather than a wall of chips.
 */

const task = defineNode("task", {
  fields: z.object({ label: z.string(), status: z.enum(["todo", "doing", "done"]) }),
  plural: "Tasks",
  description: "Something to do.",
});
const room = defineNode("room", {
  fields: z.object({ name: z.string(), building: z.string(), seats: z.number().int() }),
  label: (node: { name: string }) => node.name,
  plural: "Rooms",
  description: "A room the conference uses.",
  edges: { keeper: { to: ["person"], description: "who looks after it", inverse: "the rooms they look after" } },
});
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const schema = createSchema([task, room, person]);
type S = typeof schema;

const addRoom = defineMutation("add-room", {
  title: "Add a room",
  creates: ["room"],
  input: z.object({ name: z.string().min(1) }),
  describe: (args: { name: string }) => `Add ${args.name}`,
  apply(ctx: { addNode(node: unknown): void; freshId(name: string, kind: string): string }, args: { name: string }) {
    ctx.addNode({ id: ctx.freshId(args.name, "room"), kind: "room", name: args.name, building: "Main", seats: 10 });
  },
} as never);
const roomsHaveSeats = defineInvariant("a-room-has-seats", {
  label: "A room has seats",
  scope: { kind: "room" },
  evaluate({ subject }: { subject: { id: string; name: string; seats: number } }) {
    return subject.seats > 0 ? [] : [{ invariant: "a-room-has-seats", subjectId: subject.id, label: subject.name, message: `${subject.name} has no seats`, nodeIds: [subject.id], repairs: [] }];
  },
} as never);

const ROOMS = TABLE_PAGE + 20;
const store = () =>
  new Store<S>({
    schema,
    mutations: [addRoom as never],
    invariants: [roomsHaveSeats as never],
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Book the van", status: "todo" },
        { id: "t2", kind: "task", label: "Pack the kitchen", status: "doing" },
        { id: "t3", kind: "task", label: "Hand back the keys", status: "done" },
        { id: "ada", kind: "person", label: "Ada" },
        ...Array.from({ length: ROOMS }, (_, at) => ({ id: `room:${at}`, kind: "room", name: `Hall ${String(at).padStart(2, "0")}`, building: at % 2 ? "East" : "West", seats: at === 3 ? 0 : 20 + at })),
      ] as never,
      edges: [{ kind: "keeper", from: "room:0", to: "ada" }] as never,
    },
  });

let host: HTMLDivElement;
let root: Root;
beforeAll(async () => {
  await preloadArrangeLists();
  await barPanes.load();
  await import("../../src/kind-stop.js");
});
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.render(null));
  host.remove();
});

/** The district gone into: the default group, at full fidelity, as the focused stop draws it. */
async function goInto(kind: string, view: Partial<ViewState> = {}) {
  const s = store();
  const views = registerDefaultViews(schema, createViews(schema));
  const Group = views.lookup(kind as never, { cardinality: "many", fidelity: "full" }) as ComponentType<ViewProps<S>>;
  const nodes = s.graph.nodesOfKind(kind as never);
  const flagged = s.violations().flatMap((violation) => violation.nodeIds);
  await act(async () => {
    root.render(
      <GraviewProvider store={s} views={views} initialView={{ ...EMPTY_VIEW, focusId: `aggregate:${kind}`, ...view }}>
        <Group nodes={nodes as never} label={kind === "task" ? "Tasks" : "Rooms"} cardinality="many" fidelity="full" mode="scene" selected={false} focused flagged={flagged} />
      </GraviewProvider>,
    );
  });
  for (let tick = 0; tick < 5 && !host.querySelector('[data-testid="kind-stop"]'); tick++) await act(async () => new Promise((done) => setTimeout(done, 10)));
  return s;
}
const stop = () => host.querySelector<HTMLElement>('[data-testid="kind-stop"]');

describe("a kind gone into", () => {
  it("opens to its stop: a region named by its heading, saying how many and what they are", async () => {
    await goInto("room");
    const region = stop();
    expect(region).not.toBeNull();
    const heading = host.querySelector(`#${CSS.escape(region!.getAttribute("aria-labelledby")!)}`);
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe("Rooms");
    expect(host.querySelector('[data-testid="kind-stop-count"]')?.textContent).toBe(`${ROOMS} rooms · A room the conference uses.`);
  });

  it("offers the kind's creating act as its first control", async () => {
    await goInto("room");
    const first = stop()!.querySelector("button, a[href], input");
    expect(first?.getAttribute("data-testid")).toBe("kind-stop-primary");
    expect(first?.textContent).toBe("Add a room");
  });

  it("asks the act's question in place, and the new record is listed", async () => {
    const s = await goInto("room");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="kind-stop-primary"]')!.click());
    const ask = host.querySelector('[data-testid="kind-stop-ask"]');
    expect(ask).not.toBeNull();
    const field = ask!.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(field, "Aula");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => ask!.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(s.graph.nodesOfKind("room").some((node) => (node as { name: string }).name === "Aula")).toBe(true);
    expect(host.querySelector('[data-testid="kind-stop-ask"]')).toBeNull();
  });

  it("never opens to a bare wall of chips: a table of named rows, its facts in columns, and a page at a time", async () => {
    await goInto("room");
    expect(host.textContent).not.toMatch(/\+\d+ more/);
    const table = host.querySelector('[data-testid="kind-stop-table"]')!;
    expect(table.tagName).toBe("TABLE");
    const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Name", "Building", "Seats"]));
    expect(headers.some((header) => /looks after it/i.test(header ?? ""))).toBe(true);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(TABLE_PAGE);
    expect(host.querySelector('[data-testid="kind-stop-shown"]')?.textContent).toBe(`${TABLE_PAGE} of ${ROOMS} shown`);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="kind-stop-more"]')!.click());
    expect(table.querySelectorAll("tbody tr")).toHaveLength(ROOMS);
    // Each row is named by its record, and its acts are a named control.
    expect(table.querySelector('tbody tr th button')?.textContent).toBe("Hall 00");
    // And each row is its record to the scene, as a record is anywhere: chosen when pressed, its acts on a right-click.
    expect([...table.querySelectorAll("tbody tr")].every((tr) => tr.getAttribute("data-graview-pick") === tr.getAttribute("data-graview-record"))).toBe(true);
    expect(table.querySelector("tbody tr")?.getAttribute("tabindex")).toBe("-1");
    // A value a record has not got is said, quietly, never a hole: Hall 01 is looked after by nobody.
    const blank = table.querySelectorAll("tbody tr")[1]!.querySelector('td[data-empty]');
    expect(blank?.textContent).toBe("—none");
    expect(blank?.querySelector('[aria-hidden="true"]')?.textContent).toBe("—");
    expect(table.querySelector('[data-testid="kind-stop-row-acts"]')?.getAttribute("aria-label")).toBe("What can be done with Hall 00");
    // A relation is read as the far record's name, never its id.
    expect(table.querySelector('tbody tr')?.textContent).toContain("Ada");
    expect(table.textContent).not.toContain("room:");
  });

  it("says its problems in words, counted by the rule that found them, and opens the rule's rows", async () => {
    await goInto("room");
    const said = host.querySelector('[data-testid="kind-stop-problems"]')!;
    expect(said.textContent).toContain("1 problem");
    const rule = said.querySelector<HTMLButtonElement>("[aria-expanded]")!;
    expect(rule.textContent).toContain("A room has seats");
    await act(async () => rule.click());
    expect(rule.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector('[data-testid="kind-stop-problem-rows"]')?.textContent).toContain("Hall 03 has no seats");
    // And the flagged row says it on itself, in words a screen reader reads.
    expect(host.querySelector('tr[data-flagged] th')?.textContent).toContain("Problem: Hall 03 has no seats");
  });

  it("opens a kind with a choice field to a board with its states, the table one press away", async () => {
    await goInto("task");
    expect(stop()!.getAttribute("data-graview-shape")).toBe("board");
    const body = host.querySelector('[data-testid="kind-stop-body"]')!;
    expect(body.querySelector('[data-graview-draft="columns"]')).not.toBeNull();
    for (const state of ["Todo", "Doing", "Done"]) expect(body.textContent).toContain(state);
    expect(host.querySelector('[data-testid="kind-stop-as-board"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="kind-stop-derived"]')?.textContent).toMatch(/derived from the declaration/);
    expect(host.querySelector('[data-testid="kind-stop-keep"]')?.textContent).toBe("Keep as a lens");
  });

  it("draws the table instead when the stop asks for it", async () => {
    await goInto("task", { within: { as: "table" } });
    expect(stop()!.getAttribute("data-graview-shape")).toBe("table");
    expect(host.querySelector('[data-testid="kind-stop-as-table"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelectorAll('[data-testid="kind-stop-table"] tbody tr')).toHaveLength(3);
  });
});

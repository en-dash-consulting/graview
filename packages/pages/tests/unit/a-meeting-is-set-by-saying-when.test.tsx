// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnyMutationDefinition, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { wallNow, wallOfStored } from "@graview/core/words";
import { EditableValue, prefetchWhenInput } from "@graview/primitives/pages";
import { createViews, GraviewProvider } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A MEETING IS SET BY SAYING WHEN (Roadmap f-date-inputs).
 *
 * Adding a meeting with a start and an end, served by `graview preview`,
 * asked for each as a bare text box that wanted `2026-10-17T15:00:00Z`.
 * Now "tomorrow 3pm" is read as the reader says it, kept as an instant, and
 * the end goes with the start — in an act's form and on the record itself.
 */
const result = compileDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Meetings",
  roles: ["owner"],
  policy: { grants: [{ roles: ["owner"], mutations: "*" }] },
  kinds: { meeting: { fields: { name: { type: "string", required: true }, starts: { type: "datetime", label: "Starts" }, ends: { type: "datetime", label: "Ends" } } } },
  acts: { "add-meeting": { title: "Add a meeting", creates: "meeting" } },
});
if (!result.ok) throw new Error("the meetings document compiles");
const app = result.app as GraviewApp<AnySchema>;
const OWNER: Principal = { kind: "human", id: "nick", roles: ["owner"] };
const MEETING = { id: "m1", kind: "meeting", name: "Standup", starts: "2026-10-20T14:00:00Z", ends: "2026-10-20T14:30:00Z" };

const mounted: (() => void)[] = [];
afterEach(() => {
  for (const unmount of mounted.splice(0)) unmount();
});

async function draw(store: Store<AnySchema>, children: ReactNode): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={createViews(store.schema)} principal={OWNER}>
        {children}
      </GraviewProvider>,
    ),
  );
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  // A date's editor is fetched as it is first asked for.
  await act(async () => prefetchWhenInput());
  return host;
}

async function type(element: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const tomorrow = (): string => {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  return wallNow(at).day;
};

describe("a meeting is set by saying when", () => {
  it("in an act's form: 'tomorrow 3pm' is read, said with its zone, kept as an instant, and the end follows an hour on", async () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy! });
    const add = store.allMutations().find((one) => one.name === "add-meeting") as AnyMutationDefinition<AnySchema>;
    const host = await draw(store, <DerivedForm store={store} mutation={add} principal={OWNER} />);
    await type(host.querySelector<HTMLInputElement>('input[name="name"]')!, "Planning");
    const starts = host.querySelector<HTMLInputElement>('input[name="starts"]')!;
    await type(starts, "tomorrow 3pm");
    const said = starts.closest("[data-graview-when]")!.querySelector("[data-graview-part=when-said]")!;
    expect(said.textContent).toMatch(/3:00 PM/);
    expect(said.getAttribute("data-graview-zone")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    // The end, never touched, is an hour on.
    expect(host.querySelector<HTMLInputElement>('input[name="ends"]')!.value).toMatch(/4:00 PM/);
    await act(async () => void host.querySelector<HTMLFormElement>("form")!.requestSubmit());
    const made = store.graph.nodesOfKind("meeting")[0] as unknown as Record<string, string>;
    expect(made["starts"]).toMatch(/Z$/);
    expect(wallOfStored(made["starts"])).toEqual({ day: tomorrow(), minutes: 15 * 60 });
    expect(wallOfStored(made["ends"])).toEqual({ day: tomorrow(), minutes: 16 * 60 });
  });

  it("refuses to send words it cannot read as a day, and says so", async () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy! });
    const add = store.allMutations().find((one) => one.name === "add-meeting") as AnyMutationDefinition<AnySchema>;
    const host = await draw(store, <DerivedForm store={store} mutation={add} principal={OWNER} />);
    const starts = host.querySelector<HTMLInputElement>('input[name="starts"]')!;
    await type(starts, "sometime soon");
    expect(starts.getAttribute("aria-invalid")).toBe("true");
    expect(starts.validity.valid).toBe(false);
    expect(starts.closest("[data-graview-when]")!.textContent).toContain("Not a date this reads");
  });

  it("on the record: moving the start in place moves the end with it, as one change", async () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [MEETING], edges: [] } as never });
    const host = await draw(store, <EditableValue nodeId="m1" field="starts" value="Oct 20, 2026" stored={MEETING.starts} />);
    await act(async () => host.querySelector<HTMLButtonElement>("button[data-graview-field=starts]")!.click());
    await act(async () => prefetchWhenInput());
    const box = host.querySelector<HTMLInputElement>("[data-graview-when] input")!;
    const wall = wallOfStored(MEETING.starts)!;
    await type(box, `${wall.day} ${String(Math.floor(wall.minutes! / 60) + 2).padStart(2, "0")}:${String(wall.minutes! % 60).padStart(2, "0")}`);
    const batches = store.log.all().length;
    await act(async () => void box.form!.requestSubmit());
    const node = store.graph.getNode("m1") as unknown as Record<string, string>;
    expect(Date.parse(node["starts"]!) - Date.parse(MEETING.starts)).toBe(2 * 3_600_000);
    expect(Date.parse(node["ends"]!) - Date.parse(MEETING.ends)).toBe(2 * 3_600_000);
    expect(new Set(store.log.all().slice(batches).map((op) => op.batch)).size).toBe(1);
  });

  it("opens a month to pick from by keyboard, and the day picked keeps the time", async () => {
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: { nodes: [MEETING], edges: [] } as never });
    const add = store.allMutations().find((one) => one.name === "edit-meeting") as AnyMutationDefinition<AnySchema>;
    const host = await draw(store, <DerivedForm store={store} mutation={add} prefilled={{ id: "m1" }} principal={OWNER} />);
    const field = host.querySelector<HTMLInputElement>('input[name="starts"]')!.closest("[data-graview-when]")!;
    await act(async () => field.querySelector<HTMLButtonElement>("[data-graview-part=when-pick]")!.click());
    for (let wait = 0; wait < 40 && !field.querySelector("[role=grid]"); wait++) await act(async () => new Promise((done) => setTimeout(done, 25)));
    const grid = field.querySelector<HTMLTableElement>("[role=grid]")!;
    const start = wallOfStored(MEETING.starts)!;
    expect(document.activeElement?.getAttribute("data-day")).toBe(start.day);
    await act(async () => void grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement?.getAttribute("data-day")).not.toBe(start.day);
    const next = document.activeElement!.getAttribute("data-day")!;
    await act(async () => void (document.activeElement as HTMLButtonElement).click());
    await act(async () => void host.querySelector<HTMLFormElement>("form")!.requestSubmit());
    const node = store.graph.getNode("m1") as unknown as Record<string, string>;
    expect(wallOfStored(node["starts"])).toEqual({ day: next, minutes: start.minutes });
    // And the end went with it.
    expect(Date.parse(node["ends"]!) - Date.parse(node["starts"]!)).toBe(30 * 60_000);
  });
});

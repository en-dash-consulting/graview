// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, isoDate, nodeRef, Store } from "@graview/core";
import { GraviewProvider, createViews } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { EditableValue } from "../../src/index.js";
import { fromToday, whenSaid } from "../../src/when-words.js";

/**
 * EACH VALUE DRAWN AND CHANGED BY ITS TYPE (Roadmap f-facts-by-type).
 *
 * A record's "Finished: No" was a text box that opened onto two buttons, a
 * due date read "Sep 4, 2026" with nothing to say it was Friday and three
 * days off, and a choice of four opened a menu that had to be opened again.
 * Each is now its type — and each still runs the one act the framework
 * found, so it is judged, kept in the history and can be taken back.
 */
const task = defineNode("task", {
  fields: z.object({
    label: z.string(),
    done: z.boolean(),
    urgent: z.boolean().optional(),
    due: isoDate.optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    area: z.enum(["home", "garden", "garage", "car", "office", "kitchen"]).optional(),
    minutes: z.number().int().min(5).max(180).optional(),
    notes: z.string().optional(),
    memo: z.string().optional(),
  }),
  computed: { twice: "minutes * 2" },
  plural: "Tasks",
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { done: true }),
});
const reopen = defineMutation("reopen", {
  title: "Put it back",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["done"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { done: false }),
});
const flag = defineMutation("flag", {
  title: "Say whether it is urgent",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), urgent: z.boolean() }),
  apply: (ctx, args) => ctx.patchNode(args.id, { urgent: args.urgent }),
});
const edit = defineMutation("edit-task", {
  title: "Change the task",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), due: isoDate.optional(), size: z.enum(["small", "medium", "large"]).optional(), area: z.enum(["home", "garden", "garage", "car", "office", "kitchen"]).optional(), minutes: z.number().int().min(5).max(180).optional(), notes: z.string().optional() }),
  apply: (ctx, args) => {
    const { id, ...rest } = args;
    ctx.patchNode(id, rest);
  },
});

// A rule of the act's own: it refuses a memo longer than a line.
const jot = defineMutation("jot", {
  title: "Jot a memo",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), memo: z.string() }),
  apply: (ctx, args) => {
    if (args.memo.length > 12) throw new Error("A memo is one short line.");
    ctx.patchNode(args.id, { memo: args.memo });
  },
});

let host: HTMLElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

async function draw(node: Record<string, unknown>, children: ReactNode) {
  const store = new Store({
    schema,
    mutations: [finish, reopen, flag, edit, jot],
    invariants: [],
    invariantOptions: { today: "2026-09-01" },
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Touch up the paint", done: false, ...node }] as never, edges: [] },
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<GraviewProvider store={store} views={createViews(schema)}>{children}</GraviewProvider>));
  return { store, host };
}

describe("a yes or no", () => {
  it("is a switch that runs the act that changes it, whichever act takes no value", async () => {
    const { store, host } = await draw({}, <EditableValue nodeId="t1" field="done" value="No" />);
    const toggle = host.querySelector<HTMLButtonElement>('[role="switch"][data-graview-field="done"]')!;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.getAttribute("aria-label")).toBe("Done");
    expect(toggle.getAttribute("data-graview-editable")).toBe("finish");
    await act(async () => toggle.click());
    expect(store.graph.getNode("t1")?.["done"]).toBe(true);
    // In the history, by the act's own name, as every change is.
    expect(store.log.all().at(-1)?.mutation).toMatchObject({ name: "finish" });
  });

  it("is sent the other value where its act takes one, and a blank one is off", async () => {
    const { store, host } = await draw({}, <EditableValue nodeId="t1" field="urgent" value="" blank />);
    const toggle = host.querySelector<HTMLButtonElement>('[role="switch"][data-graview-field="urgent"]')!;
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await act(async () => toggle.click());
    expect(store.graph.getNode("t1")?.["urgent"]).toBe(true);
  });
});

describe("a day", () => {
  it("is said with its weekday and how far it is from today", () => {
    expect(fromToday("2026-09-04", "2026-09-01")).toBe("in 3 days");
    expect(fromToday("2026-08-31", "2026-09-01")).toBe("yesterday");
    expect(fromToday("2026-08-11", "2026-09-01")).toBe("3 weeks ago");
    expect(fromToday("2017-09-25", "2026-09-01")).toBe("9 years ago");
    expect(whenSaid("2026-09-04", "2026-09-01", { locale: "en-US" })?.words).toBe("Fri, Sep 4 · in 3 days");
    expect(whenSaid("2017-09-25T11:30", "2026-09-01", { locale: "en-US" })?.words).toBe("Mon, Sep 25, 2017, 11:30 AM · 9 years ago");
    // A month alone names no day: said as it is.
    expect(whenSaid("2016-05", "2026-09-01")).toBeUndefined();
  });

  it("is in the warning color only where a rule says it is late", async () => {
    const { host } = await draw({ due: "2026-08-28" }, <>
      <EditableValue nodeId="t1" field="due" value="Aug 28, 2026" stored="2026-08-28" late />
    </>);
    const due = host.querySelector<HTMLButtonElement>('button[data-graview-field="due"]')!;
    expect(due.textContent).toBe("Fri, Aug 28 · 4 days ago");
    expect(due.style.color).toBe("var(--graview-warn)");
  });

  it("past and not said late, it is said in the value's own ink", async () => {
    const { host } = await draw({ due: "2026-08-28" }, <EditableValue nodeId="t1" field="due" value="Aug 28, 2026" stored="2026-08-28" />);
    expect(host.querySelector<HTMLButtonElement>('button[data-graview-field="due"]')!.style.color).toBe("var(--graview-ink)");
  });
});

describe("a choice", () => {
  it("of a few is its options side by side, one press to change", async () => {
    const { store, host } = await draw({ size: "small" }, <EditableValue nodeId="t1" field="size" value="Small" stored="small" />);
    const group = host.querySelector('[role="group"][data-graview-field="size"]')!;
    expect(group.getAttribute("aria-label")).toBe("Size");
    const options = [...group.querySelectorAll<HTMLButtonElement>("button")];
    expect(options.map((option) => [option.textContent, option.getAttribute("aria-pressed")])).toEqual([
      ["Small", "true"],
      ["Medium", "false"],
      ["Large", "false"],
    ]);
    await act(async () => options[2]!.click());
    expect(store.graph.getNode("t1")?.["size"]).toBe("large");
  });

  it("of many is a menu that is open to the first press", async () => {
    const { store, host } = await draw({ area: "home" }, <EditableValue nodeId="t1" field="area" value="Home" stored="home" />);
    const menu = host.querySelector<HTMLSelectElement>('select[data-graview-field="area"]')!;
    expect(menu.getAttribute("aria-label")).toBe("Area");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(menu, "garage");
      menu.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(store.graph.getNode("t1")?.["area"]).toBe("garage");
  });
});

describe("an empty field", () => {
  it("says how to fill it rather than a bare add", async () => {
    const { host } = await draw({}, <>
      <EditableValue nodeId="t1" field="due" value="" blank />
      <EditableValue nodeId="t1" field="notes" value="" blank />
    </>);
    const due = host.querySelector<HTMLButtonElement>('button[data-graview-field="due"]')!;
    expect(due.textContent).toBe("Pick a day");
    expect(due.getAttribute("aria-label")).toBe("Due: pick a day");
    const notes = host.querySelector<HTMLButtonElement>('button[data-graview-field="notes"]')!;
    expect(notes.textContent).toBe("Add notes");
  });
});

describe("a value worked out from others", () => {
  it("is read, never a control, and quietly said to be worked out", async () => {
    const { host } = await draw({ minutes: 20 }, <EditableValue nodeId="t1" field="twice" value="40" />);
    const twice = host.querySelector('[data-graview-field="twice"]')!;
    expect(twice.hasAttribute("data-graview-readonly")).toBe(true);
    expect(twice.querySelector("[data-graview-worked-out]")?.textContent).toBe("worked out");
  });
});

describe("a change the store refuses", () => {
  it("is said beside its value in plain words, and the value is kept", async () => {
    const { store, host } = await draw({ minutes: 20 }, <EditableValue nodeId="t1" field="minutes" value="20" stored="20" />);
    await act(async () => host.querySelector<HTMLButtonElement>('button[data-graview-field="minutes"]')!.click());
    const box = host.querySelector<HTMLInputElement>('input[data-graview-field="minutes"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(box, "999");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => box.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(store.graph.getNode("t1")?.["minutes"]).toBe(20);
    const said = host.querySelector('[data-graview-refused="minutes"]');
    expect(said?.getAttribute("role")).toBe("status");
    expect(said?.textContent).toBe("Minutes is at most 180; it keeps 20.");
  });
});

describe("a change an act refuses", () => {
  it("is said beside its value in the act's own words, and the value is kept", async () => {
    const { store, host } = await draw({ memo: "Satin" }, <EditableValue nodeId="t1" field="memo" value="Satin" />);
    await act(async () => host.querySelector<HTMLButtonElement>('button[data-graview-field="memo"]')!.click());
    const box = host.querySelector<HTMLInputElement>('input[data-graview-field="memo"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(box, "Two coats of the satin, then gloss");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => box.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(store.graph.getNode("t1")?.["memo"]).toBe("Satin");
    expect(host.querySelector('[data-graview-refused="memo"]')?.textContent).toBe("A memo is one short line.");
  });
});

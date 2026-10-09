// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineInvariant, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerDefaultViews, SeatField } from "../../src/index.js";

/**
 * THE SEAT IS QUIET UNTIL IT IS ASKED.
 *
 * It was a rail of every act the selected thing had, nine stars, a filter
 * and a heading that named the subject in capitals. Closed it is one field,
 * "Ask Things…", in a region named the same; asked, it grows into a panel
 * that says one line about where the reader is, offers at most three
 * things to ask and at most three acts — the repairs a broken rule names
 * for this thing — and nothing else until the reader asks.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string(), done: z.boolean().default(false), late: z.boolean().default(false) }),
  plural: "Tasks",
  label: (node: { label: string }) => node.label,
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }),
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["label"],
  input: z.object({ taskId: nodeRef(["task"]), label: z.string() }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { label: args.label }),
});
const drop = defineMutation("drop", {
  title: "Drop it",
  subject: { kinds: ["task"], arg: "taskId" },
  destructive: true,
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.removeNode(args.taskId),
});
const nothingLate = defineInvariant("nothing-late", {
  scope: { kind: "task" },
  label: "Nothing late",
  repairs: ["finish"],
  evaluate({ subject }) {
    const node = subject as unknown as { id: string; label: string; late: boolean; done: boolean };
    if (!node.late || node.done) return [];
    return [{ invariant: "nothing-late", subjectId: node.id, label: node.label, message: `"${node.label}" is late`, nodeIds: [node.id], repairs: [{ mutation: "finish", args: { taskId: node.id }, label: "Finish it" }] }];
  },
});

const store = () =>
  new Store({
    schema,
    mutations: [finish, rename, drop],
    invariants: [nothingLate as never],
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", label: "Pay the deposit", done: false, late: true },
        { id: "t2", kind: "task", label: "Book the van", done: false, late: false },
      ] as never,
      edges: [],
    },
  });

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  sessionStorage.clear();
});

async function draw(selection: readonly string[] = [], start?: "field" | "hidden") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider
        store={store()}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={EMPTY_VIEW}
        initialSelection={selection}
        brand={{ name: "Things" } as never}
      >
        <main style={{ position: "relative" }}>
          <button type="button" data-testid="before">before</button>
          <SeatField<typeof schema> {...(start ? { start } : {})} />
        </main>
      </GraviewProvider>,
    ),
  );
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

const settle = () => act(async () => new Promise<void>((done) => setTimeout(done, 80)));
const seat = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-testid="seat"]');
const field = (host: HTMLElement) => host.querySelector<HTMLInputElement>('[data-testid="seat-field"]')!;

async function open(host: HTMLElement) {
  await act(async () => field(host).click());
  for (let tries = 0; tries < 20 && !host.querySelector('[data-testid="seat-panel"]'); tries++) await settle();
}

describe("the seat is quiet until it is asked", () => {
  it("is one field named for the app, in a region named the same, at the picture's foot", async () => {
    const host = await draw(["t1"]);
    const region = seat(host)!;
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("aria-label")).toBe("Ask Things");
    expect(region.hasAttribute("data-graview-foot")).toBe(true);
    expect(region.getAttribute("data-graview-seat")).toBe("closed");
    expect(field(host).getAttribute("aria-label")).toBe("Ask Things");
    expect(field(host).placeholder).toBe("Ask Things…");
    // Closed, it is the field and nothing else: no acts, no heading, no word "seat".
    expect(region.querySelectorAll("button")).toHaveLength(0);
    expect(region.textContent?.toLowerCase()).not.toContain("seat");
  });

  it("opens into one plain line, a few things to ask and at most three acts, with nothing of the old rail", async () => {
    const host = await draw(["t1"]);
    await open(host);
    const region = seat(host)!;
    expect(region.getAttribute("data-graview-seat")).toBe("open");
    expect(host.querySelector('[data-testid="seat-where"]')?.textContent).toBe('"Pay the deposit" is late.');
    const suggestions = host.querySelectorAll('[data-testid="seat-suggestion"]');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    const acts = [...host.querySelectorAll('[data-testid="seat-act"]')].map((act) => act.textContent);
    expect(acts.length).toBeLessThanOrEqual(3);
    // The repair for the broken rule, said about the thing — not "Rename", not "Drop it".
    expect(acts).toEqual(["Finish Pay the deposit"]);
    const text = region.textContent ?? "";
    for (const gone of ["☆", "★", "Show 1 more", "Filter", "Selected", "In view", "listening", "What the lines mean"]) expect(text).not.toContain(gone);
    expect(region.querySelector('[data-testid="action-filter"]')).toBeNull();
    expect(text.toLowerCase()).not.toContain("seat");
  });

  it("says where you are when nothing is chosen, with no acts", async () => {
    const host = await draw([]);
    await open(host);
    expect(host.querySelector('[data-testid="seat-where"]')?.textContent).toBe("The whole thing: 2 tasks.");
    expect(host.querySelectorAll('[data-testid="seat-act"]')).toHaveLength(0);
  });

  it("closes on Escape and gives the keyboard back to where it was", async () => {
    const host = await draw(["t1"]);
    const before = host.querySelector<HTMLButtonElement>('[data-testid="before"]')!;
    await act(async () => before.focus());
    await open(host);
    await act(async () => field(host).focus());
    await act(async () => {
      field(host).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(seat(host)!.getAttribute("data-graview-seat")).toBe("closed");
    expect(document.activeElement).toBe(before);
  });

  it("snaps to the other foot with ⇄ on a desk, and back", async () => {
    // jsdom measures every box as 0 wide, which is a phone's: a desk's picture is wider.
    const measured = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}) } as DOMRect;
    };
    const host = await draw(["t1"]).finally(() => {
      HTMLElement.prototype.getBoundingClientRect = measured;
    });
    expect(seat(host)!.getAttribute("data-graview-seat-shape")).toBe("desk");
    await open(host);
    expect(seat(host)!.getAttribute("data-graview-seat-side")).toBe("left");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seat-side"]')!.click());
    expect(seat(host)!.getAttribute("data-graview-seat-side")).toBe("right");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seat-side"]')!.click());
    expect(seat(host)!.getAttribute("data-graview-seat-side")).toBe("left");
  });

  it("is not drawn at all when the host hides it", async () => {
    const host = await draw(["t1"], "hidden");
    expect(seat(host)).toBeNull();
  });

  it("asks what is typed, and keeps the answer in the thread", async () => {
    const host = await draw(["t1"]);
    await open(host);
    await act(async () => {
      const input = field(host);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "what's wrong?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => field(host).form!.requestSubmit());
    for (let tries = 0; tries < 20 && host.querySelectorAll('[data-testid="seat-panel"] ol li').length < 2; tries++) await settle();
    const said = [...host.querySelectorAll('[data-testid="seat-panel"] ol li')].map((li) => li.textContent);
    expect(said[0]).toBe("what's wrong?");
    expect(said.length).toBeGreaterThanOrEqual(2);
    // The line and the suggestions were for before anything was asked.
    expect(host.querySelector('[data-testid="seat-where"]')).toBeNull();
  });
});

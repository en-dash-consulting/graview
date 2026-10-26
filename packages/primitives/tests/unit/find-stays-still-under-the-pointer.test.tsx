// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW, type ViewState } from "@graview/layout";
import { GraviewProvider, createViews, useGraview } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { FindBox, registerDefaultViews } from "../../src/index.js";

/*
 * FIND STAYS STILL UNDER THE POINTER. A record the pointer passed over
 * unfolded its acts under it, every row below jumped, the row the pointer
 * was heading for moved, and the next one it crossed unfolded too. Now the
 * pointer only lights a row — and only when it moved — nothing is put in or
 * taken out of the list, and a record's acts are asked for: beside the list
 * on a desk, under the row when its "⋯" is pressed in a narrow strip, and
 * by → from the keyboard in both.
 */
const talk = defineNode("talk", { fields: z.object({ label: z.string(), track: z.string().optional() }), plural: "Talks" });
const room = defineNode("room", { fields: z.object({ label: z.string() }), plural: "Rooms" });
const schema = createSchema([talk, room]);
const { defineMutation } = bindSchema(schema);
const accept = defineMutation("accept", {
  title: "Accept it",
  subject: { kinds: ["talk"], arg: "id" },
  input: z.object({ id: nodeRef(["talk"]) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { track: "accepted" }),
});

const undone: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const one of undone.splice(0)) await one();
});

async function strip(q: string, options: { compact?: boolean; talks?: number; rooms?: number } = {}) {
  const store = new Store({
    schema,
    mutations: [accept],
    invariants: [],
    snapshot: {
      nodes: [
        ...Array.from({ length: options.talks ?? 4 }, (_, i) => ({ id: `t${i}`, kind: "talk", label: `Garden talk ${i}`, track: "Planting on-site" })),
        ...Array.from({ length: options.rooms ?? 0 }, (_, i) => ({ id: `r${i}`, kind: "room", label: `Garden room ${i}` })),
      ] as never,
      edges: [],
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let view: ViewState = { ...EMPTY_VIEW, q };
  let menu: unknown = null;
  function Menu() {
    menu = useGraview().menuAt;
    return null;
  }
  const draw = () =>
    act(() => {
      root.render(
        <GraviewProvider
          store={store}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={view}
          view={view}
          onViewChange={(next) => {
            view = next;
            void draw();
          }}
        >
          <FindBox compact={options.compact ?? false} />
          <Menu />
        </GraviewProvider>,
      );
    });
  await draw();
  const box = host.querySelector<HTMLInputElement>('[data-testid="find-box"]')!;
  await act(async () => box.focus());
  const key = (name: string) => act(async () => void box.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true })));
  const lit = () => box.getAttribute("aria-activedescendant");
  const list = () => host.querySelector<HTMLElement>('[data-testid="find-list"]')!;
  /** Every element in the list, in order: what a row's position is, where there is no layout to measure. */
  const shape = () => [...list().querySelectorAll("*")].map((el) => `${el.tagName}#${el.id}`).join("|");
  const move = (target: Element, x: number, y: number) => act(async () => void target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y })));
  const done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  undone.push(done);
  return { host, box, key, lit, list, shape, move, view: () => view, menu: () => menu };
}

describe("Find stays still under the pointer", () => {
  it("puts no row in and moves none when the pointer lights a record", async () => {
    const { host, shape, move, lit } = await strip("garden");
    const before = shape();
    const records = host.querySelectorAll('[data-testid="find-hit"][data-about="node"]');
    await move(records[1]!, 40, 60);
    expect(lit()).toBe(records[1]!.id);
    await move(records[2]!, 40, 96);
    expect(lit()).toBe(records[2]!.id);
    expect(shape()).toBe(before);
    expect(host.querySelectorAll('[data-testid="find-list"] [data-testid="find-act"]')).toHaveLength(0);
  });

  it("does not light a row that slid under a pointer that did not move", async () => {
    const { host, move, lit } = await strip("garden");
    const records = host.querySelectorAll('[data-testid="find-hit"][data-about="node"]');
    await move(records[0]!, 40, 30);
    expect(lit()).toBe(records[0]!.id);
    // The list scrolled under the pointer: the browser says the pointer entered another row, at the same place.
    await act(async () => void records[2]!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 40, clientY: 30 })));
    await act(async () => void records[2]!.dispatchEvent(new MouseEvent("mouseenter", { clientX: 40, clientY: 30 })));
    await move(records[2]!, 40, 30);
    expect(lit()).toBe(records[0]!.id);
  });

  it("says the lit record in the desk's panel, its acts there as buttons, beside a list that does not change", async () => {
    const { host, key, shape, lit } = await strip("garden");
    const before = shape();
    await key("ArrowDown");
    await key("ArrowDown");
    const panel = host.querySelector('[data-testid="find-panel"]')!;
    expect(panel.querySelector('[data-testid="find-said"]')?.textContent).toContain("Garden talk 1");
    expect([...panel.querySelectorAll('[data-testid="find-act"]')].map((el) => el.textContent)).toContain("Accept it");
    await key("ArrowRight");
    expect(host.querySelector(`[id="${lit()}"]`)?.getAttribute("data-about")).toBe("act");
    expect(panel.contains(host.querySelector(`[id="${lit()}"]`))).toBe(true);
    expect(shape()).toBe(before);
  });

  it("opens a record's acts under its row only when its ⋯ is pressed, in a narrow strip", async () => {
    const { host, shape } = await strip("garden", { compact: true });
    expect(host.querySelector('[data-testid="find-panel"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="find-act"]')).toHaveLength(0);
    const before = shape();
    const more = host.querySelectorAll<HTMLElement>('[data-testid="find-acts-open"]');
    expect(more.length).toBeGreaterThan(0);
    await act(async () => more[0]!.click());
    expect(host.querySelector('[data-testid="find-act"]')?.textContent).toBe("Accept it");
    await act(async () => more[0]!.click());
    expect(host.querySelectorAll('[data-testid="find-act"]')).toHaveLength(0);
    expect(shape()).toBe(before);
  });

  it("opens them under the row with → in a narrow strip, and puts them away with ←", async () => {
    const { host, key, lit } = await strip("garden", { compact: true });
    await key("ArrowDown");
    const record = lit();
    await key("ArrowRight");
    expect(host.querySelector(`[id="${lit()}"]`)?.textContent).toBe("Accept it");
    await key("ArrowLeft");
    expect(lit()).toBe(record);
    expect(host.querySelectorAll('[data-testid="find-act"]')).toHaveLength(0);
  });

  it("opens the act's menu on its record with Enter", async () => {
    const { key, view, menu } = await strip("garden");
    await key("ArrowDown");
    await key("ArrowRight");
    await key("Enter");
    expect(menu()).toMatchObject({ on: "t0" });
    expect(view().selection).toEqual(["t0"]);
  });

  it("shows the best few of each kind where several share the strip, and a row to all of them that goes in narrowed", async () => {
    const { host, key, lit, view } = await strip("garden", { talks: 9, rooms: 7 });
    const groups = [...host.querySelectorAll('[data-testid="find-list"] [role="group"]')];
    expect(groups.map((group) => group.querySelectorAll('[data-testid="find-hit"][data-about="node"]').length)).toEqual([5, 5]);
    expect(Object.fromEntries(groups.map((group) => [group.getAttribute("aria-label"), group.querySelector('[data-testid="find-group-count"]')?.textContent]))).toEqual({ Talks: "9", Rooms: "7" });
    const alls = [...host.querySelectorAll<HTMLElement>('[data-testid="find-all"]')];
    expect(alls.map((el) => el.textContent).sort()).toEqual(["All 7 rooms matching “garden”", "All 9 talks matching “garden”"]);
    const all = alls.find((el) => el.textContent?.includes("talks"))!;
    for (let press = 0; press < 12 && lit() !== all.id; press++) await key("ArrowDown");
    expect(lit()).toBe(all.id);
    await key("Enter");
    expect(view().focusId).toBe("aggregate:talk");
    expect(view().within?.["q"]).toBe("garden");
  });

  it("shows one kind's rows whole, with no row to all of them", async () => {
    const { host } = await strip("garden", { talks: 9 });
    expect(host.querySelectorAll('[data-testid="find-hit"][data-about="node"]')).toHaveLength(9);
    expect(host.querySelector('[data-testid="find-all"]')).toBeNull();
  });

  it("marks the words that matched, in the name and in the line that says why", async () => {
    const { host } = await strip("gard on-si");
    const marks = [...host.querySelectorAll('[data-testid="find-list"] mark')].map((el) => el.textContent);
    expect(marks).toContain("Gard");
    expect(marks).toContain("si");
  });

  it("teaches the keys under a desk's strip", async () => {
    const { host } = await strip("garden");
    expect(host.querySelector('[data-testid="find-keys"]')?.textContent).toBe("↑↓ move↵ open→ actionsesc close");
  });
});

// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineApp, defineNode, Store, z } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews, Shell, type FirstLook } from "@graview/primitives";
import { createViews, GraviewProvider } from "@graview/react";
import { stubFast } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FIRST_LOOK_ANCHORS, mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

beforeAll(() => preload());

/**
 * A FIRST LOOK POINTS AT THE APP'S OWN CONTROLS, ONCE.
 *
 * A brand-new app is a bar of controls nobody has met. A host could point
 * at them only by their selectors, which are not a surface it may hold the
 * framework to; the framework points at its own, by name — the switch, the
 * problems count, Activity, the Ask box — one hint at a time, beside the
 * control and never over it, skipping what is not drawn, on either face,
 * and only once.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const addNote = defineMutation("add-note", {
  title: "Add a note",
  description: "Bring a note in.",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: `note-${args.label}`, kind: "note", label: args.label } as never);
  },
});
const app = defineApp({ name: "Field notes", schema, mutations: [addNote] });
const snapshot = { nodes: [{ id: "n1", kind: "note", label: "First" }], edges: [] } as never;
const store = () => new Store({ schema, mutations: [addNote], invariants: [], snapshot });

/*
 * A LAID-OUT BAR. The test's document lays nothing out, so each control the
 * hints point at is given the box it would have on a desk's bar, and the
 * hint's place is read against it.
 */
const BOXES: Record<string, { left: number; top: number; width: number; height: number }> = {
  "app-faces": { left: 400, top: 9, width: 160, height: 30 },
  standing: { left: 900, top: 9, width: 30, height: 30 },
  "standing-link": { left: 900, top: 9, width: 30, height: 30 },
  "activity-button": { left: 840, top: 9, width: 80, height: 30 },
  "seat-field": { left: 16, top: 700, width: 360, height: 40 },
  "profile-button": { left: 950, top: 9, width: 30, height: 30 },
};
const realRect = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const box = BOXES[this.getAttribute("data-testid") ?? ""];
    if (!box) return realRect.call(this);
    return { ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => box } as DOMRect;
  });
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const hint = (host: Element = document.body) => host.querySelector<HTMLElement>('[data-testid="first-look"]');
const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

/** Waits for a hint, or for the time a hint would have taken: the bar, and a moment for the face to settle. */
async function hintArrives(host: Element = document.body): Promise<HTMLElement | null> {
  for (let turn = 0; turn < 50 && !hint(host); turn++) await wait(80);
  return hint(host);
}

async function embed(options: Partial<EmbedOptions> & { readonly firstLook?: FirstLook }) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, fonts: false, face: "scene", store: store(), ...options } as unknown as EmbedOptions);
  });
  return { host, done: async () => { await act(async () => handle!.unmount()); host.remove(); } };
}

async function shell(firstLook: FirstLook) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} brand={{ name: "Field notes" } as never} ai={{ fast: stubFast() }}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} firstLook={firstLook} />
      </GraviewProvider>,
    ),
  );
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}

/** Each hint in turn, by the control it names, pressing Next until Done. */
async function walk(host: Element): Promise<{ anchor: string; title: string; covers: boolean }[]> {
  const seen: { anchor: string; title: string; covers: boolean }[] = [];
  for (let turn = 0; turn < 10; turn++) {
    const shown = await hintArrives(host);
    if (!shown) break;
    const anchor = shown.getAttribute("data-first-look-anchor")!;
    const control = host.querySelector<HTMLElement>(`[data-testid="${anchor === "faces" ? "app-faces" : anchor === "problems" ? "standing" : anchor === "activity" ? "activity-button" : anchor === "ask" ? "app-find" : "profile-button"}"], [data-testid="standing-link"]`);
    const box = control?.getBoundingClientRect();
    const top = parseFloat(shown.style.top);
    // Under its control, or over it: never on it.
    const covers = box === undefined || Number.isNaN(top) || (top < box.bottom && top >= box.top);
    seen.push({ anchor, title: shown.querySelector('[data-testid="first-look-title"]')!.textContent ?? "", covers });
    const next = shown.querySelector<HTMLButtonElement>('[data-testid="first-look-next"], [data-testid="first-look-done"]')!;
    // The keyboard is on it, so the hint is said as it opens.
    expect(document.activeElement).toBe(next);
    await act(async () => next.click());
  }
  return seen;
}

describe("a first look points at the app's own controls, once", { timeout: 60_000 }, () => {
  it("names its anchors as a small set a host can name", () => {
    expect([...FIRST_LOOK_ANCHORS]).toEqual(["faces", "problems", "activity", "ask", "find", "profile", "home"]);
  });

  it("shows the hints once, and not on a second visit", async () => {
    const first = await embed({ firstLook: true });
    expect(await hintArrives(first.host)).not.toBeNull();
    await walk(first.host);
    expect(hint(first.host)).toBeNull();
    await first.done();
    expect(localStorage.getItem("graview:first-look:Field notes")).toBe("seen");

    const second = await embed({ firstLook: true });
    expect(await hintArrives(second.host)).toBeNull();
    await second.done();

    // The whole-page Shell remembers the same app the same way.
    const whole = await shell(true);
    expect(await hintArrives(whole.host)).toBeNull();
    await whole.done();
  });

  it("asks the host whether it has been seen, and tells it when it is done", async () => {
    const onDone = vi.fn();
    const seenAlready = await embed({ firstLook: { seen: () => true, onDone } });
    expect(await hintArrives(seenAlready.host)).toBeNull();
    await seenAlready.done();
    expect(onDone).not.toHaveBeenCalled();

    const fresh = await embed({ firstLook: { seen: false, onDone } });
    await walk(fresh.host);
    expect(onDone).toHaveBeenCalledWith("finished");
    // The host keeps its own record: the browser does not.
    expect(localStorage.getItem("graview:first-look:Field notes")).toBeNull();
    await fresh.done();
  });

  it("anchors each hint to its control on the scene, on the pages, and under the whole-page Shell — beside it, never over it", async () => {
    // The quick ask's hint stands by Find, where the host gave a model and a quick ask is drawn.
    const scene = await embed({ firstLook: { seen: false }, ai: { fast: stubFast() } });
    const onScene = await walk(scene.host);
    expect(onScene.map((one) => one.anchor)).toEqual(["faces", "problems", "ask"]);
    expect(onScene[0]!.title).toBe("Scene or Pages");
    expect(onScene[2]!.title).toBe("Ask");
    for (const one of onScene) expect(one.covers, one.anchor).toBe(false);
    await scene.done();

    const pages = await embed({ face: "pages", firstLook: { seen: false } });
    const onPages = await walk(pages.host);
    expect(onPages.map((one) => one.anchor).slice(0, 2)).toEqual(["faces", "problems"]);
    for (const one of onPages) expect(one.covers, one.anchor).toBe(false);
    await pages.done();

    const whole = await shell({ seen: false });
    const onShell = await walk(whole.host);
    expect(onShell.map((one) => one.anchor)).toEqual(["faces", "problems", "ask"]);
    await whole.done();
  });

  it("skips the hint of a control that is not drawn, and shows Activity's once there is any", async () => {
    // No quick ask (no model was given), and nothing has happened: no Activity.
    const quiet = await embed({ firstLook: { seen: false } });
    const first = await hintArrives(quiet.host);
    expect(first?.querySelector('[data-testid="first-look-count"]')?.textContent).toBe("1 of 2");
    const said = await walk(quiet.host);
    expect(said.map((one) => one.anchor)).toEqual(["faces", "problems"]);
    await quiet.done();

    const busy = store();
    busy.apply({ name: "add-note", args: { label: "Second" } });
    const lively = await embed({ store: busy, quickAsk: false, ai: { fast: stubFast() }, firstLook: { seen: false } } as never);
    expect((await walk(lively.host)).map((one) => one.anchor)).toEqual(["faces", "problems", "activity"]);
    await lively.done();
  });

  it("ends on Escape, and gives the keyboard back where it was", async () => {
    const before = document.createElement("button");
    before.textContent = "The host's own button";
    document.body.appendChild(before);
    before.focus();
    const onDone = vi.fn();
    const shown = await embed({ firstLook: { seen: false, onDone } });
    const first = await hintArrives(shown.host);
    expect(first).not.toBeNull();
    expect(document.activeElement).not.toBe(before);
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await wait(30);
    expect(hint(shown.host)).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(onDone).toHaveBeenCalledWith("dismissed");
    // Ended is ended: nothing more comes.
    expect(await hintArrives(shown.host)).toBeNull();
    await shown.done();
    before.remove();
  });

  it("shows the host's own hint, naming a framework control, after the framework's", async () => {
    const shown = await embed({ ai: { fast: stubFast() }, firstLook: { seen: false, steps: [{ anchor: "profile", title: "You", words: "Your name, your seat and your own settings are here." }] } });
    const said = await walk(shown.host);
    expect(said.at(-1)).toMatchObject({ anchor: "profile", title: "You", covers: false });
    expect(said.map((one) => one.anchor)).toEqual(["faces", "problems", "ask", "profile"]);
    await shown.done();
  });
});

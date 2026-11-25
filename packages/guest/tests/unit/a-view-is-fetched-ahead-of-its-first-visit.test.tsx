// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AnySchema, Principal, Store } from "@graview/core";
import { fetchAhead } from "../../../pages/src/view-ahead.js";
import { createViews, GraviewProvider, type ReactViewRegistry, type ViewComponent } from "@graview/react/provider";
import { act, Suspense, use, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guestView } from "../../src/host/index.js";
import { AHEAD_MS, createMine, forgetRead, readAhead } from "../../src/host/mine.js";
import { registerWorkerView } from "../../src/host/worker-react.js";
import { bethan, schema, showroom, staff } from "./showroom.js";

/**
 * A VIEW IS FETCHED AHEAD OF ITS FIRST VISIT (Graview HQ
 * f-custom-pages-first-visit): as a person comes to a link to its page, its
 * code and what it keeps for them, each once; a few places' code once the
 * page is idle; nothing where the person asked to save data, and nothing for
 * a seat that sees nothing the view reads. On the page, in three engines,
 * `verify-view-return`.
 */
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
const settle = (ms = 80) => act(async () => new Promise<void>((done) => setTimeout(done, ms)));
let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.replaceChildren();
  Reflect.deleteProperty(navigator, "connection");
  Reflect.deleteProperty(window, "requestIdleCallback");
});

function page(principal: Principal = staff) {
  const store = showroom() as unknown as Store<AnySchema>;
  let views = createViews(schema as never) as unknown as ReactViewRegistry<AnySchema>;
  const code: Record<string, ReturnType<typeof vi.fn>> = {};
  const place = (name: string, attach: string, reads?: { kinds: string[] }) => {
    code[name] = vi.fn(async () => ({ source: "graview.onProps(() => {});" }));
    views = registerWorkerView(views, { manifest: { name, title: name, attach, cardinality: "many", ...(reads ? { reads } : {}) }, worker: code[name] as never });
  };
  for (const name of ["one", "two", "three", "four", "five", "six"]) place(name, "car");
  place("people", "shopper");
  const read = vi.fn(async () => ({}));
  const viewerState = { read, write: async () => ({ ok: true as const }) };
  const cleared: (() => void)[] = [];
  const kept = { onClear: (_: object, run: () => void) => void cleared.push(run) };
  const context = { store: store.seenBy(principal), principal, views };
  const link = (path: string, attribute = "href") => {
    const element = document.createElement(attribute === "href" ? "a" : "button");
    element.setAttribute(attribute, path);
    element.textContent = path;
    document.body.append(element);
    return element;
  };
  const listen = () => (stop = fetchAhead(document.body, "/a/cars", () => ({ context, registry: undefined, viewerState, kept }) as never));
  return { code, read, link, listen, cleared };
}
const idleNever = () => Object.assign(window, { requestIdleCallback: () => 0 });

describe("a link a person comes to", () => {
  it("fetches its view's code and what it keeps, once each, by the keyboard, a pointer going down, or one resting; not one passing over", async () => {
    idleNever();
    const { code, read, link, listen } = page();
    const [one, two, bar] = [link("/a/cars/places/one"), link("/a/cars/places/two"), link("/places/three", "data-place-path")];
    listen();
    one.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    one.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    bar.dispatchEvent(new Event("touchstart", { bubbles: true }));
    two.dispatchEvent(new Event("pointerover", { bubbles: true }));
    document.body.dispatchEvent(new Event("pointerover", { bubbles: true }));
    await settle();
    expect([code.one, code.two, code.three].map((asked) => asked!.mock.calls.length)).toEqual([1, 0, 1]);
    expect(read.mock.calls).toEqual([["one"], ["three"]]);
    two.dispatchEvent(new Event("pointerover", { bubbles: true }));
    await settle();
    expect(code.two).toHaveBeenCalledTimes(1);
  });

  it("outside the app, or under another base, fetches nothing", async () => {
    idleNever();
    const { code, link, listen } = page();
    const others = [link("https://elsewhere.example/a/cars/places/one"), link("/a/carsick/places/one"), link("/places/one"), link("/a/cars/places/none"), link("/a/cars/places/one?drawn=built-in"), link("/a/cars/cars?q=golf")];
    listen();
    for (const other of others) other.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await settle();
    expect(Object.values(code).every((asked) => asked.mock.calls.length === 0)).toBe(true);
  });

  it("fetches nothing where the person asked to save data", async () => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } });
    Object.assign(window, { requestIdleCallback: (run: () => void) => setTimeout(run, 0) });
    const { code, read, link, listen } = page();
    const one = link("/a/cars/places/one");
    listen();
    one.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await settle();
    expect(Object.values(code).every((asked) => asked.mock.calls.length === 0)).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it("fetches nothing of a view whose every kind is kept from the seat, nor a place the seat is not offered", async () => {
    idleNever();
    const { code, read, link, listen } = page({ kind: "human", id: "v:1", roles: [] });
    const people = link("/a/cars/places/people");
    listen();
    people.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await settle();
    expect(code.people).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});

describe("an idle page", () => {
  it("fetches the code of four of the app's places, and nobody's values", async () => {
    Object.assign(window, { requestIdleCallback: (run: () => void) => setTimeout(run, 0) });
    const { code, read, listen } = page(bethan);
    listen();
    await settle(200);
    expect(Object.values(code).filter((asked) => asked.mock.calls.length === 1)).toHaveLength(4);
    expect(read).not.toHaveBeenCalled();
  });
});

describe("what a view keeps, asked ahead", () => {
  const seat: Principal = { kind: "human", id: "u:a", roles: [] };
  const answering = (values: Record<string, string> = { k: "v" }) => ({ read: vi.fn(async () => values), write: async () => ({ ok: true as const }) });

  it("is taken by the drawing it was asked for, and shared by those drawn at once", async () => {
    const state = answering();
    readAhead(state, seat, "v");
    readAhead(state, seat, "v");
    const first = createMine({ view: "v", viewer: "u:a", state });
    const second = createMine({ view: "v", viewer: "u:a", state });
    await Promise.all([first.ready, second.ready]);
    expect(first.values()).toEqual({ k: "v" });
    expect(second.values()).toEqual({ k: "v" });
    expect(state.read).toHaveBeenCalledTimes(1);
  });

  it("is asked again past its time, and by another viewer", async () => {
    const state = answering();
    let at = 0;
    readAhead(state, seat, "v", () => at);
    await settle(0);
    at = AHEAD_MS + 1;
    await createMine({ view: "v", viewer: "u:a", state, now: () => at }).ready;
    await createMine({ view: "v", viewer: "u:b", state, now: () => at }).ready;
    expect(state.read).toHaveBeenCalledTimes(3);
  });

  it("is forgotten with the seat: an answer still on its way is kept by nobody", async () => {
    let answer: (values: Record<string, string>) => void = () => undefined;
    const state = { read: vi.fn(() => new Promise<Record<string, string>>((resolve) => (answer = resolve))), write: async () => ({ ok: true as const }) };
    readAhead(state, seat, "v");
    const before = createMine({ view: "v", viewer: "u:a", state });
    await settle(0);
    forgetRead(state);
    answer({ k: "before" });
    await before.ready;
    const after = createMine({ view: "v", viewer: "u:a", state });
    expect(after.values()).toEqual({});
    await settle(0);
    expect(state.read).toHaveBeenCalledTimes(2);
  });

  it("is not waited for by every drawing after one the host never answers", async () => {
    let at = 0;
    let hang = true;
    const state = { read: vi.fn(() => (hang ? new Promise<Record<string, string>>(() => undefined) : Promise.resolve({ k: "v" }))), write: async () => ({ ok: true as const }) };
    readAhead(state, seat, "v", () => at);
    hang = false;
    at = 2_000;
    const mine = createMine({ view: "v", viewer: "u:a", state, now: () => at });
    await mine.ready;
    expect(mine.values()).toEqual({ k: "v" });
  });

  it("whose first read failed is read as its page is gone back to", async () => {
    let fail = true;
    const state = { read: vi.fn(async () => (fail ? Promise.reject(new Error("away")) : { k: "v" })), write: async () => ({ ok: true as const }) };
    let late = 0;
    const mine = createMine({ view: "v", viewer: "u:a", state, onLate: () => (late += 1) });
    await mine.ready;
    await expect(mine.get("k")).resolves.toMatchObject({ ok: false });
    fail = false;
    mine.reread();
    await settle(0);
    expect(late).toBe(1);
    await expect(mine.get("k")).resolves.toEqual({ ok: true, value: "v" });
  });

  it("that fails is asked again by the drawing that wanted it next", async () => {
    let fail = true;
    const state = { read: vi.fn(async () => (fail ? Promise.reject(new Error("away")) : { k: "v" })), write: async () => ({ ok: true as const }) };
    readAhead(state, seat, "v");
    await settle(0);
    fail = false;
    const mine = createMine({ view: "v", viewer: "u:a", state });
    await mine.ready;
    expect(mine.values()).toEqual({ k: "v" });
  });

  it("is asked again by a drawing gone back to, which is pushed what moved and not what did not", async () => {
    const values: Record<string, string> = { k: "v" };
    const state = { read: vi.fn(async () => ({ ...values })), write: async () => ({ ok: true as const }) };
    let late = 0;
    const mine = createMine({ view: "v", viewer: "u:a", state, onLate: () => (late += 1) });
    await mine.ready;
    mine.reread();
    await settle(0);
    expect(late).toBe(0);
    values.k = "from the phone";
    mine.reread();
    await settle(0);
    expect(late).toBe(1);
    expect(mine.values()).toEqual({ k: "from the phone" });
  });
});

describe("a guest in a worker", () => {
  it("survives the page around it being hidden while a part arrives, and shown again: one worker, not started over", async () => {
    const made: { terminated: boolean }[] = [];
    Object.assign(window, {
      Worker: class {
        terminated = false;
        onmessage = null;
        onerror = null;
        constructor() {
          made.push(this);
        }
        postMessage() {}
        terminate() {
          this.terminated = true;
        }
      },
    });
    const Guest = guestView({ worker: { script: "/* the guest */" }, name: "card" }) as ViewComponent<AnySchema>;
    let arrive: () => void = () => undefined;
    const arriving = new Promise<void>((resolve) => (arrive = resolve));
    const Waits = ({ children }: { readonly children?: ReactNode }) => {
      use(arriving);
      return <>{children}</>;
    };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const store = showroom() as unknown as Store<AnySchema>;
    const views = createViews(schema as never) as never;
    const draw = (waits: boolean) =>
      act(async () =>
        root.render(
          <GraviewProvider<AnySchema> store={store} views={views} principal={staff}>
            <Suspense fallback={<p>Arriving</p>}>
              <Guest nodes={[]} fidelity="full" cardinality="many" mode="fullscreen" selected={false} />
              {waits ? <Waits>Here</Waits> : null}
            </Suspense>
          </GraviewProvider>,
        ),
      );
    await draw(false);
    await vi.waitFor(() => expect(made).toHaveLength(1));
    await draw(true);
    expect(host.textContent).toContain("Arriving");
    await act(async () => arrive());
    await settle(0);
    expect(host.textContent).toContain("Here");
    expect(made).toHaveLength(1);
    expect(made[0]!.terminated).toBe(false);
    await act(async () => root.unmount());
    expect(made[0]!.terminated).toBe(true);
  });
});

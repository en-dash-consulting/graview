// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lazyModule } from "../../src/lazy-part.js";

/**
 * A LAZY PART THAT FAILED TO LOAD TRIES AGAIN, AND NEVER BREAKS THE PAGE
 * (FR-139).
 *
 * Graview Cloud's realtime harness took a person's browser offline for a
 * moment before their menu's chunk had arrived: from then on every open
 * threw into the embed, and only a reload brought the menu back. A part
 * that does not arrive says so in its place with a "Try again" button, and
 * is asked for again when the browser is back online and when it is pressed.
 */
describe("a lazy part", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  /** A loader that fails until it is let through. */
  const network = () => {
    const state = { up: false, calls: 0 };
    const load = () => {
      state.calls += 1;
      return state.up ? Promise.resolve({ Menu: ({ name }: { name: string }) => <button type="button" data-testid="menu">{name}</button> }) : Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
    };
    return { state, load };
  };
  const settle = () => act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

  it("says so in one line with a button, and throws nothing, while it cannot arrive", async () => {
    const { load } = network();
    const Menu = lazyModule(load).part((module, props: { name: string }) => <module.Menu {...props} />, { what: "Your menu" });
    await act(async () => {
      root.render(<Suspense fallback={<span data-testid="waiting" />}><Menu name="Ada" /></Suspense>);
    });
    await settle();
    const line = host.querySelector("[data-testid=lazy-part-missing]");
    expect(line?.querySelector("[role=status]")?.textContent).toContain("Your menu");
    expect(line?.textContent).toContain("Your menu");
    expect(host.querySelector("button[data-testid=lazy-part-retry]")?.textContent).toBe("Try again");
    expect(host.querySelector("[data-testid=menu]")).toBeNull();
  });

  it("arrives when the browser says it is back online, without a reload", async () => {
    const { state, load } = network();
    const Menu = lazyModule(load).part((module, props: { name: string }) => <module.Menu {...props} />);
    await act(async () => {
      root.render(<Suspense fallback={null}><Menu name="Ada" /></Suspense>);
    });
    await settle();
    expect(host.querySelector("[data-testid=lazy-part-missing]")).not.toBeNull();
    state.up = true;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await settle();
    expect(host.querySelector("[data-testid=menu]")?.textContent).toBe("Ada");
    expect(host.querySelector("[data-testid=lazy-part-missing]")).toBeNull();
  });

  it("asks again when Try again is pressed, and keeps the keyboard on what arrived", async () => {
    const { state, load } = network();
    const Menu = lazyModule(load).part((module, props: { name: string }) => <module.Menu {...props} />);
    await act(async () => {
      root.render(<Suspense fallback={null}><Menu name="Ada" /></Suspense>);
    });
    await settle();
    const retry = host.querySelector<HTMLButtonElement>("[data-testid=lazy-part-retry]")!;
    retry.focus();
    // Still away: the line stays, and so does the keyboard.
    await act(async () => retry.click());
    await settle();
    expect(document.activeElement).toBe(host.querySelector("[data-testid=lazy-part-retry]"));
    state.up = true;
    await act(async () => host.querySelector<HTMLButtonElement>("[data-testid=lazy-part-retry]")!.click());
    await settle();
    expect(host.querySelector("[data-testid=menu]")).not.toBeNull();
    expect(document.activeElement).toBe(host.querySelector("[data-testid=menu]"));
  });

  it("asks again when it is drawn again, and draws at once once it is here", async () => {
    const { state, load } = network();
    const module = lazyModule(load);
    const Menu = module.part((loaded, props: { name: string }) => <loaded.Menu {...props} />);
    await act(async () => {
      root.render(<Suspense fallback={null}><Menu name="Ada" /></Suspense>);
    });
    await settle();
    expect(module.failed).toBe(true);
    state.up = true;
    await act(async () => root.render(<Suspense fallback={null}><div /></Suspense>));
    await act(async () => root.render(<Suspense fallback={null}><Menu name="Grace" /></Suspense>));
    await settle();
    expect(host.querySelector("[data-testid=menu]")?.textContent).toBe("Grace");
  });

  it("draws nothing in its place when it is quiet", async () => {
    const { load } = network();
    const Rest = lazyModule(load).part((module, props: { name: string }) => <module.Menu {...props} />, { quiet: true });
    await act(async () => {
      root.render(<Suspense fallback={null}><Rest name="Ada" /></Suspense>);
    });
    await settle();
    expect(host.innerHTML).toBe("");
  });

  it("prefetches without a rejection anybody has to catch", async () => {
    const { load } = network();
    const module = lazyModule(load);
    module.prefetch();
    await settle();
    expect(module.failed).toBe(true);
    await expect(module.load()).rejects.toThrow(/Failed to fetch/);
  });
});

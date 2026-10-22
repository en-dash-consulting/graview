// @vitest-environment jsdom
import { Suspense, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createPartsWatch, lazyModule, lazyPart, partsArriving, partsWaiting, partsWatchMoved, PartsWatchContext, type PartsWatch } from "../../src/provider.js";

/**
 * A PART IS WAITED FOR UNTIL IT HAS DRAWN, NOT UNTIL ITS MODULE ARRIVED.
 *
 * `graview shots` photographed a declared lens's place — its title, its
 * line, and nothing under it — because the place said it had drawn while
 * the lens was still to come. The lens's module had arrived, so nothing
 * was on its way (`partsArriving`), but React reveals a part that suspended
 * in a commit of its own, held back up to 300 ms after the page around it
 * first drew; the page did not move for the moment the watch waited, and
 * the place was said drawn. A part that suspends under a watch is waited
 * for until it has drawn there. In a browser: `pnpm verify preview`.
 */

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = undefined;
  host = undefined;
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean, ms = 3000): Promise<boolean> {
  for (let spent = 0; spent < ms; spent += 10) {
    if (check()) return true;
    await tick(10);
  }
  return check();
}

/** A module that arrives when the test says. */
function controlled<M>(): { readonly load: () => Promise<M>; readonly arrive: (module: M) => void } {
  let arrive!: (module: M) => void;
  const going = new Promise<M>((resolve) => (arrive = resolve));
  return { load: () => going, arrive };
}

/** The place: its title drawn at once, the part under its own boundary, as a page draws a declared lens. */
function draw(watch: PartsWatch, Part: ComponentType) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    <PartsWatchContext.Provider value={watch}>
      <main>
        <h1>What to do</h1>
        <Suspense fallback={null}>
          <Part />
        </Suspense>
      </main>
    </PartsWatchContext.Provider>,
  );
}

describe("a part is waited for until it has drawn", () => {
  it("is waited for after its module arrived, until the commit that draws it", async () => {
    const watch = createPartsWatch();
    const module = controlled<{ readonly rows: string }>();
    const lens = lazyModule(module.load);
    const Lens = lens.part((m) => <p data-testid="rows">{m.rows}</p>);
    draw(watch, Lens);
    expect(await until(() => host!.querySelector("h1") !== null)).toBe(true);
    partsWatchMoved(watch);
    expect(partsWaiting(watch), "suspended: waited for").toBe(1);

    module.arrive({ rows: "Search lockfiles for the poisoned versions" });
    await tick();
    expect(partsArriving(), "its module is here").toBe(0);
    // React holds the reveal back a moment after the title drew: the place is not drawn yet, and says so.
    expect(host!.querySelector('[data-testid="rows"]'), "React holds the reveal back").toBeNull();
    expect(partsWaiting(watch), "arrived, not yet drawn: still waited for").toBe(1);

    expect(await until(() => host!.querySelector('[data-testid="rows"]') !== null)).toBe(true);
    expect(partsWaiting(watch), "drawn: waited for no longer").toBe(0);
  });

  it("forgets a part on a place that was left before it drew", async () => {
    const watch = createPartsWatch();
    const module = controlled<{ readonly rows: string }>();
    const Lens = lazyModule(module.load).part((m) => <p>{m.rows}</p>);
    draw(watch, Lens);
    expect(await until(() => host!.querySelector("h1") !== null)).toBe(true);
    partsWatchMoved(watch);
    expect(partsWaiting(watch)).toBe(1);
    // Another place, without the part: its boundary is gone, and nothing will draw it.
    root!.render(
      <PartsWatchContext.Provider value={watch}>
        <h1>Threats</h1>
      </PartsWatchContext.Provider>,
    );
    expect(await until(() => host!.textContent === "Threats")).toBe(true);
    partsWatchMoved(watch);
    expect(partsWaiting(watch), "the next place does not wait on the one left behind").toBe(0);
    module.arrive({ rows: "late" });
  });

  it("waits for a component behind React.lazy the same way", async () => {
    const watch = createPartsWatch();
    const module = controlled<{ readonly default: () => ReactNode }>();
    const Body = lazyPart(module.load);
    draw(watch, Body);
    expect(await until(() => host!.querySelector("h1") !== null)).toBe(true);
    partsWatchMoved(watch);
    expect(partsWaiting(watch)).toBe(1);
    module.arrive({ default: () => <p data-testid="body">Grouped by who does it.</p> });
    expect(await until(() => host!.querySelector('[data-testid="body"]') !== null)).toBe(true);
    expect(partsWaiting(watch)).toBe(0);
  });

  it("is not waited for where nothing watches the place", async () => {
    const module = controlled<{ readonly rows: string }>();
    const Lens = lazyModule(module.load).part((m) => <p data-testid="rows">{m.rows}</p>);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    root.render(
      <Suspense fallback={null}>
        <Lens />
      </Suspense>,
    );
    module.arrive({ rows: "here" });
    expect(await until(() => host!.querySelector('[data-testid="rows"]') !== null)).toBe(true);
  });
});

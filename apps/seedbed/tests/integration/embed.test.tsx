// @vitest-environment jsdom
import { Store } from "@graview/core";
import { mount } from "@graview/embed";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../../src/domain/chapters.js";
import { seedbedPages } from "../../src/ui/pages.js";
import { seedbedViews } from "../../src/ui/views.js";

/**
 * A chapter of the garden, mounted into an element that is not on any page:
 * what the marketing page, the docs and a builder's preview all do. The
 * proof is that the framework needs nothing from the document — no viewport,
 * no address bar, no :root theme — to show a declared app.
 */
// Motion off, as a test is: the scene lands on a view at once rather than
// flying there over 640ms, which is the framework's own reduced-motion path.
window.matchMedia = ((query: string) =>
  ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;

const seatOf = (chapter: (typeof CHAPTERS)[number], id: string) => chapter.seats!.find((seat) => seat.principal.id === id)!.principal;

/*
 * THE CASTS THAT ARE NOT HERE ARE THE POINT.
 *
 * `EmbedOptions.views` used to be typed as `ReturnType<typeof
 * registerDefaultViews>`, which erases to `AnySchema` — so passing the
 * registry an app wrote for its own declaration, the only thing the option
 * exists for, was a type error, and this file got past it with `as never` on
 * both sides. They are gone; `pnpm typecheck` is the criterion.
 */
describe("a chapter, embedded", () => {
  const chapter = CHAPTERS[10]!; // what grows where: four kinds, two lenses, a policy
  const into = () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    return element;
  };

  it("mounts from altitude, themed within the element, and the districts are there", () => {
    const element = into();
    const handle = mount(element, {
      app: chapter.app,
      seed: chapter.seed,
      face: "graview",
      principal: chapter.principal,
      views: (schema) => seedbedViews(schema, { lens: true, board: true }),
    });
    expect(element.querySelectorAll('[data-graview-view^="kind:"]').length).toBe(4);
    const style = element.querySelector("style")?.textContent ?? "";
    expect(style).toContain(".graview-embed-");
    expect(style).not.toContain(":root");
    expect(element.querySelector('[data-testid="embed-face-scene"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(element.querySelector('[data-testid="embed-face-graview"]')).toBeNull();
    expect(element.querySelector('[data-testid="standing"]')?.textContent).toContain("Everything is in order");
    handle.unmount();
    expect(element.innerHTML).toBe("");
  });

  it("switches faces: down into a district, and over to the pages", () => {
    const element = into();
    const handle = mount(element, { app: chapter.app, seed: chapter.seed, face: "graview", principal: chapter.principal, pages: seedbedPages(chapter.app.schema) });
    handle.setFace("scene");
    // Descended: the ground is no longer at altitude, and the shelf is drawn.
    expect(element.querySelector("[data-graview-altitude]")).toBeNull();
    expect(element.querySelectorAll("[data-graview-view]").length).toBeGreaterThan(0);
    handle.setFace("pages");
    expect(element.querySelector('nav[aria-label="Kinds"]')).not.toBeNull();
    expect(element.textContent).toContain("Plots");
    handle.setStop("#focus=plot-2");
    handle.setFace("scene");
    expect(element.querySelector('[data-graview-view="plot-2"]')).not.toBeNull();
    handle.unmount();
  });

  it("names the lenses on the strip, and a lens is a place you can get back to", async () => {
    const element = into();
    const handle = mount(element, {
      app: chapter.app,
      seed: chapter.seed,
      face: "scene",
      stop: "#focus=aggregate:gardener",
      principal: chapter.principal,
      views: (schema) => seedbedViews(schema, { lens: true, board: true }),
    });
    const place = () => element.querySelector<HTMLButtonElement>('[data-testid="place-gardener"]');
    expect(place()?.textContent).toBe("Who tends what");
    expect(element.querySelector('[data-testid="place-plot"]')?.textContent).toBe("What grows where");
    expect(place()?.getAttribute("aria-pressed")).toBe("true");
    // Into a gardener: the grid is gone, and the strip still says where it is.
    handle.setStop("#focus=ravi");
    // A fresh scene, as the face test does: the mounted one lands on the
    // next frame, which a static test never gets.
    handle.setFace("pages");
    handle.setFace("scene");
    expect(place()?.getAttribute("aria-pressed")).toBe("false");
    expect(element.querySelector('[data-graview-view="ravi"]')).not.toBeNull();
    // Pressing the place is the way back. (No face toggle here: a face
    // change re-applies the handle's last stop, which is the point of it.)
    place()?.click();
    // A click's update lands on the next microtask; the handle's own calls flush at once.
    await Promise.resolve();
    expect(place()?.getAttribute("aria-pressed")).toBe("true");
    handle.unmount();
  });

  it("lets a reader change seats, and the pages withhold by the seat that sat down", () => {
    const seven = CHAPTERS[6]!;
    const element = into();
    const handle = mount(element, {
      app: seven.app,
      seed: seven.seed,
      face: "pages",
      path: "/gardeners",
      principal: seven.principal,
      seats: seven.seats,
    });
    const seat = (id: string) => element.querySelector<HTMLButtonElement>(`[data-testid="embed-seat-${id}"]`);
    // Ravi, a gardener, is at the keyboard: welcoming a gardener is the coordinator's.
    expect(seat("ravi")?.getAttribute("aria-pressed")).toBe("true");
    expect(element.querySelector('[data-testid="withheld"]')?.textContent).toContain("coordinator can");
    handle.setSeat(seatOf(seven, "june"));
    expect(seat("june")?.getAttribute("aria-pressed")).toBe("true");
    expect(element.querySelector('[data-testid="withheld"]')).toBeNull();
    expect(element.querySelector('[data-testid="form-add-gardener"]')).not.toBeNull();
    handle.unmount();
  });

  /*
   * CHANGING SEATS IS NOT STARTING AGAIN. The reader sits somewhere else;
   * the graph, the log and the store itself are the same ones they were
   * looking at a moment ago — otherwise "what a gardener may not do" would
   * be demonstrated on a different garden.
   */
  it("keeps the store and its history across a change of seat", () => {
    const seven = CHAPTERS[6]!;
    const element = into();
    const store = new Store({
      schema: seven.app.schema,
      mutations: seven.app.mutations ?? [],
      invariants: seven.app.invariants ?? [],
      ...(seven.app.policy ? { policy: seven.app.policy } : {}),
      ...(seven.seed ? { snapshot: seven.seed as never } : {}),
    });
    const handle = mount(element, {
      app: seven.app,
      store,
      face: "pages",
      path: "/gardeners",
      principal: seven.principal,
      seats: seven.seats,
    });
    const before = {
      ops: store.log.all().length,
      nodes: store.graph.allNodes().length,
    };
    handle.setSeat(seatOf(seven, "june"));
    expect(store.log.all().length).toBe(before.ops);
    expect(store.graph.allNodes().length).toBe(before.nodes);
    // And what the new seat may do, it may do to the SAME graph.
    expect(element.querySelector('[data-testid="form-add-gardener"]')).not.toBeNull();
    handle.setSeat(seatOf(seven, "ravi"));
    expect(store.graph.allNodes().length).toBe(before.nodes);
    expect(element.querySelector('[data-testid="withheld"]')?.textContent).toContain("coordinator can");
    handle.unmount();
  });

  it("never touches the host page's address or theme", () => {
    const before = window.location.href;
    const element = into();
    const handle = mount(element, { app: chapter.app, seed: chapter.seed, face: "pages", pages: seedbedPages(chapter.app.schema), path: "/plots/plot-2" });
    expect(element.querySelector('[data-testid="plot-page"]')).not.toBeNull();
    expect(window.location.href).toBe(before);
    expect(getComputedStyle(document.documentElement).getPropertyValue("--graview-accent")).toBe("");
    handle.unmount();
  });
});

import { createMemoryAdapter } from "@graview/core";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../../src/domain/chapters.js";
import { EXAMPLE_GARDEN } from "../../src/domain/example.js";
import { seedbedSchema } from "../../src/domain/schema.js";
import { createSeedbedStore } from "../../src/domain/app.js";
import { openGarden, type EmptyChoice } from "../../src/open.js";

/**
 * THE STANDALONE GARDEN OPENS PLANTED. It used to open empty on purpose,
 * which made the first thing anybody saw a city of "none yet". Now it opens
 * on the garden the chapters build up to, and starting empty is one press
 * (or `?empty=1`) — remembered, and undone by "Load the example garden".
 */
const remembered = (): EmptyChoice & { held: boolean } => {
  const choice = {
    held: false,
    get: () => choice.held,
    set: (empty: boolean) => {
      choice.held = empty;
    },
  };
  return choice;
};
const kinds = (nodes: readonly { kind: string }[]) => new Set(nodes.map((node) => node.kind));

describe("the example garden", () => {
  it("is the chapters' last garden, kept to the kinds the finished declaration has", () => {
    const rotation = CHAPTERS.find((chapter) => chapter.slug === "the-rotation")!;
    const declared = new Set(seedbedSchema.kinds as readonly string[]);
    expect(EXAMPLE_GARDEN.nodes).toEqual(rotation.seed.nodes.filter((node) => declared.has(node.kind)));
    expect(kinds(EXAMPLE_GARDEN.nodes)).toEqual(new Set(["gardener", "plot", "planting", "rotation", "rule"]));
  });

  it("loads into the finished declaration and keeps its own agreement", () => {
    const store = createSeedbedStore({ snapshot: EXAMPLE_GARDEN as never });
    expect(store.graph.allNodes().length).toBe(EXAMPLE_GARDEN.nodes.length);
    expect(store.violations()).toEqual([]);
  });
});

describe("opening the garden", () => {
  it("opens with the example garden on a first visit", async () => {
    const opened = await openGarden({ adapter: createMemoryAdapter(), search: "", fresh: false, choice: remembered() });
    expect(opened.store.graph.allNodes().length).toBe(EXAMPLE_GARDEN.nodes.length);
    expect(opened.empty).toBe(false);
  });

  it("opens empty with ?empty=1, and remembers the choice", async () => {
    const adapter = createMemoryAdapter();
    const choice = remembered();
    const opened = await openGarden({ adapter, search: "?empty=1", fresh: false, choice });
    expect(opened.store.graph.allNodes()).toEqual([]);
    expect(choice.held).toBe(true);
    // The next visit, with no flag, is still empty: the choice is the person's.
    const again = await openGarden({ adapter, search: "", fresh: false, choice });
    expect(again.store.graph.allNodes()).toEqual([]);
    expect(again.empty).toBe(true);
  });

  it("starts empty from a planted garden and comes back to the example with fresh", async () => {
    const adapter = createMemoryAdapter();
    const choice = remembered();
    const planted = await openGarden({ adapter, search: "", fresh: false, choice });
    expect(planted.store.graph.allNodes().length).toBeGreaterThan(0);

    const emptied = await openGarden({ adapter, search: "?empty=1", fresh: false, choice });
    expect(emptied.store.graph.allNodes()).toEqual([]);

    const restored = await openGarden({ adapter, search: "?fresh=1", fresh: true, choice });
    expect(restored.store.graph.allNodes().length).toBe(EXAMPLE_GARDEN.nodes.length);
    expect(choice.held).toBe(false);
  });

  it("plants a garden that was stored empty before it had a seed", async () => {
    // A browser that opened the garden when it still started empty holds an empty snapshot.
    const adapter = createMemoryAdapter();
    await adapter.save("seedbed", { nodes: [], edges: [] });
    const opened = await openGarden({ adapter, search: "", fresh: false, choice: remembered() });
    expect(opened.store.graph.allNodes().length).toBe(EXAMPLE_GARDEN.nodes.length);
  });

  it("keeps what a person planted", async () => {
    const adapter = createMemoryAdapter();
    const choice = remembered();
    const emptied = await openGarden({ adapter, search: "?empty=1", fresh: false, choice });
    emptied.store.apply({ name: "add-gardener", args: { label: "Ada" } } as never);
    await new Promise((settled) => setTimeout(settled, 20));
    choice.set(false);
    const again = await openGarden({ adapter, search: "", fresh: false, choice });
    expect(again.store.graph.allNodes().map((node) => node.label)).toEqual(["Ada"]);
  });
});

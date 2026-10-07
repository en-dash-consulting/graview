// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import type { ToolCall } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ActivityRail, registerDefaultViews } from "../../src/index.js";

/**
 * A CALL'S CHIPS ARE TOLD APART BY THE ARGUMENT, not by what it says.
 *
 * The activity shows the words a call was handed, one chip each. Keyed by
 * the value, a piece of kit whose id is `trailer` and whose type is
 * `trailer` was two children with one key: React said so in the console
 * of every product that seeded such a thing, and is free to drop or
 * repeat one of them on the next render. Each argument has its own name,
 * and the name is the key.
 */
const equipment = defineNode("equipment", {
  fields: z.object({ label: z.string(), type: z.enum(["trailer", "extractor"]) }),
  plural: "Equipment",
});
const schema = createSchema([equipment]);
const { defineMutation } = bindSchema(schema);
const addEquipment = defineMutation("add-equipment", {
  title: "Add a piece of kit",
  creates: ["equipment"],
  input: z.object({ id: z.string(), label: z.string(), type: z.enum(["trailer", "extractor"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: args.id, kind: "equipment", label: args.label, type: args.type } as never),
});

let host: HTMLDivElement;
afterEach(() => {
  host?.remove();
  vi.restoreAllMocks();
});

describe("a call in the activity", () => {
  it("draws a chip for each argument, even when two of them say the same word", async () => {
    const store = new Store({ schema, mutations: [addEquipment] });
    store.apply({ name: "add-equipment", args: { id: "trailer", label: "Hive trailer", type: "trailer" } });
    const calls: readonly ToolCall[] = [
      {
        name: "add-equipment",
        args: { id: "trailer", label: "Hive trailer", type: "trailer" },
        mutating: true,
        phase: "ok",
        at: "2026-10-04T10:00:00.000Z",
      },
    ];
    const said: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => void said.push(parts.map(String).join(" ")));
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
          <ActivityRail calls={calls} />
        </GraviewProvider>,
      ),
    );
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    const call = host.querySelector('[data-testid="activity"] ol li')!;
    expect(call.querySelectorAll('[data-graview-primitive="chip"]')).toHaveLength(3);
    expect(said.filter((line) => line.includes("same key"))).toEqual([]);
    await act(async () => root.unmount());
  });

  it("draws a read's records once each, when it came to one by two roads", async () => {
    /* A neighborhood read lists each edge's far end, so a node joined to
       another twice reports it twice. */
    const store = new Store({ schema, mutations: [addEquipment] });
    const calls: readonly ToolCall[] = [
      { name: "neighbors", args: { id: "trailer" }, mutating: false, phase: "ok", at: "2026-10-04T10:00:00.000Z", reads: ["trailer", "extractor", "extractor"] },
    ];
    const said: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => void said.push(parts.map(String).join(" ")));
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW}>
          <ActivityRail calls={calls} />
        </GraviewProvider>,
      ),
    );
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    const reads = host.querySelector('[data-testid="activity-reads"]')!;
    expect([...reads.querySelectorAll('[data-graview-primitive="chip"]')].map((chip) => chip.getAttribute("data-graview-pick"))).toEqual([
      "trailer",
      "extractor",
    ]);
    expect(said.filter((line) => line.includes("same key"))).toEqual([]);
    await act(async () => root.unmount());
  });
});

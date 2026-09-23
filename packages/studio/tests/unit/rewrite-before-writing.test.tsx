// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { declaredCode } from "../../../ship/src/source-edit.js";
import { createStudio, InPlaceWriter, studioApp, type SourceChanges } from "../../src/index.js";
import type { StudioSchema } from "../../src/meta.js";

/**
 * NOTHING IS WRITTEN WHILE THE CODE STILL SAYS THE OLD THING.
 *
 * Moving `tended-by` from the plot to the planting leaves seedbed's `tend`
 * adding an edge from a plot, and its rule reading one. Each is put in
 * front of the person as it is written; the change is written only when
 * each has been rewritten or said to still hold — and then only the
 * rewritten one is sent as code.
 */
const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

describe("Apply, with code the change leaves wrong", () => {
  it("holds the write until each is rewritten or said to hold, then sends the rewrite with the change", async () => {
    // From the repository root: under jsdom a module's URL is not a file.
    const domain = (name: string) => resolve(process.cwd(), "apps/seedbed/src/domain", name);
    const code = declaredCode(ts, [
      { path: "src/domain/mutations.ts", text: await readFile(domain("mutations.ts"), "utf8") },
      { path: "src/domain/invariants.ts", text: await readFile(domain("invariants.ts"), "utf8") },
    ]);
    const posted: unknown[] = [];
    globalThis.fetch = (async (path: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posted.push(JSON.parse(init.body!));
        return { ok: true, json: async () => ({ written: ["src/domain/schema.ts", "src/domain/mutations.ts"], diff: [] }) };
      }
      expect(path).toBe("/__graview/studio/source");
      return { ok: true, json: async () => code };
    }) as never;

    const plan: SourceChanges = {
      changes: [{ what: "move-edge", edge: "tended-by", from: "plot", to: "planting", targets: '["gardener"]' }],
      rewrite: [],
      unwritten: [],
    };
    const studio = { ...createStudio(seedbedApp), sourceChanges: () => plan };
    const meta = studioApp();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider<StudioSchema> store={studio.store} views={registerDefaultViews(meta.schema, createViews(meta.schema))} initialView={EMPTY_VIEW}>
          <InPlaceWriter studio={studio as never} migration={null} files={[]} />
        </GraviewProvider>,
      ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    const rewrites = [...host.querySelectorAll('[data-testid="studio-rewrite"]')].map((one) => one.getAttribute("data-name"));
    expect(rewrites.sort()).toEqual(["every-plot-tended", "tend"]);
    const write = () => host.querySelector<HTMLButtonElement>('[data-testid="studio-write"]')!;
    expect(write().disabled).toBe(true);

    // The rule still holds as written (say); the act is rewritten.
    const rule = host.querySelector('[data-name="every-plot-tended"]')!;
    await act(async () => rule.querySelector<HTMLInputElement>('[data-testid="studio-rewrite-holds"]')!.click());
    expect(write().disabled).toBe(true);
    const tend = host.querySelector('[data-name="tend"]')!;
    const area = tend.querySelector<HTMLTextAreaElement>('[data-testid="studio-rewrite-code"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, '{\n  title: "Name a caretaker",\n  apply() {},\n}');
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(write().disabled).toBe(false);

    await act(async () => write().click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(posted).toEqual([
      {
        changes: [
          ...plan.changes,
          { what: "replace-act", act: "tend", text: '{\n  title: "Name a caretaker",\n  apply() {},\n}' },
        ],
      },
    ]);
    expect(host.querySelector('[data-testid="studio-written"]')?.textContent).toContain("src/domain/mutations.ts");
    await act(async () => root.unmount());
  });
});

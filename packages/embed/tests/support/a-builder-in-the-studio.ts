import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, type StudioOnApply } from "../../src/index.js";

/**
 * A BUILDER IN THE STUDIO, as the host-verdict tests drive it: the vendors
 * document mounted with the studio open, one edit made as a person makes it,
 * and Apply pressed. Each step waits on what it needs to be true, not on a
 * fixed time — the studio is a lazy chunk, and under a full `pnpm test` its
 * import alone outlasted a 1.6 s budget.
 */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendors.gdd.json"), "utf8")) as GraviewDocument;
const compiled = compileDocumentWithoutCheck(vendors);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;

/** Waits, a tick at a time inside `act`, until `ready` holds or `within` milliseconds have passed. */
export async function until(ready: () => boolean, within = 15_000): Promise<void> {
  const deadline = Date.now() + within;
  while (!ready() && Date.now() < deadline) await act(async () => new Promise((wait) => setTimeout(wait, 25)));
}

// The waits above are the bound now, not the default five seconds a test is given.
vi.setConfig({ testTimeout: 30_000 });

export const handles: EmbedHandle[] = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await act(async () => handle.unmount());
  document.body.innerHTML = "";
});

export async function builder(onApply: StudioOnApply): Promise<HTMLElement> {
  const element = document.createElement("div");
  document.body.append(element);
  await act(async () => {
    handles.push(mount(element, { app, principal: { kind: "human", id: "builder", roles: ["owner"] }, studio: { onApply }, stop: "#overview=1&in.studio=open", face: "graview", fonts: false } as EmbedOptions<AnySchema>));
  });
  await until(() => element.querySelector('[data-testid="studio"]') !== null);
  expect(element.querySelector('[data-testid="studio"]'), "the studio opened").not.toBeNull();
  return element;
}

export async function press(element: Element, testid: string): Promise<void> {
  const button = element.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
  expect(button, testid).not.toBeNull();
  await act(async () => button!.click());
  await act(async () => new Promise((wait) => setTimeout(wait, 0)));
}

/** Make a change in the studio as a person would: open the fields, pick vendor's notes, and remove it from the actions strip. */
export async function edit(element: Element): Promise<void> {
  const studio = element.querySelector('[data-testid="studio"]')!;
  const open = () => [...studio.querySelectorAll<HTMLButtonElement>('[data-graview-view="kind:field"] button')].find((button) => button.textContent?.includes("open"));
  const picked = () => studio.querySelector<HTMLElement>('[data-graview-pick="field:vendor.notes"]');
  // The scene may still be settling under a studio that arrived from cache: pressed until the fields are open.
  for (const deadline = Date.now() + 15_000; !picked() && Date.now() < deadline; ) {
    const button = open();
    if (button && button.getAttribute("aria-expanded") !== "true") await act(async () => button.click());
    await act(async () => new Promise((wait) => setTimeout(wait, 25)));
  }
  const pick = picked();
  expect(pick, "vendor's notes in the scene").not.toBeNull();
  await act(async () => {
    pick!.focus();
    pick!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  const removing = () => [...studio.querySelectorAll<HTMLButtonElement>('[data-testid="inspector-strip"] [data-affordance]')].find((button) => button.textContent?.startsWith("Remove the field"));
  await until(() => removing() !== undefined);
  expect(removing(), "the act that removes the field").toBeDefined();
  await act(async () => removing()!.click());
}

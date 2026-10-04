// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocumentWithoutCheck, type GraviewDocument } from "@graview/core/document";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, type StudioApplied, type StudioOnApply } from "../../src/index.js";

/**
 * FR-65: A HOST'S REFUSAL IN ITS OWN WORDS.
 *
 * A host that refused could only say why as findings, under the studio's own
 * heading — "Not kept: the host could not keep this change" — so a host whose
 * reason is one sentence ("Your plan keeps three apps; this would be a
 * fourth") had to dress it as a finding at a made-up path. The verdict may
 * now carry a `sentence`, which the studio says as its heading in place of
 * its own, with findings or with none. And an Apply with nothing changed
 * says so in the studio's words before the host is asked anything.
 */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendors.gdd.json"), "utf8")) as GraviewDocument;
const compiled = compileDocumentWithoutCheck(vendors);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;

const handles: EmbedHandle[] = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await act(async () => handle.unmount());
  document.body.innerHTML = "";
});

async function builder(onApply: StudioOnApply) {
  const element = document.createElement("div");
  document.body.append(element);
  await act(async () => {
    handles.push(mount(element, { app, principal: { kind: "human", id: "builder", roles: ["owner"] }, studio: { onApply }, stop: "#overview=1&in.studio=open", face: "graview", fonts: false } as EmbedOptions<AnySchema>));
  });
  for (let tries = 0; tries < 40 && !element.querySelector('[data-testid="studio"]'); tries += 1) {
    await act(async () => new Promise((wait) => setTimeout(wait, 40)));
  }
  expect(element.querySelector('[data-testid="studio"]'), "the studio opened").not.toBeNull();
  return element;
}

const press = async (element: Element, testid: string) => {
  const button = element.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);
  expect(button, testid).not.toBeNull();
  await act(async () => button!.click());
  await act(async () => new Promise((wait) => setTimeout(wait, 0)));
};

/** Make a change in the studio as a person would: open the fields, pick vendor's notes, and remove it from the actions strip. */
async function edit(element: Element) {
  const studio = element.querySelector('[data-testid="studio"]')!;
  const open = [...studio.querySelectorAll<HTMLButtonElement>('[data-graview-view="kind:field"] button')].find((button) => button.textContent?.includes("open"));
  // The scene may still be settling under a studio that arrived from cache: pressed until the fields are open.
  for (let tries = 0; tries < 20 && !studio.querySelector('[data-graview-pick="field:vendor.notes"]'); tries += 1) {
    if (open!.getAttribute("aria-expanded") !== "true") await act(async () => open!.click());
    await act(async () => new Promise((wait) => setTimeout(wait, 50)));
  }
  const pick = studio.querySelector<HTMLElement>('[data-graview-pick="field:vendor.notes"]');
  expect(pick, "vendor's notes in the scene").not.toBeNull();
  await act(async () => {
    pick!.focus();
    pick!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  const remove = [...studio.querySelectorAll<HTMLButtonElement>('[data-testid="inspector-strip"] [data-affordance]')].find((button) => button.textContent?.startsWith("Remove the field"));
  await act(async () => remove!.click());
}

const SENTENCE = "Your plan keeps three apps, and this change would make a fourth.";

describe("a host refuses in its own words", () => {
  it("a verdict's sentence is the heading, in place of the studio's own, with no findings at all", async () => {
    const element = await builder(() => ({ ok: false, sentence: SENTENCE }));
    await edit(element);
    await press(element, "studio-apply");
    const panel = element.querySelector('[data-testid="studio-applied"]');
    expect(panel?.getAttribute("data-applied")).toBe("refused-by-host");
    expect(panel?.querySelector("strong")?.textContent?.trim()).toBe(SENTENCE);
    expect(panel?.textContent).not.toContain("the host could not keep this change");
    expect(panel?.textContent).not.toContain("Handed to the host");
    expect(panel?.querySelector('[data-testid="studio-host-findings"]'), "no list of nothing").toBeNull();
    expect(element.querySelector('[data-testid="studio"]'), "still open").not.toBeNull();
  });

  it("a sentence with an empty list of findings says the sentence and lists nothing", async () => {
    const element = await builder(() => ({ ok: false, sentence: SENTENCE, findings: [] }));
    await edit(element);
    await press(element, "studio-apply");
    const panel = element.querySelector('[data-testid="studio-applied"]');
    expect(panel?.querySelector("strong")?.textContent?.trim()).toBe(SENTENCE);
    expect(panel?.querySelector('[data-testid="studio-host-findings"]')).toBeNull();
  });

  it("a sentence with findings says the sentence, then the findings", async () => {
    const element = await builder(async () => ({ ok: false, sentence: SENTENCE, findings: [{ severity: "error", code: "plan-limit", path: "kinds", message: "three apps on the Studio plan" }] }));
    await edit(element);
    await press(element, "studio-apply");
    await act(async () => new Promise((wait) => setTimeout(wait, 0)));
    const panel = element.querySelector('[data-testid="studio-applied"]');
    expect(panel?.querySelector("strong")?.textContent?.trim()).toBe(SENTENCE);
    expect(panel?.querySelector('[data-testid="studio-host-findings"]')?.textContent).toContain("three apps on the Studio plan");
  });

  it("without a sentence the studio's own heading stays", async () => {
    const element = await builder(() => ({ ok: false, findings: [{ severity: "error", code: "host-refused", path: "", message: "not today" }] }));
    await edit(element);
    await press(element, "studio-apply");
    expect(element.querySelector('[data-testid="studio-applied"] strong')?.textContent).toContain("Not kept: the host could not keep this change. Your edits are still here.");
  });
});

describe("an Apply with nothing changed", () => {
  it("says so in the studio's own words, and the host is not asked", async () => {
    const handed: StudioApplied[] = [];
    const element = await builder((applied) => void handed.push(applied));
    await press(element, "studio-apply");
    const panel = element.querySelector('[data-testid="studio-applied"]');
    expect(panel?.getAttribute("data-applied")).toBe("unchanged");
    expect(panel?.textContent).toContain("Nothing to apply");
    expect(panel?.textContent).not.toContain("Handed to the host");
    expect(handed, "onApply was not called").toEqual([]);
    expect(element.querySelector('[data-testid="studio"]'), "still open").not.toBeNull();
  });

  it("a change made and taken back again is nothing changed", async () => {
    const handed: StudioApplied[] = [];
    const element = await builder((applied) => void handed.push(applied));
    await edit(element);
    await press(element, "studio-apply");
    expect(handed).toHaveLength(1);
    // Put vendor's notes back by undoing the removal on the studio's own rail.
    const studio = element.querySelector('[data-testid="studio"]')!;
    await act(async () => studio.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    const undo = studio.querySelector<HTMLButtonElement>('[data-testid="undo-turn"]');
    expect(undo, "the studio's undo").not.toBeNull();
    await act(async () => undo!.click());
    await press(element, "studio-apply");
    expect(element.querySelector('[data-testid="studio-applied"]')?.getAttribute("data-applied")).toBe("unchanged");
    expect(handed).toHaveLength(1);
  });
});

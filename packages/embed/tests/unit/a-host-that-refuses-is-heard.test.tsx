// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocument, type Finding, type GraviewDocument } from "@graview/core/document";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type EmbedHandle, type EmbedOptions, type StudioApplied, type StudioOnApply } from "../../src/index.js";

/**
 * FR-60: A HOST THAT REFUSES IS HEARD.
 *
 * `onApply` returned nothing, so with `documentFindings` in hand — a change
 * Graview Cloud cannot preview, because no edit says it — the studio still
 * said "The checker is happy. Handed to the host to keep" while the host's
 * page previewed nothing. Now `onApply` may return, or resolve to,
 * `{ ok: false, findings }`: the studio shows those findings in its applied
 * panel, says nothing about keeping, and stays open on the edits as they are.
 */
const vendors = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../../core/tests/document/fixtures/vendors.gdd.json"), "utf8")) as GraviewDocument;
const compiled = compileDocument(vendors, { skipFrameworkCheck: true });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;

const REFUSAL: Finding = { severity: "error", code: "studio-unsaid", path: "kinds.vendor.edges.fills", message: "the fills relation's cardinality changed; an edit does not change a relation", fix: "make this change in the document itself" };

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
  await act(async () => open!.click());
  const pick = studio.querySelector<HTMLElement>('[data-graview-pick="field:vendor.notes"]');
  expect(pick, "vendor's notes in the scene").not.toBeNull();
  await act(async () => {
    pick!.focus();
    pick!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  const remove = [...studio.querySelectorAll<HTMLButtonElement>('[data-testid="inspector-strip"] [data-affordance]')].find((button) => button.textContent?.startsWith("Remove the field"));
  await act(async () => remove!.click());
}

describe("a host that keeps the declaration, and refuses a change", () => {
  it("is shown refusing, with its findings, and the studio stays open with the edits intact", async () => {
    const handed: StudioApplied[] = [];
    const element = await builder((applied) => {
      handed.push(applied);
      return { ok: false, findings: [REFUSAL] };
    });
    await edit(element);
    await press(element, "studio-apply");
    const panel = element.querySelector('[data-testid="studio-applied"]');
    expect(panel?.getAttribute("data-applied")).toBe("refused-by-host");
    expect(panel?.textContent).not.toContain("Handed to the host");
    expect(panel?.textContent).toContain("Not kept");
    expect(panel?.querySelector('[data-testid="studio-host-findings"]')?.textContent).toContain(REFUSAL.message);
    expect(panel?.textContent).toContain(REFUSAL.path);
    expect(element.querySelector('[data-testid="studio"]'), "still open").not.toBeNull();
    // The edits are where they were: Apply again hands the host the same change.
    expect(handed[0]!.edits).toEqual([{ op: "remove-field", kind: "vendor", field: "notes" }]);
    await press(element, "studio-apply");
    expect(handed).toHaveLength(2);
    expect(handed[1]!.edits).toEqual(handed[0]!.edits);
  });

  it("a promise the host keeps its answer in is waited for, then heard", async () => {
    let answer!: (verdict: { ok: false; findings: readonly Finding[] }) => void;
    const element = await builder(() => new Promise((resolve) => (answer = resolve)));
    await press(element, "studio-apply");
    expect(element.querySelector('[data-testid="studio-applied"]')?.getAttribute("data-applied")).toBe("asking");
    expect(element.querySelector('[data-testid="studio-applied"]')?.textContent).not.toContain("Handed to the host");
    await act(async () => answer({ ok: false, findings: [REFUSAL] }));
    expect(element.querySelector('[data-testid="studio-applied"]')?.getAttribute("data-applied")).toBe("refused-by-host");
  });

  it("a host that keeps it, saying so or saying nothing, is still said to have it", async () => {
    for (const onApply of [() => ({ ok: true }) as const, () => undefined]) {
      const element = await builder(onApply);
      await press(element, "studio-apply");
      const panel = element.querySelector('[data-testid="studio-applied"]');
      expect(panel?.getAttribute("data-applied")).toBe("kept");
      expect(panel?.textContent).toContain("Handed to the host to keep");
      await act(async () => handles.pop()!.unmount());
      element.remove();
    }
  });
});

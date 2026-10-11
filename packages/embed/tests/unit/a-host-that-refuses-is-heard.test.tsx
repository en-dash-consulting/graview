// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { Finding } from "@graview/core/document";
import { act } from "react";
import { describe, expect, it } from "vitest";
import type { StudioApplied } from "../../src/index.js";
import { builder, edit, handles, press } from "../support/a-builder-in-the-studio.js";

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
const REFUSAL: Finding = { severity: "error", code: "studio-unsaid", path: "kinds.vendor.edges.fills", message: "the fills relation's cardinality changed; an edit does not change a relation", fix: "make this change in the document itself" };

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
    // A change to hand over: with nothing changed the host is not asked at all (FR-65).
    await edit(element);
    await press(element, "studio-apply");
    expect(element.querySelector('[data-testid="studio-applied"]')?.getAttribute("data-applied")).toBe("asking");
    expect(element.querySelector('[data-testid="studio-applied"]')?.textContent).not.toContain("Handed to the host");
    await act(async () => answer({ ok: false, findings: [REFUSAL] }));
    expect(element.querySelector('[data-testid="studio-applied"]')?.getAttribute("data-applied")).toBe("refused-by-host");
  });

  it("a host that keeps it, saying so or saying nothing, is still said to have it", async () => {
    for (const onApply of [() => ({ ok: true }) as const, () => undefined]) {
      const element = await builder(onApply);
      await edit(element);
      await press(element, "studio-apply");
      const panel = element.querySelector('[data-testid="studio-applied"]');
      expect(panel?.getAttribute("data-applied")).toBe("kept");
      expect(panel?.textContent).toContain("Handed to the host to keep");
      await act(async () => handles.pop()!.unmount());
      element.remove();
    }
  });
});

// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { EdgeSigns } from "../../src/edge-signs.js";

/**
 * AN EDGE SIGN STEPS PAST A DISTRICT'S NAME. On graview.dev's landing page
 * at 600 wide the sign for Decision records, past the right edge, stepped
 * down past the corner Up and the key stand in — and stood on "MODULES 16
 * ⚠ 10", the name of the district just under the corner, so a press on
 * the problem count landed on the sign. A district's name holds a control;
 * a sign steps past it as it steps past the corner.
 */
const schema = createSchema([
  defineNode("decision", { fields: z.object({ label: z.string() }), plural: "Decision records" }),
  defineNode("module", { fields: z.object({ label: z.string() }), plural: "Modules" }),
] as never);

const WINDOW = { width: 550, height: 360 };
const CORNER = { x: WINDOW.width - 176, y: 0, width: 176, height: 100 };
const district = (kind: string, x: number, y: number) => ({ id: `kind:${kind}`, kind: "", plane: 2, x, y, width: 120, height: 60 }) as never;
/* Modules' card at 300,40; its name under it, from 320 to 550 across and 104 to 130 down: right where a sign below the corner stands. */
const NAME = { id: "kind:module", x: 20, y: 64, width: 230, height: 26 };
const result = (nameplates: readonly (typeof NAME)[] | undefined) =>
  ({
    width: WINDOW.width,
    height: WINDOW.height,
    city: { cell: 20, originX: 0, originY: 0, pan: { x: 0, y: 0 }, extent: { x: 0, y: 0, width: 760, height: 360 }, ...(nameplates ? { nameplates } : {}) },
    nodes: [district("decision", 640, 30), district("module", 300, 40)],
  }) as never;

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => host.remove());

/** The sign's upper and lower edges: it is centered on `top` (translateY(-50%)) and 36 tall with its gap. */
const signSpan = (): { top: number; bottom: number } => {
  const sign = host.querySelector<HTMLElement>('[data-graview-past-edge="kind:decision"]');
  expect(sign, "the sign for Decision records").not.toBeNull();
  const at = parseFloat(sign!.style.top);
  return { top: at - 18, bottom: at + 18 };
};

describe("an edge sign beside a district's name", () => {
  it("stood on the name when it knew only the corner", () => {
    const root = createRoot(host);
    act(() => root.render(<EdgeSigns result={result(undefined)} schema={schema as never} chrome={[CORNER]} onGo={() => {}} />));
    const { top, bottom } = signSpan();
    const name = { top: 40 + NAME.y, bottom: 40 + NAME.y + NAME.height };
    expect(top < name.bottom && name.top < bottom).toBe(true);
    act(() => root.unmount());
  });

  it("steps past the corner and then past the name under it", () => {
    const root = createRoot(host);
    act(() => root.render(<EdgeSigns result={result([NAME])} schema={schema as never} chrome={[CORNER]} onGo={() => {}} />));
    const { top } = signSpan();
    expect(top).toBeGreaterThanOrEqual(40 + NAME.y + NAME.height);
    act(() => root.unmount());
  });
});

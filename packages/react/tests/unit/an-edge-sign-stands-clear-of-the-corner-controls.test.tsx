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
 * AN EDGE SIGN STANDS CLEAR OF THE CORNER CONTROLS. On a phone the city
 * runs past the right edge near the top, and the sign for the district out
 * there was drawn under "Close the map": its name read through the control
 * and neither could be pressed for the other. The corner the altitude
 * control and the key stand in is ground a sign steps past.
 */
const schema = createSchema([
  defineNode("decision", { fields: z.object({ label: z.string() }), plural: "Decision records" }),
  defineNode("module", { fields: z.object({ label: z.string() }), plural: "Modules" }),
] as never);

const PHONE = { width: 344, height: 305 };
/* The layout's chrome on a phone: the corner Up and the Key stand in, 176 by 100 in the top right. */
const CORNER = { x: PHONE.width - 176, y: 0, width: 176, height: 100 };
const district = (kind: string, x: number, y: number) => ({ id: `kind:${kind}`, kind: "", plane: 2, x, y, width: 60, height: 40 }) as never;
/* Decision records past the right edge, level with the corner; Modules on the ground. */
const result = {
  width: PHONE.width,
  height: PHONE.height,
  city: { cell: 20, originX: 0, originY: 0, pan: { x: 0, y: 0 }, extent: { x: -40, y: 0, width: 520, height: 305 } },
  nodes: [district("decision", 380, 30), district("module", 140, 150)],
} as never;

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => host.remove());

const signTop = (): number => {
  const sign = host.querySelector<HTMLElement>('[data-graview-past-edge="kind:decision"]');
  expect(sign, "the sign for Decision records").not.toBeNull();
  return parseFloat(sign!.style.top);
};

describe("an edge sign", () => {
  it("stands where its district lies when nothing is in the corner", () => {
    const root = createRoot(host);
    act(() => root.render(<EdgeSigns result={result} schema={schema as never} onGo={() => {}} />));
    // Level with the district, held off the very top by the margin.
    expect(signTop()).toBeLessThan(CORNER.y + CORNER.height);
    act(() => root.unmount());
  });

  it("steps below the corner the altitude control and the key stand in", () => {
    const root = createRoot(host);
    act(() => root.render(<EdgeSigns result={result} schema={schema as never} chrome={[CORNER]} onGo={() => {}} />));
    // The sign is centered on `top` (translateY(-50%)), so its upper edge is half a sign above it.
    expect(signTop() - 18).toBeGreaterThanOrEqual(CORNER.y + CORNER.height);
    act(() => root.unmount());
  });
});

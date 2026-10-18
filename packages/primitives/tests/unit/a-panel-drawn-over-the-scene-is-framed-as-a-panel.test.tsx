// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { catalogOf, type AiPanel } from "@graview/core/catalog";
import { EMPTY_VIEW, kindCardId } from "@graview/layout";
import { BesideTheMap, createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DraftDoor, MapPanel, registerDefaultViews } from "../../src/index.js";
import { useInlineEnv, type InlineEnv } from "../../src/inline-ai-env.js";
import { drawPanel } from "../../src/inline-ai-menu.js";

/*
 * A PANEL DRAWN OVER THE SCENE IS FRAMED AS A PANEL (FR-184). Drawn from
 * the menu while the city stood at altitude with a district chosen, the
 * draft was a bare list on the dark ground — "Draft — A list of sessions ·
 * Keep as a lens · Discard" — with the district's panel still open beside
 * it, about something else. It stands on the scene's surface in a frame
 * of its own, and what stood beside the map is put away while it does.
 */
const session = defineNode("session", { fields: z.object({ label: z.string(), track: z.enum(["main", "side"]).default("main") }), plural: "Sessions", noun: "session" });
const schema = createSchema([session]);
const store = () =>
  new Store({
    schema,
    snapshot: { nodes: [1, 2, 3].map((n) => ({ id: `s-${n}`, kind: "session", label: `Session ${n}`, track: n === 1 ? "side" : "main" })) as never, edges: [] },
  });

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800, toJSON: () => ({}) }) as DOMRect;

let env: InlineEnv | undefined;
function Env() {
  env = useInlineEnv();
  return null;
}

const turns = async (until: () => boolean) => {
  for (let tick = 0; tick < 80 && !until(); tick += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
};

describe("a panel drawn over the scene", () => {
  it("stands framed on the scene's surface, and the district's panel beside the map is put away while it does", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const given = store();
    await act(async () =>
      root.render(
        <GraviewProvider store={given} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} initialSelection={[kindCardId("session")]}>
          <BesideTheMap.Provider value={true}>
            <Env />
            <DraftDoor />
            <MapPanel />
          </BesideTheMap.Provider>
        </GraviewProvider>,
      ),
    );
    await turns(() => host.querySelector('[data-testid="district-panel"]') !== null);
    expect(host.querySelector('[data-testid="district-panel"]')).not.toBeNull();

    const candidate = catalogOf(given, { on: "list", kind: "session" }, { principal: env!.principal }).candidates.find((one) => one.type === "panel");
    expect(candidate?.type).toBe("panel");
    const panel: AiPanel = { title: "A list of sessions", recipe: { ...(candidate as Extract<typeof candidate, { type: "panel" }>)!.panel, title: "A list of sessions" } };
    await act(async () => void (await drawPanel(env!, panel)));
    await turns(() => host.querySelector('[data-testid="draft-frame"]') !== null);

    const frame = host.querySelector<HTMLElement>('[data-testid="draft-frame"]')!;
    expect(frame).not.toBeNull();
    // On the scene's surface, in a frame of its own: the panel's ground, an edge and rounded corners — not the bare ground.
    expect(frame.getAttribute("data-graview-draft-frame")).toBe("scene");
    expect(frame.style.background).toContain("--graview-panel");
    expect(frame.style.background).not.toContain("--graview-ground");
    expect(frame.style.border).toContain("--graview-edge");
    expect(frame.style.borderRadius).not.toBe("");
    // The district's panel, about something else, is put away while the draft stands.
    expect(host.querySelector('[data-testid="district-panel"]')).toBeNull();

    // Put away, the district's panel is back.
    await act(async () => host.querySelector<HTMLElement>('[data-testid="draft-discard"]')!.click());
    await turns(() => host.querySelector('[data-testid="district-panel"]') !== null);
    expect(host.querySelector('[data-testid="district-panel"]')).not.toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});

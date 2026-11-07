import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { ECONOMICS_MANIFEST, kit, placementApp, placementSeed } from "../../../../scripts/fixtures/placement-app.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { checkPresses } from "../../src/headless/presses.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A PRESS ON A CONTROL ALREADY IN ITS STATE PASSES THE CHECK (Roadmap
 * f-view-authoring-friction-2026-11). The press check refused a rock
 * collection's "All" chip, pressed while nothing was filtered, as a control
 * that does nothing — though leaving the view as it is is exactly right
 * there. A press that changes nothing on a control that says it is in that
 * state (`aria-pressed="true"`, `aria-current`, `aria-selected`) passes;
 * one that says no state and changes nothing still fails.
 */
const store = () => new Store({ schema: placementApp.schema, mutations: placementApp.mutations ?? [], policy: placementApp.policy!, snapshot: structuredClone(placementSeed) as never }) as unknown as Store<AnySchema>;
const manifest = ECONOMICS_MANIFEST as unknown as WorkerViewManifest;
const checked = async (source: string) => {
  const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: kit, run: nodeIsolate(), input: { node: { id: "placement:rhea" } }, presses: checkPresses });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result as HeadlessDescribed;
};

const CHIPS = `
let filter = "all";
let tab = "rocks";
const draw = () => graview.render(graview.html\`<div role="group" aria-label="Show">
  <button id="all" aria-pressed="\${filter === "all" ? "true" : "false"}">All</button>
  <button id="igneous" aria-pressed="\${filter === "igneous" ? "true" : "false"}">Igneous</button>
</div>
<div role="tablist"><span role="tab" id="rocks" tabindex="0" aria-selected="\${tab === "rocks" ? "true" : "false"}">Rocks</span></div>
<nav><a id="here" aria-current="page">Page 1</a></nav>
<button id="plain">Shuffle</button>\`);
graview.onProps(() => draw());
graview.on("click", "#all", () => { filter = "all"; draw(); });
graview.on("click", "#igneous", () => { filter = "igneous"; draw(); });
graview.on("click", "#rocks", () => { tab = "rocks"; draw(); });
graview.on("click", "#here", () => draw());
graview.on("click", "#plain", () => draw());
`;

describe("the press check, on a control already in its state", () => {
  it("passes an All chip pressed while nothing is filtered, an open tab and the page a pager is on, saying the state each shows", async () => {
    const { presses } = await checked(CHIPS);
    const said = Object.fromEntries((presses?.controls ?? []).map((one) => [one.control, one]));
    expect(said["“All”"]).toMatchObject({ ok: true, says: "“All” is already in the state it shows (aria-pressed=\"true\"): pressed, it leaves the view as it is." });
    expect(said["“Rocks”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-selected="true"') });
    expect(said["“Page 1”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-current="page"') });
    expect(said["“Igneous”"]).toMatchObject({ ok: true, says: "“Igneous”, pressed, draws again." });
  });

  it("still fails a control that shows no state and changes nothing when pressed", async () => {
    const { presses } = await checked(CHIPS);
    expect(presses?.problems.map((one) => one.says)).toEqual(["“Shuffle” does nothing when pressed: the view hears the click, and asks for no act, goes nowhere and draws nothing new."]);
  });
});

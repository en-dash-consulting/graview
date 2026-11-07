import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { ECONOMICS_MANIFEST, kit, placementApp, placementSeed } from "../../../../scripts/fixtures/placement-app.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { checkPresses } from "../../src/headless/presses.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A PRESS ON A CONTROL ALREADY IN ITS STATE PASSES THE CHECK, ONE OF A SET
 * (Roadmap f-view-authoring-friction-2026-11). The press check refused a rock
 * collection's "All" chip, pressed while nothing was filtered, as a control
 * that does nothing, though leaving the view as it is is right there. It
 * exists because "the Save button doesn't work… this would never be the case.
 * Ever." — so a state alone does not excuse a press. It passes only where
 * another control of its set says the same attribute's other state, so it is
 * really a choice among them, and the attribute is one its role can say.
 */
const store = () => new Store({ schema: placementApp.schema, mutations: placementApp.mutations ?? [], policy: placementApp.policy!, snapshot: structuredClone(placementSeed) as never }) as unknown as Store<AnySchema>;
const manifest = ECONOMICS_MANIFEST as unknown as WorkerViewManifest;
const checked = async (source: string) => {
  const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: kit, run: nodeIsolate(), input: { node: { id: "placement:rhea" } }, presses: checkPresses });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result as HeadlessDescribed;
};
/** A view of these buttons, whose every click draws the same again. */
const dead = (markup: string, ...selectors: string[]) => `
const draw = () => graview.render(graview.html\`${markup}\`);
graview.onProps(() => draw());
${selectors.map((selector) => `graview.on("click", ${JSON.stringify(selector)}, () => draw());`).join("\n")}
`;
const saidOf = async (source: string) => Object.fromEntries(((await checked(source)).presses?.controls ?? []).map((one) => [one.control, one]));

const CHIPS = `
let filter = "all";
let tab = "rocks";
const draw = () => graview.render(graview.html\`<div role="group" aria-label="Show">
  <button id="all" aria-pressed="\${filter === "all" ? "true" : "false"}">All</button>
  <button id="igneous" aria-pressed="\${filter === "igneous" ? "true" : "false"}">Igneous</button>
</div>
<div role="tablist"><span role="tab" id="rocks" tabindex="0" aria-selected="\${tab === "rocks" ? "true" : "false"}">Rocks</span><span role="tab" id="minerals" tabindex="0" aria-selected="\${tab === "minerals" ? "true" : "false"}">Minerals</span></div>
<div><a id="here" aria-current="page">Page 1</a><a id="there" aria-current="false">Page 2</a></div>
<button id="plain">Shuffle</button>\`);
graview.onProps(() => draw());
graview.on("click", "#all", () => { filter = "all"; draw(); });
graview.on("click", "#igneous", () => { filter = "igneous"; draw(); });
graview.on("click", "#rocks", () => { tab = "rocks"; draw(); });
graview.on("click", "#minerals", () => { tab = "minerals"; draw(); });
graview.on("click", "#here", () => draw());
graview.on("click", "#there", () => draw());
graview.on("click", "#plain", () => draw());
`;

describe("the press check, on a control already in its state", () => {
  it("passes an All chip beside its other chips, an open tab beside another and the page a pager is on beside another, saying the state each shows", async () => {
    const said = await saidOf(CHIPS);
    expect(said["“All”"]).toMatchObject({ ok: true, says: "“All” is already in the state it shows (aria-pressed=\"true\"): pressed, it leaves the view as it is." });
    expect(said["“Rocks”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-selected="true"') });
    expect(said["“Page 1”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-current="page"') });
    expect(said["“Igneous”"]).toMatchObject({ ok: true, says: "“Igneous”, pressed, draws again." });
  });

  it("still fails a control that shows no state and changes nothing when pressed", async () => {
    const { presses } = await checked(CHIPS);
    expect(presses?.problems.map((one) => one.says).filter((one) => one.includes("Shuffle"))).toEqual(["“Shuffle” does nothing when pressed: the view hears the click, and asks for no act, goes nowhere and draws nothing new."]);
  });

  it("finds a set by its group as well as its parent", async () => {
    const said = await saidOf(dead(`<div role="radiogroup"><p><span id="a" role="radio" tabindex="0" aria-checked="true">Rocks</span></p><p><span id="b" role="radio" tabindex="0" aria-checked="false">Minerals</span></p></div>`, "#a", "#b"));
    expect(said["“Rocks”"]?.ok).toBe(true);
  });

  for (const [name, markup, control] of [
    ["a Save that says it is pressed", `<button id="x" aria-pressed="true">Save changes</button>`, "“Save changes”"],
    ["a Delete that says it is a switch that is on", `<button id="x" role="switch" aria-checked="true">Delete record</button>`, "“Delete record”"],
    ["a Submit that says it is selected", `<button id="x" aria-selected="true">Submit</button>`, "“Submit”"],
    ["a Save whose aria-current is empty", `<button id="x" aria-current="">Save</button>`, "“Save”"],
    ["a Save whose aria-current says undefined, beside one that says false", `<div><button id="x" aria-current="undefined">Save</button><button id="y" aria-current="false">Other</button></div>`, "“Save”"],
    ["a Save selected beside a button that is no tab, though both say the attribute", `<div><button id="x" aria-selected="true">Save</button><button id="y" aria-selected="false">Other</button></div>`, "“Save”"],
    ["a Save checked with no checkable role, beside another", `<div><button id="x" aria-checked="true">Save</button><button id="y" aria-checked="false">Other</button></div>`, "“Save”"],
  ] as const) {
    it(`fails ${name}: a state alone does not excuse a press that does nothing`, async () => {
      const said = await saidOf(dead(markup, "#x", "#y"));
      expect(said[control]).toMatchObject({ ok: false, says: expect.stringContaining("does nothing when pressed") });
    });
  }
});

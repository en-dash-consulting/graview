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
let page = 1;
const draw = () => graview.render(graview.html\`<div role="group" aria-label="Show">
  <button id="all" aria-pressed="\${filter === "all" ? "true" : "false"}">All</button>
  <button id="igneous" aria-pressed="\${filter === "igneous" ? "true" : "false"}">Igneous</button>
</div>
<div role="tablist"><span role="tab" id="rocks" tabindex="0" aria-selected="\${tab === "rocks" ? "true" : "false"}">Rocks</span><span role="tab" id="minerals" tabindex="0" aria-selected="\${tab === "minerals" ? "true" : "false"}">Minerals</span></div>
<div>\${page === 1 ? graview.html\`<a id="p1" data-key="p1" aria-current="page">Page 1</a><a id="p2" data-key="p2">Page 2</a>\` : graview.html\`<a id="p1" data-key="p1">Page 1</a><a id="p2" data-key="p2" aria-current="page">Page 2</a>\`}</div>
<div role="radiogroup"><p><span id="r1" role="radio" tabindex="0" aria-checked="\${tab === "rocks" ? "true" : "false"}">Hard</span></p><p><span id="r2" role="radio" tabindex="0" aria-checked="\${tab === "minerals" ? "true" : "false"}">Soft</span></p></div>
<button id="plain">Shuffle</button>\`);
graview.onProps(() => draw());
graview.on("click", "#all", () => { filter = "all"; draw(); });
graview.on("click", "#igneous", () => { filter = "igneous"; draw(); });
graview.on("click", "#rocks", () => { tab = "rocks"; draw(); });
graview.on("click", "#minerals", () => { tab = "minerals"; draw(); });
graview.on("click", "#r1", () => { tab = "rocks"; draw(); });
graview.on("click", "#r2", () => { tab = "minerals"; draw(); });
graview.on("click", "#p1", () => { page = 1; draw(); });
graview.on("click", "#p2", () => { page = 2; draw(); });
graview.on("click", "#plain", () => draw());
`;

/** A view with a control that does nothing when pressed, and `beside` drawn with it, with its own handler. */
const deadBeside = (markup: string, handler = "") => `
let clicks = 0;
const draw = () => graview.render(graview.html\`${markup}<p>\${clicks}</p>\`);
graview.onProps(() => draw());
graview.on("click", "#x", () => draw());
graview.on("click", "#y", () => { ${handler || "clicks += 1; draw();"} });
`;

describe("the press check, on a control already in its state", () => {
  it("passes chips, tabs, radios and a pager that a press moves through, saying the state each shows", async () => {
    const said = await saidOf(CHIPS);
    expect(said["“All”"]).toMatchObject({ ok: true, says: "“All” is already in the state it shows (aria-pressed=\"true\"): pressed, it leaves the view as it is." });
    expect(said["“Rocks”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-selected="true"') });
    expect(said["“Page 1”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-current="page"') });
    expect(said["“Hard”"]).toMatchObject({ ok: true, says: expect.stringContaining('aria-checked="true"') });
    expect(said["“Igneous”"]).toMatchObject({ ok: true, says: "“Igneous”, pressed, draws again." });
  });

  it("still fails a control that shows no state and changes nothing when pressed", async () => {
    const { presses } = await checked(CHIPS);
    expect(presses?.problems.map((one) => one.says).filter((one) => one.includes("Shuffle"))).toEqual(["“Shuffle” does nothing when pressed: the view hears the click, and asks for no act, goes nowhere and draws nothing new."]);
  });

  for (const [name, markup] of [
    ["a static pager of links that go somewhere, the others not saying the attribute", `<div><a id="x" aria-current="page">Page 1</a><a id="y" data-place="two">Page 2</a></div>`],
    ["the others saying false", `<div><a id="x" aria-current="page">Page 1</a><a id="y" data-place="two" aria-current="false">Page 2</a></div>`],
    ["each link in a list item of its own", `<ul><li><a id="x" aria-current="page">Page 1</a></li><li><a id="y" data-place="two">Page 2</a></li></ul>`],
    ["a role that names a place, whose press goes somewhere", `<div><span id="x" role="link" tabindex="0" aria-current="step">Page 1</span><span id="y" role="link" tabindex="0" data-place="two">Page 2</span></div>`],
  ] as const) {
    it(`passes a pager's current link: ${name}`, async () => {
      const said = await saidOf(dead(markup, "#x"));
      expect(said["“Page 1”"]).toMatchObject({ ok: true, says: expect.stringContaining("aria-current=") });
    });
  }

  it("passes a pager's current link beside a link whose code goes somewhere", async () => {
    const said = await saidOf(deadBeside(`<div><a id="x" aria-current="page">Page 1</a><a id="y">Page 2</a></div>`, 'graview.navigate("placement:rhea");'));
    expect(said["“Page 1”"]?.ok).toBe(true);
  });

  it("passes a chip beside one that asks for an act, since a run applies no act and so cannot see the state move", async () => {
    const bound = await saidOf(dead(`<div><button id="x" aria-pressed="true">All</button><button id="y" aria-pressed="false" data-act="set-economics">Mine</button></div>`, "#x"));
    expect(bound["“All”"]?.ok).toBe(true);
    const coded = await saidOf(deadBeside(`<div><button id="x" aria-pressed="true">All</button><button id="y" aria-pressed="false">Mine</button></div>`, 'graview.act("set-economics", { id: "placement:rhea" });'));
    expect(coded["“All”"]?.ok).toBe(true);
  });

  for (const [name, markup, control] of [
    ["a dead Save beside a working Cancel: pressing Cancel never takes Save's state", `<div><button id="x" aria-pressed="true">Save</button><button id="y" aria-pressed="false">Cancel</button></div>`, "“Save”"],
    ["a dead Save beside a hidden control", `<div><button id="x" aria-pressed="true">Save</button><button id="y" hidden aria-pressed="false" data-act="set-economics">Other</button></div>`, "“Save”"],
    ["a dead Save beside a control set out of sight by its style", `<div><button id="x" aria-pressed="true">Save</button><button id="y" style="display: none" aria-pressed="false" data-act="set-economics">Other</button></div>`, "“Save”"],
    ["a dead Save beside a control under aria-hidden", `<div><button id="x" aria-pressed="true">Save</button><span aria-hidden="true"><button id="y" aria-pressed="false" data-act="set-economics">Other</button></span></div>`, "“Save”"],
    ["a dead Save beside aria-pressed=\"banana\"", `<div><button id="x" aria-pressed="true">Save</button><button id="y" aria-pressed="banana" data-act="set-economics">Other</button></div>`, "“Save”"],
    ["a dead Save far from one in its group that a press never moves it for", `<div role="group"><p><button id="x" aria-pressed="true">Save</button></p><section><button id="y" aria-pressed="false">Other</button></section></div>`, "“Save”"],
    ["a dead Save beside a control of another element that asks for an act", `<div><button id="x" aria-pressed="true">Save</button><a id="y" aria-pressed="false" data-act="set-economics">Other</a></div>`, "“Save”"],
    ["a current link beside a link that goes nowhere", `<div><a id="x" aria-current="page">Page 1</a><a id="y">Page 2</a></div>`, "“Page 1”"],
    ["a current link beside a link that goes nowhere, one that says false", `<div><a id="x" aria-current="page">Page 1</a><a id="y" aria-current="false">Page 2</a></div>`, "“Page 1”"],
    ["a radio that no press in its group moves", `<div role="radiogroup"><p><span id="x" role="radio" tabindex="0" aria-checked="true">Rocks</span></p><p><span id="y" role="radio" tabindex="0" aria-checked="false">Minerals</span></p></div>`, "“Rocks”"],
  ] as const) {
    it(`fails ${name}`, async () => {
      const said = await saidOf(deadBeside(markup));
      expect(said[control]).toMatchObject({ ok: false, says: expect.stringContaining("does nothing when pressed") });
    });
  }

  /** So many controls the view's code hears, each drawing something new, then `then`; `handlers` hears what `then` draws. */
  const pastTheBudget = (before: number, then: string, handlers: string) => `
let clicks = 0;
let filter = "all";
const draw = () => graview.render(graview.html\`<div>\${Array.from({ length: ${before} }, (_, at) => graview.html\`<button id="b\${at}" class="busy" data-key="b\${at}">Busy \${at}</button>\`)}</div>${then}<p>\${clicks}</p>\`);
graview.onProps(() => draw());
graview.on("click", ".busy", () => { clicks += 1; draw(); });
${handlers}
`;
  const CHIPS_AT_THE_LIMIT = `<div><button id="all" aria-pressed="\${filter === "all" ? "true" : "false"}">All</button><button id="igneous" aria-pressed="\${filter === "igneous" ? "true" : "false"}">Igneous</button></div>`;
  const CHIP_HANDLERS = `graview.on("click", "#all", () => { filter = "all"; draw(); }); graview.on("click", "#igneous", () => { filter = "igneous"; draw(); });`;

  it("reports a real chip as not pressed where the budget leaves it no press to prove its sibling, never as failing", async () => {
    /* 23 others, then All, the 24th press: it changes nothing, and no press is left for Igneous. */
    const { presses } = await checked(pastTheBudget(23, CHIPS_AT_THE_LIMIT, CHIP_HANDLERS));
    const said = Object.fromEntries((presses?.controls ?? []).map((one) => [one.control, one]));
    expect(said["“All”"]).toMatchObject({ ok: true, says: "“All” was not pressed: the check presses 24 controls the view's code hears, and this is past them." });
    expect(presses?.ok).toBe(true);
  });

  it("does the same where the budget runs out between a sibling that moved nothing and the one that would", async () => {
    const markup = `<div><button id="all" aria-pressed="\${filter === "all" ? "true" : "false"}">All</button><button id="decoy" aria-pressed="false">Decoy</button><button id="igneous" aria-pressed="\${filter === "igneous" ? "true" : "false"}">Igneous</button></div>`;
    const { presses } = await checked(pastTheBudget(22, markup, `${CHIP_HANDLERS} graview.on("click", "#decoy", () => { clicks += 1; draw(); });`));
    const all = presses?.controls.find((one) => one.control === "“All”");
    expect(all).toMatchObject({ ok: true, says: expect.stringContaining("was not pressed") });
    expect(presses?.problems).toEqual([]);
  });

  it("still fails a dead Save the budget has no bearing on: no sibling it could have pressed would prove it", async () => {
    const { presses } = await checked(pastTheBudget(23, `<div><button id="x" aria-pressed="true">Save</button><span id="y">Words</span></div>`, `graview.on("click", "#x", () => draw());`));
    expect(presses?.controls.find((one) => one.control === "“Save”")).toMatchObject({ ok: false, says: expect.stringContaining("does nothing when pressed") });
  });

  it("still fails a dead Save within the budget, beside a working Cancel, in a view of many controls", async () => {
    const { presses } = await checked(pastTheBudget(20, `<div><button id="x" aria-pressed="true">Save</button><button id="y" aria-pressed="false">Cancel</button></div>`, `graview.on("click", "#x", () => draw()); graview.on("click", "#y", () => { clicks += 1; draw(); });`));
    expect(presses?.controls.find((one) => one.control === "“Save”")?.ok).toBe(false);
  });

  it("says why without telling an author what to add beside it", async () => {
    const said = await saidOf(deadBeside(`<div><button id="x" aria-pressed="true">Save</button><button id="y" aria-pressed="false">Cancel</button></div>`));
    expect(said["“Save”"]?.says).toBe("“Save” does nothing when pressed: it says aria-pressed=\"true\", and no press on this view takes that from it.");
  });

  for (const [name, markup, control] of [
    ["a lone Save that says it is current", `<button id="x" aria-current="page">Save</button>`, "“Save”"],
    ["a Save that says it is current beside an ordinary button: a toolbar is no pager, and a plain button names no place", `<div><button id="x" aria-current="page">Save</button><button id="y">Cancel</button></div>`, "“Save”"],
    ["a Save that says it is current beside a button that says false", `<div><button id="x" aria-current="page">Save</button><button id="y" aria-current="false">Cancel</button></div>`, "“Save”"],
    ["a lone link that says it is current", `<a id="x" aria-current="page">Page 1</a>`, "“Page 1”"],
    ["a current link whose only neighbor is a control of another kind", `<div><a id="x" aria-current="page">Page 1</a><button id="y">Save</button></div>`, "“Page 1”"],
    ["a current link whose neighbor says aria-current=\"\"", `<div><a id="x" aria-current="page">Page 1</a><a id="y" aria-current="">Page 2</a></div>`, "“Page 1”"],
    ["a current link whose neighbor is current too", `<div><a id="x" aria-current="page">Page 1</a><a id="y" aria-current="page">Page 2</a></div>`, "“Page 1”"],
    ["a link whose aria-current is empty, beside another", `<div><a id="x" aria-current="">Page 1</a><a id="y">Page 2</a></div>`, "“Page 1”"],
    ["a link whose aria-current says undefined, beside another", `<div><a id="x" aria-current="undefined">Page 1</a><a id="y">Page 2</a></div>`, "“Page 1”"],
  ] as const) {
    it(`fails ${name}`, async () => {
      const said = await saidOf(dead(markup, "#x", "#y"));
      expect(said[control]).toMatchObject({ ok: false, says: expect.stringContaining("does nothing when pressed") });
    });
  }

  it("still asks a sibling to state the other value of aria-pressed, aria-selected and aria-checked", async () => {
    for (const [markup, control] of [
      [`<div><button id="x" aria-pressed="true">All</button><button id="y">Igneous</button></div>`, "“All”"],
      [`<div role="tablist"><span id="x" role="tab" tabindex="0" aria-selected="true">Rocks</span><span id="y" role="tab" tabindex="0">Minerals</span></div>`, "“Rocks”"],
      [`<div role="radiogroup"><span id="x" role="radio" tabindex="0" aria-checked="true">Rocks</span><span id="y" role="radio" tabindex="0">Minerals</span></div>`, "“Rocks”"],
    ] as const) expect((await saidOf(dead(markup, "#x", "#y")))[control]?.ok, markup).toBe(false);
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

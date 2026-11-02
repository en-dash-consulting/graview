import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { BROKEN_JS, ECONOMICS_JS, ECONOMICS_MANIFEST, kit, placementApp, placementSeed } from "../../../../scripts/fixtures/placement-app.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * THE VIEW CHECK PRESSES EVERY CONTROL (Roadmap f-views-work-end-to-end).
 * Nick, Oct 30: "too often I find that the views a chatbot creates actually
 * don't have a clickable section or the Save button doesn't work… this
 * would never be the case. Ever." `runWorkerViewHeadless(…, { presses: true
 * })` — what `graview view check` and a host's view gate run — presses every
 * control the view drew as the live host would take the press, nothing
 * applied, and a control that goes nowhere, throws, or is refused fails the
 * check with a plain finding, among the description's problems.
 */
const store = () => new Store({ schema: placementApp.schema, mutations: placementApp.mutations ?? [], policy: placementApp.policy!, snapshot: structuredClone(placementSeed) as never }) as unknown as Store<AnySchema>;
const manifest = ECONOMICS_MANIFEST as unknown as WorkerViewManifest;
const run = nodeIsolate();
const checked = async (source: string, record = "placement:rhea", at = store()) => {
  const result = await runWorkerViewHeadless({ manifest, source, store: at, principal: kit, run, input: { node: { id: record } }, presses: true });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result as HeadlessDescribed;
};

describe("the press check", () => {
  it("passes a view whose every control does what it says, and applies nothing", async () => {
    const at = store();
    const { presses, description } = await checked(ECONOMICS_JS, "placement:rhea", at);
    expect(presses?.ok).toBe(true);
    expect(presses?.controls.map((one) => [one.control, one.does])).toEqual([
      ["“Save economics”", "act"],
      ["“View the contract”", "file"],
      ["“Download it”", "file"],
    ]);
    expect(presses?.controls[0]?.says).toMatch(/^“Save economics” asks for “set-economics”/);
    expect(description.problems).toEqual([]);
    expect((at.graph.getNode("placement:rhea") as unknown as { fixedFee?: number }).fixedFee).toBeUndefined();
  });

  it("fails a button bound to nothing, that the view hears no click on: it does nothing", async () => {
    const { presses, description } = await checked(BROKEN_JS.nothing);
    expect(presses?.ok).toBe(false);
    expect(presses?.problems.map((one) => one.says)).toEqual(["“Save” does nothing: it is bound to no act (data-act), goes nowhere (data-record, data-place), and the view hears no click on it."]);
    expect(description.problems).toContainEqual({ at: "press “Save”", says: presses!.problems[0]!.says });
  });

  it("fails a button whose own code throws when it is pressed, pressed in a run of its own", async () => {
    const { presses } = await checked(BROKEN_JS.throws);
    expect(presses?.problems.map((one) => one.says)).toEqual(["“Recalculate” throws when pressed: Error: rate is undefined"]);
  });

  it("fails a link to a record the view was not shown: it goes nowhere", async () => {
    const { presses } = await checked(BROKEN_JS.lost);
    expect(presses?.problems[0]?.says).toMatch(/^“Open Nobody” goes nowhere: /);
  });

  it("fails a jump to an id the view never drew", async () => {
    const { presses } = await checked(BROKEN_JS.jump);
    expect(presses?.problems.map((one) => one.says)).toEqual(["“Terms” jumps to #terms, and the view drew no element with that id."]);
  });

  it("fails a Save that sends words where its act takes a number, even once its field is filled, and says which", async () => {
    const { presses } = await checked(BROKEN_JS.untyped);
    expect(presses?.problems.map((one) => one.says)).toEqual(["“Save economics” is refused: “fixedFee” expects a number."]);
  });

  it("fails a button whose code asks for an act where only a press applies one, and says to bind it", async () => {
    const { presses } = await checked(BROKEN_JS.code);
    expect(presses?.problems[0]?.says).toMatch(/^“Save fee”, pressed: it asks for “set-economics” from its code, which is refused: .* Bind the button to it instead: data-act="set-economics"\.$/);
  });

  it("presses a form that cannot be sent empty again with words in its empty fields, as a person fills it", async () => {
    const source = `graview.onProps((props) => graview.render(graview.html\`<fieldset data-record="\${props.node.id}"><input type="number" name="fixedFee"><button data-act="set-economics">Set the fee</button></fieldset>\`));`;
    const { presses } = await checked(source);
    expect(presses?.ok).toBe(true);
    expect(presses?.controls[0]?.says).toMatch(/^“Set the fee” asks for “set-economics”/);
  });

  it("presses Save again with each optional field the host filled emptied, which is left out rather than sent as nothing", async () => {
    const { presses } = await checked(ECONOMICS_JS, "placement:omar");
    expect(presses?.ok).toBe(true);
    expect(presses?.controls.find((one) => one.does === "act")?.ok).toBe(true);
  });
});

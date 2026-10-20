import { readFileSync } from "node:fs";
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { nick, rae, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * THE VIEW CHECKER SAYS WHAT A FIELD SAVED AS IT IS TYPED NEEDS (FR-191):
 * its act on itself, a name, a fieldset bound to a record, and a
 * `data-save` and `data-debounce` the host reads — so a view that would
 * save nothing is told so by its headless run (`graview describe`, the
 * Cloud's proposal check) rather than found out by a person whose notes
 * went nowhere. And the guide's worked call sheet draws with no problem.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const manifest: WorkerViewManifest = { name: "call", attach: "call", cardinality: "one", acts: ["save-notes"] };
const TODD = "call:todd";
const TODD_NOTES = "Asked for the attendance list a week ahead.";

describe("the view checker on a field saved as it is typed", () => {
  const run = nodeIsolate();
  const problemsOf = async (markup: string) => {
    const source = `graview.onProps(() => graview.render(${JSON.stringify(markup)}));`;
    const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: nick, run, input: { node: { id: TODD } } });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    return result.description.problems.map((one) => one.says);
  };

  it("takes data-save and data-debounce on a field with its act in a fieldset bound to a record", async () => {
    expect(await problemsOf(`<fieldset data-record="${TODD}"><textarea name="notes" data-prefill="notes" data-act="save-notes" data-save="input" data-debounce="1500"></textarea></fieldset>`)).toEqual([]);
    expect(await problemsOf(`<fieldset data-record="${TODD}"><select name="notes" data-act="save-notes" data-save="change"><option>Yes</option></select></fieldset>`)).toEqual([]);
  });

  it("says a field that saves through no act, or outside a fieldset bound to a record, saves nothing", async () => {
    expect(await problemsOf(`<fieldset data-record="${TODD}"><textarea name="notes" data-save="input"></textarea></fieldset>`)).toEqual([expect.stringContaining("saves through no act")]);
    expect(await problemsOf(`<textarea name="notes" data-act="save-notes" data-save="input"></textarea>`)).toEqual([expect.stringContaining("no fieldset bound to a record")]);
    expect(await problemsOf(`<fieldset><textarea name="notes" data-act="save-notes" data-save="input"></textarea></fieldset>`)).toEqual([expect.stringContaining("no fieldset bound to a record")]);
  });

  it("says what data-save and data-debounce take", async () => {
    expect(await problemsOf(`<fieldset data-record="${TODD}"><textarea name="notes" data-act="save-notes" data-save="blur"></textarea></fieldset>`)).toEqual([expect.stringContaining('data-save is "input"')]);
    expect(await problemsOf(`<fieldset data-record="${TODD}"><textarea name="notes" data-act="save-notes" data-save="input" data-debounce="soon"></textarea></fieldset>`)).toEqual([expect.stringContaining("milliseconds from 250 to 10 000")]);
    expect(await problemsOf(`<fieldset data-record="${TODD}"><textarea name="notes" data-act="save-notes" data-debounce="500"></textarea></fieldset>`)).toEqual([expect.stringContaining('read only on a field that saves as it is typed')]);
    expect(await problemsOf(`<fieldset data-record="${TODD}"><button data-act="save-notes" data-save="input">Save</button></fieldset>`)).toEqual([expect.stringContaining("Only a field saves")]);
  });
});

describe("the guide's worked call sheet", () => {
  const example = readFileSync(new URL("../../../skills/skills/graview-view-forms/examples/a-call-sheet.js", import.meta.url), "utf8");
  const declared = Function(`return (${/manifest: (\{[\s\S]*?\n\/\/ \})/.exec(example)![1]!.replace(/^\/\/ ?/gm, "")});`)() as WorkerViewManifest;

  it("opens with a manifest of one call that may save its notes, and draws the notes field with no problems", async () => {
    expect(declared).toEqual({ name: "call", attach: "call", cardinality: "one", acts: ["save-notes"] });
    const result = await runWorkerViewHeadless({ manifest: declared, source: example, store: store(), principal: nick, run: nodeIsolate(), input: { node: { id: TODD } } });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.problems).toEqual([]);
    expect(result.description.text).toContain("Todd Meyer");
    expect(result.description.text).toContain("Story County");
  });

  it("shows a seat that may not save the notes as words, with no field", async () => {
    const result = await runWorkerViewHeadless({ manifest: declared, source: example, store: store(), principal: rae, run: nodeIsolate(), input: { node: { id: TODD } } });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.text).toContain(TODD_NOTES);
  });
});

import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { checkPresses } from "../../src/headless/presses.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A SELECT THE PERSON PICKS FROM PASSES THE PRESS CHECK (Roadmap
 * f-view-authoring-friction-2026-11). A newsroom's view drew each story's
 * fact check as a dropdown that saves when it is changed
 * (`data-act="set-fact-check" data-save="change"`), and the check refused
 * it: the option it showed counted as filled in by the view, not typed. But
 * the dropdown saves only when a person picks, and the pick is theirs. The
 * check now picks another option, as a person does, and judges the act on
 * that. A text field the view wrote into and the person never touched is
 * still refused.
 */
const document = {
  format: "graview-document",
  formatVersion: 1,
  name: "Newsroom",
  roles: ["editor", "reader"],
  policy: {
    grants: [{ roles: ["editor"], mutations: "*" }],
    sees: [{ roles: ["editor"], kinds: ["story"] }],
  },
  kinds: {
    story: {
      noun: "story",
      plural: "stories",
      label: "{title}",
      fields: {
        title: { type: "string", required: true },
        factCheck: { type: "enum", options: ["unchecked", "checked", "disputed"] },
        note: { type: "string" },
      },
    },
  },
  acts: {
    "set-fact-check": { title: "Set the fact check", on: "story", sets: { factCheck: "$factCheck" } },
    "set-note": { title: "Set the note", on: "story", sets: { note: "$note" } },
  },
};
const compiled = compileDocument(document);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app as GraviewApp<AnySchema>;
const seed = { nodes: [{ id: "story:tide", kind: "story", title: "The tide report" }, { id: "story:dam", kind: "story", title: "The dam vote", factCheck: "checked" }], edges: [] };
const ed: Principal = { kind: "human", id: "person:ed", roles: ["editor"] };
const store = () => new Store({ schema: app.schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: structuredClone(seed) as never }) as unknown as Store<AnySchema>;
const manifest: WorkerViewManifest = { name: "fact-check", attach: "story", cardinality: "one", acts: ["set-fact-check", "set-note"] };

const checked = async (markup: string, record = "story:tide") => {
  const source = `graview.onProps((props) => { const node = props.node; graview.render(graview.html\`${markup}\`); });`;
  const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: ed, run: nodeIsolate(), input: { node: { id: record } }, presses: checkPresses });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return (result as HeadlessDescribed).presses!;
};
const DROPDOWN = `<div data-record="\${node.id}"><label>Fact check <select name="factCheck" data-prefill="factCheck" data-act="set-fact-check" data-save="change">
  \${["unchecked", "checked", "disputed"].map((one) => (node.factCheck ?? "unchecked") === one ? graview.html\`<option value="\${one}" selected>\${one}</option>\` : graview.html\`<option value="\${one}">\${one}</option>\`)}
</select></label></div>`;

describe("the press check, on a select that saves when it is changed", () => {
  it("picks another option, as a person does, and passes where the act takes the pick", async () => {
    const presses = await checked(DROPDOWN);
    expect(presses.problems).toEqual([]);
    expect(presses.controls).toEqual([expect.objectContaining({ control: "“Fact check”", does: "save", ok: true, says: expect.stringContaining("“set-fact-check”") })]);
  });

  it("passes on a record that holds a value, picking an option other than the one it shows", async () => {
    const presses = await checked(DROPDOWN, "story:dam");
    expect(presses.problems).toEqual([]);
  });

  it("does not refuse a select with no other option, whose one value is only re-sent unchanged", async () => {
    const presses = await checked(`<div data-record="\${node.id}"><select name="factCheck" aria-label="Fact check" data-prefill="factCheck" data-act="set-fact-check" data-save="change"><option value="checked" selected>checked</option></select></div>`, "story:dam");
    expect(presses.problems).toEqual([]);
  });

  it("still refuses a pick the app does not declare", async () => {
    const presses = await checked(`<div data-record="\${node.id}"><select name="factCheck" data-act="set-fact-check" data-save="change"><option value="maybe">Maybe</option><option value="perhaps">Perhaps</option></select></div>`);
    expect(presses.problems).toEqual([expect.objectContaining({ does: "save", says: expect.stringContaining("not one this app declares") })]);
  });
});

describe("the press check, on a select a button sends", () => {
  it("still refuses a Save whose select the person never picked from, showing a value the record does not hold", async () => {
    const presses = await checked(`<fieldset data-record="\${node.id}"><select name="factCheck" aria-label="Fact check"><option value="disputed" selected>disputed</option><option value="checked">checked</option></select><button data-act="set-fact-check">Save</button></fieldset>`);
    expect(presses.problems).toEqual([expect.objectContaining({ control: "“Save”", does: "act", says: expect.stringContaining("filled in by the view, not typed") })]);
  });
});

describe("the press check, on a text field the view filled", () => {
  it("still refuses a text field the view wrote words into and the person never touched", async () => {
    const presses = await checked(`<div data-record="\${node.id}"><input name="note" value="Looks fine to me" data-act="set-note" data-save="change" aria-label="Note"></div>`);
    expect(presses.problems).toEqual([expect.objectContaining({ does: "save", says: expect.stringContaining("filled in by the view, not typed") })]);
  });
});

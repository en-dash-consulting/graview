import { Store, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { sam, threatApp, threatSeed, WATCH_JS, WATCH_MANIFEST } from "../../../../scripts/fixtures/threat-app.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";

/**
 * A HEADLESS RUN PRESSES, AND SAYS WHAT THE PRESS WOULD SEND (0.1.45).
 * `describe_place` and `propose_view` said what a view drew and nothing of
 * what pressing it would do, so whether Threat Watch's `<span role="button"
 * data-act>` in a fieldset sent anything was found out only on the page.
 * `runWorkerViewHeadless(…, { press: "<selector>" })` presses the first
 * element the selector matches and says what the live host would do there,
 * by its own rules: the link it follows, the act it asks for with the
 * arguments it carries — the bound record, the fields in its scope, typed
 * only where `typed` says — and whether this seat's store would apply it,
 * rehearsed and never applied, or the refusal in the view's words; and what
 * the view's own code did when it heard the click. And the describer says
 * an element bound to an act that can never be pressed.
 */
const store = () => new Store({ schema: threatApp.schema, mutations: threatApp.mutations ?? [], policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never }) as unknown as Store<AnySchema>;
const manifest = WATCH_MANIFEST as unknown as WorkerViewManifest;
const stranger: Principal = { kind: "human", id: "person:visitor", roles: [] };

describe("a headless run asked to press", () => {
  const run = nodeIsolate();
  const pressing = async (press: Parameters<typeof runWorkerViewHeadless>[0]["press"], principal: Principal = sam, at = store(), source = WATCH_JS) => {
    const result = await runWorkerViewHeadless({ manifest, source, store: at, principal, run, press });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    return result as HeadlessDescribed;
  };

  it("says a <span role=\"button\" data-act> in a card asks for its act on the card's record, applied for this seat — and applies nothing", async () => {
    const at = store();
    const { pressed } = await pressing('[data-ack="threat:phishing"]', sam, at);
    expect(pressed?.element).toBe('<span class="press" data-act="acknowledge" role="button">');
    expect(pressed?.opens).toBeUndefined();
    expect(pressed?.act).toMatchObject({ as: "acknowledge", ok: true, name: "acknowledge", args: { id: "threat:phishing" } });
    expect(pressed?.says).toMatch(/asks for "acknowledge".*applied for this seat, were it pressed/);
    expect(pressed?.act).toMatchObject({ changes: true });
    expect((at.graph.getNode("threat:phishing") as unknown as { status: string }).status).toBe("new");
  });

  it("says a press on a card's heading opens the card's record", async () => {
    const { pressed } = await pressing('[data-record="threat:phishing"] h3');
    expect(pressed?.opens).toEqual({ record: "threat:phishing" });
    expect(pressed?.act).toBeUndefined();
    expect(pressed?.says).toMatch(/opens the record "threat:phishing"/);
  });

  it("carries what the person typed into the fields of the press's fieldset, and only that", async () => {
    const typed = await pressing({ selector: '[data-save-note="threat:phishing"]', typed: { note: "Forwarded to the mail team" } });
    expect(typed.pressed?.act).toMatchObject({ as: "set-note", ok: true, args: { id: "threat:phishing", note: "Forwarded to the mail team" } });
    // Typed nowhere, the note goes as nothing: the act is asked for without it.
    const untyped = await pressing('[data-save-note="threat:phishing"]');
    expect(untyped.pressed?.act && "args" in untyped.pressed.act ? untyped.pressed.act.args : untyped.pressed?.act).not.toHaveProperty("note");
  });

  it("says the refusal a seat that may not run the act would hear, in the policy's words", async () => {
    const { pressed } = await pressing('[data-ack="threat:phishing"]', stranger);
    expect(pressed?.act).toMatchObject({ as: "acknowledge", ok: false, reason: "refused" });
    expect(pressed?.act && !pressed.act.ok ? pressed.act.message : "").not.toBe("");
  });

  it("says what the view's own code did on hearing the click, and describes what it drew before the press", async () => {
    const result = await pressing('[data-more="threat:phishing"]');
    expect(result.pressed).toMatchObject({ redrew: true, asked: [], went: [] });
    expect(result.pressed?.act).toBeUndefined();
    expect(result.pressed?.says).toMatch(/bound to no act and lands in no link.*it drew again/);
    expect(result.description.text).not.toContain("Forty mailboxes");
  });

  it("says a selector that matches nothing is a press on nothing, among the problems", async () => {
    const result = await pressing(".no-such-thing");
    expect(result.pressed?.element).toBeUndefined();
    expect(result.description.problems).toContainEqual({ at: 'press ".no-such-thing"', says: '".no-such-thing" matches nothing the view drew: there is nothing there to press.' });
  });
});

describe("the describer on an element bound to an act", () => {
  const run = nodeIsolate();
  const problemsOf = async (markup: string) => {
    const source = `graview.onProps(() => graview.render(${JSON.stringify(markup)}));`;
    const result = await runWorkerViewHeadless({ manifest, source, store: store(), principal: sam, run });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    return result.description.problems.map((one) => one.says);
  };

  it("takes a span, a div or an SVG group with a button's role as a press, as it takes a button", async () => {
    expect(await problemsOf('<fieldset data-record="threat:phishing"><input name="note"><span role="button" data-act="set-note">Save</span><div data-act="acknowledge">Ack</div><button data-act="acknowledge">Ack</button></fieldset>')).toEqual([]);
  });

  it("says one that can never be pressed by itself: a label, an option, a field to type into that does not save", async () => {
    expect(await problemsOf('<fieldset data-record="threat:phishing"><label data-act="acknowledge">Ack <input type="checkbox" name="x"></label></fieldset>')).toEqual([expect.stringContaining("A press on a label presses its field too")]);
    expect(await problemsOf('<fieldset data-record="threat:phishing"><select name="status"><option data-act="acknowledge">Ack</option></select></fieldset>')).toEqual([expect.stringContaining("An option is never pressed by itself")]);
    expect(await problemsOf('<fieldset data-record="threat:phishing"><input name="note" data-act="set-note"></fieldset>')).toEqual([expect.stringContaining("A click into a field to type or to pick is not a press")]);
  });
});

// @vitest-environment jsdom
import { Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { erin, lin, offersApp, offersSeed, openOffersApp } from "../../../../scripts/fixtures/offers-app.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createPressReader, judgePress } from "../../src/host/press.js";
import { createGuestHost } from "../../src/host/session.js";
import { judgeCodeAct, sightIsTotal } from "../../src/host/writes.js";
import type { GuestAnswer, GuestDomEvent, HostMessage } from "../../src/protocol.js";

/**
 * WRITES THAT CANNOT LEAK (FR-92). Erin, staff, may see the internal margin
 * review and what it costs (18 500); Lin, of the client, may see the
 * packages but not that offer. A view running for Erin reads the cost, and
 * tries to write it into the starter package's summary, which Lin reads.
 * With sights on, it is refused every way it tries — from its own code, by
 * a press it computed the argument of, by a field it filled itself — and a
 * press of Erin's on a bound button, with words she typed, applies. With
 * sights off there is nothing to leak, and a declared act applies from
 * code. That the host tells a person's press from anything else in a real
 * browser, in Chromium, WebKit and Firefox, is `guest-sandbox
 * --transport=writes`.
 */

const SECRET = "18500";
const manifest: WorkerViewManifest = {
  name: "packages",
  title: "The packages",
  attach: "package",
  cardinality: "many",
  reads: { kinds: ["offer"], edges: ["includes"] },
  acts: ["set-summary", { act: "set-standing", as: "recommend", constants: { standing: "recommended" } }],
};
const sighted = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const open = () => new Store({ schema: openOffersApp.schema, mutations: openOffersApp.mutations ?? [], policy: openOffersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const summaryOf = (store: Store<never>, id = "package:start") => (store.seenBy(lin).graph.getNode(id) as unknown as { summary: string }).summary;
const shownTo = (store: Store<never>) => {
  const props = workerViewProps(store, erin, { manifest });
  return new Set((props.nodes ?? []).map((node) => node.id));
};

const INSERT = 0;
const UPDATE = 3;
const ATTRIBUTE = 2;
let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `w${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `w${(ids += 1)}`, type: 3, data });

/**
 * A view's region as `mountWorkerView` wires it, without the worker: the
 * drawing, the press reader, the session and the write rules. `trusted`
 * stands in for the browser's `isTrusted`, which a test's own events never
 * are; left out, the reader asks the event, as the host does.
 */
function region(store: Store<never>, trusted?: (event: Event) => boolean) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const told: GuestDomEvent[] = [];
  const answers: GuestAnswer[] = [];
  const session = createGuestHost({
    store,
    principal: erin,
    view: manifest.name,
    nonce: "n",
    send: (message: HostMessage) => {
      if (message.type === "answer") answers.push(message);
    },
    props: () => workerViewProps(store, erin, { manifest }),
    judgeAct: (name, args) => judgeCodeAct(store, manifest, name, args),
    limits: { acts: 3 },
  });
  const reader = createPressReader(trusted);
  const drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: (message) => told.push(message),
    onFieldSet: (field) => reader.filled(field),
    before: (event, at, root) => {
      reader.heard(event, at);
      const press = reader.press(event, at, root);
      if (!press) return;
      return { pressed: { as: press.as, ...session.pressed(judgePress(store, manifest, shownTo(store), press)) } };
    },
  });
  const form = element("fieldset", {}, [
    element("input", { name: "summary", placeholder: "What it is" }),
    element("button", { "data-act": "set-summary", "data-record": "package:start", "data-summary": SECRET }, [text("Say it")]),
  ]);
  drawing.apply([[INSERT, "~", form, 0]]);
  const field = shadow.querySelector("input")!;
  const button = shadow.querySelector("button")!;
  const fieldId = (form.children[0] as { id: string }).id;
  /** The viewer typing: the field's value, and the input event the browser raises. */
  const type = (words: string) => {
    field.value = words;
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  };
  const press = () => button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  /** The view setting what the field shows, by a record of its own. */
  const viewSets = (value: string) => drawing.apply([[UPDATE, fieldId, "value", value, ATTRIBUTE]]);
  const last = () => told.filter((one) => one.pressed).at(-1)?.pressed;
  return { session, drawing, field, button, type, press, viewSets, last, answers, told };
}

describe("sights on: what a view read cannot be written where somebody else reads it", () => {
  it("the app's sight is not total", () => {
    expect(sightIsTotal(sighted())).toBe(false);
  });

  it("refuses an act from the view's own code, with no press, carrying a hidden field", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.session.receive({ type: "act", nonce: "n", id: 1, name: "set-summary", args: { packageId: "package:start", summary: `margin review costs ${SECRET}` } });
    expect(view.answers[0]).toMatchObject({ ok: false, reason: "press-only" });
    expect(summaryOf(store as never)).not.toContain(SECRET);
  });

  it("refuses an act its manifest does not name, however it is asked", () => {
    const store = sighted();
    expect(judgeCodeAct(store, manifest, "add-note", { label: SECRET })).toMatchObject({ ok: false, reason: "undeclared" });
    expect(judgePress(store, manifest, shownTo(store as never), { as: "add-note", fields: [] })).toMatchObject({ ok: false, reason: "undeclared" });
  });

  it("refuses a press whose argument the view computed: the button's own data is not read, so the act has nothing to say", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.press();
    expect(view.last()).toMatchObject({ as: "set-summary", ok: false });
    expect(summaryOf(store as never)).not.toContain(SECRET);
  });

  it("refuses a press that would carry a field the view filled in itself", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.viewSets(`costs ${SECRET}`);
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
    expect(summaryOf(store as never)).not.toContain(SECRET);
  });

  it("refuses a press after the view changed what the viewer typed", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.type("A short way in");
    view.viewSets(`A short way in, costs ${SECRET}`);
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
    expect(summaryOf(store as never)).not.toContain(SECRET);
  });

  it("does not take the change a browser raises when a field the view filled loses focus for typing", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.viewSets(`costs ${SECRET}`);
    view.field.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
  });

  it("keeps a field the view wrote into the view's while the viewer types after its words, and the viewer's once they empty it", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.type("A");
    view.viewSets(`A (${SECRET})`);
    view.type(`A (${SECRET})n`);
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
    view.type("");
    view.type("Mine now");
    view.press();
    expect(view.last()).toMatchObject({ ok: true });
    expect(summaryOf(store as never)).toBe("Mine now");
  });

  it("takes nothing away when the view only empties a field", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.type("First");
    view.viewSets("");
    view.type("Second");
    view.press();
    expect(view.last()).toMatchObject({ ok: true });
  });

  it("refuses a press bound to a record the view was not shown", () => {
    const store = sighted();
    expect(judgePress(store, manifest, shownTo(store as never), { as: "set-summary", record: "party:open-set", fields: [{ name: "summary", value: "x", typed: true, empty: false }] })).toMatchObject({ ok: false, reason: "unbound" });
  });

  it("does nothing for a click the browser did not see a person make", () => {
    const store = sighted();
    const view = region(store as never);
    view.type("Typed by a script");
    view.press();
    expect(view.last()).toBeUndefined();
    expect(store.log.all()).toHaveLength(0);
  });

  it("applies a press on a bound button with what the viewer typed: Erin's, through the view, undoable", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.type("Coaching and a sprint, to begin");
    view.press();
    expect(view.last()).toMatchObject({ as: "set-summary", ok: true });
    expect(summaryOf(store as never)).toBe("Coaching and a sprint, to begin");
    const op = store.log.all().at(-1)!;
    expect(op.author.id).toBe("person:erin");
    expect(op.via).toBe("view:packages");
    store.undo(op.batch!, { author: erin });
    expect(summaryOf(store as never)).toBe("Coaching and a sprint.");
  });

  it("keeps what the viewer typed when the view only says it back", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    view.type("Said back");
    view.viewSets("Said back");
    view.press();
    expect(view.last()).toMatchObject({ ok: true });
  });

  it("fills a press's constants from the manifest, never from the view", () => {
    const store = sighted();
    expect(judgePress(store, manifest, shownTo(store as never), { as: "recommend", record: "package:full", fields: [{ name: "standing", value: "later", typed: true, empty: false }] })).toEqual({ ok: true, name: "set-standing", args: { packageId: "package:full", standing: "recommended" } });
  });

  it("holds presses to the view's allowance", () => {
    const store = sighted();
    const view = region(store as never, () => true);
    for (const words of ["one", "two", "three", "four"]) {
      view.type(words);
      view.press();
    }
    expect(view.told.filter((one) => one.pressed).map((one) => one.pressed!.ok)).toEqual([true, true, true, false]);
    expect(view.last()).toMatchObject({ reason: "rate-limited" });
  });
});

describe("sights off: there is nothing to leak", () => {
  it("the app's sight is total", () => {
    expect(sightIsTotal(open())).toBe(true);
  });

  it("applies a declared act from the view's code, with its arguments as given, through the view", () => {
    const store = open();
    const view = region(store as never, () => true);
    view.session.receive({ type: "act", nonce: "n", id: 1, name: "set-summary", args: { packageId: "package:start", summary: "From the view's code" } });
    expect(view.answers[0]).toMatchObject({ ok: true });
    expect(store.log.all().at(-1)!.via).toBe("view:packages");
  });

  it("still refuses an act the manifest does not name", () => {
    expect(judgeCodeAct(open(), manifest, "add-note", { label: "x" })).toMatchObject({ ok: false, reason: "undeclared" });
  });

  it("puts the manifest's constants over what the code says", () => {
    expect(judgeCodeAct(open(), manifest, "recommend", { packageId: "package:later", standing: "later" })).toEqual({ ok: true, name: "set-standing", args: { packageId: "package:later", standing: "recommended" } });
  });
});

/**
 * A PICK AMONG WORDS THE VIEW WROTE. A radio's value and a select's options
 * are the view's words; the person only picks one. A pick is the person's
 * as a choice, never as what the words say: Erin choosing "Yes" on a radio
 * whose value the view set to the cost would otherwise write the cost into
 * the summary Lin reads, as though Erin had typed it. A pick is taken as
 * the argument only when it is one of the values the app itself declares
 * for it (an enum or a literal), or a record the view was shown.
 */
describe("sights on: a person's pick carries no word of the view's", () => {
  const picking = { ...manifest, acts: ["set-summary", "set-standing"] } satisfies WorkerViewManifest;
  function choices(store: Store<never>, fields: unknown[], act: string, record = "package:start") {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const told: GuestDomEvent[] = [];
    const session = createGuestHost({ store, principal: erin, view: picking.name, nonce: "n", send: () => {}, props: () => workerViewProps(store, erin, { manifest: picking }), judgeAct: (name, args) => judgeCodeAct(store, picking, name, args) });
    const reader = createPressReader(() => true);
    const shown = new Set((workerViewProps(store, erin, { manifest: picking }).nodes ?? []).map((node) => node.id));
    const drawing = createOpenDrawing(shadow, {
      origin: "null",
      send: (message) => told.push(message),
      onFieldSet: (field) => reader.filled(field),
      before: (event, at, root) => {
        reader.heard(event, at);
        const press = reader.press(event, at, root);
        if (!press) return;
        return { pressed: { as: press.as, ...session.pressed(judgePress(store, picking, shown, press)) } };
      },
    });
    drawing.apply([[INSERT, "~", element("fieldset", {}, [...fields, element("button", { "data-act": act, "data-record": record }, [text("Save")])]), 0]]);
    return { shadow, press: () => shadow.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true })), last: () => told.filter((one) => one.pressed).at(-1)?.pressed };
  }

  it("refuses a radio the person picked whose value is the view's own words", () => {
    const store = sighted();
    const view = choices(store as never, [element("label", {}, [element("input", { type: "radio", name: "summary", value: SECRET }), text("Yes, that's right")])], "set-summary");
    view.shadow.querySelector("input")!.click();
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
    expect(summaryOf(store as never)).not.toContain(SECRET);
  });

  it("refuses an option the person picked whose value is the view's own words", () => {
    const store = sighted();
    const view = choices(store as never, [element("select", { name: "summary" }, [element("option", { value: "" }, [text("Choose")]), element("option", { value: `Costs ${SECRET}` }, [text("Looks good")])])], "set-summary");
    const select = view.shadow.querySelector("select")!;
    select.selectedIndex = 1;
    select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
    expect(summaryOf(store as never)).not.toContain(SECRET);
  });

  it("applies a pick that is one of the values the app declares for it", () => {
    const store = sighted();
    const view = choices(
      store as never,
      ["recommended", "alternative", "later"].map((standing) => element("input", { type: "radio", name: "standing", value: standing })),
      "set-standing",
    );
    view.shadow.querySelectorAll("input")[2]!.click();
    view.press();
    expect(view.last()).toMatchObject({ ok: true });
    expect((store.seenBy(lin).graph.getNode("package:start") as unknown as { standing: string }).standing).toBe("later");
  });
});

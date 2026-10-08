// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { EMAIL_DRAFT, nick, rae, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createPressReader, fillPrefills, judgePress, prefillOf } from "../../src/host/press.js";
import { createGuestHost } from "../../src/host/session.js";
import { judgeCodeAct } from "../../src/host/writes.js";
import type { GuestDomEvent, HostMessage } from "../../src/protocol.js";

/**
 * A VIEW PREFILLS ONLY WHAT THE SEAT MAY WRITE (FR-150). Graview Cloud's
 * workshop: a deliverable's draft is three thousand characters, and the
 * views guide said "Do not prefill", so a view that offered to change it
 * asked the person to type all of it again. A view now marks a field
 * `data-prefill="draft"` and the HOST fills it from the record the view was
 * shown, through the viewer's sight — only when an act beside it writes
 * that field of that record and the viewer may run it there — and a press
 * carries it only back into that field. In a real browser, in three
 * engines: `guest-sandbox --transport=record`.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const manifest: WorkerViewManifest = { name: "deliverable", attach: "deliverable", cardinality: "one", acts: ["set-draft", "set-subject", "quote-draft"] };
const EMAIL = "deliverable:email";
const shownTo = (s: Store<AnySchema>, principal = nick, id = EMAIL) => {
  const props = workerViewProps(s, principal, { manifest, input: { node: { id } } });
  return new Set([...(props.node ? [props.node.id] : []), ...(props.nodes ?? []).map((node) => node.id)]);
};
const draftOf = (s: Store<AnySchema>, id = EMAIL) => (s.graph.getNode(id) as unknown as { draft: string }).draft;

describe("what a view of one record is handed", () => {
  it("is the record as `node`, its fields on it beside id, kind and label, and no `fields` key", () => {
    const props = workerViewProps(store(), nick, { manifest, input: { node: { id: EMAIL } } });
    expect(props.node).toEqual({ id: EMAIL, kind: "deliverable", label: "Email to Todd", subject: "Email to Todd", draft: EMAIL_DRAFT, status: "drafting" });
    expect(props.node).not.toHaveProperty("fields");
    expect(props.cardinality).toBe("one");
    /* Its own record is `node`, never one of `nodes`: those are what it reads beyond it. */
    expect(props.nodes).toEqual([]);
    expect(props.acts.map((one) => one.name).sort()).toEqual(["quote-draft", "set-draft", "set-subject"]);
  });
});

describe("what the host fills a field with", () => {
  it("is the record's own field, whole, for an act beside it that writes it and a seat that may run it", () => {
    expect(prefillOf(store(), nick, manifest, shownTo(store()), { record: EMAIL, field: "draft", acts: ["set-draft"] })).toBe(EMAIL_DRAFT);
    expect(EMAIL_DRAFT).toContain("\n\n");
  });
  it("is nothing for a seat that may not write it", () => {
    expect(prefillOf(store(), rae, manifest, shownTo(store(), rae), { record: EMAIL, field: "draft", acts: ["set-draft"] })).toBeUndefined();
  });
  it("is nothing for an act that takes the field but writes no field of the record", () => {
    expect(prefillOf(store(), nick, manifest, shownTo(store()), { record: EMAIL, field: "draft", acts: ["quote-draft"] })).toBeUndefined();
  });
  it("is nothing for an act that writes another field, or one the manifest does not name", () => {
    expect(prefillOf(store(), nick, manifest, shownTo(store()), { record: EMAIL, field: "draft", acts: ["set-subject"] })).toBeUndefined();
    expect(prefillOf(store(), nick, { ...manifest, acts: ["set-subject"] }, shownTo(store()), { record: EMAIL, field: "draft", acts: ["set-draft"] })).toBeUndefined();
  });
  it("is nothing from a record the view was not shown, though the seat may see and write it", () => {
    expect(prefillOf(store(), nick, manifest, shownTo(store()), { record: "deliverable:agenda", field: "draft", acts: ["set-draft"] })).toBeUndefined();
  });
  it("never hands a field of a record the seat may not see", () => {
    for (const principal of [rae, nick]) for (const field of ["body", "label"]) expect(prefillOf(store(), principal, manifest, new Set(["memo:margin", ...shownTo(store(), principal)]), { record: "memo:margin", field, acts: ["set-draft", "quote-draft"] })).toBeUndefined();
  });
});

const INSERT = 0;
let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `w${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `w${(ids += 1)}`, type: 3, data });

/** A view's region as `mountWorkerView` wires it, without the worker: the drawing, the press reader, the prefill, the session and the write rules. */
function region(s: Store<AnySchema>, principal = nick, form = element("fieldset", { "data-record": EMAIL }, [element("textarea", { name: "draft", "data-prefill": "draft" }), element("button", { "data-act": "set-draft" }, [text("Save the draft")])])) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const told: GuestDomEvent[] = [];
  const shown = shownTo(s, principal);
  const session = createGuestHost({
    store: s,
    principal,
    view: manifest.name,
    nonce: "n",
    send: (_: HostMessage) => {},
    props: () => workerViewProps(s, principal, { manifest, input: { node: { id: EMAIL } } }),
    judgeAct: (name, args) => judgeCodeAct(s, manifest, name, args),
  });
  const reader = createPressReader(() => true);
  const drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: (message) => told.push(message),
    onFieldSet: (field) => reader.filled(field),
    before: (event, at, root) => {
      reader.heard(event, at);
      const press = reader.press(event, at, root);
      if (!press) return;
      return { pressed: { as: press.as, ...session.pressed(judgePress(s, manifest, shown, press)) } };
    },
  });
  const done = new WeakSet<Element>();
  const draw = (records: unknown) => {
    drawing.apply(records);
    fillPrefills(shadow, reader, done, (asked) => prefillOf(s, principal, manifest, shown, asked));
  };
  draw([[INSERT, "~", form, 0]]);
  const field = shadow.querySelector("textarea")!;
  const type = (words: string) => {
    field.value = words;
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  };
  const press = (as = "set-draft") => shadow.querySelector(`[data-act="${as}"]`)!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  const last = () => told.filter((one) => one.pressed).at(-1)?.pressed;
  return { shadow, field, type, press, last, draw, form };
}

describe("a field the host filled", () => {
  it("holds the whole draft, its line breaks kept, and saves the person's edit with its line breaks intact", () => {
    const s = store();
    const view = region(s);
    expect(view.field.value).toBe(EMAIL_DRAFT);
    const edited = `${EMAIL_DRAFT}\n\nP.S. The barn has parking for forty.`;
    view.type(edited);
    view.press();
    expect(view.last()).toMatchObject({ ok: true });
    expect(draftOf(s)).toBe(edited);
    expect(draftOf(s).split("\n\n")).toHaveLength(EMAIL_DRAFT.split("\n\n").length + 1);
  });

  it("is left empty for a seat that may not write it, and their press is refused as before", () => {
    const s = store();
    const view = region(s, rae);
    expect(view.field.value).toBe("");
    view.press();
    expect(view.last()).toMatchObject({ ok: false });
    expect(draftOf(s)).toBe(EMAIL_DRAFT);
  });

  it("goes only back into the field it came from: pressed for another act that takes it, it is refused", () => {
    const s = store();
    const form = element("fieldset", { "data-record": EMAIL }, [element("textarea", { name: "draft", "data-prefill": "draft" }), element("button", { "data-act": "set-draft" }, [text("Save")]), element("button", { "data-act": "quote-draft" }, [text("Quote it")])]);
    const view = region(s, nick, form);
    expect(view.field.value).toBe(EMAIL_DRAFT);
    view.press("quote-draft");
    expect(view.last()).toMatchObject({ as: "quote-draft", ok: false, reason: "untyped" });
    expect(s.graph.nodesOfKind("memo" as never)).toHaveLength(1);
  });

  it("is not filled where every act beside it only takes the field, and a press carries the person's own words", () => {
    const s = store();
    const form = element("fieldset", { "data-record": EMAIL }, [element("textarea", { name: "draft", "data-prefill": "draft" }), element("button", { "data-act": "quote-draft" }, [text("Quote it")])]);
    const view = region(s, nick, form);
    expect(view.field.value).toBe("");
    view.type("Just this line.");
    view.press("quote-draft");
    expect(view.last()).toMatchObject({ ok: true });
  });

  it("is the view's once the view writes into it, and a press carrying it is refused", () => {
    const s = store();
    const view = region(s);
    const textareaId = (view.form.children[0] as { id: string }).id;
    view.draw([[INSERT, textareaId, text(" and our margin"), 0]]);
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
    expect(draftOf(s)).toBe(EMAIL_DRAFT);
  });

  it("is never filled from a record the seat may not see, whatever the view binds it to", () => {
    const s = store();
    const form = element("fieldset", { "data-record": "memo:margin" }, [element("textarea", { name: "body", "data-prefill": "body" }), element("button", { "data-act": "quote-draft" }, [text("Quote it")])]);
    const view = region(s, rae, form);
    expect(view.field.value).toBe("");
    expect(view.shadow.innerHTML).not.toContain("18 percent");
  });

  it("is not written over when the view drew words in it, or the person already typed", () => {
    const s = store();
    const form = element("fieldset", { "data-record": EMAIL }, [element("textarea", { name: "draft", "data-prefill": "draft" }, [text("The view's own words")]), element("button", { "data-act": "set-draft" }, [text("Save")])]);
    const view = region(s, nick, form);
    expect(view.field.value).toBe("The view's own words");
    view.press();
    expect(view.last()).toMatchObject({ ok: false, reason: "untyped" });
  });
});

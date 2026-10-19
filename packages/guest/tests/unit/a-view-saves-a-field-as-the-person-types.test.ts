// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { nick, rae, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createPressReader, createSaver, fillPrefills, judgePress, prefillOf, SAVE_DEBOUNCE_MS, saveDebounceOf } from "../../src/host/press.js";
import { createGuestHost } from "../../src/host/session.js";
import { judgeCodeAct } from "../../src/host/writes.js";
import type { GuestDomEvent, GuestPressed, HostMessage } from "../../src/protocol.js";

/**
 * A VIEW SAVES A FIELD AS THE PERSON TYPES, AND HEARS THAT IT SAVED
 * (FR-191). A Farm Bureau workshop's call sheet: notes are taken while the
 * phone is ringing, and a view's code never holds what the person typed, so
 * the notes reached the act only through a Save button. A field now carries
 * its act and says when it saves — `data-act="save-notes" data-save="input"
 * data-debounce="1500"` inside a `fieldset data-record` — and the HOST runs
 * the act once the person pauses, and at once when they leave the field,
 * collecting the fields as a press does and holding it to the same rules.
 * The view hears each act's outcome as `acted`. In a real browser, in three
 * engines: `guest-sandbox --transport=record`.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const manifest: WorkerViewManifest = { name: "call", attach: "call", cardinality: "one", acts: ["save-notes", "set-draft"] };
const TODD = "call:todd";
const TODD_NOTES = "Asked for the attendance list a week ahead.";
const notesOf = (s: Store<AnySchema>, id = TODD) => (s.graph.getNode(id) as unknown as { notes: string }).notes;

const INSERT = 0;
let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `s${(ids += 1)}`, type: 1, element: name, attributes, children });
const notesField = (attributes: Record<string, string> = {}) => element("textarea", { name: "notes", "data-prefill": "notes", "data-act": "save-notes", "data-save": "input", ...attributes });
const sheet = (field = notesField(), record = TODD) => element("fieldset", { "data-record": record }, [field]);

/** A clock the test moves by hand. */
function clock() {
  let now = 0;
  const due = new Map<number, { at: number; run: () => void }>();
  let next = 0;
  return {
    timers: {
      set: (run: () => void, ms: number) => {
        next += 1;
        due.set(next, { at: now + ms, run });
        return next;
      },
      clear: (handle: unknown) => void due.delete(handle as number),
    },
    pass(ms: number) {
      now += ms;
      for (const [handle, one] of [...due].sort((a, b) => a[1].at - b[1].at)) {
        if (one.at > now) continue;
        due.delete(handle);
        one.run();
      }
    },
  };
}

/** A view's region as `mountWorkerView` wires it, without the worker: the drawing, the press reader, the saver, the prefill, the session and the write rules. */
function region(s: Store<AnySchema>, principal = nick, form = sheet()) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const told: GuestDomEvent[] = [];
  const props = () => workerViewProps(s, principal, { manifest, input: { node: { id: TODD } } });
  const shown = new Set([TODD]);
  const session = createGuestHost({ store: s, principal, view: manifest.name, nonce: "n", send: (_: HostMessage) => {}, props, judgeAct: (name, args) => judgeCodeAct(s, manifest, name, args) });
  /* The person's own events are the ones the test marks; anything else is what a view could raise. */
  const trusted = (event: Event) => (event as Event & { person?: boolean }).person === true;
  const reader = createPressReader(trusted);
  const time = clock();
  let drawing: ReturnType<typeof createOpenDrawing> | undefined = undefined;
  const saver = createSaver({
    reader,
    trusted,
    timers: time.timers,
    save: (press, field) => {
      const outcome = session.pressed(judgePress(s, manifest, shown, press));
      told.push({ type: "dom-event", target: drawing!.renderer.idOf(field)!, event: "acted", pressed: { as: press.as, ...outcome } });
    },
  });
  drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: (message) => told.push(message),
    onFieldSet: (field) => reader.filled(field),
    before: (event, at, root) => {
      reader.heard(event, at);
      saver.heard(event, at, root);
      const press = reader.press(event, at, root);
      if (!press) return;
      return { pressed: { as: press.as, ...session.pressed(judgePress(s, manifest, shown, press)) } };
    },
  });
  drawing.apply([[INSERT, "~", form, 0]]);
  fillPrefills(shadow, reader, new WeakSet(), (asked) => prefillOf(s, principal, manifest, shown, asked));
  const field = shadow.querySelector("textarea")!;
  const raise = (type: string, person = true) => {
    const event = new Event(type, { bubbles: true, composed: true });
    if (person) Object.defineProperty(event, "person", { value: true });
    field.dispatchEvent(event);
  };
  const type = (words: string, person = true) => {
    field.value = words;
    raise("input", person);
  };
  const acted = (): (GuestPressed | undefined)[] => told.filter((one) => one.event === "acted").map((one) => one.pressed);
  const pressed = () => told.filter((one) => one.pressed && one.event !== "acted");
  return { shadow, field, type, raise, acted, pressed, time, saver, told };
}

describe("a field saved as the person types", () => {
  it("is filled from the record, and saves the person's notes once they pause for data-debounce, without a button", () => {
    const s = store();
    const view = region(s, nick, sheet(notesField({ "data-debounce": "1500" })));
    expect(view.field.value).toBe(TODD_NOTES);
    view.type(`${TODD_NOTES} Will bring six from his board.`);
    view.time.pass(1_000);
    expect(notesOf(s)).toBe(TODD_NOTES);
    view.type(`${TODD_NOTES} Will bring six from his board, and the soil reports.`);
    view.time.pass(1_499);
    expect(notesOf(s)).toBe(TODD_NOTES);
    view.time.pass(1);
    expect(notesOf(s)).toBe(`${TODD_NOTES} Will bring six from his board, and the soil reports.`);
    /* Saved once, as Nick, through the view, as a press is. */
    const ops = s.log.all();
    expect(ops.filter((op) => op.via === "view:call")).toHaveLength(1);
    expect(ops.at(-1)).toMatchObject({ via: "view:call", author: { id: "person:nick" } });
  });

  it("is heard by the view as `acted` on the field, with the act's outcome", () => {
    const s = store();
    const view = region(s);
    view.type("Call back Thursday.");
    expect(view.acted()).toEqual([]);
    view.time.pass(SAVE_DEBOUNCE_MS);
    expect(view.acted()).toEqual([expect.objectContaining({ as: "save-notes", ok: true })]);
    const said = view.told.find((one) => one.event === "acted")!;
    expect(view.shadow.querySelector("textarea")).toBe(view.field);
    expect(said.target).toBe(view.told.find((one) => one.event === "input")!.target);
  });

  it("waits 1 000 ms when data-debounce does not say, and holds what it says to 250–10 000", () => {
    const at = (attributes: Record<string, string>) => {
      const field = document.createElement("textarea");
      for (const [name, value] of Object.entries(attributes)) field.setAttribute(name, value);
      return saveDebounceOf(field);
    };
    expect(SAVE_DEBOUNCE_MS).toBe(1_000);
    expect(at({})).toBe(1_000);
    expect(at({ "data-debounce": "1500" })).toBe(1_500);
    expect(at({ "data-debounce": "0" })).toBe(250);
    expect(at({ "data-debounce": "60000" })).toBe(10_000);
    expect(at({ "data-debounce": "soon" })).toBe(1_000);
  });

  it("saves at once what was still waiting when the person leaves the field, and not again after", () => {
    const s = store();
    const view = region(s);
    view.type("Left a message.");
    view.raise("change");
    expect(notesOf(s)).toBe("Left a message.");
    view.time.pass(10_000);
    expect(view.acted()).toHaveLength(1);
    /* Leaving a field with nothing waiting saves nothing. */
    view.raise("change");
    expect(view.acted()).toHaveLength(1);
  });

  it("saves what is still waiting when the view goes", () => {
    const s = store();
    const view = region(s);
    view.type("Asked about parking.");
    expect(view.saver.waiting).toBe(1);
    view.saver.flush();
    expect(notesOf(s)).toBe("Asked about parking.");
    expect(view.saver.waiting).toBe(0);
  });

  it("is not pressed by a click into it to type", () => {
    const s = store();
    const view = region(s);
    const click = new MouseEvent("click", { bubbles: true, composed: true });
    Object.defineProperty(click, "person", { value: true });
    view.field.dispatchEvent(click);
    expect(view.pressed()).toEqual([]);
    expect(s.log.all().filter((op) => op.via === "view:call")).toHaveLength(0);
  });

  it("saves nothing for typing the view raised: only the person's own input starts a save", () => {
    const s = store();
    const view = region(s);
    view.type("The view's words.", false);
    view.raise("change", false);
    view.time.pass(10_000);
    expect(view.acted()).toEqual([]);
    expect(notesOf(s)).toBe(TODD_NOTES);
  });

  it("is refused for a seat that may not write the notes, the view hearing why, and nothing filled", () => {
    const s = store();
    const view = region(s, rae);
    expect(view.field.value).toBe("");
    view.type("Rae's guess.");
    view.time.pass(SAVE_DEBOUNCE_MS);
    expect(view.acted()).toEqual([expect.objectContaining({ as: "save-notes", ok: false })]);
    expect(view.acted()[0]!.message).toEqual(expect.any(String));
    expect(notesOf(s)).toBe(TODD_NOTES);
  });

  it("is refused when it is bound to a record the view was not shown, as a press is", () => {
    const s = store();
    const view = region(s, nick, sheet(notesField({ name: "draft", "data-prefill": "draft", "data-act": "set-draft" }), "deliverable:email"));
    expect(view.field.value).toBe("");
    view.type("Typed into the wrong place.");
    view.time.pass(SAVE_DEBOUNCE_MS);
    expect(view.acted()).toEqual([expect.objectContaining({ as: "set-draft", ok: false, reason: "unbound" })]);
  });
});

import { InvalidArguments, PermissionDeniedError, type AnySchema, type Principal, type Store } from "@graview/core";
import { judgeDestination, type GuestList } from "../host/links.js";
import { placeNamed, unsureOfViews, whereOfWords, type Destination, type NamedPlace } from "../host/links-words.js";
import type { WorkerViewManifest } from "../host/manifest.js";
import { isEntry, isKeyControl, isPress, linkPressed, notPressable, opensOnPress } from "../host/pressable.js";
import { accepts, judgePress } from "../host/press.js";
import { argumentsSaid } from "../host/session.js";
import { judgeCodeAct, type Press } from "../host/writes.js";
import { storedFilesOf } from "../host/marks.js";
import type { DrawnTranscript } from "./draw.js";
import { fieldsOf } from "./press.js";
import type { HeadlessTranscript } from "./protocol.js";
import { TreeElement } from "./tree.js";

/*
 * EVERY CONTROL, PRESSED, BEFORE A VIEW IS KEPT (Roadmap
 * f-views-work-end-to-end): `runWorkerViewHeadless(…, { presses: true })`,
 * `graview view check`, and Graview Cloud's view gate.
 *
 * "Too often the views a chatbot creates don't have a clickable section, or
 * the Save button doesn't work." What a view drew was judged — its markup,
 * its links' names, its accessibility — and what pressing it did was found
 * out by the person. Now every control it drew is pressed, headless, as the
 * live host would take the press, and one that goes nowhere, throws, or is
 * refused fails the check with a plain finding:
 *
 *   · A BOUND PRESS (`data-act`), and a field that saves as it is typed: its
 *     arguments read as the host reads them — the record it is bound to, the
 *     manifest's constants, the fields in its scope as drawn, a field the
 *     host fills from the record filled — judged by the host's own write
 *     rules and rehearsed in the store for this seat (`previewAll`), nothing
 *     applied. Refused where a person must type first, it is pressed again
 *     with words in each empty field, as a person would fill the form; and,
 *     where it lands, again with each optional field the host filled emptied
 *     — "“Save economics” is refused when “fixedFee” is emptied: “fixedFee”
 *     expects a number".
 *   · A LINK (`data-record`, `data-place`, a card, a row, a count, a chip, a
 *     legend's entry that names records): where it goes, or why nowhere.
 *   · A JUMP (`href="#id"`): the element it names, drawn.
 *   · A FILE LINK (`data-file`): a record the view was shown, holding a file.
 *   · ANY OTHER CONTROL — a `<button>` with no act, a `role="button"`, a
 *     toggle — and anything the view hears a click on: pressed in a run of
 *     its own, and what the view's code did then is the answer. It threw; it
 *     asked for an act the host refuses from code; it asked to go nowhere;
 *     or it did nothing at all — no act, no going, nothing drawn again.
 *     A control the view hears no click on, bound to nothing and linked
 *     nowhere, does nothing, and says so without a run.
 */

/** One control the check pressed, and what came of it. */
export interface PressFinding {
  /** The control as a person reads it: its name in quotes (“Save economics”). */
  readonly control: string;
  /** The element, as the drawing names it. */
  readonly element: string;
  /** What pressing it is: a bound act, a field's save, a link, a jump, a file, the view's own code, or nothing. */
  readonly does: "act" | "save" | "link" | "jump" | "file" | "code" | "nothing";
  readonly ok: boolean;
  /** What came of it, in a sentence. */
  readonly says: string;
}

/** Every control a view drew, pressed. */
export interface PressCheck {
  /** No control failed. */
  readonly ok: boolean;
  readonly controls: readonly PressFinding[];
  /** The controls that failed: each one's sentence is the finding. */
  readonly problems: readonly PressFinding[];
  /** All of it in words, a line a control. */
  readonly text: string;
}

/** What a run that pressed one control came to. */
export type PressRun = { readonly ok: true; readonly transcript: HeadlessTranscript } | { readonly ok: false; readonly reason: string; readonly detail: string };

export interface PressCheckContext<S extends AnySchema> {
  readonly store: Store<S>;
  readonly principal: Principal;
  readonly manifest: WorkerViewManifest;
  /** The records the view was shown. */
  readonly shown: ReadonlySet<string>;
  readonly places: readonly NamedPlace[];
  readonly lists: readonly GuestList[];
  readonly placesUnsure?: boolean;
  /** What it drew, before any press. */
  readonly drawn: DrawnTranscript;
  /** The ids of what it hears a click on, as drawn. */
  readonly clicks: readonly string[];
  /** Run the view again, pressing the element with this id: the view's code heard the click there. */
  readonly rerun: (target: string) => Promise<PressRun>;
  /** The most controls pressed in runs of their own. 24 by default. */
  readonly maxRuns?: number;
}

const below = function* (element: TreeElement): Generator<TreeElement> {
  for (const child of element.childNodes) {
    if (!(child instanceof TreeElement)) continue;
    yield child;
    yield* below(child);
  }
};
const up = (element: TreeElement, root: TreeElement, test: (one: TreeElement) => boolean): TreeElement | undefined => {
  for (let on: TreeElement | null = element; on && on !== root; on = on.parentElement) if (test(on)) return on;
  return undefined;
};
const textOf = (element: TreeElement): string => element.childNodes.map((child) => (child instanceof TreeElement ? (child.getAttribute("aria-hidden") === "true" ? "" : textOf(child)) : child.nodeType === 3 ? child.textContent : "")).join("");
const named = (element: TreeElement) => {
  const said = ["id", "class", "data-record", "data-place", "data-act", "data-file", "href", "role", "name"].flatMap((name) => (element.getAttribute(name) === null ? [] : [` ${name}="${element.getAttribute(name)!.slice(0, 80)}"`]));
  return `<${element.localName}${said.join("")}>`;
};
/** A control's name, as a person reads it. */
const nameOf = (element: TreeElement): string => {
  const said = (element.getAttribute("aria-label") ?? textOf(element)).replace(/\s+/g, " ").trim() || element.getAttribute("title") || element.getAttribute("name") || "";
  return said ? `“${said.length > 60 ? `${said.slice(0, 59)}…` : said}”` : named(element);
};

/** Words a person might type into an empty field, by its type, for a form that cannot be pressed empty. */
const SAMPLES: Readonly<Record<string, string>> = {
  number: "1", range: "1", date: "2026-01-15", "datetime-local": "2026-01-15T09:00", time: "09:00", month: "2026-01", week: "2026-W03",
  email: "someone@example.com", url: "https://example.com", tel: "+1 555 0100", text: "A test", search: "A test", textarea: "A test",
};
const sampleOf = (field: TreeElement) => (field.localName === "textarea" ? SAMPLES["textarea"] : SAMPLES[(field.getAttribute("type") ?? "text").toLowerCase()]);

const FIELD = new Set(["input", "textarea", "select"]);
/** Controls a person presses that are no field, no link and no bound act: a button, a role's, a toggle. */
const isControl = (element: TreeElement) =>
  (element.localName === "button" && element.namespaceURI === "http://www.w3.org/1999/xhtml") ||
  isKeyControl(element) ||
  ["link", "menuitem", "menuitemcheckbox", "menuitemradio", "option"].includes(element.getAttribute("role") ?? "") ||
  (element.localName === "a" && !element.hasAttribute("href") && !element.hasAttribute("data-record") && !element.hasAttribute("data-place") && !element.hasAttribute("data-file"));
/**
 * A CONTROL ALREADY IN ITS STATE (Roadmap f-view-authoring-friction-2026-11):
 * an "All" chip pressed while nothing is filtered, the tab that is open, the
 * page a pager is on. Pressed, it rightly leaves the view as it is — so it is
 * no control that does nothing, where it says that state to a person as
 * well as to the eye: `aria-pressed="true"`, `aria-current`, `aria-selected`
 * or `aria-checked="true"`. The attribute it says it by, or nothing.
 */
const stateShown = (element: TreeElement): string | undefined => {
  for (const name of ["aria-pressed", "aria-selected", "aria-checked"]) if (element.getAttribute(name) === "true") return `${name}="true"`;
  const current = element.getAttribute("aria-current");
  return current !== null && current !== "false" ? `aria-current="${current}"` : undefined;
};
/** What the host presses of itself, which the check leaves to the host: a disclosure, a lightbox, a drop, a placed video. */
const hostOwn = (element: TreeElement) => element.localName === "summary" || element.hasAttribute("data-lightbox") || element.hasAttribute("data-drop") || element.localName === "graview-video";

export async function checkPresses<S extends AnySchema>(context: PressCheckContext<S>): Promise<PressCheck> {
  const { drawn, store, principal, manifest } = context;
  const root = drawn.root;
  const all = [...below(root)];
  const heard = new Set(context.clicks);
  const heardAt = (element: TreeElement) => up(element, root, (one) => heard.has(drawn.idOf(one) ?? "")) !== undefined;
  const ids = new Set(all.flatMap((one) => (one.getAttribute("id") ? [one.getAttribute("id")!] : [])));
  const controls: PressFinding[] = [];
  const found = (element: TreeElement, does: PressFinding["does"], ok: boolean, says: string) => controls.push({ control: nameOf(element), element: named(element), does, ok, says });
  const via = `view:${manifest.name}`;

  /* An act as the host would take it, rehearsed for this seat: its sentence, or why not. */
  const rehearse = (name: string, args: Record<string, unknown>): { ok: true; intent: string } | { ok: false; message: string; missing: boolean } => {
    try {
      const done = store.previewAll([{ name, args }], { author: principal, via });
      return { ok: true, intent: done.intent };
    } catch (error) {
      if (error instanceof PermissionDeniedError) return { ok: false, message: `this seat may not: ${error.refusal.message}`, missing: false };
      if (error instanceof InvalidArguments) return { ok: false, message: argumentsSaid(error), missing: error.issues.some((issue) => /required|received undefined/i.test(issue.message)) };
      return { ok: false, message: `the act threw: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`, missing: false };
    }
  };
  /* A press as the host reads it, typed where `typed` says. */
  const pressOf = (bound: TreeElement, typed: Readonly<Record<string, string>>): Press => {
    const record = up(bound, root, (one) => one.getAttribute("data-record") !== null)?.getAttribute("data-record") ?? undefined;
    const scope = up(bound, root, (one) => one.localName === "fieldset" || one.getAttribute("role") === "group") ?? root;
    return { as: bound.getAttribute("data-act")!, ...(record !== undefined ? { record } : {}), fields: fieldsOf(scope, record, { store, principal, manifest, shown: context.shown, places: context.places, lists: context.lists, typed }) };
  };
  const judged = (bound: TreeElement, typed: Readonly<Record<string, string>>) => {
    const press = pressOf(bound, typed);
    const said = judgePress(store, manifest, context.shown, press);
    if (!said.ok) return { ok: false as const, message: said.message, missing: false, press };
    const done = rehearse(said.name, said.args);
    return done.ok ? { ok: true as const, intent: done.intent, args: said.args, press } : { ...done, press };
  };
  const judgeAct = (bound: TreeElement, does: "act" | "save") => {
    const name = nameOf(bound);
    const as = bound.getAttribute("data-act")!;
    const scope = up(bound, root, (one) => one.localName === "fieldset" || one.getAttribute("role") === "group") ?? root;
    const fields = [...below(scope)].filter((one) => FIELD.has(one.localName) && one.getAttribute("name"));
    let first = judged(bound, {});
    let filled = false;
    /*
     * As a person fills it: words in each field left empty. Refused as drawn
     * for what a person types first, this is the press that counts; landing
     * as drawn, it must land filled in too — a number asked for in a text
     * field lands empty and is refused the moment anybody types in it.
     */
    const empty = fields.filter((one) => one.value === "" && !(first.press.fields.find((field) => field.name === one.getAttribute("name"))?.from) && sampleOf(one) !== undefined);
    const samples = Object.fromEntries(empty.map((one) => [one.getAttribute("name")!, sampleOf(one)!]));
    if (empty.length > 0) {
      const again = judged(bound, samples);
      if (again.ok) [first, filled] = [again, !first.ok];
      else if (first.ok || first.missing) first = again;
    }
    if (!first.ok) return found(bound, does, false, `${name} is refused: ${first.message.replace(/\.$/, "")}.`);
    /* It lands: and with each optional field the host filled emptied, as a person clears one. */
    const mutation = store.allMutations().find((one) => one.name === (judgePress(store, manifest, context.shown, first.press) as { name?: string }).name);
    const shape = ((mutation?.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}) as Record<string, unknown>;
    const clearable = first.press.fields.filter((field) => field.from && Object.hasOwn(shape, field.name) && accepts(shape[field.name], undefined)).map((field) => field.name);
    if (clearable.length > 0) {
      const typed = { ...(filled ? samples : {}), ...Object.fromEntries(clearable.map((one) => [one, ""])) };
      const emptied = judged(bound, typed);
      if (!emptied.ok) return found(bound, does, false, `${name} is refused when ${clearable.map((one) => `“${one}”`).join(" and ")} ${clearable.length === 1 ? "is" : "are"} emptied: ${emptied.message.replace(/\.$/, "")}.`);
    }
    return found(bound, does, true, `${name} asks for “${as}”${filled ? " once its fields are filled" : ""}${first.intent ? `: “${first.intent}”` : ", which changes nothing as it is drawn"}.`);
  };

  let runs = 0;
  const maxRuns = context.maxRuns ?? 24;
  for (const element of all) {
    if (hostOwn(element)) continue;
    /* A bound press, or a field that saves as it is typed. */
    if (element.hasAttribute("data-act")) {
      const why = notPressable(element);
      if (FIELD.has(element.localName) && element.hasAttribute("data-save")) {
        const save = element.getAttribute("data-save");
        if (save !== "input" && save !== "change") found(element, "save", false, `${nameOf(element)} saves nothing: data-save is "input" or "change", not "${save}".`);
        else judgeAct(element, "save");
      } else if (why) found(element, "act", false, `${nameOf(element)} is bound to “${element.getAttribute("data-act")}” and is never pressed: ${why}`);
      else if (isPress(element)) judgeAct(element, "act");
      continue;
    }
    /* A jump within the view. */
    if (element.localName === "a" && (element.getAttribute("href") ?? "").startsWith("#")) {
      const id = element.getAttribute("href")!.slice(1);
      found(element, "jump", ids.has(id), ids.has(id) ? `${nameOf(element)} jumps to #${id}.` : `${nameOf(element)} jumps to #${id}, and the view drew no element with that id.`);
      continue;
    }
    /* A record's file. */
    if (element.hasAttribute("data-file")) {
      const record = element.getAttribute("data-file") ?? "";
      const field = element.getAttribute("data-field") ?? "";
      const node = context.shown.has(record) ? (store.seenBy(principal).graph.getNode(record) as Record<string, unknown> | undefined) : undefined;
      const files = node && field ? storedFilesOf(node[field]) : [];
      const at = Number(element.getAttribute("data-index") ?? "0");
      const file = files[Number.isInteger(at) && at >= 0 ? at : 0];
      if (element.localName !== "a") found(element, "file", false, `${nameOf(element)} is a file link on a <${element.localName}>: a file link is an <a data-file>.`);
      else if (!node) found(element, "file", false, `${nameOf(element)} links to a file of "${record}", which is no record this view was shown.`);
      else if (!file) found(element, "file", false, `${nameOf(element)} links to the file in "${field || "(no data-field)"}" of "${record}", which holds none.`);
      else found(element, "file", true, `${nameOf(element)} ${element.hasAttribute("data-download") ? "downloads" : "opens"} “${file.name ?? "the file"}”.`);
      continue;
    }
    /* A link: a record, a place, a list — a card, a row, a count, a chip. */
    if (opensOnPress(element, [...below(element)].some(isEntry))) {
      const filter = element.getAttribute("data-filter");
      const section = element.getAttribute("data-section");
      const record = element.getAttribute("data-record");
      const where = { ...(filter ? { where: whereOfWords(filter) } : {}), ...(section ? { section } : {}) };
      const to: Destination = record ? { record, ...where } : { place: element.getAttribute("data-place") ?? "", ...where };
      const went = judgeDestination(to, { sees: (id) => context.shown.has(id), places: context.places, lists: context.lists, schema: store.schema });
      if (went.ok) {
        const arrival = went.arrival;
        found(element, "link", true, `${nameOf(element)} opens ${"record" in arrival ? `the record "${arrival.record}"` : "place" in arrival ? `the place "${arrival.place}"` : `the list of ${arrival.list}`}.`);
      } else {
        const asked = "place" in to ? to.place : to.record;
        const unknown = "place" in to && !placeNamed(context.places, asked) && !context.lists.some((one) => one.slug === asked || one.kind === asked);
        /* A titled view's place the host did not hand: a doubt, not a failure. */
        if (context.placesUnsure && unknown) found(element, "link", true, `${nameOf(element)} may go nowhere: ${went.says}${unsureOfViews}`);
        else found(element, "link", false, `${nameOf(element)} goes nowhere: ${went.says}`);
      }
      continue;
    }
    /* Any other control, and what the view hears a click on. */
    const id = drawn.idOf(element);
    const listened = heard.has(id ?? "");
    if (!isControl(element) && !listened) continue;
    /* Inside a link, with no press of its own: the link's (above). */
    if (!listened && linkPressed(element, root, (one) => opensOnPress(one, [...below(one)].some(isEntry)))) continue;
    if (!heardAt(element)) {
      found(element, "nothing", false, `${nameOf(element)} does nothing: it is bound to no act (data-act), goes nowhere (data-record, data-place), and the view hears no click on it.`);
      continue;
    }
    if (id === undefined) continue;
    if (runs >= maxRuns) {
      found(element, "code", true, `${nameOf(element)} was not pressed: the check presses ${maxRuns} controls the view's code hears, and this is past them.`);
      continue;
    }
    runs += 1;
    const ran = await context.rerun(id);
    if (!ran.ok) {
      found(element, "code", false, ran.reason === "error" ? `${nameOf(element)} throws when pressed: ${ran.detail.replace(/^It threw: /, "")}` : `${nameOf(element)}, pressed, stopped the view (${ran.reason}): ${ran.detail}`);
      continue;
    }
    const pressed = ran.transcript.pressed;
    if (!pressed || pressed.target === undefined) {
      found(element, "code", false, `${nameOf(element)} could not be pressed in a run of its own: it was not drawn there the same way.`);
      continue;
    }
    const asked = ran.transcript.asked.slice(pressed.asked);
    const went = ran.transcript.went.slice(pressed.went);
    const redrew = ran.transcript.renders.length > pressed.renders;
    const wrong: string[] = [];
    for (const one of asked) {
      const said = judgeCodeAct(store, manifest, one.name, (one.args ?? {}) as Record<string, unknown>, { shown: context.shown, file: () => undefined, dropped: () => undefined });
      if (!said.ok) wrong.push(`it asks for “${one.name}” from its code, which is refused: ${said.message}${said.reason === "press-only" ? ` Bind the button to it instead: data-act="${one.name}".` : ""}`);
      else {
        const done = rehearse(said.name, said.args);
        if (!done.ok) wrong.push(`it asks for “${one.name}”, which is refused: ${done.message}`);
      }
    }
    for (const one of went) {
      const judgedTo = judgeDestination(one as Destination, { sees: (to) => context.shown.has(to), places: context.places, lists: context.lists, schema: store.schema });
      if (!judgedTo.ok) wrong.push(`it asks to go nowhere: ${judgedTo.says}`);
    }
    const state = asked.length === 0 && went.length === 0 && !redrew ? stateShown(element) : undefined;
    if (wrong.length > 0) found(element, "code", false, `${nameOf(element)}, pressed: ${wrong.join("; ")}`);
    else if (state) found(element, "code", true, `${nameOf(element)} is already in the state it shows (${state}): pressed, it leaves the view as it is.`);
    else if (asked.length === 0 && went.length === 0 && !redrew) found(element, "code", false, `${nameOf(element)} does nothing when pressed: the view hears the click, and asks for no act, goes nowhere and draws nothing new.`);
    else found(element, "code", true, `${nameOf(element)}, pressed, ${[...(asked.length > 0 ? [`asks for ${asked.map((one) => `“${one.name}”`).join(", ")}`] : []), ...(went.length > 0 ? ["goes where it says"] : []), ...(redrew ? ["draws again"] : [])].join(" and ")}.`);
  }
  const problems = controls.filter((one) => !one.ok);
  const lines = [`Presses: ${controls.length} control${controls.length === 1 ? "" : "s"} pressed, ${problems.length === 0 ? "every one does what it says" : `${problems.length} ${problems.length === 1 ? "fails" : "fail"}`}.`];
  for (const one of controls) lines.push(`  ${one.ok ? "ok   " : "FAILS"} ${one.says}`);
  return { ok: problems.length === 0, controls, problems, text: `${lines.join("\n")}\n` };
}

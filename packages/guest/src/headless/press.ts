import { PermissionDeniedError, type AnySchema, type Principal, type Store } from "@graview/core";
import { judgeDestination, type Arrival, type GuestList } from "../host/links.js";
import { whereOfWords, type Destination } from "../host/links-words.js";
import type { WorkerViewManifest } from "../host/manifest.js";
import { isEntry, isPress, linkPressed, notPressable, opensOnPress } from "../host/pressable.js";
import { judgePress, prefillOf } from "../host/press.js";
import type { Press, PressedField } from "../host/writes.js";
import type { GuestPlace, GuestRefusal } from "../protocol.js";
import type { DrawnTranscript } from "./draw.js";
import type { HeadlessTranscript } from "./protocol.js";
import { TreeElement } from "./tree.js";

/*
 * A PRESS, CHECKED BEFORE A VIEW SHIPS (0.1.45): `runWorkerViewHeadless(…,
 * { press: "<selector>" })`.
 *
 * `describe_place` and `propose_view` said what a view drew and nothing of
 * what pressing it would do, so whether `<span role="button" data-act>` in
 * a fieldset sent anything was found out only on the page. A headless run
 * now presses the first element a selector matches, as `graview.on`
 * matches one, and says what the live host would do there — judged here,
 * in the host's context, by the host's own rules (pressable.ts, links.ts,
 * press.ts) over what the view drew before the press:
 *
 *   · the link it lands in, and where that goes — a record, a place, a
 *     list — or why it goes nowhere;
 *   · the act a bound press asks for and the arguments it carries, read as
 *     the host reads them — the bound record, the manifest's constants, the
 *     fields in its scope, typed by the person only where `typed` says so,
 *     a field the host fills from the record as it fills it — and whether
 *     the store would apply it for this seat, rehearsed (`previewAll`) and
 *     never applied; or the refusal, in the words the view would hear;
 *   · what the view's own code did when it heard the click: the acts it
 *     asked for (none applied), where it asked to go, and whether it drew
 *     again.
 */

/** What a press the run made would have done. Nothing was applied. */
export interface HeadlessPress {
  readonly selector: string;
  /** The element it matched, as the drawing names it (`<div class="card" data-record="threat:7">`); none when it matched nothing. */
  readonly element?: string;
  /** Where the host would go: the link the press lands in, judged. */
  readonly opens?: Arrival;
  /** The link it lands in goes nowhere: why. */
  readonly lost?: string;
  /** The act a bound press would ask for: applied for this seat, rehearsed, with its arguments and its sentence; or refused, with the view's `pressed`. */
  readonly act?: { readonly as: string; readonly ok: true; readonly name: string; readonly args: Readonly<Record<string, unknown>>; readonly intent: string; readonly changes: boolean } | { readonly as: string; readonly ok: false; readonly reason: GuestRefusal; readonly message: string };
  /** What the view's own code asked for when it heard the click, and where it asked to go. Nothing was applied. */
  readonly asked: HeadlessTranscript["asked"];
  readonly went: HeadlessTranscript["went"];
  /** It drew again when it heard the click. */
  readonly redrew: boolean;
  /** All of it, in a sentence or two. */
  readonly says: string;
}

export interface HeadlessPressContext<S extends AnySchema> {
  readonly store: Store<S>;
  readonly principal: Principal;
  readonly manifest: WorkerViewManifest;
  /** The records the view was shown. */
  readonly shown: ReadonlySet<string>;
  readonly places: readonly GuestPlace[];
  readonly lists: readonly GuestList[];
  /** What the person typed, or picked, by the field's name. Every other field holds what the view left in it. */
  readonly typed?: Readonly<Record<string, string | number | boolean>>;
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
const named = (element: TreeElement) => {
  const said = ["id", "class", "data-record", "data-place", "data-act", "role", "name"].flatMap((name) => (element.getAttribute(name) === null ? [] : [` ${name}="${element.getAttribute(name)!.slice(0, 80)}"`]));
  return `<${element.localName}${said.join("")}>`;
};
const textOf = (element: TreeElement): string => element.childNodes.map((child) => (child instanceof TreeElement ? textOf(child) : child.nodeType === 3 ? child.textContent : "")).join("");

/** The fields in a press's scope as the host would read them: typed where `typed` says, and the view's, or the host's prefill, everywhere else. */
function fieldsOf<S extends AnySchema>(scope: TreeElement, record: string | undefined, context: HeadlessPressContext<S>): PressedField[] {
  const typed = context.typed ?? {};
  const fields: PressedField[] = [];
  const acts = [...below(scope)].filter((one) => one.getAttribute("data-act") !== null).map((one) => one.getAttribute("data-act")!);
  for (const field of below(scope)) {
    const name = field.getAttribute("name");
    if (!name || !["input", "select", "textarea"].includes(field.localName)) continue;
    const type = (field.getAttribute("type") ?? "text").toLowerCase();
    const mine = Object.hasOwn(typed, name);
    if (type === "radio") {
      const value = field.getAttribute("value") ?? "on";
      if (mine ? String(typed[name]) !== value : !field.checked) continue;
      fields.push({ name, value, typed: mine, empty: false, chosen: true });
    } else if (field.localName === "select") {
      const options = [...below(field)].filter((one) => one.localName === "option");
      const picked = options.find((one) => one.selected || one.getAttribute("selected") !== null) ?? options[0];
      const value = mine ? String(typed[name]) : picked ? (picked.getAttribute("value") ?? textOf(picked).trim()) : "";
      fields.push({ name, value, typed: mine, empty: value === "" && !mine, chosen: true });
    } else if (type === "checkbox") {
      const checked = mine ? typed[name] === true || typed[name] === "true" || typed[name] === "on" : field.checked;
      fields.push({ name, value: checked, typed: mine, empty: !checked && !mine });
    } else {
      /* What the host fills from the record (FR-150), as it fills it: an empty field marked data-prefill with its own name. */
      const around = up(field, scope, (one) => one.getAttribute("data-record") !== null)?.getAttribute("data-record") ?? record;
      const fill = field.value === "" && field.getAttribute("data-prefill") === name && around ? prefillOf(context.store, context.principal, context.manifest, context.shown, { record: around, field: name, acts }) : undefined;
      const from = fill !== undefined ? { record: around!, field: name, value: fill } : undefined;
      const said = mine ? typed[name]! : (fill ?? field.value);
      const numeric = type === "number" || type === "range";
      const value = numeric && said !== "" && Number.isFinite(Number(said)) ? Number(said) : typeof said === "boolean" ? String(said) : said;
      fields.push({ name, value, typed: mine || from !== undefined, empty: value === "" && !mine && !from, ...(from ? { from } : {}) });
    }
  }
  return fields;
}

/** A press the run made, judged as the live host would judge it, over what the view drew before it. */
export function judgeHeadlessPress<S extends AnySchema>(pressed: NonNullable<HeadlessTranscript["pressed"]>, before: DrawnTranscript, transcript: HeadlessTranscript, context: HeadlessPressContext<S>): HeadlessPress {
  const asked = transcript.asked.slice(pressed.asked);
  const went = transcript.went.slice(pressed.went);
  const redrew = transcript.renders.length > pressed.renders;
  const element = pressed.target !== undefined ? before.elementOf(pressed.target) : undefined;
  const code = [
    ...asked.map((one) => `its code asked for "${one.name}"`),
    ...went.map((one) => `its code asked to go to "${"record" in one ? one.record : one.place}"`),
    ...(redrew ? ["it drew again"] : []),
  ];
  const also = code.length > 0 ? ` When the view heard the click, ${code.join(", ")}.` : "";
  if (!element) return { selector: pressed.selector, asked, went, redrew, says: `"${pressed.selector}" matches nothing the view drew: there is nothing there to press.` };
  const root = before.root;
  const out: { opens?: Arrival; lost?: string; act?: HeadlessPress["act"] } = {};
  const said: string[] = [];

  /* A link first, as the host follows one, unless the press lands on a press of its own on the way. */
  const link = linkPressed(element, root, (one) => opensOnPress(one, [...below(one)].some(isEntry)));
  if (link) {
    const filter = link.getAttribute("data-filter");
    const section = link.getAttribute("data-section");
    const record = link.getAttribute("data-record");
    const where = { ...(filter ? { where: whereOfWords(filter) } : {}), ...(section ? { section } : {}) };
    const to: Destination = record ? { record, ...where } : { place: link.getAttribute("data-place") ?? "", ...where };
    const judged = judgeDestination(to, { sees: (id) => context.shown.has(id), places: context.places, lists: context.lists, schema: context.store.schema });
    if (judged.ok) {
      out.opens = judged.arrival;
      const arrival = judged.arrival;
      const narrowed = "filter" in arrival && arrival.filter ? `, narrowed to ${arrival.filter}` : "";
      said.push(`It opens ${"record" in arrival ? `the record "${arrival.record}"` : "place" in arrival ? `the place "${arrival.place}"` : `the list of ${arrival.list}`}${narrowed}${arrival.section ? `, at "${arrival.section}"` : ""}.`);
    } else {
      out.lost = judged.says;
      said.push(`It lands in a link that goes nowhere: ${judged.says}`);
    }
  }

  /* A bound press, as the host reads and judges one. */
  const bound = up(element, root, (one) => one.getAttribute("data-act") !== null);
  if (bound) {
    const as = bound.getAttribute("data-act")!;
    const why = notPressable(bound);
    if (why) {
      said.push(`It is bound to "${as}", and is never pressed: ${why}`);
    } else if (isPress(bound)) {
      const recordAt = up(bound, root, (one) => one.getAttribute("data-record") !== null)?.getAttribute("data-record") ?? undefined;
      const scope = up(bound, root, (one) => one.localName === "fieldset" || one.getAttribute("role") === "group") ?? root;
      const press: Press = { as, ...(recordAt !== undefined ? { record: recordAt } : {}), fields: fieldsOf(scope, recordAt, context) };
      const judged = judgePress(context.store, context.manifest, context.shown, press);
      if (!judged.ok) out.act = { as, ok: false, reason: judged.reason, message: judged.message };
      else {
        try {
          const rehearsed = context.store.previewAll([{ name: judged.name, args: judged.args }], { author: context.principal, via: `view:${context.manifest.name}` });
          out.act = { as, ok: true, name: judged.name, args: judged.args, intent: rehearsed.intent, changes: rehearsed.ops.length > 0 };
        } catch (error) {
          out.act = error instanceof PermissionDeniedError ? { as, ok: false, reason: "refused", message: error.refusal.message } : { as, ok: false, reason: "failed", message: "The act could not be applied." };
        }
      }
      const act = out.act!;
      said.push(act.ok ? `It asks for "${act.name}" with ${JSON.stringify(act.args)}: ${act.changes ? `“${act.intent}”, applied for this seat, were it pressed.` : "applied for this seat, it would change nothing."}` : `It asks for "${as}", which the host refuses (${act.reason}): ${act.message}`);
    }
  }
  if (said.length === 0) said.push(`It is bound to no act and lands in no link: the host does nothing there${code.length > 0 ? "" : ", and the view's code does nothing either"}.`);
  return { selector: pressed.selector, element: named(element), ...out, asked, went, redrew, says: `A press on ${named(element)}: ${said.join(" ")}${also}` };
}

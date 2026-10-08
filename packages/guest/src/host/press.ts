import type { AnySchema, Principal, Store } from "@graview/core";
import type { ManifestAct, WorkerViewManifest } from "./manifest.js";
import { declaredValues, entryFor, refuse, type Judged, type Prefilled, type Press, type PressedField } from "./writes.js";

/*
 * A PRESS, AS THE HOST SEES IT (FR-92): the half of the write rules that
 * reads the page. A trusted click on an element bound to an act
 * (`data-act`) is read here — its record, and the fields in its scope,
 * each the viewer's or not — and judged by `judgePress`, in the click's own
 * handler. writes.ts says why.
 *
 * WHOSE A FIELD'S VALUE IS. The host keeps, for every field the view drew,
 * what the viewer last left in it:
 *
 *   · Only an `input` event the browser marks trusted is typing. A
 *     `change` is not, for a text field: the browser raises one, trusted,
 *     when a field the view filled loses focus, and it would have passed
 *     the view's words off as the viewer's. For a choice — a checkbox, a
 *     radio, a select — the viewer's own pick is the whole value, and its
 *     trusted `input` or `change` makes it theirs.
 *   · A text field the view wrote words into is the view's until the viewer
 *     empties it. Typing one letter after the view's words leaves them
 *     there, so a field the view filled does not become the viewer's by
 *     being typed in; emptied, everything in it from then on is theirs. A
 *     view that only empties a field (after an act, say) takes nothing away.
 *   · A view that says back exactly what a field already shows has not
 *     changed it.
 *   · A pick is the viewer's choice, never the viewer's words: a radio's
 *     value and a select's options are the view's, so a picked one goes
 *     only as a value the app itself declares for the argument (an enum's,
 *     a literal's) or a record the view was shown. Otherwise a radio
 *     labeled "Yes" whose value is a hidden record's text would carry it.
 */

const FIELD = new Set(["input", "select", "textarea"]);
const isField = (element: Element): element is HTMLInputElement => element.namespaceURI === "http://www.w3.org/1999/xhtml" && FIELD.has(element.localName);
/** A field whose whole value is one pick of the viewer's: a checkbox, a radio, a select. */
const isChoice = (field: HTMLInputElement) => field.localName === "select" || field.type === "checkbox" || field.type === "radio";
/** A field that shows nothing the view could have put there: empty, unchecked. */
const isEmpty = (field: HTMLInputElement) => (field.type === "checkbox" || field.type === "radio" ? !field.checked : field.localName !== "select" && field.value === "");

/** What a field shows now, as one string to compare. */
function shows(field: HTMLInputElement): string {
  if (field.type === "checkbox" || field.type === "radio") return `checked:${field.checked}`;
  if (field.localName === "select" && (field as unknown as HTMLSelectElement).multiple) return `selected:${[...(field as unknown as HTMLSelectElement).selectedOptions].map((option) => option.value).join("\u0000")}`;
  return `value:${field.value}`;
}

export interface PressReader {
  /** An event on what the view drew: a trusted one on a field is the viewer's typing. */
  heard(event: Event, element: Element): void;
  /** The view set what a field shows: what the viewer typed there is gone. */
  filled(field: Element): void;
  /** A trusted click on (or in) an element bound to an act: the press, with its record and the fields in its scope. */
  press(event: Event, element: Element, root: Element): Press | undefined;
  /** The host filled a field from a record the view was shown (FR-150): the viewer's to edit, and to send only back where it came from. */
  prefilled(field: Element, from: Prefilled): void;
}

export function createPressReader(trusted: (event: Event) => boolean = (event) => event.isTrusted): PressReader {
  const typed = new WeakMap<Element, string>();
  /* Fields the view wrote into, until the viewer empties them. */
  const written = new WeakSet<Element>();
  /* Fields the host filled from a record, until the viewer empties them or the view writes into them (FR-150). */
  const origins = new WeakMap<Element, Prefilled>();
  return {
    heard(event, element) {
      if (!isField(element) || !trusted(event)) return;
      if (event.type === "input" || (event.type === "change" && isChoice(element))) {
        if (isChoice(element) || isEmpty(element)) written.delete(element);
        if (isEmpty(element)) origins.delete(element);
        typed.set(element, shows(element));
        /* A radio the viewer chose unchooses its group: those are the viewer's too. */
        if (element.type === "radio" && element.name) {
          const root = element.getRootNode() as ParentNode;
          for (const other of root.querySelectorAll?.('input[type="radio"]') ?? []) if ((other as HTMLInputElement).name === element.name) typed.set(other, shows(other as HTMLInputElement));
        }
      }
    },
    filled(field) {
      typed.delete(field);
      origins.delete(field);
      if (isField(field) && !isEmpty(field)) written.add(field);
      else written.delete(field);
    },
    press(event, element, root) {
      if (event.type !== "click" || !trusted(event)) return undefined;
      const bound = element.closest("[data-act]");
      if (!bound || !root.contains(bound)) return undefined;
      const record = bound.closest("[data-record]");
      const scope = bound.closest("fieldset, [role='group']") ?? root;
      const fields: PressedField[] = [];
      for (const one of scope.querySelectorAll("input[name], select[name], textarea[name]")) {
        const field = one as HTMLInputElement;
        const mine = !written.has(field) && typed.get(field) === shows(field);
        if (field.type === "radio") {
          if (!field.checked) continue;
          fields.push({ name: field.name, value: field.value, typed: mine, empty: false, chosen: true });
          continue;
        }
        if (field.localName === "select") {
          fields.push({ name: field.name, value: field.value, typed: mine, empty: field.value === "" && !mine, chosen: true });
          continue;
        }
        if (field.type === "checkbox") {
          fields.push({ name: field.name, value: field.checked, typed: mine, empty: !field.checked && !written.has(field) && !mine });
          continue;
        }
        const numeric = field.type === "number" || field.type === "range";
        const value = numeric && field.value !== "" && Number.isFinite(field.valueAsNumber) ? field.valueAsNumber : field.value;
        const from = mine ? origins.get(field) : undefined;
        fields.push({ name: field.name, value, typed: mine, empty: field.value === "" && !mine, ...(from ? { from } : {}) });
      }
      return { as: bound.getAttribute("data-act") ?? "", ...(record && root.contains(record) ? { record: record.getAttribute("data-record")! } : {}), fields };
    },
    prefilled(field, from) {
      written.delete(field);
      origins.set(field, from);
      typed.set(field, shows(field as HTMLInputElement));
    },
  };
}

/** A text field the host may fill: a textarea, or an input that holds words or a number. */
const FILLABLE = new Set(["text", "search", "email", "url", "tel", "number"]);

/**
 * THE HOST FILLS WHAT A VIEW MARKED (FR-150): each `input` or `textarea`
 * under `root` with `data-prefill="<field>"` and the same `name`, empty and
 * not filled by the view, is filled with what `valueOf` says that field of
 * its bound record holds — or left empty, when it says nothing. writes.ts
 * (`prefillOf`) says when it says something. Run after each batch the view
 * draws; a field it has filled, or found holding something, is not looked
 * at again.
 */
export function fillPrefills(
  root: ParentNode & Node,
  reader: PressReader,
  done: WeakSet<Element>,
  valueOf: (asked: { readonly record: string; readonly field: string; readonly acts: readonly string[] }) => string | undefined,
): void {
  for (const one of root.querySelectorAll("input[data-prefill], textarea[data-prefill]")) {
    const field = one as HTMLInputElement;
    if (done.has(field)) continue;
    const asked = field.getAttribute("data-prefill") ?? "";
    if (asked === "" || field.getAttribute("name") !== asked) continue;
    if (field.localName === "input" && !FILLABLE.has(field.type)) continue;
    /* Something is in it already — the view's words, or the viewer's: the host writes over neither. */
    if (field.value !== "") {
      done.add(field);
      continue;
    }
    const scope = field.closest("fieldset, [role='group']") ?? root;
    const acts = [...scope.querySelectorAll("[data-act]")];
    const around = field.closest("[data-record]");
    const records = new Set(acts.map((act) => act.closest("[data-record]")?.getAttribute("data-record")).filter((id): id is string => typeof id === "string"));
    const record = around && root.contains(around) ? around.getAttribute("data-record") : records.size === 1 ? [...records][0] : undefined;
    if (!record) continue;
    const value = valueOf({ record, field: asked, acts: acts.map((act) => act.getAttribute("data-act") ?? "") });
    if (value === undefined) continue;
    field.value = value;
    done.add(field);
    /* A field that cannot hold the value whole — a number field handed words, a one-line field handed paragraphs — is left empty: what it would send is not what the record holds. */
    if (field.value !== value) {
      field.value = "";
      continue;
    }
    reader.prefilled(field, { record, field: asked, value });
  }
}

/** An act the viewer's press asked for: its arguments from the bound record, the manifest and what the viewer typed. */
export function judgePress<S extends AnySchema>(store: Store<S>, manifest: WorkerViewManifest, shown: ReadonlySet<string>, press: Press): Judged {
  const entry = entryFor(manifest, press.as);
  if (!entry) return refuse("undeclared", `This view may not ask for “${press.as}”: its manifest does not name it.`);
  const mutation = store.allMutations().find((one) => one.name === entry.act);
  if (!mutation) return refuse("unknown-act", "There is no act by that name here.");
  const args: Record<string, unknown> = {};
  if (press.record !== undefined) {
    const arg = entry.record ?? mutation.subject?.arg;
    if (!arg) return refuse("unbound", `“${press.as}” is not done to a record.`);
    if (!shown.has(press.record)) return refuse("unbound", "That press is bound to a record this view was not shown.");
    args[arg] = press.record;
  }
  for (const [name, value] of Object.entries(entry.constants ?? {})) {
    if (name in args) return refuse("malformed", `“${name}” is both the bound record and a constant.`);
    args[name] = value;
  }
  /* The act's arguments, by name: its input object's own keys. */
  const shape = (mutation.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  const declared = new Set(Object.keys(shape));
  const seen = new Set<string>();
  for (const field of press.fields) {
    if (!declared.has(field.name) || field.name in args) continue;
    if (seen.has(field.name)) return refuse("malformed", `Two fields here are called “${field.name}”.`);
    seen.add(field.name);
    if (field.typed && field.chosen) {
      /* The viewer picked it; the view wrote it. It goes only as one of the app's own values, or a record the view was shown. */
      const value = declaredValues(shape[field.name])?.find((one) => String(one) === String(field.value));
      if (value !== undefined) args[field.name] = value;
      else if (typeof field.value === "string" && shown.has(field.value)) args[field.name] = field.value;
      else return refuse("untyped", `“${field.name}” was a choice among the view's own words, not one this app declares, so it was not sent.`);
    } else if (field.typed && field.from && !(press.record === field.from.record && field.name === field.from.field && writesBack(store, entry, field.from.record, field.from.field)))
      /* Filled by the host from a record: it goes only back into the field it came from (FR-150). */
      return refuse("untyped", `“${field.name}” was filled in from a record for an act that writes it back there, not for this one, so it was not sent.`);
    else if (field.typed && field.from && String(field.value) === field.from.value)
      /* Filled and untouched since: the record's value as it is now, never the copy it was filled with, which another seat may have changed since. */
      args[field.name] = (store.graph.getNode(field.from.record) as Record<string, unknown> | undefined)?.[field.name] ?? field.value;
    else if (field.typed) args[field.name] = field.value;
    else if (!field.empty) return refuse("untyped", `“${field.name}” was filled in by the view, not typed by you, so it was not sent.`);
  }
  return { ok: true, name: entry.act, args };
}

/*
 * A FIELD THE HOST FILLS FROM THE RECORD (FR-150).
 *
 * A view cannot fill a field (above), so a view that offered to change a
 * three-thousand-character draft asked the person to type all of it again.
 * So the HOST fills it. A view marks a field with what it holds —
 * `<textarea name="draft" data-prefill="draft">` inside an act's
 * `fieldset` — and the host writes the record's own value into it, read
 * through the viewer's sight, when every one of these holds:
 *
 *   · the field's `name` is the field it asks for, and the record is the one
 *     the field is bound to (`data-record` on it or around it, else the one
 *     record every act in its `fieldset` is bound to), one the view was
 *     shown;
 *   · an act in its `fieldset` is named in the manifest, is done to that
 *     record, takes that field as an argument and declares it WRITES it
 *     (`writes`), writes no other record's fields (`writesOther`), and this
 *     viewer may run it on that record;
 *   · the value is text or a number, and the field holds it whole.
 *
 * The value is then the viewer's, as if they had typed it, and they edit it
 * in place: what they type after it is theirs too. But it goes only back
 * where it came from. A press carries a filled field only to an act that
 * writes that field of that same record (`writesBack`); any other press
 * carrying it is refused `untyped`. A view that sets the field after the
 * host filled it makes it the view's, as ever.
 *
 * Nothing leaks by it. The value is a field of a record the view was shown,
 * so the view could already read it in its props; the host hands it nothing
 * the viewer may not see, and nothing that is not in the record. And it can
 * be written only into the field it came from, on the record it came from,
 * by an act the viewer may run there: the most a view can do with it is
 * have the person save a field as it was.
 */

/** Whether an act, as the manifest names it, writes this field of this record back: done to it, taking the field, writing it, and no other record's. */
export function writesBack<S extends AnySchema>(store: Store<S>, entry: ManifestAct, record: string, field: string): boolean {
  const mutation = store.allMutations().find((one) => one.name === entry.act);
  const subject = mutation?.subject;
  if (!mutation || !subject) return false;
  if ((entry.record ?? subject.arg) !== subject.arg || field === subject.arg || Object.hasOwn(entry.constants ?? {}, field)) return false;
  if (!Object.hasOwn((mutation.input as { shape?: Record<string, unknown> }).shape ?? {}, field)) return false;
  if (Object.keys(mutation.writesOther ?? {}).length > 0) return false;
  const kind = store.graph.getNode(record)?.kind as string | undefined;
  const definition = kind === undefined ? undefined : store.schema.tryDefinition(kind);
  if (!definition || (subject.kinds !== "*" && !(subject.kinds as readonly string[]).includes(kind!))) return false;
  if (!Object.hasOwn((definition.fields as { shape?: Record<string, unknown> }).shape ?? {}, field)) return false;
  /*
   * Only what the act DECLARES it `writes` (every act a document compiles
   * declares it). A TypeScript act that declares nothing may do anything
   * with an argument named like a field — copy it into a record other seats
   * read — so a record's value is never handed to it unasked.
   */
  return mutation.writes?.includes(field) ?? false;
}

/** What the host fills a field with: one field of a record the view was shown, as the viewer sees it, when an act bound beside it writes it back and the viewer may run it there. */
export function prefillOf<S extends AnySchema>(
  store: Store<S>,
  principal: Principal,
  manifest: WorkerViewManifest,
  shown: ReadonlySet<string>,
  asked: { readonly record: string; readonly field: string; readonly acts: readonly string[] },
): string | undefined {
  if (!shown.has(asked.record)) return undefined;
  const node = store.seenBy(principal).graph.getNode(asked.record) as Record<string, unknown> | undefined;
  if (!node) return undefined;
  const writable = asked.acts.some((as) => {
    const entry = entryFor(manifest, as);
    if (!entry || !writesBack(store, entry, asked.record, asked.field)) return false;
    const subject = store.allMutations().find((one) => one.name === entry.act)!.subject!;
    return store.permits({ name: entry.act, args: { [subject.arg]: asked.record } }, principal).ok;
  });
  if (!writable) return undefined;
  const value = node[asked.field];
  return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

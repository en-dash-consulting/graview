import { fieldsWrittenBy, subjectKindsOf, type AnySchema, type Principal, type Store } from "@graview/core";
import type { GuestRefusal } from "../protocol.js";
import { manifestActs, type ManifestAct, type WorkerViewManifest } from "./manifest.js";

/*
 * WRITES THAT CANNOT LEAK (FR-92).
 *
 * A view runs for every member with that member's sight, and its author is
 * not the member: a chat that read a record somebody else wrote may follow
 * what was hidden in it. The danger is a view reading what this viewer may
 * see and writing it where somebody else may see it. So:
 *
 *   An act must be named in the view's manifest, or it is refused.
 *
 *   Where the app's sight is total — every member sees every record — there
 *   is nothing to leak, and an act the view asks for from its own code
 *   applies with the arguments it gives (`sightIsTotal`).
 *
 *   Otherwise an act applies only from a press the HOST saw — a trusted
 *   click on an element the view drew with `data-act` — in that press's own
 *   handler, and its arguments come only from
 *     · the record the element is bound to (`data-record`, on it or the
 *       nearest element around it), one the view was shown;
 *     · the manifest's constants for the act; and
 *     · the values of fields the host itself read, each one the viewer
 *       typed: the last change to it a trusted `input` or `change` event,
 *       and nothing the view drew changing it since.
 *   A field whose value the view set — its `value` attribute, a later
 *   update, a textarea's text, an option's `selected` — is FILLED BY THE
 *   VIEW, and a press that would carry it is refused. A view's code cannot
 *   type: what it dispatches lands in its own worker's DOM, never the
 *   host's, and every event it could cause there is untrusted.
 *
 * Either way the act is applied as the viewer, `via: "view:<name>"`, under
 * the view's allowance, and undoable like any other.
 *
 * Pure: no DOM. The host's region reads the press and the fields
 * (press.ts, fetched with the region's drawing), and judges them there.
 */

/** Whether every member of the app sees every record: no sight is declared, or every kind is seen by everybody, whole. */
export function sightIsTotal<S extends AnySchema>(store: Store<S>): boolean {
  const sees = store.policy?.sees ?? [];
  if (sees.length === 0) return true;
  return (store.schema.kinds as readonly string[]).every((kind) => sees.some((sight) => sight.roles === "*" && !sight.own && sight.kinds.includes(kind)));
}

/** A field the host read, at the moment of a press. */
export interface PressedField {
  readonly name: string;
  readonly value: string | number | boolean;
  /** The viewer typed it: the last change was theirs, and the view has not set it since. */
  readonly typed: boolean;
  /** It holds nothing, and nobody has touched it. */
  readonly empty: boolean;
  /**
   * It is a pick — a radio, a select — whose value is the view's own words:
   * the viewer chose it, but did not write it. Taken only as a value the
   * app itself declares for the argument, or a record the view was shown.
   */
  readonly chosen?: true;
  /**
   * The host filled it from a record the view was shown (FR-150): that
   * record's field, as this viewer sees it. It goes only back where it came
   * from — to an act that writes that field of that record.
   */
  readonly from?: Prefilled;
}

/** Where a field the host filled came from: a field of a record the view was shown (FR-150). */
export interface Prefilled {
  readonly record: string;
  readonly field: string;
}

/**
 * The values the app's own declaration allows an argument — an enum's
 * options or a literal's values, through `optional()`, `default()` and the
 * like — or undefined when it declares no such list.
 */
export function declaredValues(schema: unknown): readonly unknown[] | undefined {
  let at = schema as { _zod?: { def?: Record<string, unknown> } } | undefined;
  for (let depth = 0; depth < 8 && at?._zod?.def; depth += 1) {
    const def = at._zod.def;
    if (def["type"] === "enum") return Object.values(def["entries"] as Record<string, unknown>);
    if (def["type"] === "literal") return def["values"] as unknown[];
    if (!("innerType" in def)) return undefined;
    at = def["innerType"] as typeof at;
  }
  return undefined;
}

/** A press the host saw on an element bound to an act. */
export interface Press {
  /** What the view called the act (`data-act`). */
  readonly as: string;
  /** The record the element is bound to (`data-record`), if any. */
  readonly record?: string;
  /** The fields in the press's scope, read by the host. */
  readonly fields: readonly PressedField[];
}

export type Judged = { readonly ok: true; readonly name: string; readonly args: Record<string, unknown> } | { readonly ok: false; readonly reason: GuestRefusal; readonly message: string };

export const refuse = (reason: GuestRefusal, message: string): Judged => ({ ok: false, reason, message });

export function entryFor(manifest: WorkerViewManifest, asked: string): ManifestAct | undefined {
  return manifestActs(manifest).find((one) => (one.as ?? one.act) === asked) ?? manifestActs(manifest).find((one) => one.act === asked && one.as === undefined);
}

/** An act the view asked for from its own code (`graview.act`). */
export function judgeCodeAct<S extends AnySchema>(store: Store<S>, manifest: WorkerViewManifest, name: string, args: Readonly<Record<string, unknown>>): Judged {
  const entry = entryFor(manifest, name);
  if (!entry) return refuse("undeclared", `This view may not ask for “${name}”: its manifest does not name it.`);
  if (!sightIsTotal(store)) return refuse("press-only", "In this app some members may not see some records, so a view's act applies only when you press it.");
  return { ok: true, name: entry.act, args: { ...args, ...(entry.constants ?? {}) } };
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
 *     record, takes that field as an argument and WRITES it (`writes`, or the
 *     name-match `fieldsWrittenBy` reads), writes no other record's fields
 *     (`writesOther`), and this viewer may run it on that record;
 *   · the value is text or a number.
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
  if ((entry.record ?? subject.arg) !== subject.arg || field === subject.arg || field in (entry.constants ?? {})) return false;
  if (!(field in ((mutation.input as { shape?: Record<string, unknown> }).shape ?? {}))) return false;
  if (Object.keys(mutation.writesOther ?? {}).length > 0) return false;
  const kind = store.graph.getNode(record)?.kind as string | undefined;
  const definition = kind === undefined ? undefined : store.schema.tryDefinition(kind);
  if (!definition || !subjectKindsOf(store.schema, mutation).includes(kind!)) return false;
  return fieldsWrittenBy(mutation, definition).includes(field);
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

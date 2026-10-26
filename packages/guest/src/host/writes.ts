import { isMadeRef, type AnySchema, type FileValue, type Store } from "@graview/core";
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

/**
 * Whether every member of the app sees every record and every field of it:
 * no sight is declared, or every kind is seen by everybody, whole. A sight
 * that keeps fields (`hide`, or a `fields` list) shows a kind in part, so a
 * kind only such a sight gives everybody is not seen whole: a view run for
 * a seat that sees those fields could write them where the others read.
 */
export function sightIsTotal<S extends AnySchema>(store: Store<S>): boolean {
  const sees = store.policy?.sees ?? [];
  if (sees.length === 0) return true;
  const whole = (sight: (typeof sees)[number]) => sight.fields === undefined && (sight.hide?.length ?? 0) === 0;
  return (store.schema.kinds as readonly string[]).every((kind) => sees.some((sight) => sight.roles === "*" && !sight.own && !sight.via && whole(sight) && sight.kinds.includes(kind)));
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
  /** What the host filled it with, as the field held it. */
  readonly value: string;
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

export type Judged =
  | {
      readonly ok: true;
      readonly name: string;
      readonly args: Record<string, unknown>;
      /** The dropped files this act spent under a drop's exception: the host hands none of them to an act again. */
      readonly spent?: readonly string[];
    }
  | { readonly ok: false; readonly reason: GuestRefusal; readonly message: string };

export const refuse = (reason: GuestRefusal, message: string): Judged => ({ ok: false, reason, message });

export function entryFor(manifest: WorkerViewManifest, asked: string): ManifestAct | undefined {
  return manifestActs(manifest).find((one) => (one.as ?? one.act) === asked) ?? manifestActs(manifest).find((one) => one.act === asked && one.as === undefined);
}

/*
 * A FILE IN AN ACT'S ARGUMENT (FR-193). A view hands an act a file — a
 * moment's photograph — only as the host handed it one: a file the person
 * dropped (`event.files`), or one on a record the view was shown, as the
 * record keeps it. Anything with an `href` that is neither is refused,
 * whatever it says, and a file that is one goes as the host kept it: what
 * the view added to it or changed in it is left off. A file is never an
 * address a view made up.
 *
 * WHERE SIGHT IS NOT TOTAL, an act from a view's code is refused (above) —
 * except one that carries the files of a drop and nothing the view chose:
 * each argument a file the person dropped, the record the drop was bound
 * to (its `data-drop-connect`, or the `data-record` it was drawn in), or a
 * record the same change makes (`{ $made: n }`). A drop is the person's
 * own gesture, and its files are theirs, so it allows the one change it was
 * made for: each file goes in one act, once, and is then spent (`spent`,
 * which the host takes out of what it handed), and no argument is the
 * view's pick among the records it was shown or the values the app
 * declares — a pick is a choice, and a run of choices can spell what this
 * viewer alone may see.
 */

/** What a drop handed a view a file for: the record the drop was bound to, if any. */
export interface DropGrant {
  readonly target?: string;
}

/** What the host handed a view: the records it was shown, and the files it may hand back. */
export interface CodeActContext {
  /** The records the view was last shown. */
  readonly shown: ReadonlySet<string>;
  /** The file at `href` as the host keeps it, where it handed this view that file: in a drop, or on a record it was shown. */
  readonly file: (href: string) => FileValue | undefined;
  /** The drop the host handed this view that file in, if it did and no act has spent it since. */
  readonly dropped: (href: string) => DropGrant | undefined;
}

const looksLikeFile = (value: unknown): value is { readonly href: unknown } => typeof value === "object" && value !== null && !Array.isArray(value) && "href" in value;

/** An act the view asked for from its own code (`graview.act`). */
export function judgeCodeAct<S extends AnySchema>(store: Store<S>, manifest: WorkerViewManifest, name: string, args: Readonly<Record<string, unknown>>, context?: CodeActContext): Judged {
  const entry = entryFor(manifest, name);
  if (!entry) return refuse("undeclared", `This view may not ask for “${name}”: its manifest does not name it.`);
  /* Each file as the host kept it, or the act is refused. */
  const given: Record<string, unknown> = {};
  const drops = new Map<string, DropGrant>();
  for (const [key, value] of Object.entries(args)) {
    const one = (file: unknown): unknown => {
      if (!looksLikeFile(file)) return file;
      const kept = typeof file.href === "string" ? context?.file(file.href) : undefined;
      if (!kept) throw refuse("malformed", `“${key}” is a file the host did not hand this view: a view hands an act a file the person dropped (event.files), or one a record it was shown holds, as it was handed.`);
      const drop = context?.dropped(kept.href);
      if (drop) {
        if (drops.has(kept.href)) throw refuse("malformed", `“${key}” hands the act a dropped file it already carries: each file a person dropped goes in one act, once.`);
        drops.set(kept.href, drop);
      }
      return kept;
    };
    try {
      given[key] = Array.isArray(value) ? value.map(one) : one(value);
    } catch (refusal) {
      return refusal as Judged;
    }
  }
  if (!sightIsTotal(store)) {
    /* Every dropped file in the act from drops bound to one record, or every one to none: the change the gesture was made for. */
    const targets = new Set([...drops.values()].map((drop) => drop.target));
    const target = targets.size === 1 ? [...targets][0] : undefined;
    const theirs = (value: unknown): boolean =>
      (looksLikeFile(value) && typeof value.href === "string" && drops.has(value.href)) || isMadeRef(value) || (target !== undefined && value === target && context?.shown.has(target) === true);
    const ofADrop = drops.size > 0 && targets.size === 1 && Object.values(given).every((value) => (Array.isArray(value) ? value.every(theirs) : theirs(value)));
    if (!ofADrop) return refuse("press-only", "In this app some members may not see some records, so a view's act applies only when you press it.");
    return { ok: true, name: entry.act, args: { ...given, ...(entry.constants ?? {}) }, spent: [...drops.keys()] };
  }
  return { ok: true, name: entry.act, args: { ...given, ...(entry.constants ?? {}) } };
}

import { defOf } from "../schema/zod.js";
import { isMoment } from "../days.js";
import { fileKindOf } from "../schema/files.js";
import { typedFieldOf } from "../schema/typed-field-of.js";
import { amountOf, type AmountMark } from "../schema/amount-mark.js";
import { amountMark } from "../schema/amount-words.js";

/*
 * A file of its own (FR-179): what an argument asks for is read by a form, a
 * list's filter, the matcher and the seat — each fetched as it is first
 * drawn or asked — and never by what a page draws before anybody acts, so
 * a page's first chunk carries none of it (`@graview/core/words`).
 */

/**
 * What sort of answer an argument wants, read off its own declaration.
 *
 * The affordance layer could already say "this needs a `label`" and offer
 * candidate ids for a node reference — but for a plain string or a date it
 * offered a list of nothing, so half the actions in an interface were dead
 * ends that looked live. The mutation's schema knows perfectly well that
 * `label` is a non-empty string and `date` is `YYYY-MM-DD`; nothing had
 * asked it.
 */
export type ArgShape =
  /**
   * Words; `long` where the field allows more than 500 characters — prose,
   * asked for in a text area (FR-147). `holds` where they are a phone number
   * or a place: asked for as one, and drawn as a link.
   */
  | { readonly type: "text"; readonly long?: true; readonly holds?: "phone" | "place" }
  /**
   * A DATE, AND WITH `time` A TIME OF DAY IN IT. A workshop's start is
   * `YYYY-MM-DDTHH:MM`; read as a plain date it got a date picker, whose
   * `YYYY-MM-DD` the act's own pattern refused — on every face, so the
   * workshop could not be made and the talk could not be given its slot.
   */
  | {
      readonly type: "date";
      readonly time?: true;
      /** A moment that names an instant (a document's `datetime`, `z.iso.datetime()`): typed on the reader's clock and kept in UTC with its `Z`. Without it, a time is kept as the wall time written. */
      readonly instant?: true;
    }
  /**
   * A number, and its range where it says one: `step` is what its values are
   * whole multiples of (FR-114), 1 for a whole number. `duration` where it is
   * a length of time in minutes, typed as "1h 30m", "90" or "1:30". `amount`
   * where the field is said as more than a number: money in a currency, a
   * fraction as a percent — asked for as "$1,250.50".
   */
  | { readonly type: "number"; readonly min?: number; readonly max?: number; readonly step?: number; readonly duration?: true; readonly amount?: AmountMark }
  | { readonly type: "choice"; readonly options: readonly string[] }
  /**
   * YES OR NO — an argument that takes a boolean.
   *
   * Undescribable until now, for the same reason a list was: an interface
   * can only offer what it can ask for, so "Add a field" — whose `required`
   * is a plain boolean — was derived NOWHERE. The studio's central act, in
   * the studio, unreachable, because nothing could ask one question.
   */
  | { readonly type: "boolean" }
  /**
   * SEVERAL OF A THING — an argument that takes a list.
   *
   * "Invite somebody as coordinator and gardener" is one act with two roles
   * in one argument, and without this shape it described itself as `unknown`:
   * an interface can only offer what it can ask for, so the act was offered
   * NOWHERE. Not hidden behind a refusal — simply never derived, in every
   * installation the framework ships.
   */
  | { readonly type: "several"; readonly of: ArgShape }
  /** A picture, a video or a document the host stores (FR-162), put on the record by its upload (FR-163); `image` where only a picture will do, `video` where only a video will (0.1.37). */
  | { readonly type: "file"; readonly image?: true; readonly video?: true }
  | { readonly type: "unknown" };

/** Unwraps optional/default/nullable so a wrapped field still describes itself. */
export function unwrap(schema: unknown): unknown {
  const inner = defOf(schema)?.innerType;
  return inner === undefined ? schema : unwrap(inner);
}

/** What a number's declared format bounds it to, as zod's own `int()`, `int32()` … say. */
const NUMBER_FORMAT_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-3.4028234663852886e38, 3.4028234663852886e38],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
};

type CheckDef = { readonly check?: string; readonly value?: unknown; readonly inclusive?: boolean; readonly format?: string; readonly pattern?: unknown; readonly fn?: unknown };
const checksOf = (field: unknown): CheckDef[] =>
  (((field as { _zod?: { def?: { checks?: readonly { _zod?: { def?: CheckDef } }[] } } })?._zod?.def?.checks ?? []).map((check) => check._zod?.def).filter((def): def is CheckDef => def !== undefined));

/**
 * Zod 4 keeps the primitive type on `_def.type` and the refinements a UI
 * actually needs — bounds, patterns — as the checks on its definition. Read
 * from the checks themselves, not from `_zod.bag`, which zod 4.6 stopped
 * filling as it builds a schema: the bounds and the date pattern read there
 * vanished with a minor version. Reading them here, in one place, keeps
 * every other layer free of zod internals.
 */
export function describeArg(schema: unknown): ArgShape {
  const field = unwrap(schema);
  const def = defOf(field);
  const type = def?.type;
  const checks = checksOf(field);

  if (type === "enum") return { type: "choice", options: Object.keys(def?.entries ?? {}) };

  const file = fileKindOf(field);
  if (file) return file === "image" ? { type: "file", image: true } : file === "video" ? { type: "file", video: true } : { type: "file" };

  if (type === "boolean") return { type: "boolean" };

  /*
   * A list describes itself through what it holds. An array of something
   * nothing can describe is still unknown — saying "several unknowns" would
   * make an unaskable argument look askable, which is the failure this whole
   * shape exists to prevent.
   */
  if (type === "array") {
    const of = describeArg(def?.element);
    return of.type === "unknown" ? { type: "unknown" } : { type: "several", of };
  }

  if (type === "number") {
    let min: number | undefined;
    let max: number | undefined;
    let step: number | undefined;
    for (const check of checks) {
      if (check.check === "multiple_of" && typeof check.value === "number") step = check.value;
      else if (check.check === "number_format" && (check.format === "safeint" || check.format === "int32" || check.format === "uint32")) step ??= 1;
      const range = check.check === "number_format" && check.format ? NUMBER_FORMAT_RANGES[check.format] : undefined;
      const low = range ? range[0] : check.check === "greater_than" && check.inclusive && typeof check.value === "number" ? check.value : undefined;
      const high = range ? range[1] : check.check === "less_than" && check.inclusive && typeof check.value === "number" ? check.value : undefined;
      if (low !== undefined) min = min === undefined ? low : Math.max(min, low);
      if (high !== undefined) max = max === undefined ? high : Math.min(max, high);
    }
    return {
      type: "number",
      ...(min === undefined ? {} : { min }),
      ...(max === undefined ? {} : { max }),
      ...(step === undefined ? {} : { step }),
      ...(typedFieldOf(field) === "duration" ? { duration: true as const } : {}),
      ...(amountOf(schema) ? { amount: amountMark(amountOf(schema)!) } : {}),
    };
  }

  if (type === "string") {
    // A moment that names an instant: a document's `datetime` (checked by `isMoment`) or zod's own ISO date and time.
    if (checks.some((check) => check.fn === isMoment || check.format === "datetime") || def?.format === "datetime") return { type: "date", time: true, instant: true };
    // A date is a string with a date-shaped pattern. Recognizing it means
    // the interface offers a date picker instead of a free text box, which
    // is the difference between an action anyone can run and one only its
    // author knows the format for.
    const own = def?.pattern;
    const sources = [own, ...checks.map((check) => check.pattern)].filter((pattern): pattern is RegExp => pattern instanceof RegExp).map((pattern) => pattern.source);
    if (sources.some((source) => source.includes("\\d{4}"))) {
      // A time of day in the pattern as well: `T\d{2}:\d{2}`, or a space before it.
      return sources.some((source) => source.includes("\\d{2}:\\d{2}")) ? { type: "date", time: true } : { type: "date" };
    }
    // Prose: more than 500 characters allowed — a document's `text` (FR-147), asked for in a text area.
    const long = checks.some((check) => check.check === "max_length" && typeof (check as { maximum?: unknown }).maximum === "number" && (check as { maximum: number }).maximum > 500);
    const holds = typedFieldOf(field);
    return long ? { type: "text", long: true } : holds === "phone" || holds === "place" ? { type: "text", holds } : { type: "text" };
  }

  return { type: "unknown" };
}

/** The declared shape of one named argument of a mutation input object. */
export function argShape(input: unknown, name: string): ArgShape {
  const shape = (input as { shape?: Record<string, unknown> })?.shape;
  if (!shape || !(name in shape)) return { type: "unknown" };
  return describeArg(shape[name]);
}

import { fieldWriters, labelOf, type AnySchema, type NodeOfSchema, type Store } from "@graview/core";
import { dayOf, daysBetween, minutesOf } from "./calendar-dates.js";
import { CALENDAR_REQUIRED_ROLES, type CalendarBindings, type PlacedEntry, holds } from "./calendar-options.js";


export class CalendarBindingError extends Error {
  constructor(
    readonly kind: string,
    readonly missing: readonly string[],
  ) {
    super(
      `The calendar lens has no binding for ${missing.map((role) => `"${role}"`).join(", ")} on "${kind}". ` +
        `Bind them in the lens declaration: bindings: { ${kind}: { start: "<field>" } }.`,
    );
    this.name = "CalendarBindingError";
  }
}

/**
 * One node as an entry, or null when it simply has no date.
 *
 * A binding error and a missing value are different things, the same way
 * they are in the timeline: an app that never bound `start` has made a
 * mistake, and a task with no due date is ordinary data. Only the first
 * throws.
 */
export function placeOnCalendar<S extends AnySchema>(
  node: NodeOfSchema<S>,
  bindings: CalendarBindings,
  schema?: S,
): PlacedEntry | null {
  const roles = bindings[node.kind];
  if (!roles) return null;
  const record = node as Record<string, unknown>;
  const declared = schema?.tryDefinition(node.kind)?.fields.shape as Record<string, unknown> | undefined;
  const missing = CALENDAR_REQUIRED_ROLES.filter((role) => {
    const field = roles[role];
    if (!field) return true;
    return declared ? !(field in declared) : !(field in record);
  });
  if (missing.length > 0) throw new CalendarBindingError(node.kind, missing);

  const from = dayOf(record[roles.start]);
  if (from === null) return null;
  const to = (roles.end ? dayOf(record[roles.end]) : null) ?? from;
  const at = minutesOf(record[roles.start]);
  const named = roles.label ? record[roles.label] : undefined;
  return {
    id: node.id,
    kind: node.kind as string,
    label:
      typeof named === "string" && named.length > 0
        ? named
        : labelOf(schema?.tryDefinition(node.kind), node),
    from,
    // An end before its start is a typo in the data, not a span that runs
    // backwards: the entry occupies the day it starts and says no more.
    to: daysBetween(from, to) < 0 ? from : to,
    at: roles.allDay && record[roles.allDay] === true ? null : at,
    allDay: roles.allDay ? record[roles.allDay] === true || at === null : at === null,
    done: holds(record, roles.done),
  };
}

/** The entries touching a day, in the order a person reads them. */
export function entriesOn(entries: readonly PlacedEntry[], day: string): PlacedEntry[] {
  return entries
    .filter((entry) => daysBetween(entry.from, day) >= 0 && daysBetween(day, entry.to) >= 0)
    .sort((a, b) => {
      // All-day first — they are the frame the timed ones sit inside — then
      // by time, then by name so the order never wobbles between renders.
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.at !== b.at) return (a.at ?? 0) - (b.at ?? 0);
      return a.label.localeCompare(b.label);
    });
}


/* ------------------------------------------------------- moving a date */

/**
 * THE ACT THAT WRITES THE DATE, found in the declaration rather than named
 * in the lens.
 *
 * A calendar you cannot drag in is a picture of a schedule rather than a
 * schedule. But the lens must not invent an edit: it looks for a declared
 * act whose subject accepts this kind and that SAYS it writes the field the
 * start role is bound to, and falls back to the derived edit of the kind,
 * which every kind has. Either way the store judges it, the log records it
 * with an author, and undo takes it back — exactly as if the same act had
 * been pressed in the strip.
 */
export function actThatMoves<S extends AnySchema>(
  store: Store<S>,
  kind: string,
  field: string,
): { readonly name: string; readonly arg: string } | null {
  /*
   * Which acts write this field, asked of the framework's own answer
   * (`fieldWriters`) rather than of `mutation.writes` alone. That is the
   * function the checker uses for `field-without-writer`, and it also reads
   * an act that patches a field it happens to be named for — so a
   * `reschedule` whose declaration forgot `writes: ["due"]` is still found,
   * and the lens does not disagree with the checker about who writes what.
   */
  const writers = fieldWriters(store.schema, store.allMutations()).get(kind)?.get(field) ?? [];
  const declared = new Map(store.allMutations().map((mutation) => [mutation.name, mutation]));
  for (const name of writers) {
    const mutation = declared.get(name);
    const subject = mutation?.subject;
    if (!mutation || !subject) continue;
    // It must also be able to be TOLD the new date, or it writes its own —
    // "finish it" writes `done` and has no opinion you can hand it.
    const shape = (mutation.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
    if (!(field in shape)) continue;
    return { name: mutation.name, arg: subject.arg };
  }
  // Every kind has a derived edit; it is the honest fallback, and the policy
  // reads it through whatever declared acts it rides.
  const edit = store.allMutations().find((mutation) => mutation.derived?.edit === kind);
  return edit?.subject ? { name: edit.name, arg: edit.subject.arg } : null;
}

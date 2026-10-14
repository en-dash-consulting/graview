import { isRepeat, repeatKey, WEEKDAYS, weekdayName, type AnySchema, type Repeat, type Weekday } from "@graview/core";
import { repeatAsRead } from "@graview/core/words";
import { useEditableFields } from "@graview/react/drawing";
import { useId, useState, type CSSProperties, type ReactNode } from "react";

/*
 * HOW A DATE REPEATS, ASKED FOR (`repeat.ts` in core): none, every day,
 * week, month or year; every how many; on which weekdays; until a day — and
 * the answer said back in words ("Every other Tuesday and Thursday, until
 * Dec 15, 2026") as it is chosen, for whoever cannot see the controls lined
 * up. Every control is a labeled native one, so a keyboard and a screen
 * reader reach each in order. Fetched with the first one drawn: a form or a
 * record whose dates do not repeat never loads it.
 */

export interface RepeatPickerProps {
  /** How the date repeats now; undefined when it does not. */
  readonly value: unknown;
  readonly onChange: (next: Repeat | undefined) => void;
  /** The date it repeats (its first occurrence), for the words and the weekday it falls on. */
  readonly start?: unknown;
  /** What the control is called: the date's label and "repeats". */
  readonly label: string;
  readonly name?: string;
}

const EVERY: readonly [Repeat["every"] | "", string][] = [
  ["", "Does not repeat"],
  ["day", "Daily"],
  ["week", "Weekly"],
  ["month", "Monthly"],
  ["year", "Yearly"],
];
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const ROW: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center" };

/** The picker itself: controlled, drawn in a form beside the date it repeats. */
export function RepeatPicker({ value, onChange, start, label, name = "repeat" }: RepeatPickerProps): ReactNode {
  const id = useId();
  const repeat = isRepeat(value) ? value : undefined;
  const day = typeof start === "string" && /^\d{4}-\d{2}-\d{2}/.test(start) ? start : undefined;
  const ownWeekday = day ? WEEKDAYS[new Date(`${day.slice(0, 10)}T00:00:00Z`).getUTCDay()]! : undefined;
  const set = (next: Partial<Repeat>) => {
    const merged = { ...(repeat ?? { every: "week" as const }), ...next } as Record<string, unknown>;
    for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key];
    onChange(merged as unknown as Repeat);
  };
  const unit = repeat?.every ?? "week";
  const weekdays = (repeat?.on as readonly Weekday[] | undefined) ?? (ownWeekday ? [ownWeekday] : []);
  return (
    <fieldset data-graview-part="field" data-graview-field="repeat" data-graview-repeat={name} style={{ display: "grid", gap: 8, border: "1px solid var(--graview-edge)", borderRadius: 8, padding: "8px 12px", margin: 0, minWidth: 0 }}>
      <legend data-graview-part="label" style={{ padding: "0 4px" }}>
        {label}
      </legend>
      <div style={ROW}>
        <label htmlFor={`${id}-every`}>Repeats</label>
        <select
          id={`${id}-every`}
          name={`${name}.every`}
          value={repeat?.every ?? ""}
          onChange={(event) => {
            const every = event.target.value as Repeat["every"] | "";
            // A weekday list is a week's and a day of the month a month's: changing the unit lets the other go.
            onChange(every === "" ? undefined : ({ ...(repeat?.interval ? { interval: repeat.interval } : {}), ...(repeat?.until ? { until: repeat.until } : {}), every } as Repeat));
          }}
          data-graview-part="control"
        >
          {EVERY.map(([every, words]) => (
            <option key={every} value={every}>
              {words}
            </option>
          ))}
        </select>
        {repeat ? (
          <label style={ROW}>
            every
            <input
              type="number"
              min={1}
              max={99}
              name={`${name}.interval`}
              aria-label={`Every how many ${unit}s`}
              value={repeat.interval ?? 1}
              onChange={(event) => set({ interval: Number(event.target.value) > 1 ? Math.min(99, Math.round(Number(event.target.value))) : undefined })}
              style={{ width: "4.5em" }}
              data-graview-part="control"
            />
            {unit}
            {(repeat.interval ?? 1) > 1 ? "s" : ""}
          </label>
        ) : null}
      </div>
      {repeat?.every === "week" ? (
        <div role="group" aria-label="On" style={ROW}>
          <span aria-hidden="true">On</span>
          {WEEKDAYS.map((weekday, at) => (
            <label key={weekday} style={{ display: "inline-flex", gap: 4, alignItems: "center", minHeight: 24 }}>
              <input
                type="checkbox"
                name={`${name}.on`}
                value={weekday}
                checked={weekdays.includes(weekday)}
                onChange={(event) => {
                  const on = WEEKDAYS.filter((one) => (one === weekday ? event.target.checked : weekdays.includes(one)));
                  // Its own weekday alone is said by saying none.
                  set({ on: on.length === 0 || (on.length === 1 && on[0] === ownWeekday) ? undefined : on });
                }}
              />
              {weekdayName(at, "short")}
            </label>
          ))}
        </div>
      ) : null}
      {repeat?.every === "month" ? (
        <label style={ROW}>
          On
          <select
            name={`${name}.on`}
            value={repeat.on?.[0] === -1 ? "last" : ""}
            onChange={(event) => set({ on: event.target.value === "last" ? [-1] : undefined })}
            data-graview-part="control"
          >
            <option value="">{day ? `the ${ordinal(Number(day.slice(8, 10)))}` : "the same day"}</option>
            <option value="last">the last day</option>
          </select>
        </label>
      ) : null}
      {repeat ? (
        <label style={ROW}>
          Until
          <input type="date" name={`${name}.until`} value={repeat.until ?? ""} onChange={(event) => set({ until: event.target.value || undefined })} data-graview-part="control" />
        </label>
      ) : null}
      <p aria-live="polite" data-graview-repeat-said="" style={{ margin: 0, color: "var(--graview-ink-dim)", fontSize: "0.8125rem" }}>
        {repeat ? repeatAsRead(day ?? "", repeat) : "Does not repeat"}
      </p>
    </fieldset>
  );
}

/**
 * HOW A RECORD'S DATE REPEATS, CHANGED WHERE IT IS SHOWN: a button saying
 * "Repeat…" (or "Change how it repeats") beside the date, opening the
 * picker, kept by the act that writes it — logged, judged and undoable as
 * any edit in place — and only where an act may write it.
 */
export function RepeatEditor<S extends AnySchema>({ nodeId, field, start, value, label }: { readonly nodeId: string; readonly field: string; readonly start: unknown; readonly value: unknown; readonly label: string }): ReactNode {
  const { fields, commit } = useEditableFields<S>(nodeId);
  const writer = fields.find((candidate) => candidate.field === repeatKey(field) && candidate.takesValue && candidate.open.length === 0);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Repeat | undefined>(isRepeat(value) ? value : undefined);
  if (!writer) return null;
  if (!open) {
    return (
      <button type="button" data-graview-repeat-open={field} onClick={() => (setDraft(isRepeat(value) ? value : undefined), setOpen(true))} style={{ marginInlineStart: 8, fontSize: "0.75rem", padding: "1px 8px", borderRadius: 999, minHeight: 24 }}>
        {isRepeat(value) ? "Change how it repeats" : "Repeat…"}
      </button>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setOpen(false);
        // Not repeating any more is written as none (null): the date is its one day again.
        commit(writer, draft ?? null);
      }}
      style={{ display: "grid", gap: 6, marginTop: 6 }}
    >
      <RepeatPicker value={draft} onChange={setDraft} start={start} label={label} name={repeatKey(field)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" data-graview-repeat-keep={field}>
          Keep
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

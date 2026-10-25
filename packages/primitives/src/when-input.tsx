import { readPartialDay, readWhenTyped, storedOfWall, wallNow, wallOfStored, zoneSaid, type WallTime } from "@graview/core/words";
import { Suspense, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { WhenPicker } from "./when-picker-door.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

/*
 * A DAY OR A MOMENT, ASKED FOR AS PEOPLE SAY IT (Roadmap f-date-inputs).
 *
 * One editor for every date a person gives: a record's value changed in
 * place, a card's, an act's form on the pages and in the scene. A text box
 * takes what people say — "tomorrow 3pm", "Fri 10:30", "17 Oct" — and says
 * back, as it is typed, the day it read and the zone it is in, so nobody has
 * to learn `2026-10-17T15:00`. Beside it a button opens a month to pick from
 * by pointer or by keyboard (fetched the first time it is opened, never in
 * the first paint).
 *
 * What it hands on is the value as the field keeps it (`storedOfWall`): a
 * day, an instant in UTC for a field that keeps instants, a wall time for one
 * that does not — or nothing, while what is typed reads as no day, and then
 * the box says so and the form it is in will not send.
 */

export interface WhenInputProps {
  /** The value as the field keeps it: "2026-10-17", "2026-10-17T19:00:00Z", "2026-10-17T15:00". */
  readonly value: string | undefined;
  /** Whether the field holds a time of day as well as a day. */
  readonly time: boolean;
  /** Whether a time is kept as an instant (UTC, with its `Z`) rather than as the wall time written. */
  readonly instant?: boolean;
  /** Whether the field may know only a year or a month ("2006", "May 2016"), kept as `2006` or `2016-05` (Roadmap f-partial-dates). */
  readonly partial?: boolean;
  /** What the field is called, as a screen reader says the box. */
  readonly label: string;
  readonly name?: string;
  readonly required?: boolean;
  readonly autoFocus?: boolean;
  /** Take the keyboard as it is drawn, its words chosen whole, so what is typed ("Fri 10:30") replaces the day said: for a value opened to change in place. */
  readonly autoSelect?: boolean;
  /** The locale digits are read in (10/17 or 17/10) and the day is said in. */
  readonly locale?: string;
  /** What the field now holds, each time what is typed changes: undefined while it is empty or reads as no day. */
  readonly onChange: (stored: string | undefined) => void;
  /** The keyboard left the editor — the box, its button and its month — for somewhere else. */
  readonly onLeave?: (stored: string | undefined) => void;
  /** Escape in the box. */
  readonly onCancel?: () => void;
  readonly inputRef?: Ref<HTMLInputElement>;
  /** The box's own look, where the surface it sits in sets one. */
  readonly boxStyle?: CSSProperties;
}

const HINT = "try “tomorrow 3pm”, “Fri 10:30” or “17 Oct”";

/** A wall time in words, on no clock but its own: "Sat, Oct 17, 2026, 3:00 PM"; `long`, "Saturday, October 17, 2026 at 3:00 PM". */
export function wallAsRead(wall: WallTime, time: boolean, locale: string | undefined, long = false): string {
  const stamp = Date.UTC(+wall.day.slice(0, 4), +wall.day.slice(5, 7) - 1, +wall.day.slice(8, 10), 0, time ? (wall.minutes ?? 0) : 0);
  const options: Intl.DateTimeFormatOptions = {
    weekday: long ? "long" : "short",
    year: "numeric",
    month: long ? "long" : "short",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "UTC",
  };
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale ?? "en-US", options);
  } catch {
    format = new Intl.DateTimeFormat("en-US", options);
  }
  return format.format(stamp).replace(/ /g, " ");
}

/** A year or a month alone as `dayAsRead` says it: "2006", "May 2016" (Roadmap f-partial-dates). Said here, so the editor reaches nothing of `@graview/core`'s main entry. */
function partAsRead(part: string, locale: string | undefined): string {
  if (part.length === 4) return part;
  const stamp = Date.UTC(+part.slice(0, 4), +part.slice(5, 7) - 1, 1);
  try {
    return new Intl.DateTimeFormat(locale ?? "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(stamp);
  } catch {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(stamp);
  }
}

/** The editor itself: controlled by the value the field keeps. */
export function WhenInput({ value, time, instant = false, partial = false, label, name, required, autoFocus, autoSelect, locale, onChange, onLeave, onCancel, inputRef, boxStyle }: WhenInputProps): ReactNode {
  const id = useId();
  const box = useRef<HTMLInputElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  // A year or a month alone, where the field may know no more (Roadmap f-partial-dates): "2006", "May 2016".
  const partOf = (typed: string | undefined): string | undefined => (partial && !time && typed !== undefined ? readPartialDay(typed) : undefined);
  const said = (stored: string | undefined) => {
    const part = partOf(stored);
    if (part !== undefined) return partAsRead(part, locale);
    const wall = wallOfStored(stored);
    return wall ? wallAsRead(wall, time, locale) : (stored ?? "");
  };
  const [text, setText] = useState(() => said(value));
  const [open, setOpen] = useState(false);
  /*
   * What this editor last handed on, and the value it last saw: a value that
   * arrives otherwise (an end moved with its start, an undo) is said afresh;
   * the one it handed on itself leaves the words as they were typed.
   */
  const [handed, setHanded] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== handed) {
      setHanded(value);
      setText(said(value));
    }
  }

  useEffect(() => {
    if (!autoSelect) return;
    box.current?.focus();
    box.current?.select();
  }, [autoSelect]);

  const zone = time && instant ? zoneSaid(locale) : undefined;
  const untouched = text === said(value);
  const base = wallOfStored(value);
  const part = untouched ? partOf(value) : partOf(text);
  const reading = part !== undefined ? undefined : untouched ? base : readWhenTyped(text, { today: wallNow().day, time, ...(base ? { base } : {}), ...(locale ? { locale } : {}) });
  const stored = untouched ? value : part !== undefined ? part : reading ? storedOfWall(reading, { time, instant }) : undefined;
  const empty = text.trim() === "";
  const unread = !empty && reading === undefined && part === undefined;

  // A box that reads as no day says so to the form it is in, which will not send it.
  useEffect(() => {
    box.current?.setCustomValidity(unread ? `Not a date this reads — ${HINT}` : "");
  }, [unread]);

  const hand = (next: string | undefined) => {
    setHanded(next);
    onChange(next);
  };
  const type = (next: string) => {
    setText(next);
    const alone = partOf(next);
    if (alone !== undefined) return hand(alone);
    const wall = next.trim() === "" ? undefined : readWhenTyped(next, { today: wallNow().day, time, ...(base ? { base } : {}), ...(locale ? { locale } : {}) });
    hand(wall ? storedOfWall(wall, { time, instant }) : undefined);
  };
  const pick = (day: string) => {
    const wall: WallTime = time ? { day, minutes: reading?.minutes ?? base?.minutes ?? 9 * 60 } : { day };
    const next = storedOfWall(wall, { time, instant });
    setText(said(next));
    hand(next);
    setOpen(false);
    // Back to the box, all of it chosen, so a time typed next ("3pm") replaces the words and keeps the day.
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.select();
    });
  };

  const words = empty ? `Type a date, or pick one — ${HINT}` : unread ? `Not a date this reads — ${HINT}` : part !== undefined ? `${partAsRead(part, locale)} (${part.length === 4 ? "a year" : "a month"} alone)` : reading ?`${wallAsRead(reading, time, locale, true)}${zone ? ` ${zone.short}` : ""}` : "";
  const setRef = (element: HTMLInputElement | null) => {
    box.current = element;
    if (typeof inputRef === "function") inputRef(element);
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = element;
  };

  return (
    <span
      data-graview-when={time ? (instant ? "instant" : "moment") : "day"}
      style={{ display: "inline-flex", flex: "1 1 14rem", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", maxWidth: "100%", minWidth: 0 }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && event.currentTarget.contains(next)) return;
        // A blur with nowhere it went is the window losing focus; the editor waits for it to come back.
        if (!next && typeof document !== "undefined" && !document.hasFocus()) return;
        setOpen(false);
        onLeave?.(stored);
      }}
    >
      <input
        ref={setRef}
        type="text"
        name={name}
        required={required}
        autoFocus={autoFocus}
        aria-label={label}
        aria-describedby={`${id}-said`}
        aria-invalid={unread || undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={time ? "tomorrow 3pm" : "17 Oct"}
        value={text}
        data-graview-part="control"
        onChange={(event) => type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel?.();
          } else if (event.key === "ArrowDown" && event.altKey) {
            // Alt with the down arrow opens the month, as a native date box does.
            event.preventDefault();
            setOpen(true);
          }
        }}
        style={{ flex: "1 1 12ch", minWidth: "10ch", maxWidth: "100%", boxSizing: "border-box", font: "inherit", ...boxStyle }}
      />
      <button
        ref={opener}
        type="button"
        aria-label={`Pick a date for ${label}`}
        aria-expanded={open}
        aria-controls={`${id}-month`}
        data-graview-part="when-pick"
        onClick={() => setOpen((was) => !was)}
        onPointerEnter={() => WhenPicker.prefetch()}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 32, minHeight: 32, padding: 0, borderRadius: 6 }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      </button>
      <span
        id={`${id}-said`}
        aria-live="polite"
        data-graview-part="when-said"
        {...(zone ? { "data-graview-zone": zone.zone, title: `Times are in ${zone.zone.replace(/_/g, " ")} (${zone.short})` } : {})}
        style={{ flexBasis: "100%", fontSize: "0.75rem", color: unread ? "var(--graview-bad)" : "var(--graview-ink-faint)" }}
      >
        {words}
        {zone && !unread && !empty ? <span data-graview-part="when-zone">{` · ${(zone.zone.split("/").at(-1) ?? zone.zone).replace(/_/g, " ")} time`}</span> : null}
      </span>
      {open ? (
        <Suspense fallback={null}>
          <WhenPicker.Part
            id={`${id}-month`}
            label={label}
            selected={reading?.day ?? base?.day}
            today={wallNow().day}
            locale={locale}
            onPick={pick}
            onClose={() => {
              setOpen(false);
              opener.current?.focus();
            }}
          />
        </Suspense>
      ) : null}
    </span>
  );
}

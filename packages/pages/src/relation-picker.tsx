import { useEffect, useRef, useState } from "react";

/*
 * THE RECORDS A RELATION'S ROW MAY TIE, opened from a chip (Roadmap
 * f-facts-by-type), named by the sheet that opens it.
 *
 * Drawn in place, under the row — it pushes what is below it down rather
 * than covering it — with a search where there are more than a handful.
 * Escape, or picking one, puts it away; the keyboard goes back to the press
 * that opened it.
 */

/** One record the picker may name: its name, and what tells it from another of the same name. */
export interface PickerRecord {
  readonly id: string;
  readonly label: string;
  readonly apart?: string | undefined;
}

export interface RelationPickerProps {
  /** What the picker is for, in the act's words: "Move it to another list". */
  readonly label: string;
  /**
   * The records it may name, as the derivation narrowed them, less those
   * already tied, by name — named by the sheet, so this chunk carries
   * nothing of the framework's own and splits nothing a page loads first.
   */
  readonly offered: readonly PickerRecord[];
  readonly onPick: (id: string) => void;
  readonly onClose: () => void;
}

/** Past this many, a search box stands over the list. */
const SEARCH_PAST = 7;
/** At most this many are listed at once; the search narrows the rest. */
const LISTED = 40;

export default function RelationPicker({ label, offered, onPick, onClose }: RelationPickerProps) {
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const searching = offered.length > SEARCH_PAST;
  const words = query.trim().toLowerCase();
  const matching = words === "" ? offered : offered.filter((one) => `${one.label} ${one.apart ?? ""}`.toLowerCase().includes(words));
  const listed = matching.slice(0, LISTED);

  useEffect(() => {
    // The keyboard comes in with it: to the search, else to the first record.
    (search.current ?? box.current?.querySelector<HTMLElement>("button[data-graview-candidate]"))?.focus();
  }, []);

  const move = (from: HTMLElement, by: number) => {
    const items = [...(box.current?.querySelectorAll<HTMLElement>("input, button[data-graview-candidate]") ?? [])];
    const at = items.indexOf(from);
    items[Math.max(0, Math.min(items.length - 1, at + by))]?.focus();
  };

  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      data-graview-relation-picker=""
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          move(event.target as HTMLElement, event.key === "ArrowDown" ? 1 : -1);
        }
      }}
      onBlur={(event) => {
        // Leaving it, not moving within it, puts it away.
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) onClose();
      }}
      style={{ display: "grid", gap: 6, marginTop: 8, padding: "8px 0", maxWidth: 420, minWidth: 0 }}
    >
      {searching ? (
        <input
          ref={search}
          type="search"
          aria-label={`${label}: find one`}
          placeholder="Find one…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && listed[0]) {
              event.preventDefault();
              onPick(listed[0].id);
            }
          }}
          style={{ font: "inherit", fontSize: "inherit", minHeight: 32, padding: "0 10px", borderRadius: "var(--graview-radius-sm, 8px)", border: "1px solid var(--graview-edge-bright)", background: "var(--graview-ground)", color: "var(--graview-ink)", minWidth: 0 }}
        />
      ) : null}
      {listed.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", maxHeight: 280, overflowY: "auto" }}>
          {listed.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                data-graview-candidate={one.id}
                onClick={() => onPick(one.id)}
                style={{ all: "unset", cursor: "pointer", boxSizing: "border-box", display: "flex", gap: 8, alignItems: "baseline", width: "100%", minHeight: 32, padding: "4px 8px", borderRadius: "var(--graview-radius-sm, 8px)", color: "var(--graview-ink)", overflowWrap: "anywhere" }}
                className="graview-candidate"
              >
                {one.label}
                {one.apart ? <span style={{ color: "var(--graview-ink-muted)", fontSize: "0.875em" }}>{one.apart}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, color: "var(--graview-ink-muted)" }}>{offered.length === 0 ? "Nothing else to choose." : "Nothing matches."}</p>
      )}
      {matching.length > listed.length ? (
        <p style={{ margin: 0, color: "var(--graview-ink-muted)", fontSize: "0.875em" }}>
          {matching.length - listed.length} more — type to narrow them.
        </p>
      ) : null}
      <style>{`.graview-candidate:hover,.graview-candidate:focus-visible{background:var(--graview-panel)}.graview-candidate:focus-visible{outline:2px solid var(--graview-accent);outline-offset:-2px}`}</style>
    </div>
  );
}

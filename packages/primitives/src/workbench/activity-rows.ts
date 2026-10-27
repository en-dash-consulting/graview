/*
 * HOW A ROW OF ACTIVITY IS DRAWN, NEVER SIDEWAYS (FR-226, Roadmap
 * f-activity-panel-no-sideways-scroll): a row is one column that may
 * shrink, its header wraps, its sentence breaks anywhere — a record named
 * in 120 characters with no space ran the sentence past the panel's edge
 * and put the row's "as it was" and undo past it, reached only by
 * scrolling sideways — and its chips wrap. Shared by every row the panel
 * draws (`activity.tsx`) and by the AI's rows (`ai-entries.tsx`), which
 * are fetched later.
 */
export const ACTIVITY_ROW = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 3, lineHeight: 1.45, minWidth: 0 } as const;
export const ACTIVITY_HEAD = { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6, minWidth: 0 } as const;
/** The sentence of a row: it takes the line and breaks anywhere, so the buttons beside it stay beside it. */
export const ACTIVITY_WORDS = { flex: "1 1 0%", minWidth: 0, overflowWrap: "anywhere" } as const;
export const ACTIVITY_CHIPS = { display: "flex", flexWrap: "wrap", gap: 4, minWidth: 0 } as const;

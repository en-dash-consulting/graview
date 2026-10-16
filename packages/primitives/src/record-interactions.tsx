import type { AiInteraction } from "@graview/core/catalog";
import type { CSSProperties } from "react";
import { UndoTurn } from "./workbench/activity.js";
import { InteractionRow } from "./workbench/ai-entries.js";
import "./frame.js"; // A door: tied to what the page drew first (TIED DOORS, packages/primitives/src/frame.ts).

export interface RecordInteractionsProps {
  readonly entries: readonly AiInteraction[];
  /** The section's own look and its heading's, where the page has them. */
  readonly style?: CSSProperties;
  readonly headingStyle?: CSSProperties;
  readonly className?: string;
}

/** The AI's entries about one record, as Activity draws them — fetched with the first (`record-interactions-door.tsx`). */
export function RecordInteractions({ entries, style, headingStyle, className }: RecordInteractionsProps) {
  return (
    <section {...(className ? { className } : {})} data-testid="record-ai" aria-label="What AI did here" style={{ display: "grid", gap: 10, ...style }}>
      <h2 style={headingStyle ?? { margin: 0, fontSize: "1rem" }}>What AI did here</h2>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8, fontSize: "0.875rem" }}>
        {entries.slice(0, 8).map((entry) => (
          <InteractionRow key={entry.id} entry={entry} undo={(batch) => <UndoTurn batch={batch} />} />
        ))}
      </ol>
    </section>
  );
}

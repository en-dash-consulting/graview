import type { AnySchema, Suggestion } from "@graview/core";
import { acceptSuggestion } from "@graview/core/tidying";
import { useGraview } from "@graview/react/provider";
import { useState } from "react";

/** A line that breaks anywhere rather than widen the tray. */
const WRAPS = { minWidth: 0, overflowWrap: "anywhere" } as const;

/**
 * THE CHANGES OF A SUGGESTION OF SEVERAL (Roadmap f-job-approvals): a
 * workflow's run asked about as one — "Fill out next week's events: 28
 * events to add, 3 to change" — opened to each change, in its act's own
 * sentence, with its own Accept: the row's Accept takes every change still
 * waiting and its Decline the rest. Drawn for whoever may decide; a voter
 * votes on the whole.
 */
export function SuggestionItems({ suggestion, decides, heard }: { readonly suggestion: Suggestion; readonly decides: boolean; readonly heard: (word: string) => void }) {
  const { store, principal } = useGraview<AnySchema>();
  const [refused, setRefused] = useState<string | null>(null);
  const items = suggestion.items;
  if (items.length < 2) return null;
  const take = (at: number, index: number) => {
    setRefused(null);
    try {
      acceptSuggestion(store, suggestion.id, { author: principal, items: [at] });
      heard("Accepted that change; the rest still wait.");
      // The keyboard stays on the list: the next change's Accept, else the row's own.
      requestAnimationFrame(() => {
        const row = document.querySelector(`[data-suggestion="${CSS.escape(suggestion.id)}"]`);
        const next = row?.querySelectorAll<HTMLElement>('[data-testid="suggestion-item-accept"]')[index] ?? row?.querySelectorAll<HTMLElement>('[data-testid="suggestion-item-accept"]')[index - 1];
        (next ?? row?.querySelector<HTMLElement>('[data-testid="suggestion-accept"]'))?.focus();
      });
    } catch (error) {
      setRefused(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <details data-testid="suggestion-items" style={{ minWidth: 0 }}>
      <summary style={{ cursor: "pointer", fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>{`Show the ${items.length} changes`}</summary>
      <ol style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4, minWidth: 0 }}>
        {items.map((item, index) => (
          <li key={item.at} data-testid="suggestion-item" data-item={item.at} style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, fontSize: "0.75rem" }}>
            <span style={{ ...WRAPS, flex: "1 1 auto" }}>{item.intent}</span>
            {decides ? (
              <button type="button" data-testid="suggestion-item-accept" aria-label={`Accept: ${item.intent}`} onClick={() => take(item.at, index)} style={{ minHeight: 24, padding: "1px 8px", fontSize: "0.75rem", flex: "0 0 auto" }}>
                Accept
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {refused ? (
        <span data-testid="suggestion-item-refused" role="alert" style={{ ...WRAPS, display: "block", fontSize: "0.75rem", color: "var(--graview-warn)" }}>
          {refused}
        </span>
      ) : null}
    </details>
  );
}

import type { HostAi } from "@graview/tools";
import { useEffect, useRef, useState } from "react";

/**
 * THE FAST SLOT RANKS WHAT IS TYPED IN THE MENU (Roadmap f-menu-type-anything).
 *
 * The plain word-start match (`menuMatches`) answers on the first key with
 * no wait. Where the host gave a Fast slot (Jev, or its `decide`), a pause
 * in the typing asks it one Choice — which of the menu's rows the words
 * mean — and its answer refines the list: a row it finds likely is shown
 * though no word of it begins with what was typed ("complete" finds
 * "Finish it"), and its best is the row lit. Debounced, never in the way of
 * a key: the words changed, the answer on its way is dropped and nothing
 * is asked until the typing rests again. No Fast slot, no ask: the local
 * match alone.
 */

/** One row the menu could show, by its key (`act:<id>`, `item:<id>`) and its words. */
export interface MenuRankRow {
  readonly key: string;
  readonly label: string;
}

/** How long the typing rests before the Fast slot is asked, and how likely a row must be to be shown for it. */
export const MENU_RANK_REST_MS = 250;
export const MENU_RANK_FLOOR = 0.2;

/** The Fast slot the host gave, or its `decide`, where AI is not off. */
const fastSlot = (ai: HostAi | undefined) => (ai === undefined || ai.off ? undefined : (ai.fast ?? (ai.decide ? { model: ai.name ?? "decide", decide: ai.decide } : undefined)));

/** The Fast slot's chance for each row the words could mean, once it has answered for these words; null before, and with no Fast slot. */
export function useFastRank(ai: HostAi | undefined, words: string, rows: readonly MenuRankRow[]): ReadonlyMap<string, number> | null {
  const [ranked, setRanked] = useState<{ readonly words: string; readonly chances: ReadonlyMap<string, number> } | null>(null);
  const held = useRef(rows);
  held.current = rows;
  const rowsSaid = rows.map((row) => `${row.key}\u0000${row.label}`).join("\u0001");
  const fast = fastSlot(ai);
  useEffect(() => {
    const asked = words.trim();
    if (!fast || asked === "" || held.current.length === 0) return;
    let live = true;
    const keyed = new Map(held.current.map((row, at) => [`r${at + 1}`, row]));
    const timer = setTimeout(() => {
      void fast
        // Jev's own Choice, with "none of these": words that mean no row light none.
        .decide({ typed: asked }, { row: { type: "choice", instructions: `Which of these menu rows does somebody typing “${asked}” mean?`, criteria: { ...Object.fromEntries([...keyed].map(([key, row]) => [key, row.label])), none: "None of these rows" } } })
        .then((decided) => {
          ai?.meter?.({ tier: "fast", model: fast.model, inputTokens: decided.usage.inputTokens, outputTokens: decided.usage.outputTokens, interaction: "menu" });
          const answer = decided.answers["row"];
          if (!live || answer?.type !== "choice") return;
          const chances = new Map<string, number>();
          for (const [key, chance] of Object.entries(answer.probabilities)) {
            const row = keyed.get(key);
            if (row) chances.set(row.key, chance);
          }
          // "None of these": the local match stands alone.
          if (answer.choice === "none") return setRanked({ words: asked, chances: new Map() });
          const chosen = keyed.get(answer.choice);
          if (chosen && !chances.has(chosen.key)) chances.set(chosen.key, answer.confidence);
          setRanked({ words: asked, chances });
        })
        // A Fast slot that fails leaves the local match, which already answered.
        .catch(() => undefined);
    }, MENU_RANK_REST_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // Asked again when the words or the rows change; the slot itself is the host's, fixed for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, rowsSaid, fast === undefined]);
  // An answer for other words than these is never shown.
  return ranked !== null && ranked.words === words.trim() ? ranked.chances : null;
}

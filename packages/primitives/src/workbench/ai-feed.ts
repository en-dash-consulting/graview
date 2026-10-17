import type { AiInteraction } from "@graview/core/catalog";
import { useAiDeskState, useGraview } from "@graview/react/provider";
import { useEffect } from "react";

/**
 * THE AI'S ENTRIES IN ACTIVITY, AS THE FEED READS THEM (Roadmap
 * f-activity-ai-entries): which the desk holds, asked of the host once. The
 * rows that draw them (`ai-entries.tsx`) are fetched with the first one, so
 * a face whose reader never asked the AI carries none of them.
 */

/** Which of the feed is shown: everything, the changes, or the AI's entries. */
export type ActivityShows = "all" | "changes" | "ai";

/** The interactions this app's desk holds — the page's and the host's, asked for once — or none when AI is off. */
export function useInteractions(): readonly AiInteraction[] {
  const { ai, aiDesk } = useGraview();
  const { entries } = useAiDeskState(aiDesk);
  const off = ai.off === true;
  useEffect(() => {
    if (!off) aiDesk.load();
  }, [aiDesk, off]);
  return off ? [] : entries;
}


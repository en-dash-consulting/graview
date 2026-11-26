import type { ToolCall } from "@graview/tools";
import { useCallback, useState } from "react";

/*
 * WHAT A SEAT DID, AS ACTIVITY SAYS IT: the Scene's bar and the one face's
 * both hand the app's seat this log's `onCall`, and their inbox the calls.
 * Its own file, so the routed face reaches it without the workbench.
 */

/** The calls a seat made, newest first, a settling call replacing its own "running" line: the record Activity shows. */
export function useCallLog(): readonly [readonly ToolCall[], (call: ToolCall) => void] {
  const [calls, setCalls] = useState<readonly ToolCall[]>([]);
  const onCall = useCallback((call: ToolCall) => {
    setCalls((current) => {
      // A call that settles replaces its own "running" entry rather than
      // stacking on it, so the rail shows twelve turns, not twelve halves.
      const settling = call.phase !== "running" && current[0]?.name === call.name && current[0]?.at === call.at;
      return [call, ...(settling ? current.slice(1) : current)].slice(0, 12);
    });
  }, []);
  return [calls, onCall] as const;
}

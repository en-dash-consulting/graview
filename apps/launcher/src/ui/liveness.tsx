import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { addressOf, APPS } from "../domain/survey.js";

/**
 * Which apps are actually serving on this machine, right now.
 *
 * Deliberately NOT in the graph. The graph holds what you have decided — what
 * to show, what to retire, why something is worth keeping — and every one of
 * those belongs in the op log because every one of them is a choice somebody
 * made and might want back. Whether a dev server happens to be up is not a
 * choice, it is an observation about the world, and putting it through
 * mutations would fill the log with "port 5192 answered" every four seconds
 * and let undo pretend a server had come back.
 *
 * So: the graph for what was decided, this for what is true outside.
 */
const LivenessContext = createContext<Readonly<Record<string, boolean>>>({});

export function useLiveness(): Readonly<Record<string, boolean>> {
  return useContext(LivenessContext);
}

async function reachable(entry: { readonly port: number }, signal: AbortSignal): Promise<boolean> {
  try {
    // `no-cors` gives an opaque response we cannot read, which is fine — the
    // question is only whether anything answered.
    await fetch(`${addressOf(entry)}/`, { mode: "no-cors", signal });
    return true;
  } catch {
    return false;
  }
}

export function LivenessProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<Readonly<Record<string, boolean>>>({});

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const sweep = async () => {
      const results = await Promise.all(
        APPS.map(async (entry) => [entry.id, await reachable(entry, controller.signal)] as const),
      );
      if (!cancelled) setLive(Object.fromEntries(results));
    };
    void sweep();
    const timer = setInterval(() => void sweep(), 4000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return <LivenessContext.Provider value={live}>{children}</LivenessContext.Provider>;
}

import { LOCAL_BRIDGE_PATH, type LocalBridgeAnswer, type LocalBridgeStatus } from "@graview/core";
import { useCallback, useEffect, useState } from "react";

/**
 * IS THERE A MACHINE BEHIND THIS PAGE, AND WILL IT ANSWER?
 *
 * The local door is open only while somebody is running the app from a
 * terminal: `localIntelligence()` from `@graview/ship/dev` is a dev-server
 * plugin, so a built deployment has nothing serving the path at all. Every
 * way that can go wrong has to read as CLOSED rather than as broken —
 *
 *  - a 404, because the page is on a static host and no plugin exists;
 *  - an HTML answer, because a dev server with history fallback hands the
 *    index page to an unknown path and `JSON.parse` would throw on it;
 *  - a network failure, because nothing is listening at all.
 *
 * Closed is not an error. A door that is not there is the normal state of
 * every deployed copy of the app, and an interface that says "failed" there
 * is telling a person to fix something that is working.
 */
export type LocalIntelligence =
  | { readonly state: "probing" }
  | { readonly state: "open"; readonly version: string; readonly ask: Ask }
  | { readonly state: "closed"; readonly reason: string };

/** Words and photographs (base64 data URLs) in, what it said out. */
export type Ask = (prompt: string, photos?: readonly string[]) => Promise<string>;

/** A JSON body, or nothing at all when the answer was not JSON. */
async function json(response: Response): Promise<unknown | undefined> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) return undefined;
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

export function useLocalIntelligence(path: string = LOCAL_BRIDGE_PATH): LocalIntelligence {
  const [status, setStatus] = useState<LocalBridgeStatus | null>(null);

  useEffect(() => {
    let live = true;
    const closed = (reason: string) => {
      if (live) setStatus({ available: false, reason });
    };
    void (async () => {
      try {
        const response = await fetch(path, { method: "GET", headers: { accept: "application/json" } });
        if (!response.ok) {
          closed("Nothing is serving the local door here.");
          return;
        }
        const body = await json(response);
        if (body === undefined) {
          /* An HTML index page: the dev server's history fallback, not a door. */
          closed("Nothing is serving the local door here.");
          return;
        }
        if (live) setStatus(body as LocalBridgeStatus);
      } catch {
        closed("Nothing is serving the local door here.");
      }
    })();
    return () => {
      live = false;
    };
  }, [path]);

  const ask = useCallback<Ask>(
    async (prompt, photos = []) => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, photos }),
      });
      const body = (await json(response)) as LocalBridgeAnswer | undefined;
      if (body === undefined) throw new Error("The local door answered with something that was not JSON.");
      if ("error" in body) throw new Error(body.error);
      return body.text;
    },
    [path],
  );

  if (status === null) return { state: "probing" };
  return status.available
    ? { state: "open", version: status.version, ask }
    : { state: "closed", reason: status.reason };
}

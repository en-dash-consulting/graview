import { STUDIO_DOOR_PATH, type AnySchema, type StudioDoorAnswer, type StudioDoorStatus } from "@graview/core";
import { useEffect, useState } from "react";
import type { Studio } from "./studio.js";

/**
 * APPLY, INTO THE CHECKOUT — when there is a checkout to write into.
 *
 * A running `pnpm dev` with the studio door has one; a deployed app does
 * not, and the studio says so and hands over the files instead. What is
 * sent is the CHANGE the person made, never files: the dev server makes it
 * inside the checkout's own declarations, so what was written by hand is
 * still there afterwards.
 */

/** Whether this app's dev server has the studio door open. `null` until it has answered, and for no door at all. */
export function useStudioDoor(path: string = STUDIO_DOOR_PATH): Extract<StudioDoorStatus, { available: true }> | null {
  const [door, setDoor] = useState<Extract<StudioDoorStatus, { available: true }> | null>(null);
  useEffect(() => {
    if (typeof fetch !== "function") return;
    let live = true;
    fetch(path)
      .then(async (response) => (response.ok ? ((await response.json()) as StudioDoorStatus) : null))
      .then((status) => {
        if (live && status?.available) setDoor(status);
      })
      // A static host 404s or answers HTML: no door, and nothing to say about it.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path]);
  return door;
}

export type InPlace =
  | { readonly state: "written"; readonly paths: readonly string[] }
  | { readonly state: "not-written"; readonly reasons: readonly string[] };

/**
 * The change, made in the checkout — or every reason it was not. A stored
 * graph that needs a migration is one of the reasons until the studio can
 * write the migration beside the change: a declaration that moved on over a
 * graph that did not is an app that fails to open.
 */
export async function writeInPlace(studio: Studio<AnySchema>, migration: string | null, path: string = STUDIO_DOOR_PATH): Promise<InPlace> {
  const { changes, unwritten } = studio.sourceChanges();
  const reasons = [
    ...unwritten,
    ...(migration ? [`A stored graph needs a migration (${migration}) — the studio cannot yet write it into the checkout.`] : []),
  ];
  if (reasons.length > 0) return { state: "not-written", reasons };
  if (changes.length === 0) return { state: "not-written", reasons: ["Nothing has changed since the studio opened."] };
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const answer = (await response.json()) as StudioDoorAnswer;
    if ("written" in answer) return { state: "written", paths: answer.written };
    if ("refused" in answer) return { state: "not-written", reasons: answer.refused };
    return { state: "not-written", reasons: [answer.error] };
  } catch (error) {
    return { state: "not-written", reasons: [`The dev server did not answer: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

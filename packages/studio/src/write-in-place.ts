import {
  STUDIO_DOOR_PATH,
  type DeclarationChange,
  type StudioDoorAnswer,
  type StudioDoorDiagnostic,
  type StudioDoorSource,
  type StudioDoorStatus,
} from "@graview/core";
import { useEffect, useState } from "react";

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

/** The checkout's own acts and rules, as they are written. */
export async function readCode(path: string = STUDIO_DOOR_PATH): Promise<StudioDoorSource> {
  const response = await fetch(`${path}/source`);
  if (!response.ok) throw new Error(`The studio door answered ${response.status}.`);
  return (await response.json()) as StudioDoorSource;
}

export type InPlace =
  | { readonly state: "written"; readonly paths: readonly string[] }
  | { readonly state: "not-written"; readonly reasons: readonly string[]; readonly diagnostics?: readonly StudioDoorDiagnostic[] };

/** The changes, made in the checkout — or every reason, in the door's and the compiler's words, that they were not. */
export async function writeChanges(changes: readonly DeclarationChange[], path: string = STUDIO_DOOR_PATH): Promise<InPlace> {
  if (changes.length === 0) return { state: "not-written", reasons: ["Nothing has changed since the studio opened."] };
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const answer = (await response.json()) as StudioDoorAnswer;
    if ("written" in answer) return { state: "written", paths: answer.written };
    if ("refused" in answer) return { state: "not-written", reasons: answer.refused, ...(answer.diagnostics ? { diagnostics: answer.diagnostics } : {}) };
    return { state: "not-written", reasons: [answer.error] };
  } catch (error) {
    return { state: "not-written", reasons: [`The dev server did not answer: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

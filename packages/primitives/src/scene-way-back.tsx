import type { AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { useGraview } from "@graview/react/provider";
import { useContext, useEffect, useRef } from "react";
import { NoticeBoardContext } from "./notices.js";

const door = retryingImport(() => import("./scene-way-back-door.js"));

/**
 * THE SCENE'S WAY BACK (FR-153): what the routed face offers after an act,
 * on the scene — the act's own words on the app's board of notices, with
 * Take back, for `WAY_BACK_MS`; and ⌘Z or Ctrl+Z, heard while the keyboard
 * is in the app (anywhere, on the whole-page Shell). Down in a district a
 * person who moved the wrong record had no way back in reach but opening
 * Activity and finding the turn.
 *
 * What judges and says it is behind a door, fetched once the scene has
 * drawn: nothing in it is needed to draw, and the scene's first load keeps
 * to its budget. What the log held when the scene was drawn is told to it,
 * so an act made before it arrives is still offered back.
 */
export function SceneWayBack() {
  const { store, principal } = useGraview<AnySchema>();
  const board = useContext(NoticeBoardContext);
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const seen = store.batches().length;
    const going = door().then((module) => module.sceneWay(store, principal, board, seen, mark.current), () => undefined);
    // Gone before it arrived, it stops as it starts.
    return () => void going.then((stop) => stop?.());
  }, [store, principal, board]);
  return <span ref={mark} hidden />;
}

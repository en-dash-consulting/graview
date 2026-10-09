import { layer, type AnySchema } from "@graview/core";
import type { ToolCall } from "@graview/tools";
import { useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BarFind } from "./app-bar.js";
import { FindBox } from "./find.js";
import { ActivityRail } from "./workbench/activity.js";
import { FollowingLine } from "./workbench/following.js";
import { Trail } from "./workbench/trail.js";

/*
 * WHAT THE SCENE PUTS IN THE ONE BAR, AND WHAT IT KEEPS ON ITS PICTURE.
 *
 * The whole-page Shell drew a bar of its own on the scene — a wordmark, the
 * browser's back and forward drawn again, "Lists", the trail, the places as
 * tabs, Find, the standing, Activity and the person — while an embed and the
 * routed face wore the one `AppBar`. The same app looked like two apps, and
 * on a phone the Shell's bar wrapped to three rows. Both scene faces now
 * wear the `AppBar` and hand it the same two things from here: the scene's
 * Find, in the bar's place for it, and the scene's Activity, in the bar's
 * place for the face's own tool (`BarFind.own`).
 *
 * The rest of what the Shell's bar said was about the picture, not the app:
 * the record in focus, "the past", "zoomed in", "moved", a raised relation,
 * whose stop you are following — each with its ×. Those are on the picture
 * now (`SceneTrail`), in its top corner opposite Up, the way a map carries
 * its own state; the browser keeps its own back and forward.
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

/**
 * THE SCENE'S PART OF THE BAR: its Find in the bar's place for Find, and its
 * Activity in the bar's place for the face's own tool. Nothing until the bar
 * has said where (`BarFind`).
 */
export function SceneBarTools<S extends AnySchema>({
  find,
  calls,
  seat,
  remembers = false,
}: {
  readonly find: BarFind | null;
  readonly calls: readonly ToolCall[];
  /** The seat the app gives an agent, which Activity holds. */
  readonly seat?: ReactNode;
  /** Whether this browser remembers the edits; Activity says so, with the way back. */
  readonly remembers?: boolean;
}) {
  if (!find) return null;
  return (
    <>
      {createPortal(<FindBox<S> compact={find.compact} />, find.slot)}
      {find.own ? createPortal(<ActivityRail calls={calls} remembers={remembers} {...(seat !== undefined ? { seat } : {})} />, find.own) : null}
    </>
  );
}

/**
 * WHAT THE PICTURE IS DOING, ON THE PICTURE: the record in focus, the past,
 * zoomed in, what a hand moved, a raised relation and whose stop you follow,
 * each a word with its × — in the picture's top corner, opposite Up. Nothing
 * at all while the picture is as it opened.
 */
export function SceneTrail({ home = null }: { readonly home?: string | null }) {
  return (
    <div
      data-graview-scene-trail=""
      style={{
        position: "absolute",
        top: 14,
        left: 14,
        // Up, at the other corner, keeps its room.
        maxWidth: "calc(100% - 150px)",
        zIndex: layer("overview"),
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        pointerEvents: "none",
      }}
    >
      <Trail home={home} onPicture />
      <span style={{ pointerEvents: "auto" }}>
        <FollowingLine />
      </span>
    </div>
  );
}

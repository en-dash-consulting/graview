import type { AnySchema, Author } from "@graview/core";
import { useEffect } from "react";
import type { ActivityMark, ToolCallLike } from "./activity.js";
import { useGraview } from "./context.js";

/*
 * What a drawn picture or a seat reads of the activity the provider keeps:
 * a file of its own, so the frame that keeps it carries neither hook.
 */

/**
 * What has just happened, per node, for a few seconds.
 *
 * The overview is the place to WATCH the system work — an edit landing, a
 * rule starting to fail, an agent reading its way to a decision — and all of
 * it is already in the op log. This turns the log into something a picture
 * can read.
 *
 * The state lives in the provider rather than here for the same reason
 * selection does: the scene, the chrome and an agent seat must all be
 * looking at the same activity, or the picture and the list disagree about
 * what just happened.
 *
 * It costs nothing on a quiet graph. There is no animation loop and no
 * polling: a subscription that never fires schedules no timer, and the marks
 * are cleared by a single timeout rather than by a frame callback checking
 * whether they have expired.
 */
export function useActivity<S extends AnySchema>(): ReadonlyMap<string, ActivityMark> {
  return useGraview<S>().activity;
}

/**
 * Pipes an agent seat's read-only tool calls into the picture.
 *
 * What an agent READ is the half a diff cannot show, and the half that says
 * whether to trust what it then did. The runtime already announces every
 * call with the nodes it looked at; this is the wire.
 */
export function useAttention(runtime: {
  readonly author?: Author;
  onCall(listener: (call: ToolCallLike) => void): () => void;
}): void {
  const { noteAttention, noteSeat } = useGraview();
  useEffect(
    () =>
      runtime.onCall((call) => {
        const author = runtime.author ?? { kind: "agent" as const };
        /*
         * WHAT A CALL SAYS reaches the body: a run's stop reason, a loop's
         * sentence — announced as a `stop` call carrying `said` — is said
         * from the robot, not only written to the rail.
         */
        const said = call.args?.["said"];
        if (call.phase === "ok" && typeof said === "string" && said.length > 0) {
          noteSeat({ type: "said", author, say: said });
        }
        if (call.phase !== "ok" || !call.reads || call.reads.length === 0) return;
        noteAttention({
          reads: call.reads,
          // The seat's OWN author, not a generic agent: attributing a read to
          // a different participant than the writes makes one agent looking
          // and then moving read as two people editing at once.
          author,
          intent: `read ${call.name}`,
        });
      }),
    [runtime, noteAttention, noteSeat],
  );
}

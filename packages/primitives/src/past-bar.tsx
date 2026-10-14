import { retryingImport } from "@graview/core/retry";
import { lazyModule, usePlayback } from "@graview/react/provider";
import { Suspense } from "react";

/*
 * THE TIMELINE'S DOOR (Roadmap f-playback). Nothing of playback is in a
 * page's first load: the timeline — its ticks, its player, the sentences
 * it reads from `@graview/core/history` — is fetched when somebody first
 * asks to see the app as it was, and drawn on whichever face they are on.
 */
const TIMELINE = /* @__PURE__ */ lazyModule(retryingImport(() => import("./timeline.js")));

/** Which face the timeline is drawn on: over the scene's picture, or at the head of the routed face's page. */
export type TimelineFace = "scene" | "pages";

const Timeline = TIMELINE.part((module: typeof import("./timeline.js"), props: { readonly face: TimelineFace }) => <module.Timeline {...props} />, { what: "The timeline" });

/** Fetch the timeline before it is asked for: a pointer over "Show the app as it was here". */
export const prefetchTimeline = (): void => TIMELINE.prefetch();

/**
 * THE APP AS IT WAS, AND THE WAY THROUGH IT: drawn while the timeline is
 * open — an "as of" banner, a scrubber with a tick per change, play and
 * its speed, the way back to now — and nothing otherwise.
 */
export function PastBar({ face }: { readonly face: TimelineFace }) {
  const playback = usePlayback();
  if (!playback?.open) return null;
  return (
    <Suspense fallback={null}>
      <Timeline face={face} />
    </Suspense>
  );
}

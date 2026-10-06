import { aggregateId, kindOfCard, type ViewState } from "@graview/layout/view";

/* Its own module, so the frame of every face reaches it without the scene's way back (FR-104). */

/**
 * Where "Focus" lands from altitude when nothing is focused.
 *
 * An app that opens from the city has no in-stack default, and the provider
 * lands a focusless descent back on the overview — which made the control a
 * button that did nothing, in every such app. Descending has to go
 * SOMEWHERE: into the district that is selected, or the first one declared.
 */
/**
 * WHERE "FOCUS" LANDS FROM ALTITUDE: the drive-in that is focused, else the
 * selected kind's, else the first kind that has a drive-in — a kind with a
 * picture of its own is a better place to walk up to than the first kind
 * in the declaration — else the first kind at all.
 */
export function descentTarget(view: ViewState, kinds: readonly string[], driveIns: readonly string[] = []): string | null {
  if (view.focusId) return view.focusId;
  const selected = (view.selection ?? []).map(kindOfCard).find((kind) => kind !== null);
  const kind = selected ?? driveIns.find((one) => kinds.includes(one)) ?? kinds[0] ?? null;
  return kind === null ? null : aggregateId(kind);
}

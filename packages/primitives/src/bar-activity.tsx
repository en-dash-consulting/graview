import type { AnySchema } from "@graview/core";
import { useAiDeskState, useGraph, useGraview } from "@graview/react/provider";
import { useMemo } from "react";
import { barPanes } from "./bar-panes-door.js";
import type { InboxProps } from "./inbox.js";
import { useNotifiedCount } from "./notify-door.js";

/**
 * THE INBOX, ON A BAR THAT IS NOT THE SCENE'S (FR-152, Roadmap
 * f-app-bar-calm): the routed face's. The scene draws its inbox in the
 * bar's place for the face's own tool; on Pages it is fetched with the
 * bar's panes once there is anything to put in it — a change, a
 * suggestion, the host's notifications, what was done while the reader was
 * away, an ask — so a face that draws it before anything has happened
 * carries none of it.
 */
const InboxPart = barPanes.part((panes, props: InboxProps) => <panes.Inbox {...props} />, { quiet: true });

/** Whether the inbox has anything to hold yet, read without fetching it. */
export function useInboxWanted(batches: number): boolean {
  const { store, whileAway, notifications, aiDesk } = useGraview<AnySchema>();
  const nodes = useGraph();
  const notified = useNotifiedCount();
  const { entries } = useAiDeskState(aiDesk);
  const suggests = useMemo(() => store.log.all().some((op) => op.suggests !== undefined && !op.withheld), [store, nodes]);
  return batches > 0 || notified > 0 || suggests || (whileAway?.tidied ?? 0) > 0 || (notifications?.length ?? 0) > 0 || entries.length > 0;
}

/** The inbox, fetched with the bar's panes. */
export function BarInbox(props: InboxProps) {
  return <InboxPart {...props} />;
}

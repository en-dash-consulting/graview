import type { AnySchema, Store } from "@graview/core";
import { BarInbox, useCallLog, useInboxWanted } from "@graview/primitives/pages";
import { useGraviewIfAny, usePlayback } from "@graview/react/provider";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { PageContext } from "./page-context.js";
import { useStoreTick } from "./page-context.js";

/**
 * ONE INBOX, ON THE ROUTED FACE'S BAR (FR-152, Roadmap f-app-bar-calm), as
 * the scene has it: what waits for you, what has happened — each change
 * with its own way back, after the notice that offered the last one has
 * gone — and what you asked. In the bar's place for the face's own tool
 * where a bar above the face keeps one (`own`), else where it is drawn: the
 * derived shell's own bar. Fetched once there is anything to put in it, so
 * a face nobody has changed carries none of it; drawn from the provider,
 * so a face handed no views has none.
 */
export function PagesInbox<S extends AnySchema>({ context, own }: { readonly context: PageContext<S>; readonly own?: HTMLElement }) {
  useStoreTick(context.store);
  const here = useGraviewIfAny();
  if (!here) return null;
  return <Wanted context={context} {...(own ? { own } : {})} />;
}

function Wanted<S extends AnySchema>({ context, own }: { readonly context: PageContext<S>; readonly own?: HTMLElement }) {
  // What has happened is now's, whichever moment the face draws (Roadmap f-playback).
  const live = (usePlayback()?.live ?? context.store) as unknown as Store<AnySchema>;
  useStoreTick(live as Store<AnySchema>);
  const wanted = useInboxWanted(live.batches().length);
  /*
   * THE APP'S SEAT, IN ACTIVITY (Graview HQ
   * feature:f-studio-and-seat-on-the-one-face), as the Scene's bar holds it:
   * handed the calls it makes, and wanted from the first draw, so a new
   * project's starter seat is there before anything has happened.
   */
  const [calls, onCall] = useCallLog();
  const seat = useMemo(() => context.seat?.(onCall), [context.seat, onCall]);
  if (!wanted && seat === undefined) return null;
  // Never suspends: its room stands until the panes are here (`BarInbox`).
  const drawn = <BarInbox remembers={false} calls={calls} {...(seat !== undefined ? { seat } : {})} />;
  // Drawn in the derived shell's own row, in the bar's class for the face's own tool.
  return own ? createPortal(drawn, own) : <div className="graview-bar-own">{drawn}</div>;
}

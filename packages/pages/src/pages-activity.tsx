import type { AnySchema, Store } from "@graview/core";
import { BarActivity, BarSuggested, useNotifiedCount } from "@graview/primitives/pages";
import { useGraviewIfAny, usePlayback } from "@graview/react/provider";
import { Suspense } from "react";
import { createPortal } from "react-dom";
import type { PageContext } from "./page-context.js";
import { useStoreTick } from "./page-context.js";

/**
 * WHAT HAS HAPPENED, ON THE ROUTED FACE'S BAR (FR-152), as the scene has
 * it: each change with its own way back, after the notice that offered the
 * last one has gone — on Pages a person with a mouse had no way to a change
 * once its ten seconds were up. In the bar's place for the face's own tool
 * where a bar above the face keeps one (`own`), else where it is drawn: the
 * derived shell's own bar. Fetched once there is anything to show, so a face
 * nobody has changed carries none of it; drawn from the provider's
 * activity, so a face handed no views has none.
 */
export function PagesActivity<S extends AnySchema>({ context, own }: { readonly context: PageContext<S>; readonly own?: HTMLElement }) {
  useStoreTick(context.store);
  const here = useGraviewIfAny();
  // What has happened is now's, whichever moment the face draws (Roadmap f-playback).
  const live = (usePlayback()?.live ?? context.store) as unknown as Store<AnySchema>;
  useStoreTick(live as Store<AnySchema>);
  // Somebody told of changes (Roadmap f-notify-subscriptions) has Activity to open, though nothing has changed yet.
  const notified = useNotifiedCount();
  if (!here || (live.batches().length === 0 && notified === 0)) return null;
  // What tidying suggests waits beside it, quietly, only while something does.
  const drawn = (
    <>
      <Suspense fallback={null}>
        <BarSuggested />
      </Suspense>
      <Suspense fallback={null}>
        <BarActivity />
      </Suspense>
    </>
  );
  // Drawn in the derived shell's own row, in the bar's class for the face's own tool, so a phone's bar draws it as a mark.
  return own ? createPortal(drawn, own) : <div className="graview-bar-own">{drawn}</div>;
}

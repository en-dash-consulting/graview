import type { AnySchema, GraviewApp, Principal, Store } from "@graview/core";
import type { CatalogPlace } from "@graview/core/catalog";
import { useGoTo, useGraview, useLiveStore, type AiDesk, type GoTo, type SeatTalk } from "@graview/react/provider";
import type { HostAi } from "@graview/tools/frame";
import { useMemo } from "react";

/**
 * WHAT THE INLINE AI'S RUNNER NEEDS OF THE FACE IT RUNS ON: the store as
 * now (never the past a face may be showing), who is asking, the host's AI,
 * the app's desk and conversation, the way to go somewhere, the places,
 * the app a panel is drafted against, where the viewer is and what is
 * selected. Plain values, read here once, so the menu, Activity's "Ask
 * again" and a later quick ask run the same code (`inline-ai-menu.tsx`).
 * Apart from the runner so a surface can hold one before the runner is
 * fetched.
 */
export interface InlineEnv {
  readonly store: Store<AnySchema>;
  readonly principal: Principal;
  readonly ai: HostAi;
  readonly desk: AiDesk;
  readonly seatTalk: SeatTalk;
  readonly goTo: GoTo;
  readonly places: readonly CatalogPlace[];
  readonly app: GraviewApp<AnySchema>;
  readonly place?: string;
  readonly selection: readonly string[];
}

/** The runner's environment, from the provider it is drawn under. */
export function useInlineEnv(): InlineEnv {
  const { store: shown, principal, ai, aiDesk, seatTalk, views, app, brand, view, selection } = useGraview<AnySchema>();
  const store = useLiveStore(shown, principal);
  const goTo = useGoTo();
  const place = view.within?.["view"];
  return useMemo(
    () => ({
      store,
      principal,
      ai,
      desk: aiDesk,
      seatTalk,
      goTo,
      // What each place is and reads go too: the menu offers the view an app has before it draws a second (`existingViewsOf`).
      places: [...views.places()],
      app: (app as GraviewApp<AnySchema> | undefined) ?? ({ name: brand?.name ?? "app", schema: store.schema, ...(store.policy ? { policy: store.policy } : {}) } as unknown as GraviewApp<AnySchema>),
      ...(place ? { place } : {}),
      selection,
    }),
    [store, principal, ai, aiDesk, seatTalk, goTo, views, app, brand, place, selection],
  );
}

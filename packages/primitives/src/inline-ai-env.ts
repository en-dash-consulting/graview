import type { AnySchema, GraviewApp, Principal, Store } from "@graview/core";
import type { CatalogPlace } from "@graview/core/catalog";
import { useGoTo, useGraview, useLiveStore, usePlayback, type AiDesk, type GoTo, type SeatTalk } from "@graview/react/provider";
import type { HostAi } from "@graview/tools/frame";
import { useCallback, useMemo, useRef } from "react";

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

type Given = ReturnType<typeof useGraview<AnySchema>>;

function envOf(given: Given, store: Store<AnySchema>, goTo: GoTo): InlineEnv {
  const { principal, ai, aiDesk, seatTalk, views, app, brand, view, selection } = given;
  const place = view.within?.["view"];
  return {
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
  };
}

/** The runner's environment, from the provider it is drawn under. */
export function useInlineEnv(): InlineEnv {
  const given = useGraview<AnySchema>();
  const { store: shown, principal, ai, aiDesk, seatTalk, views, app, brand, view, selection } = given;
  const store = useLiveStore(shown, principal);
  const goTo = useGoTo();
  const place = view.within?.["view"];
  return useMemo(
    () => envOf(given, store, goTo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, principal, ai, aiDesk, seatTalk, goTo, views, app, brand, place, selection],
  );
}

/**
 * THE SAME ENVIRONMENT, READ WHEN IT IS WANTED AND NOT BEFORE: for a door
 * that asks ahead of its menu (Roadmap f-jev-fast-polish) without drawing
 * again each time the graph moves. Of the store as now, as the menu reads it
 * (`useLiveStore`), whatever moment the face shows.
 */
export function useInlineEnvLater(): () => InlineEnv | null {
  const given = useGraview<AnySchema>();
  const playback = usePlayback<AnySchema>();
  const goTo = useGoTo();
  const latest = useRef({ given, playback, goTo });
  latest.current = { given, playback, goTo };
  return useCallback(() => {
    const now = latest.current;
    return envOf(now.given, now.playback ? (now.playback.live.seenBy(now.given.principal) as unknown as Store<AnySchema>) : now.given.store, now.goTo);
  }, []);
}

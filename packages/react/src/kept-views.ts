import { NO_KEPT_VIEWS, tidyViews, type AnySchema, type KeptViews, type KeptViewsState } from "@graview/core";
import { useMemo, useSyncExternalStore } from "react";
import { useGraviewIfAny } from "./context.js";
import type { ReactViewRegistry } from "./view-registry.js";

/*
 * THE HOST'S VIEWS, AS THE PLACE MENU TIDIES THEM (Roadmap
 * f-place-menu-views): what it says now, read as it changes.
 */

const never = () => () => undefined;

/** What `keeper` says now, followed as it changes; nothing hidden, deleted or allowed without one. */
export function useKeptViewsState(keeper: KeptViews | undefined): KeptViewsState {
  const subscribe = useMemo(() => (keeper?.onChange ? (listener: () => void) => keeper.onChange!(listener) : never), [keeper]);
  const read = () => keeper?.current() ?? NO_KEPT_VIEWS;
  return useSyncExternalStore(subscribe, read, read);
}

/** The provider's kept views and what they say now: `null` where the host keeps none. */
export function useKeptViews(): { readonly keeper: KeptViews; readonly state: KeptViewsState } | null {
  const keeper = useGraviewIfAny()?.keptViews;
  const state = useKeptViewsState(keeper);
  return keeper ? { keeper, state } : null;
}

/**
 * THE REGISTRY A FRAME HANDS ITS FACES, AS THE HOST'S TIDYING LEAVES IT
 * (`tidyViews`): a view it lists as hidden kept off the lists, one it lists
 * as deleted drawn nowhere. The same registry while nothing is tidied.
 */
export function useTidiedViews<S extends AnySchema>(views: ReactViewRegistry<S>, keeper: KeptViews | undefined): ReactViewRegistry<S> {
  const state = useKeptViewsState(keeper);
  const { hidden, removed } = state;
  return useMemo(() => tidyViews(views, { hidden, removed }) as ReactViewRegistry<S>, [views, hidden, removed]);
}

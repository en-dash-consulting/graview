import { retryingImport } from "@graview/core/retry";
import type { AnySchema, KeptViews } from "@graview/core";
import { createElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { GraviewContext, useGraview } from "./context.js";
import { lazyModule } from "./lazy-part.js";
import type { ReactViewRegistry } from "./view-registry.js";

/*
 * THE FRAME'S HALF OF THE PLACE MENU'S TIDYING (Roadmap f-place-menu-views),
 * all a page carries up front: what tidies the registry, and what follows
 * the host as it changes, are fetched where a host keeps views at all.
 */

const tidying = /* @__PURE__ */ lazyModule(retryingImport(() => import("./tidy-views.js")));

/**
 * Follows the host's views with what tidies the registry, fetched the first
 * time the host lists something hidden or deleted — a page whose host has
 * tidied nothing never asks for it; the answer stops following.
 */
function follow<S extends AnySchema>(views: ReactViewRegistry<S>, keeper: KeptViews, set: (tidied: ReactViewRegistry<S>) => void): () => void {
  let stop: (() => void) | undefined;
  let gone = false;
  const listed = () => {
    const { hidden, removed } = keeper.current();
    if (stop || gone || hidden.length + removed.length === 0) return;
    stop = () => undefined;
    void tidying.load().then((module) => {
      if (!gone) stop = module.watchTidied(views, keeper, set as never);
    }, String);
  };
  listed();
  const unlisten = keeper.onChange?.(listed);
  return () => {
    gone = true;
    unlisten?.();
    stop?.();
  };
}

/**
 * THE REGISTRY A FRAME HANDS ITS FACES, AS THE HOST'S TIDYING LEAVES IT
 * (`tidyViews`): a view it lists as hidden kept off the lists, one it lists
 * as deleted drawn nowhere. What tidies it is fetched where a host keeps
 * views at all, and the registry is the frame's own until it has.
 */
export function useTidiedViews<S extends AnySchema>(views: ReactViewRegistry<S>, keeper: KeptViews | undefined): ReactViewRegistry<S> {
  const [tidied, setTidied] = useState<readonly [ReactViewRegistry<S>, ReactViewRegistry<S>]>();
  useEffect(() => (keeper ? follow(views, keeper, (next) => setTidied([views, next])) : undefined), [views, keeper]);
  return tidied?.[0] === views ? tidied[1] : views;
}

/**
 * THE HOST'S VIEWS FOR WHAT IS DRAWN INSIDE, over a provider that was not
 * handed them: every surface under it reads `keptViews` and the registry
 * tidied as they say. How the whole-page Shell takes `keptViews` as
 * `mount` does (Roadmap f-place-menu-views).
 */
export function KeptViewsProvider({ keptViews, children }: { readonly keptViews: KeptViews; readonly children?: ReactNode }) {
  const outer = useGraview();
  const views = useTidiedViews(outer.views as ReactViewRegistry<AnySchema>, keptViews);
  const value = useMemo(() => ({ ...outer, keptViews, views }), [outer, keptViews, views]);
  return createElement(GraviewContext.Provider, { value }, children);
}

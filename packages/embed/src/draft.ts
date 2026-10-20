import { retryingImport } from "@graview/core/retry";
import type { WorkerViewDefinition } from "@graview/guest/host/views";
import { partArriving } from "@graview/react/provider";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { DraftOver } from "./frame.js";

/*
 * A VIEW PROPOSED AND NOT KEPT (FR-187), as the whole embed and the pages
 * alone draw one: the worker's host it is registered with, fetched only
 * when a draft is handed, and the registration over the app's views.
 */

/** A view proposed and not kept (FR-187): a worker view's definition, its code as `source` — a plain script against the `graview` global — or `worker`. */
export type EmbedDraftView = Omit<WorkerViewDefinition, "worker" | "draft"> & ({ readonly source: string; readonly worker?: undefined } | { readonly worker: WorkerViewDefinition["worker"]; readonly source?: undefined });

/*
 * THE WORKER'S HOST FOR A DRAFT, fetched only when one is handed: a page
 * that is handed none never loads it for this. Counted while it is on its
 * way (`partArriving`), so a place a draft is handed to after it first drew
 * is not said drawn before the draft is in it (FR-188).
 */
let draftHost: typeof import("@graview/guest/host/views") | undefined;
const draftChunk = retryingImport(() => import("@graview/guest/host/views"));
const load = (): Promise<void> => draftChunk().then((module) => void (draftHost = module), () => new Promise<void>((resolve) => setTimeout(resolve, 2_000)).then(load));
export const fetchDraftHost: () => Promise<void> = partArriving(load);

/** Whether a draft handed now must wait for the worker's host before the embed first draws. */
export const draftWaits = (draft: EmbedDraftView | null | undefined): boolean => Boolean(draft) && draftHost === undefined;

/** Stands in for the embed while what it draws with arrives — the worker's host for a draft, the rules for a place handed back — then draws it. */
export function Settling({ onReady, fetch }: { readonly onReady: () => void; readonly fetch: () => Promise<void> }) {
  useLayoutEffect(() => void fetch().then(onReady), [onReady, fetch]);
  return null;
}

/** Each draft handed, counted: what the drawn signal is watched again for when a draft is swapped (`setDraftView`). */
let handed = 0;

/**
 * How the frame registers the draft over the app's views, kept while the
 * same draft is handed, and which draft it is. A draft handed after the
 * embed first drew, before the worker's host is here, is registered once
 * the host arrives; the embed is not drawn again from nothing for it.
 */
export function useDraft(draft: EmbedDraftView | null | undefined): { readonly over: DraftOver | undefined; readonly n: number } {
  const [host, setHost] = useState(() => draftHost);
  useEffect(() => {
    if (!draft || host) return;
    let gone = false;
    void fetchDraftHost().then(() => {
      if (!gone) setHost(draftHost);
    });
    return () => {
      gone = true;
    };
  }, [draft, host]);
  const n = useMemo(() => (handed += 1), [draft]);
  const over = useMemo(() => {
    const views = host ?? draftHost;
    if (!draft || !views) return undefined;
    const { source, worker, ...rest } = draft;
    const definition: WorkerViewDefinition = { ...rest, worker: worker ?? { source: source! }, draft: true };
    return { name: draft.manifest.name, home: draft.manifest.attach === "home", register: (registry) => views.registerWorkerView(registry, definition) } satisfies DraftOver;
  }, [draft, host]);
  return { over, n };
}

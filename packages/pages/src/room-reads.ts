import type { ViewerState } from "@graview/core";
import { useSyncExternalStore } from "react";

/*
 * WHERE A PERSON HAS READ UP TO, IN EACH ROOM (Graview HQ
 * feature:f-chat-rooms): one marker a room or thread — the instant of the
 * last message they saw there — kept the way any per-viewer value is, by
 * the host's `viewerState` under `graview:rooms`, and in this browser where
 * a host keeps none (for the visit, where it cannot keep anything). What
 * the bell's unread count reads, and what a room's
 * page moves as it is read. Never in the graph, the log or an export.
 */

/** The view name the markers are kept under (`ROOMS_READ_STATE` on `@graview/core/rooms`). */
const VIEW = "graview:rooms";

export interface RoomReads {
  /** Every marker, by room key (`room`, or `room@record`). */
  get(): Readonly<Record<string, string>>;
  /** Moves a marker forward to `at`; never back. */
  mark(key: string, at: string): void;
  subscribe(listener: () => void): () => void;
}

const BY_STATE = new WeakMap<object, Map<string, RoomReads>>();
const VISIT: Record<string, RoomReads> = {};

/** The markers of one person, kept by this host (or for the visit), shared by every part of the page that reads them. */
export function roomReadsFor(viewerState: ViewerState | undefined, person: string | undefined): RoomReads {
  const who = person ?? "";
  if (!viewerState) return (VISIT[who] ??= made(browserKept(who)));
  let held = BY_STATE.get(viewerState);
  if (!held) BY_STATE.set(viewerState, (held = new Map()));
  let reads = held.get(who);
  if (!reads) held.set(who, (reads = made(viewerState)));
  return reads;
}

/** This browser's own keeping, as a viewer state: a per-viewer convenience, never shared, and nothing when the browser keeps nothing. */
function browserKept(who: string): ViewerState | undefined {
  const key = (view: string) => `graview:${view}:${who}`;
  try {
    if (typeof localStorage === "undefined") return undefined;
    localStorage.getItem(key(VIEW));
  } catch {
    return undefined;
  }
  return {
    async read(view) {
      try {
        return JSON.parse(localStorage.getItem(key(view)) ?? "{}") as Record<string, string>;
      } catch {
        return {};
      }
    },
    async write(view, field, value) {
      try {
        const held = JSON.parse(localStorage.getItem(key(view)) ?? "{}") as Record<string, string>;
        if (value === null) delete held[field];
        else held[field] = value;
        localStorage.setItem(key(view), JSON.stringify(held));
      } catch {
        // Not kept: the marker holds for the visit.
      }
      return { ok: true };
    },
  };
}

function made(viewerState: ViewerState | undefined): RoomReads {
  let marks: Readonly<Record<string, string>> = {};
  const listeners = new Set<() => void>();
  const told = () => {
    for (const listener of listeners) listener();
  };
  if (viewerState) {
    void viewerState.read(VIEW).then(
      (kept) => {
        // What was marked here while the host answered wins where it is later.
        const merged: Record<string, string> = { ...kept };
        for (const [key, at] of Object.entries(marks)) if (!merged[key] || merged[key]! < at) merged[key] = at;
        marks = merged;
        told();
      },
      () => undefined,
    );
  }
  return {
    get: () => marks,
    mark(key, at) {
      if (marks[key] !== undefined && marks[key]! >= at) return;
      marks = { ...marks, [key]: at };
      told();
      void viewerState?.write(VIEW, key, at).catch(() => undefined);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The markers, as they move. */
export function useRoomReads(reads: RoomReads): Readonly<Record<string, string>> {
  return useSyncExternalStore(reads.subscribe, reads.get, reads.get);
}

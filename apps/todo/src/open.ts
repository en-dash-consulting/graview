import {
  browserStartsFresh,
  createBrowserAdapter,
  createBroadcastPresence,
  forgetFreshParam,
  openRemote,
  openStore,
  type OpenedStore,
} from "@graview/ship/browser";
import type { PresenceChannel, Principal } from "@graview/core";
import example from "./data/example.json";
import { todoApp } from "./domain/app.js";
import { thingsBrand } from "./domain/brand.js";
import type { TodoSchema } from "./domain/schema.js";
import { openingSeat, today } from "./ui/app.js";

/**
 * HOW THINGS OPENS ITSELF — in one function, so that everywhere it is
 * opened, it opens the same way.
 *
 * At its own port the app remembered every edit through ship's browser
 * adapter; mounted in the launcher it was handed no store at all, built an
 * in-memory one from the example, and forgot on reload. So the launcher —
 * the first thing a person opens — hid the one persistence capability the
 * demos already had, and there was no way to tell from inside it whether
 * Things persisted anything.
 *
 * The scope is the app's own name, so two demos mounted in one launcher
 * keep two stores rather than writing over each other.
 */
export interface OpenedApp {
  readonly opened: OpenedStore<TodoSchema>;
  readonly principal: Principal;
  readonly brand: typeof thingsBrand;
  /** Whether this browser is keeping the edits — true wherever it is opened. */
  readonly remembers: boolean;
  /**
   * WHO ELSE IS HERE: the tabs of this origin, over a BroadcastChannel
   * scoped like the store. Multiplayer for free, beside the adapter and
   * never in the log.
   */
  readonly presence: PresenceChannel;
}

export async function open(): Promise<OpenedApp> {
  /*
   * AGAINST A SERVER, WHERE ASKED: `?server=` and the address `graview
   * serve` printed opens the store there, so two people in two browsers
   * are in one app — and in its rooms, each seeing what the other says as
   * it is said (Graview HQ feature:f-chat-rooms).
   */
  const server = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("server");
  if (server) {
    const principal = openingSeat();
    const remote = await openRemote({ app: todoApp, url: server, principal });
    return { opened: { store: remote.store } as unknown as OpenedStore<TodoSchema>, principal, brand: thingsBrand, remembers: false, presence: createBroadcastPresence(todoApp.name) };
  }
  const opened = await openStore({
    app: todoApp,
    adapter: createBrowserAdapter(),
    scope: todoApp.name,
    seed: example,
    fresh: browserStartsFresh(),
    storeOptions: { invariantOptions: { context: { today: today() } } },
  });
  forgetFreshParam();
  return {
    opened,
    principal: openingSeat(),
    brand: thingsBrand,
    remembers: true,
    presence: createBroadcastPresence(todoApp.name),
  };
}

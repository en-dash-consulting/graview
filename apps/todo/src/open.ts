import {
  browserStartsFresh,
  createBrowserAdapter,
  createBroadcastPresence,
  forgetFreshParam,
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

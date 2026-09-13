import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  openStore,
} from "@graview/ship/browser";
import type { Principal, Store } from "@graview/core";
import { seedbedApp } from "./domain/app.js";
import { seedbedBrand } from "./domain/brand.js";
import type { SeedbedSchema } from "./domain/schema.js";

/**
 * HOW THE SEEDBED OPENS ITSELF, wherever it is opened.
 *
 * Its own port and the launcher, through one function and one scope — two
 * demos mounted in one launcher keep two stores rather than writing over
 * each other. No seed: the garden starts EMPTY on purpose, which is the
 * whole point of this example, and populating it is the onboarding.
 *
 * Chapters are not opened this way; `main.tsx` handles those, because a
 * chapter is a different declaration with its own scope and its own seat.
 */
export interface OpenedApp {
  readonly store: Store<SeedbedSchema>;
  readonly principal?: Principal;
  readonly brand: typeof seedbedBrand;
  readonly remembers: boolean;
}

export async function open(): Promise<OpenedApp> {
  const opened = await openStore({
    app: seedbedApp,
    adapter: createBrowserAdapter(),
    scope: seedbedApp.name,
    fresh: browserStartsFresh(),
  });
  forgetFreshParam();
  return { store: opened.store, brand: seedbedBrand, remembers: true };
}

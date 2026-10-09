import {
  browserStartsFresh,
  createBrowserAdapter,
  forgetFreshParam,
  openStore,
} from "@graview/ship/browser";
import type { PersistenceAdapter, Principal, Store } from "@graview/core";
import { seedbedApp } from "./domain/app.js";
import { seedbedBrand } from "./domain/brand.js";
import { EXAMPLE_GARDEN } from "./domain/example.js";
import type { SeedbedSchema } from "./domain/schema.js";

/**
 * HOW THE SEEDBED OPENS ITSELF, wherever it is opened.
 *
 * Its own port and the launcher, through one function and one scope — two
 * demos mounted in one launcher keep two stores rather than writing over
 * each other.
 *
 * IT OPENS PLANTED. The garden used to start empty on purpose, so the first
 * thing anybody saw was a city of "none yet" and nothing to ask about. Now
 * it opens on the example garden (the one the chapters grow into), and an
 * empty garden is the person's choice: "Start empty" in the person menu, or
 * `?empty=1` — remembered in this browser until "Load the example garden"
 * (or `?fresh=1`) brings the example back.
 *
 * Chapters are not opened this way; `main.tsx` handles those, because a
 * chapter is a different declaration with its own scope and its own seat.
 */
export interface OpenedApp {
  readonly store: Store<SeedbedSchema>;
  readonly principal?: Principal;
  readonly brand: typeof seedbedBrand;
  readonly remembers: boolean;
  /** Whether the garden opened empty because a person chose it. */
  readonly empty: boolean;
}

/** Whether this browser was asked to keep the garden empty. */
export interface EmptyChoice {
  get(): boolean;
  set(empty: boolean): void;
}

const CHOSE_EMPTY = "graview:seedbed:empty";

/** The choice, kept beside the garden in this browser; forgotten quietly where storage is refused. */
export const browserEmptyChoice: EmptyChoice = {
  get: () => {
    try {
      return localStorage.getItem(CHOSE_EMPTY) === "1";
    } catch {
      return false;
    }
  },
  set: (empty) => {
    try {
      if (empty) localStorage.setItem(CHOSE_EMPTY, "1");
      else localStorage.removeItem(CHOSE_EMPTY);
    } catch {
      // Not being able to remember the choice is not a reason to fail the opening.
    }
  },
};

export interface GardenOpening {
  readonly adapter: PersistenceAdapter;
  /** The address's query: `?empty=1` empties the garden. */
  readonly search: string;
  /** Start from the example, whatever is stored (`?fresh=1`, a driven browser). */
  readonly fresh: boolean;
  readonly choice: EmptyChoice;
}

/** Opens the finished garden: planted unless a person chose it empty. */
export async function openGarden({ adapter, search, fresh, choice }: GardenOpening) {
  const scope = seedbedApp.name;
  if (new URLSearchParams(search).get("empty") === "1") {
    choice.set(true);
    const opened = await openStore({ app: seedbedApp, adapter, scope, fresh: true });
    return { store: opened.store, empty: true };
  }
  if (fresh) choice.set(false);
  const empty = choice.get();
  /*
   * A garden nobody has touched is planted: a browser that opened the
   * seedbed while it still started empty holds an empty snapshot and no
   * history, and that is not a choice anybody made.
   */
  let untouched = false;
  if (!fresh && !empty) {
    const stored = await adapter.load(scope);
    const log = (await adapter.loadLog?.(scope)) ?? [];
    untouched = (stored?.nodes.length ?? 0) === 0 && log.length === 0;
  }
  const opened = await openStore({
    app: seedbedApp,
    adapter,
    scope,
    ...(empty ? {} : { seed: EXAMPLE_GARDEN }),
    fresh: fresh || untouched,
  });
  return { store: opened.store, empty };
}

/** Drops `?empty=1` once it has been honored, as `forgetFreshParam` drops `?fresh=1`. */
export function forgetEmptyParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("empty") !== "1") return;
  url.searchParams.delete("empty");
  window.history.replaceState(null, "", url.toString());
}

export async function open(): Promise<OpenedApp> {
  const opened = await openGarden({
    adapter: createBrowserAdapter(),
    search: typeof window === "undefined" ? "" : window.location.search,
    fresh: browserStartsFresh(),
    choice: browserEmptyChoice,
  });
  forgetFreshParam();
  forgetEmptyParam();
  return { store: opened.store, brand: seedbedBrand, remembers: true, empty: opened.empty };
}

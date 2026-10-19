import type { AnySchema } from "../schema/schema.js";
import { FIDELITIES, placeSlug, type Fidelity, type Place, type ViewCell, type ViewRegistration, type ViewRegistry } from "./types.js";

/*
 * THE VIEWS A PERSON TIDIES FROM THE PLACE MENU (Roadmap f-place-menu-views).
 *
 * Views pile up as chats draw them, and the person annoyed by the clutter is
 * standing at the places drop-down. Right-clicking a place there offers Hide
 * and Delete; the drop-down's foot lists what is Hidden (with Show) and
 * what was Recently deleted (with Restore, for thirty days). App-wide, not
 * per person.
 *
 * A script view drawn by a chat is the HOST's — it stores the view and its
 * replaced versions — so hiding, deleting and restoring it are the host's
 * too, through `KeptViews`. A declared lens is the declaration's: hidden by
 * `set-lens-hidden` and deleted by `remove-lens`, a change to the
 * declaration the host writes with its usual rollback (`KeptViews.lens`).
 * The page only asks; the host decides who may (`KeptViewsState.may`) and
 * refuses what it did not allow.
 */

/** What this viewer may tidy, as the host decides: script views (an owner or an editor), declared lenses (the owner). */
export interface KeptViewsMay {
  readonly views: boolean;
  readonly lenses: boolean;
}

/** A view deleted and still kept: in the drop-down's "Recently deleted" until `until`, then gone for good. */
export interface RemovedView {
  /** The name it is restored by: a script view's manifest name, or `lens:<title>` for a declared lens. */
  readonly name: string;
  /** What it was called, as the drop-down lists it. */
  readonly title: string;
  /** The kind it was a picture of, when known. */
  readonly kind?: string;
  /** When it was deleted (ISO 8601). */
  readonly at: string;
  /** When it is gone for good (ISO 8601): thirty days after `at`. */
  readonly until: string;
  /** A declared lens: restored by the host taking back the change that removed it. */
  readonly lens?: true;
  /** Who deleted it, in words. */
  readonly by?: string;
}

/** What the host says now: the script views kept off the lists, the views recently deleted (newest first), and what this viewer may do. */
export interface KeptViewsState {
  /** Script views kept off the lists, by name. A declared lens's hiding is the declaration's (`hidden: true`), not listed here. */
  readonly hidden: readonly string[];
  readonly removed: readonly RemovedView[];
  readonly may: KeptViewsMay;
}

/** A declared lens's change from the place menu: kept off the lists or put back (`set-lens-hidden`), or deleted (`remove-lens`). */
export type LensTidyEdit =
  | { readonly op: "set-lens-hidden"; readonly title: string; readonly on?: string; readonly hidden: boolean }
  | { readonly op: "remove-lens"; readonly title: string; readonly on?: string };

/**
 * THE HOST'S VIEWS, AS THE PLACE MENU TIDIES THEM (`keptViews` on the
 * embed and the provider). `current()` is read as the page draws;
 * `onChange` says when it moved — the host's own change, or somebody
 * else's. Each action resolves once the host has done it and `current()`
 * says so, and throws, in words, what the host refused.
 *
 *   hide / show      a script view off the places, the scene and the
 *                    gallery, and back — untouched, still at its address
 *   remove           a script view out of the app, listed under
 *                    `removed` for thirty days
 *   restore          a view listed under `removed`, back where it was —
 *                    a declared lens by taking back the change that
 *                    removed it
 *   lens             a declared lens's `set-lens-hidden` or `remove-lens`:
 *                    written as any change to the declaration, the page
 *                    handed the new app (`setApp`), a removed lens listed
 *                    under `removed` with `lens: true`. Unsaid, declared
 *                    lenses are not offered.
 */
export interface KeptViews {
  current(): KeptViewsState;
  onChange?(listener: () => void): () => void;
  hide(name: string): void | Promise<void>;
  show(name: string): void | Promise<void>;
  /** `about` is what the page knows of it — its title and kind — for a host that lists it by them. */
  remove(name: string, about?: { readonly title: string; readonly kind: string }): void | Promise<void>;
  restore(name: string): void | Promise<void>;
  lens?(edit: LensTidyEdit): void | Promise<void>;
}

/** How long a deleted view is kept: thirty days. */
export const REMOVED_VIEW_DAYS = 30;

const DAY_MS = 86_400_000;

/** The name a removed declared lens is listed and restored by. */
export const removedLensName = (title: string): string => `lens:${title}`;

/** Nothing hidden, nothing deleted, nothing allowed: a host that keeps no views. */
export const NO_KEPT_VIEWS: KeptViewsState = { hidden: [], removed: [], may: { views: false, lenses: false } };

export interface MemoryViewsOptions {
  /** What every viewer may tidy. Script views, not declared lenses, unless said. */
  readonly may?: KeptViewsMay;
  /** What it starts with: a state kept before (a file, a database row). */
  readonly initial?: Partial<Pick<KeptViewsState, "hidden" | "removed">>;
  /** How long a deleted view is kept, in days. `REMOVED_VIEW_DAYS`. */
  readonly days?: number;
  /** The clock, in milliseconds. */
  readonly now?: () => number;
  /** Who is doing it, in words, said on what they delete. */
  readonly by?: () => string | undefined;
  /**
   * THE DECLARATION, for declared lenses: `change` writes a lens's
   * `set-lens-hidden` or `remove-lens`; `restore` takes back the removal of
   * the lens listed (the host's rollback). Without it, `lens` is not offered.
   */
  readonly declaration?: {
    change(edit: LensTidyEdit): void | Promise<void>;
    restore(removed: RemovedView): void | Promise<void>;
  };
}

/**
 * VIEWS KEPT IN MEMORY: a page's, a test's, or a server's behind
 * `@graview/ship`'s `viewsHandler` — hidden names, and deleted views kept
 * thirty days, each read past its day dropped for good. Gone with the page
 * or the process unless its `current()` is written somewhere and handed back
 * as `initial`.
 */
export function memoryViews(options: MemoryViewsOptions = {}): KeptViews {
  const now = options.now ?? Date.now;
  const keep = (options.days ?? REMOVED_VIEW_DAYS) * DAY_MS;
  const may = options.may ?? { views: true, lenses: false };
  let hidden: readonly string[] = [...(options.initial?.hidden ?? [])];
  let removed: readonly RemovedView[] = [...(options.initial?.removed ?? [])];
  let state: KeptViewsState | null = null;
  const listeners = new Set<() => void>();
  const changed = () => {
    state = null;
    for (const listener of listeners) listener();
  };
  const fresh = () => {
    const at = now();
    const kept = removed.filter((one) => Date.parse(one.until) > at);
    if (kept.length !== removed.length) {
      removed = kept;
      state = null;
    }
  };
  const removal = (name: string, title: string, kind: string | undefined, lens: boolean): RemovedView => {
    const at = now();
    const by = options.by?.();
    return { name, title, ...(kind ? { kind } : {}), at: new Date(at).toISOString(), until: new Date(at + keep).toISOString(), ...(lens ? { lens: true as const } : {}), ...(by ? { by } : {}) };
  };
  const declaration = options.declaration;
  return {
    current() {
      fresh();
      state ??= { hidden, removed, may: declaration ? may : { ...may, lenses: false } };
      return state;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    hide(name) {
      if (hidden.includes(name)) return;
      hidden = [...hidden, name];
      changed();
    },
    show(name) {
      if (!hidden.includes(name)) return;
      hidden = hidden.filter((one) => one !== name);
      changed();
    },
    remove(name, about) {
      hidden = hidden.filter((one) => one !== name);
      removed = [removal(name, about?.title ?? name, about?.kind, false), ...removed.filter((one) => one.name !== name)];
      changed();
    },
    async restore(name) {
      fresh();
      const entry = removed.find((one) => one.name === name);
      if (!entry) throw new Error(`Nothing called "${name}" was deleted in the last ${options.days ?? REMOVED_VIEW_DAYS} days.`);
      if (entry.lens) {
        if (!declaration) throw new Error(`"${entry.title}" is a lens of the declaration, and this host does not change the declaration.`);
        await declaration.restore(entry);
      }
      removed = removed.filter((one) => one !== entry);
      changed();
    },
    ...(declaration
      ? {
          async lens(edit: LensTidyEdit) {
            await declaration.change(edit);
            if (edit.op === "remove-lens") {
              const name = removedLensName(edit.title);
              removed = [removal(name, edit.title, edit.on, true), ...removed.filter((one) => one.name !== name)];
            }
            changed();
          },
        }
      : {}),
  };
}

/** On a tidied registry, the registry it is over: one visit, however its views are tidied. */
export const TIDIED_FROM: unique symbol = Symbol.for("graview.tidied-from") as never;

const fallbacks = (fidelity: Fidelity): readonly Fidelity[] => [fidelity, ...FIDELITIES.filter((one) => one !== fidelity)];

/**
 * A REGISTRY AS THE HOST'S TIDYING LEAVES IT: a script view it lists as
 * hidden is a place kept off the lists (`hidden: true`, reached by its
 * address and never its kind's default picture), and one it lists as
 * deleted is no place at all and never drawn — each falling back to what
 * the kind drew before. The registry itself is untouched, and is answered
 * as it is when nothing is tidied. Pure: every face reads the same answer.
 */
export function tidyViews<S extends AnySchema, V>(registry: ViewRegistry<S, V>, state: Pick<KeptViewsState, "hidden" | "removed">): ViewRegistry<S, V> {
  if (state.hidden.length === 0 && state.removed.length === 0) return registry;
  const gone = new Set(state.removed.filter((one) => !one.lens).map((one) => one.name));
  const hid = new Set(state.hidden);
  const tidied = (registration: { readonly name?: string } | undefined): boolean => registration?.name !== undefined && (gone.has(registration.name) || hid.has(registration.name));
  /* What a cell draws when nothing tidied may: the last registration that would have won it, as the registry decides. */
  const exact = (kind: string, cardinality: ViewCell["cardinality"], fidelity: Fidelity): ViewRegistration<V> | undefined =>
    [...registry.registrations()].reverse().find((one) => one.kind === kind && one.cardinality === cardinality && one.fidelity === fidelity && !one.beside && !one.hidden && !tidied(one));
  const cellOf = (kind: string, cell: ViewCell): ViewRegistration<V> | undefined => {
    for (const fidelity of fallbacks(cell.fidelity)) {
      const found = exact(kind, cell.cardinality, fidelity);
      if (found) return found;
    }
    if (cell.cardinality === "one") {
      for (const fidelity of fallbacks(cell.fidelity)) {
        const found = exact(kind, "many", fidelity);
        if (found) return found;
      }
    }
    return undefined;
  };
  const tidy: ViewRegistry<S, V> = {
    ...registry,
    register(kind, cell, view, meta) {
      registry.register(kind, cell, view, meta);
      return tidy;
    },
    lookup(kind, cell) {
      return registry.lookup(kind, cell) === undefined ? undefined : exact(kind, cell.cardinality, cell.fidelity)?.view;
    },
    places: () =>
      registry
        .places()
        .filter((place) => !(place.name !== undefined && gone.has(place.name)))
        .map((place): Place => (place.name !== undefined && hid.has(place.name) && !place.hidden ? { ...place, hidden: true } : place)),
    resolve(kind, cell, as) {
      const found = registry.resolve(kind, cell, as);
      if (!found || !tidied(found)) return found;
      // A hidden view is still reached by its own name; a deleted one is not reached at all.
      if (as !== undefined && found.name !== undefined && !gone.has(found.name) && found.title !== undefined && placeSlug(found.title) === as) return found;
      return cellOf(kind, cell);
    },
    all: () => registry.all().filter((one) => !(one.name !== undefined && gone.has(one.name))),
  };
  Object.defineProperty(tidy, TIDIED_FROM, { value: (registry as { readonly [TIDIED_FROM]?: object })[TIDIED_FROM] ?? registry });
  return tidy;
}

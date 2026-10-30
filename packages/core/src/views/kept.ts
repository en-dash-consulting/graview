import type { Place } from "./types.js";

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

/**
 * A declared lens's change from the place menu: kept off the lists or put
 * back (`set-lens-hidden`), "Export CSV" offered or not (`set-lens-export`,
 * on a kind's list by its kind), or deleted (`remove-lens`).
 */
export type LensTidyEdit =
  | { readonly op: "set-lens-hidden"; readonly title: string; readonly on?: string; readonly hidden: boolean }
  | { readonly op: "set-lens-export"; readonly title: string; readonly on?: string; readonly export: boolean }
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
  /**
   * A SCRIPT VIEW REVISED (Roadmap f-make-this-section-better): "Make this
   * better" on a section of a view composed a whole new source — the
   * section replaced, the rest kept byte for byte — and the page judged it
   * (`compareViewRevision`, the view's own checks) before offering it. Keep
   * hands it here: the host keeps it as it keeps a view a chat replaced
   * (Graview Cloud: `propose_view` and `apply_view`), its replaced version
   * among the view's own, and answers once it is kept — with the one way
   * back where it has its own (`undo`), and a line the card says (`note`).
   * Without `undo` the page's Undo hands the code before back here. Throws,
   * in words, what it refused. Unsaid, no section is offered for revising.
   * Offered only where `current().may.views`.
   */
  revise?(revision: ViewRevisionKept): ViewReviseAnswer | Promise<ViewReviseAnswer>;
  /** The code the host keeps for a view it revised, where it says (a conformance check reads it back). */
  revised?(name: string): string | undefined;
}

/** A revision of a script view, as Keep hands it to the host. */
export interface ViewRevisionKept {
  /** The view, by its manifest name, and its title. */
  readonly name: string;
  readonly title: string;
  /** The whole new source, and the source it replaces. */
  readonly source: string;
  readonly before: string;
  /** The section it revised, by name ("This week"). */
  readonly section: string;
  /** What changed, in a sentence, as the card said it. */
  readonly said: string;
  /** Set when this hands back the code before, as the page's Undo. */
  readonly undoes?: true;
}

/** What a host answers a kept revision: nothing, or a line to say and its own way back. */
export type ViewReviseAnswer = void | undefined | { readonly note?: string; readonly undo?: () => void | Promise<void> };

/** How long a deleted view is kept: thirty days. */
export const REMOVED_VIEW_DAYS = 30;

const DAY_MS = 86_400_000;

/** The name a removed declared lens is listed and restored by. */
export const removedLensName = (title: string): string => `lens:${title}`;

/** Nothing hidden, nothing deleted, nothing allowed: a host that keeps no views. */
export const NO_KEPT_VIEWS: KeptViewsState = { hidden: [], removed: [], may: { views: false, lenses: false } };

/** How a place is tidied: by the host, as a view it keeps; as a change to the declaration; or not by this viewer at all. */
export function placeTidying(place: Pick<Place, "name" | "declared">, state: KeptViewsState, keeper: KeptViews): "view" | "lens" | null {
  if (place.name !== undefined && state.may.views) return "view";
  if (place.declared && state.may.lenses && keeper.lens) return "lens";
  return null;
}

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
      // A deleted lens of the declaration is restored, never replaced by a script view of its name.
      if (removed.some((one) => one.name === name && one.lens)) throw new Error(`"${name}" is a deleted lens of the declaration; only its owner restores it.`);
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


/**
 * REVISIONS KEPT IN MEMORY (Roadmap f-make-this-section-better): the views
 * a host keeps, with `revise` keeping each view's new code here — said
 * "Kept until this page reloads", its undo putting the code before back —
 * and `revised` reading it. Refused to a seat that may not change views. A
 * dev server's, a test's; a host that keeps views for good writes its own.
 */
export function withMemoryRevisions(views: KeptViews): KeptViews {
  const revised = new Map<string, string>();
  return {
    ...views,
    current: () => views.current(),
    revise(revision: ViewRevisionKept): ViewReviseAnswer {
      if (!views.current().may.views) throw new Error("Only someone who may change this app's views can keep a revision of one.");
      const had = revised.get(revision.name);
      revised.set(revision.name, revision.source);
      return {
        note: "Kept until this page reloads.",
        undo: () => {
          if (had === undefined) revised.delete(revision.name);
          else revised.set(revision.name, had);
        },
      };
    },
    revised: (name: string) => revised.get(name),
  };
}

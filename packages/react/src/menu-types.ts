import type { ReactNode } from "react";
import type { MenuViewSection } from "./view-places.js";

/*
 * THE CONTEXT MENU'S SHAPES: what it is opened on, a row, a section, and
 * what answers one. A module of their own, so the provider that holds a
 * host's sections (`context.tsx`) names them without importing the menu
 * that reads the provider (`menu-sections.tsx`).
 */

/**
 * WHAT A CONTEXT MENU IS OPENED ON, as a section of it is told: the record,
 * the kind or the relation under the gesture (`on`), what the acts are
 * derived for (`about`), the field and the place it landed in, which face
 * opened it, and the element it was opened from.
 */
export interface MenuTarget {
  /** The face the menu was opened on. */
  readonly face: "scene" | "pages";
  /** The node, kind card or edge the gesture landed on, when it landed on one. */
  readonly on?: string | undefined;
  /** What the acts in the menu are derived for. */
  readonly about: readonly string[];
  /** The field of `on` it landed on, on a record's page. */
  readonly field?: string | undefined;
  /** The place (a lens, by the name it is registered under) it landed in. */
  readonly place?: string | undefined;
  /** The address it landed on, when that was a link. */
  readonly href?: string | undefined;
  /** The act it landed on — a record's "What can be done", a list's way to begin one — by its declared name. */
  readonly act?: string | undefined;
  /** The column it landed in — a status board's, or a region a view marked `data-column` — when it landed in one. */
  readonly column?: MenuColumn | undefined;
  /** The section of a worker view it landed in — "This week" — when it landed in one (`sectionUnder`). */
  readonly section?: MenuViewSection | undefined;
  /** The routed face's page it landed on, outside a worker view: what the page is about, and the element itself under the gesture. */
  readonly page?: MenuPage | undefined;
  /** The element it was opened from, which the keyboard goes back to. */
  readonly element?: HTMLElement | null | undefined;
}

/**
 * THE PAGE A MENU WAS OPENED ON, ON THE ROUTED FACE (Roadmap
 * f-make-any-page-better): what the page itself is about — a record's page
 * (`on`), a kind's list (`about`, its group), a place, else the home — and
 * the element itself the gesture landed on, from which "Make “Tasks”
 * better" names the part a person would call it.
 */
export interface MenuPage {
  readonly on?: string | undefined;
  readonly about?: readonly string[] | undefined;
  readonly place?: string | undefined;
  /** The page is the home. */
  readonly home?: boolean | undefined;
  readonly at: Element;
}

/**
 * A COLUMN UNDER THE CURSOR: a status board's column, a region a worker
 * view marked `data-column="<field>:<value>"` — the kind it holds, the
 * field its records are put in it by, that field's value there, and the
 * column's own words.
 */
export interface MenuColumn {
  readonly kind: string;
  readonly field: string;
  readonly value: string;
  readonly label: string;
}

/** One row of a section: pressed, it runs and the menu closes. */
export interface MenuItem {
  /** Unique in its section; carried as `data-menu-item`. */
  readonly id: string;
  /** What pressing it does, in the reader's words. */
  readonly label: string;
  readonly run: () => void;
  /** Said under the label, quietly: where it goes, or why. */
  readonly hint?: string;
}

/**
 * A SECTION OF THE CONTEXT MENU, beside the acts the derivation offers. The
 * face's own ("Open", "Change the date") and a host's — the inline AI is
 * one — are both sections, drawn by the one menu: rows from `items`, or what
 * `render` draws, handed the way to close the menu.
 */
/**
 * HOW NEAR A MENU IS, AS IT IS GOT READY: the pointer rested on the target
 * (`"rest"`), the keyboard landed on it (`"keyboard"`), a finger went down
 * on it (`"touch"`), or the menu is opening — a right-click pressed, a
 * finger held, the menu key (`"open"`).
 */
export type MenuReadying = "rest" | "keyboard" | "touch" | "open";

export interface MenuSection {
  /** Unique in the menu; carried as `data-menu-section`. */
  readonly id: string;
  /** A heading over the section; none for a plain run of rows. */
  readonly heading?: string;
  /** Before the acts (`"start"`), after them (the default), or after every row of the menu and never folded behind More… (`"last"`: a host's own rows, `menuItems`). */
  readonly at?: "start" | "end" | "last";
  readonly items?: readonly MenuItem[];
  /** Drawn in place of rows, for a section that needs more than rows. */
  readonly render?: (close: () => void) => ReactNode;
  /**
   * GET READY: the menu may be about to open on this target — the pointer
   * rested on it, the keyboard is on it, a finger is down on it (FR-186).
   * Fetch what the section draws or opens, so the menu draws complete in
   * its first frame. Never a change: nothing is shown. `why` says how near
   * the menu is (`MenuReadying`): `"open"` is the right-click's press or a
   * finger held on its way to a long press, before the menu draws. A model
   * is asked from here only on `"rest"`, where the host let a hover ask
   * (`HostAi.prefetchOnRest`).
   */
  readonly prepare?: (why?: MenuReadying) => void;
  /**
   * A WAY TO ASK, beside Chat under the menu's field (Roadmap
   * f-make-any-page-better): ✨ Better UI on a part of a page. A section
   * that is a mode draws no rows; the menu draws its button.
   */
  readonly mode?: MenuMode;
}

/**
 * A WAY TO ASK UNDER THE MENU'S FIELD (Roadmap f-make-any-page-better): its
 * name and mark ("✨ Better UI"), whether typed words are its own — asked
 * of the Fast slot as they are typed, lighting its button — the card it
 * opens, with the words asked at once or with nothing typed to choose how,
 * and the nudges it suggests here.
 */
export interface MenuMode {
  /** Unique in the menu; carried as `data-menu-mode`. */
  readonly id: string;
  readonly label: string;
  readonly mark: string;
  /** Whether these words are this mode's ("make the cards bigger"). */
  readonly claims: (words: string) => Promise<boolean>;
  /** Opens its card: with words, asked at once; without, to choose. */
  readonly open: (words?: string) => void;
  /** What is worth suggesting here in this mode, in words: the act alone. */
  readonly nudges?: () => readonly string[];
}

/**
 * WHERE A HOST'S OWN ROW WAS PRESSED (Roadmap f-host-context-menu-items):
 * the record or the place under the pointer, the kind whose list it was,
 * the address of what was under it, and the app's own link: what a host's
 * "Make changes in your own AI" hands to somebody else's assistant.
 */
export interface HostMenuAt {
  /** The face the menu was opened on. */
  readonly face: "scene" | "pages";
  /** The record under the pointer, by its id. */
  readonly record?: string | undefined;
  /** The relation under the pointer, on the scene, by its link's id. */
  readonly edge?: string | undefined;
  /** The place under the pointer, by its slug (the name its address carries, `/places/<slug>`). */
  readonly place?: string | undefined;
  /** The kind of the record under the pointer, or whose list, card or group on the map it was. */
  readonly kind?: string | undefined;
  /** The whole address of what was under the pointer, when it has one on the host's page (none under memory routing). */
  readonly href?: string | undefined;
  /** The app's own link: the whole address of its home. */
  readonly link: string;
}

/**
 * A ROW A HOST ADDS TO THE CONTEXT MENU (`menuItems` on `mount`, the
 * provider, the Shell and `PagesApp`): drawn after the framework's own rows,
 * a button like theirs (labeled, reached by the keyboard, pressed after a
 * phone's long press) and called with what was under the pointer.
 */
export interface HostMenuItem {
  /** Unique among the host's rows; carried as `data-menu-item`. */
  readonly id: string;
  /** What pressing it does, in the reader's words. */
  readonly label: string;
  /** Said beside the label, quietly. */
  readonly hint?: string;
  /** Pressed: told what was under the pointer and the app's link. */
  readonly run: (at: HostMenuAt) => void;
  /** Whether it is offered here; unsaid, everywhere the menu opens. */
  readonly offered?: (at: HostMenuAt) => boolean;
}

/** A host's or a face's contribution: told what the menu is opened on, it answers a section or nothing. */
export type MenuSectionSource = (target: MenuTarget) => MenuSection | null | undefined;

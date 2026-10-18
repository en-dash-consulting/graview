import type { ReactNode } from "react";

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
  /** The element it was opened from, which the keyboard goes back to. */
  readonly element?: HTMLElement | null | undefined;
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
export interface MenuSection {
  /** Unique in the menu; carried as `data-menu-section`. */
  readonly id: string;
  /** A heading over the section; none for a plain run of rows. */
  readonly heading?: string;
  /** Before the acts (`"start"`) or after them (the default). */
  readonly at?: "start" | "end";
  readonly items?: readonly MenuItem[];
  /** Drawn in place of rows, for a section that needs more than rows. */
  readonly render?: (close: () => void) => ReactNode;
  /**
   * GET READY: the menu may be about to open on this target — the pointer
   * rested on it, the keyboard is on it, a finger is down on it (FR-186).
   * Fetch what the section draws or opens, so the menu draws complete in
   * its first frame. Never a model call, nor a change: nothing is shown.
   */
  readonly prepare?: () => void;
}

/** A host's or a face's contribution: told what the menu is opened on, it answers a section or nothing. */
export type MenuSectionSource = (target: MenuTarget) => MenuSection | null | undefined;

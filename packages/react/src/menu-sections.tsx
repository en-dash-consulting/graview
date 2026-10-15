import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGraviewIfAny } from "./context.js";

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
}

/** A host's or a face's contribution: told what the menu is opened on, it answers a section or nothing. */
export type MenuSectionSource = (target: MenuTarget) => MenuSection | null | undefined;

const MenuSectionsContext = createContext<readonly MenuSectionSource[]>([]);

/**
 * A FACE'S OWN SECTIONS (the routed face's "Open", "Change …"), added to
 * every context menu drawn inside it, after those of any around it. A
 * host's are the provider's `menuSections`, and are drawn after these.
 */
export function MenuSections({ sections, children }: { readonly sections: readonly MenuSectionSource[]; readonly children: ReactNode }) {
  const outer = useContext(MenuSectionsContext);
  const all = useMemo(() => [...outer, ...sections.filter((source) => !outer.includes(source))], [outer, sections]);
  return <MenuSectionsContext.Provider value={all}>{children}</MenuSectionsContext.Provider>;
}

/** The sections every source here gives for a target, the ones before the acts first. */
export function useMenuSections(target: MenuTarget | null): { readonly start: readonly MenuSection[]; readonly end: readonly MenuSection[] } {
  const faces = useContext(MenuSectionsContext);
  const host = useGraviewIfAny()?.menuSections;
  // The same source given twice — a face's and a host's — is drawn once.
  const sources = host ? [...faces, ...host.filter((source) => !faces.includes(source))] : faces;
  if (target === null || sources.length === 0) return { start: [], end: [] };
  const sections = sources.flatMap((source) => {
    try {
      const section = source(target);
      return section && ((section.items?.length ?? 0) > 0 || section.render) ? [section] : [];
    } catch {
      // A host's section that throws is left out, never the menu.
      return [];
    }
  });
  return { start: sections.filter((section) => section.at === "start"), end: sections.filter((section) => section.at !== "start") };
}

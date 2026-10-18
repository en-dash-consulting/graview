import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useGraviewIfAny } from "./context.js";
import type { MenuSection, MenuSectionSource, MenuTarget } from "./menu-types.js";

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

/** Every source here: the faces', then the host's. The same source given twice — a face's and a host's — is drawn once. */
function useSources(): readonly MenuSectionSource[] {
  const faces = useContext(MenuSectionsContext);
  const host = useGraviewIfAny()?.menuSections;
  return useMemo(() => (host ? [...faces, ...host.filter((source) => !faces.includes(source))] : faces), [faces, host]);
}

/**
 * GETTING EVERY SECTION READY FOR A TARGET (FR-186): what a face calls when
 * the pointer rests on a record, a card, a row or a kind, the keyboard
 * lands on one, or a finger goes down on one — each section's `prepare`.
 */
export function useMenuPrepare(): (target: MenuTarget) => void {
  const sources = useSources();
  return useCallback(
    (target: MenuTarget) => {
      for (const source of sources) {
        try {
          source(target)?.prepare?.();
        } catch {
          // A host's section that throws is left out, never the menu.
        }
      }
    },
    [sources],
  );
}

/** The sections every source here gives for a target, the ones before the acts first. */
export function useMenuSections(target: MenuTarget | null): { readonly start: readonly MenuSection[]; readonly end: readonly MenuSection[] } {
  const sources = useSources();
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

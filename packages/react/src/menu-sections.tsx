import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { kindsOf } from "@graview/layout/view";
import { useGraviewIfAny } from "./context.js";
import type { HostMenuAt, HostMenuItem, MenuReadying, MenuSection, MenuSectionSource, MenuTarget } from "./menu-types.js";

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

/** A host's own rows given around a face, the app's link as that face says it, and whether its addresses are the host's page's. */
interface HostItems {
  readonly items: readonly HostMenuItem[];
  readonly link?: (() => string) | undefined;
  readonly addresses?: boolean | undefined;
}
const HostItemsContext = createContext<HostItems>({ items: [] });

/** Rows by their ids, the first given of each kept: the same row handed twice (the provider's and a face's) is drawn once. */
function joined(outer: readonly HostMenuItem[], inner: readonly HostMenuItem[]): readonly HostMenuItem[] {
  const ids = new Set(outer.map((item) => item.id));
  const more = inner.filter((item) => !ids.has(item.id) && (ids.add(item.id), true));
  return more.length === 0 ? outer : [...outer, ...more];
}

/**
 * A HOST'S OWN ROWS OF THE CONTEXT MENU (`menuItems`, Roadmap
 * f-host-context-menu-items), for every menu drawn inside: the Shell's and
 * `PagesApp`'s, added to the provider's. A face gives `link`, the app's
 * own address as it routes, and `addresses={false}` where its paths are no
 * page of the host's (memory routing): a row is then handed no `href`.
 */
export function HostMenuItems({ items, link, addresses, children }: { readonly items?: readonly HostMenuItem[] | undefined; readonly link?: (() => string) | undefined; readonly addresses?: boolean | undefined; readonly children: ReactNode }) {
  const outer = useContext(HostItemsContext);
  const value = useMemo<HostItems>(() => ({ items: items ? joined(outer.items, items) : outer.items, link: link ?? outer.link, addresses: addresses ?? outer.addresses }), [outer, items, link, addresses]);
  return <HostItemsContext.Provider value={value}>{children}</HostItemsContext.Provider>;
}

/** The app's link where neither a face nor the provider said it: this page's address, without what the scene keeps after `#`. */
const pageLink = (): string => (typeof location === "undefined" ? "" : `${location.origin}${location.pathname}${location.search}`);

/** An address made whole against this page. */
function whole(href: string): string {
  try {
    return new URL(href, typeof location === "undefined" ? "http://localhost/" : location.href).href;
  } catch {
    return href;
  }
}

/** Every source here: the faces', then the host's sections, then the host's own rows. The same source given twice — a face's and a host's — is drawn once. */
function useSources(): readonly MenuSectionSource[] {
  const faces = useContext(MenuSectionsContext);
  const provided = useGraviewIfAny();
  const host = provided?.menuSections;
  const store = provided?.store;
  const around = useContext(HostItemsContext);
  const providerItems = provided?.menuItems;
  const items = useMemo(() => (providerItems ? joined(providerItems, around.items) : around.items), [providerItems, around.items]);
  const link = around.link ?? provided?.menuLink;
  const addresses = around.addresses ?? true;
  const rows = useMemo<MenuSectionSource | null>(
    () =>
      items.length === 0
        ? null
        : (target) => {
            const on = target.on;
            const node = on === undefined ? undefined : store?.graph.getNode(on);
            const edge = node || on === undefined ? undefined : store?.graph.allEdges().find((one) => one.id === on);
            // A kind's card on the scene, or a group of one kind (a list's ground): the kind.
            const kinds = node ? [node.kind] : on !== undefined && !edge ? kindsOf(on) : [];
            const group = kinds.length === 1 ? kinds : target.about.length === 1 ? kindsOf(target.about[0]!) : [];
            const at: HostMenuAt = {
              face: target.face,
              ...(node ? { record: node.id } : {}),
              ...(edge ? { edge: edge.id } : {}),
              ...(group.length === 1 ? { kind: group[0]! } : {}),
              ...(target.place !== undefined ? { place: target.place } : {}),
              ...(target.href !== undefined && addresses ? { href: whole(target.href) } : {}),
              link: (link ?? pageLink)(),
            };
            const offered = items.filter((item) => {
              try {
                return item.offered?.(at) ?? true;
              } catch {
                // A host's row that throws deciding is left out, never the menu.
                return false;
              }
            });
            return offered.length === 0 ? null : { id: "host-items", at: "last", items: offered.map((item) => ({ id: item.id, label: item.label, ...(item.hint ? { hint: item.hint } : {}), run: () => item.run(at) })) };
          },
    [items, link, addresses, store],
  );
  return useMemo(() => {
    const sources = host ? [...faces, ...host.filter((source) => !faces.includes(source))] : faces;
    return rows ? [...sources, rows] : sources;
  }, [faces, host, rows]);
}

/**
 * GETTING EVERY SECTION READY FOR A TARGET (FR-186): what a face calls when
 * the pointer rests on a record, a card, a row or a kind, the keyboard
 * lands on one, or a finger goes down on one — each section's `prepare`.
 */
export function useMenuPrepare(): (target: MenuTarget, why?: MenuReadying) => void {
  const sources = useSources();
  return useCallback(
    (target: MenuTarget, why?: MenuReadying) => {
      for (const source of sources) {
        try {
          source(target)?.prepare?.(why);
        } catch {
          // A host's section that throws is left out, never the menu.
        }
      }
    },
    [sources],
  );
}

/** The sections every source here gives for a target, the ones before the acts first. */
export function useMenuSections(target: MenuTarget | null): { readonly start: readonly MenuSection[]; readonly end: readonly MenuSection[]; readonly last: readonly MenuSection[] } {
  const sources = useSources();
  if (target === null || sources.length === 0) return { start: [], end: [], last: [] };
  const sections = sources.flatMap((source) => {
    try {
      const section = source(target);
      return section && ((section.items?.length ?? 0) > 0 || section.render || section.mode) ? [section] : [];
    } catch {
      // A host's section that throws is left out, never the menu.
      return [];
    }
  });
  return { start: sections.filter((section) => section.at === "start"), end: sections.filter((section) => section.at !== "start" && section.at !== "last"), last: sections.filter((section) => section.at === "last") };
}

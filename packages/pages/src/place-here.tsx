import { labelOf, pluralLabel, sharesItsName, type AnySchema, type Place } from "@graview/core";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Link, useHref, useLocation } from "react-router-dom";
import { FaceControls, usePlaced, usePlacedOnTheFace } from "./face-placed.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { kindOfSlug, placePath, pluralSlug, recordPath, type PageRegistry, type PageSection } from "./registry.js";
import { eyebrow, KindMark, liveKinds, plain } from "./page-typography.js";

/*
 * WHERE YOU ARE (Roadmap gv-pages-where-am-i).
 *
 * A product face drawn over the derived pages sent people to
 * `/steps/consolidate`, and nothing on the page said "Plan › Steps ›
 * Consolidate", nor lit a tab: the app rebuilt a trail by matching
 * `pluralSlug` against the path and reading the record's label. The face
 * knows where it is, so it says so — as a value (`placeHere`, `usePlaceHere`)
 * for a design that draws its own shell, and as a line at the head of each
 * derived page (`PageTrail`).
 */

/** One step of the way to a page: what it is called and its address on this face. */
export interface PlaceStep {
  readonly label: string;
  /** Its address as a link carries it, the face's base joined on; none for a section that has no page. */
  readonly href?: string;
  /** Its address basename-relative, as a `<Link to>` or `navigate()` takes it; none where `href` is none. */
  readonly path?: string;
  /** The page itself: the trail's last step. */
  readonly current?: true;
}

/** Where the face is: what kind of page, of which kind and record, said in the app's words, and the way to it. */
export interface PlaceHere {
  /** The home, a kind's list, a record's page, a picture's page, or a page of the face's or the app's own (Find, the problems, a route). */
  readonly as: "home" | "list" | "record" | "place" | "page";
  /** The kind the page is about: the list's, the record's, the picture's. */
  readonly kind?: string;
  /** The record's id, on a record's page. */
  readonly id?: string;
  /** The page's own name: the record's label, the kind's plural, the picture's title. */
  readonly label: string;
  /** The section the kind's pages are in (`registry.section`), for a design's own tab. */
  readonly section?: string;
  /** The section, the list, the page, in that order: the page itself last, `current`. */
  readonly trail: readonly PlaceStep[];
}

/** The words of the pages the face draws that are not about a kind. */
const OWN_PAGES: Readonly<Record<string, string>> = {
  problems: "Problems",
  search: "Search",
  map: "Connections",
  places: "Pictures",
  "~draft": "A view drawn",
};

const decoded = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/**
 * WHERE A PATH ON THIS FACE IS, worked out from the declaration: for a bar
 * drawn outside the face's router, told the path by `steering` or
 * `onNavigate`. Inside the face, `usePlaceHere()` says the same of the page
 * drawn now. `base` is the face's basename, joined onto each `href`.
 */
export function placeHere<S extends AnySchema>(
  context: PageContext<S>,
  path: string,
  options: { readonly registry?: Pick<PageRegistry<S, unknown>, "sectionOf"> | undefined; readonly base?: string | undefined } = {},
): PlaceHere {
  const { store } = context;
  const schema = store.schema;
  const base = (options.base ?? "").replace(/\/$/, "");
  const [pathname = "/", search = ""] = path.split("#")[0]!.split("?");
  const step = (label: string, to: string, current?: true): PlaceStep => ({ label, href: `${base}${to}`, path: to, ...(current ? { current } : {}) });
  const sectionStep = (kind: string): readonly PlaceStep[] => {
    const section: PageSection | undefined = options.registry?.sectionOf(kind);
    if (!section) return [];
    return [section.path === undefined ? { label: section.label } : step(section.label, section.path)];
  };
  const sectionOf = (kind: string) => options.registry?.sectionOf(kind)?.label;
  const said = (kind: string) => {
    const section = sectionOf(kind);
    return section === undefined ? {} : { section };
  };
  const [first, second, ...more] = pathname.split("/").filter(Boolean).map(decoded);
  if (first === undefined) return { as: "home", label: "Home", trail: [step("Home", "/", true)] };
  // A picture: `/places/<as>`, `?of=<plural>` where two pictures share the name.
  if (first === "places" && second !== undefined && more.length === 0) {
    const of = new URLSearchParams(search).get("of");
    const live = new Set(liveKinds(store, context.principal));
    const all: readonly Place[] = context.views?.places() ?? [];
    const place = all.find((candidate) => live.has(candidate.kind) && candidate.as === second && (!of || pluralSlug(schema, candidate.kind) === of));
    if (place) {
      const to = placePath(place.as, sharesItsName(place, all) ? pluralSlug(schema, place.kind) : undefined);
      return { as: "place", kind: place.kind, label: place.title, ...said(place.kind), trail: [...sectionStep(place.kind), step(place.title, to, true)] };
    }
  }
  const kind = more.length === 0 ? kindOfSlug(schema, first) : undefined;
  if (kind !== undefined) {
    const list = step(pluralLabel(schema, kind), `/${pluralSlug(schema, kind)}`);
    if (second === undefined) return { as: "list", kind, label: list.label, ...said(kind), trail: [...sectionStep(kind), { ...list, current: true }] };
    const node = store.graph.getNode(second);
    // A record this seat cannot see, or that is gone, is named as its page names it: no id said to a person.
    const label = node && node.kind === kind ? labelOf(schema.tryDefinition(kind), node as never) : "Nothing lives here";
    return { as: "record", kind, id: second, label, ...said(kind), trail: [...sectionStep(kind), list, step(label, recordPath(schema, kind, second), true)] };
  }
  // A page of the face's own, or of the app's: said by its name, else by the last of its words.
  const words = OWN_PAGES[first] ?? capitalized((more.at(-1) ?? second ?? first).replace(/[-_]+/g, " "));
  return { as: "page", label: words, trail: [step(words, pathname, true)] };
}

const capitalized = (words: string): string => words.charAt(0).toUpperCase() + words.slice(1);

/** What the face hands what is drawn inside it, for `usePlaceHere`: the context its pages read and the registry that names the sections. */
export interface PlaceHereRoot {
  readonly context: PageContext<AnySchema>;
  readonly registry: PageRegistry<AnySchema, unknown> | undefined;
}
export const PlaceHereContext = createContext<PlaceHereRoot | null>(null);

/**
 * WHERE THE FACE IS NOW, for a design that draws its own shell: what kind
 * of page, of which kind, its record, its name, the section it is in, and
 * the trail to it with each step's address under the face's base. Inside
 * `PagesApp` (a registered shell, page or route); a bar outside the face's
 * router reads `placeHere(context, path)` with the path it was told.
 */
export function usePlaceHere(): PlaceHere {
  const root = useContext(PlaceHereContext);
  if (!root) throw new Error("usePlaceHere() is for what PagesApp draws: a registered shell, page or route. Outside it, placeHere(context, path) says the same of a path.");
  return usePlaceIn(root);
}

function usePlaceIn(root: PlaceHereRoot): PlaceHere {
  const location = useLocation();
  const base = useHref("/");
  // A record renamed renames the trail.
  useStoreTick(root.context.store);
  return placeHere(root.context, `${location.pathname}${location.search}`, { registry: root.registry, base });
}

/** Out of sight and still said: the page's own name, which its heading says under the trail. */
const unseen: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};

const step: CSSProperties = { display: "flex", alignItems: "center", gap: 6, minWidth: 0 };
const words: CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, lineHeight: "24px" };

/**
 * THE TRAIL: a nav the reader is told is "You are here", each step on the
 * way a link, the page itself last and `aria-current="page"` — said to a
 * screen reader and kept out of sight, since the page's heading says it
 * right under the trail. One line, at a phone's width too: a long step is
 * cut short, never wrapped onto a second.
 *
 * Placed by a shell of the app's own, it is THE face's trail, and the
 * derived pages draw none at their heads. A shell that draws its own from
 * `usePlaceHere()` says `{ without: ["trail"] }`.
 */
export function PageTrail({ style, ...rest }: { readonly style?: CSSProperties } & Record<`data-${string}`, string>) {
  usePlacedOnTheFace("trail");
  const here = usePlaceHere();
  return <Trail here={here} {...(style ? { style } : {})} {...rest} />;
}

/** A derived page's trail, at its head: unless the shell placed one, went without, or there is nothing before the page to say. */
export function HeadTrail<S extends AnySchema>({ context, style }: { readonly context: PageContext<S>; readonly style?: CSSProperties }) {
  const root = useContext(PlaceHereContext);
  const placed = useContext(FaceControls);
  const shellHasOne = usePlaced(placed ?? NOWHERE, "trail");
  if (shellHasOne || root?.registry?.without().has("trail")) return null;
  // A page drawn outside the face's routes still says the way to it, with no sections.
  return <HeadTrailDrawn root={root ?? { context: context as unknown as PageContext<AnySchema>, registry: undefined }} context={context} {...(style ? { style } : {})} />;
}

function HeadTrailDrawn<S extends AnySchema>({ root, context, style }: { readonly root: PlaceHereRoot; readonly context: PageContext<S>; readonly style?: CSSProperties }) {
  const here = usePlaceIn(root);
  // Only the page itself: its heading says it, and a trail of one step says nothing more.
  if (here.trail.length < 2) return null;
  return <Trail here={here} mark={here.as === "record" ? { kind: here.kind!, context } : undefined} {...(style ? { style } : {})} data-testid="page-trail" />;
}

const NOWHERE = { count: () => 0, place: () => () => {}, subscribe: () => () => {} };

function Trail<S extends AnySchema>({
  here,
  mark,
  style,
  ...rest
}: { readonly here: PlaceHere; readonly mark?: { readonly kind: string; readonly context: PageContext<S> } | undefined; readonly style?: CSSProperties } & Record<`data-${string}`, string>): ReactNode {
  const listIndex = here.as === "record" ? here.trail.length - 2 : -1;
  return (
    <nav aria-label="You are here" data-graview-trail="" style={{ minWidth: 0, ...style }} {...rest}>
      <ol style={{ ...eyebrow, listStyle: "none", padding: 0, display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
        {here.trail.map((at, index) => (
          <li key={`${index}:${at.label}`} style={at.current ? unseen : { ...step, flexShrink: index === here.trail.length - 2 ? 0 : 1, maxWidth: "100%" }} {...(at.current ? { "aria-current": "page" as const } : {})}>
            {/* The way between steps, said by the list itself: a screen reader hears "list, 3 items", not the arrows. */}
            {index > 0 && !at.current ? <span aria-hidden="true">›</span> : null}
            {at.current ? (
              at.label
            ) : at.path !== undefined ? (
              <Link to={at.path} style={{ ...plain, ...step }} {...(index === listIndex ? { "data-testid": "trail-list" } : {})}>
                {index === listIndex && mark ? <KindMark kind={mark.kind} brand={mark.context.brand} schema={mark.context.store.schema} size={8} /> : null}
                <span style={words}>{at.label}</span>
              </Link>
            ) : (
              <span style={words}>{at.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

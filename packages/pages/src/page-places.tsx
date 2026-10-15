import { counted, isCurrent, labelOf, onePerPicture, placeLabel, sharesItsName, type AnySchema, type Store, type Place } from "@graview/core";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { kindFacts } from "./facts.js";
import { ViewBoundary } from "@graview/react/drawing";
import { isDefaultView, type ViewProps } from "@graview/react/provider";
import { arrange, parseArrangement } from "@graview/core/arrange";
import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { DerivedForm } from "./form.js";
import { placePath, pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import {
  DISPLAY,
  KindMark,
  eyebrow,
  h2,
  lede,
  link,
  arrangedKinds,
  homeKinds,
  liveKinds,
  plain,
  pluralOf,
  quiet,
  rule,
  wide,
} from "./page-typography.js";
import { PageMain, PageTitle } from "./page-shell.js";
import { SpecLinks } from "@graview/primitives/pages";


/** The app's pictures this seat may see: registered places whose kind is live here. */
export function placesOf<S extends AnySchema>(context: PageContext<S>): readonly Place[] {
  const views = context.views;
  if (!views) return [];
  const live = new Set(liveKinds(context.store, context.principal));
  return views.places().filter((place) => live.has(place.kind));
}

/** Every kind a picture is over that this seat sees: its own, or each kind of one picture over several. */
function kindsOfPlace<S extends AnySchema>(context: PageContext<S>, place: Place): readonly string[] {
  if (!place.over) return [place.kind];
  const live = new Set(liveKinds(context.store, context.principal));
  return place.over.filter((kind) => kind === place.kind || live.has(kind));
}

/*
 * TWO KINDS, ONE PICTURE'S NAME. Two different pictures called "The
 * timetable", one over talks and one over workshops, are two places the
 * scene tells apart by kind; a page address by name alone would send both
 * to the first. A name only one picture uses keeps its plain address — one
 * picture over both kinds among them — and a shared one says whose with
 * `?of=<plural>`.
 */
/** The key a place is drawn under: its kind and its name, since a name alone can be shared. */
export const placeKey = (place: Place): string => `place:${place.kind}:${place.as}`;

/** A place's page address, saying whose it is only when another kind shares the name. */
export function pathOfPlace<S extends AnySchema>(context: PageContext<S>, place: Place): string {
  return placePath(place.as, sharesItsName(place, context.views?.places() ?? []) ? pluralSlug(context.store.schema, place.kind) : undefined);
}

function membersOf<S extends AnySchema>(store: Store<S>, kind: string) {
  const definition = store.schema.tryDefinition(kind);
  return store.graph.nodesOfKind(kind).filter((node) => isCurrent(definition, node));
}

/** "2 plots", "12 plantings across 4 plots", "200 talks and 40 workshops" — how much a picture is over, in the schema's plurals. */
function overOf<S extends AnySchema>(store: Store<S>, kinds: string | readonly string[], across?: string): string {
  const count = (n: number, of: string) => counted(store.schema, of, n);
  const held = (typeof kinds === "string" ? [kinds] : kinds).map((kind) => count(membersOf(store, kind).length, kind)).join(" and ");
  return across ? `${held} across ${count(membersOf(store, across).length, across)}` : held;
}

/*
 * THE LENS ITSELF, ON A PAGE. The same component the scene descends into,
 * over the kind's current members, in fullscreen mode — the mode a view
 * must already render correctly in, since jacking out of the scene is a
 * promise every lens makes. Nothing here is a copy of a lens: it is the
 * lens.
 */
function LensOnPage<S extends AnySchema>({ context, place, chosen, filter }: { context: PageContext<S>; place: Place; chosen?: readonly string[]; filter?: string | null }) {
  const { store, views, invariantContext } = context;
  const registration = views?.resolve(place.kind, { cardinality: "many", fidelity: "full" }, place.as);
  const View = registration?.view as ComponentType<ViewProps<S>> | undefined;
  const flagged = [...new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds))];
  // A picture over several kinds is handed every one of them: the page is the whole picture, not one district's share.
  const all = kindsOfPlace(context, place).flatMap((kind) => membersOf(store, kind));
  if (!View) return null;
  const members = narrowed(store, all, filter, flagged);
  /*
   * A LENS THAT THROWS SAYS SO IN ITS OWN PLACE, here as in the scene: the
   * host's views reach the pages (FR-35), so a view that cannot draw would
   * otherwise take the whole face down with it (FR-24).
   */
  return (
    <ViewBoundary kind={place.kind} view={place.title}>
      <View
        nodes={members}
        label={place.title}
        fidelity="full"
        cardinality="many"
        mode="fullscreen"
        selected={false}
        {...(chosen && chosen.length > 0 ? { implicated: chosen } : {})}
        {...(flagged.length > 0 ? { flagged } : {})}
      />
    </ViewBoundary>
  );
}

/**
 * A PICTURE NARROWED BY ITS ADDRESS (`?filter=stage:building`): the members
 * the filter keeps, in the words a list's arranging line writes, judged by
 * the same arranging the list page does (this face's chunk carries it
 * already). Every member when no filter is asked.
 */
function narrowed<S extends AnySchema, N extends { readonly id: string; readonly kind: string }>(store: Store<S>, members: readonly N[], filter: string | null | undefined, flagged: readonly string[]): readonly N[] {
  const conditions = filter ? (parseArrangement({ filter }).filter ?? []) : [];
  if (conditions.length === 0) return members;
  return arrange(members as never, { filter: conditions }, { schema: store.schema, graph: store.graph as never, flagged: new Set(flagged) }).nodes as unknown as readonly N[];
}

/**
 * ONE NAMED PICTURE, AND NOTHING ELSE: the lens registered under `as`, at
 * full size, over the kind's current members — for a host that wants the
 * picture without the app around it. The embed's picture face is this; a
 * page of the app's own may use it the same way.
 */
export function PlacePicture<S extends AnySchema>({
  store,
  views,
  as,
  invariantContext,
}: {
  readonly store: Store<S>;
  readonly views: NonNullable<PageContext<S>["views"]>;
  readonly as: string;
  readonly invariantContext?: PageContext<S>["invariantContext"];
}) {
  useStoreTick(store);
  const context: PageContext<S> = { store, views, ...(invariantContext ? { invariantContext } : {}) };
  const place = views.places().find((candidate) => candidate.as === as);
  if (!place) return null;
  return <LensOnPage context={context} place={place} />;
}

/*
 * A KIND WITH NO PICTURE OF ITS OWN, DRAWN ANYWAY.
 *
 * `registerDefaultViews` titles nothing, so a new app has no places — and
 * until the gallery, no pictures on its pages at all. A group view the app
 * wrote for the kind (untitled, so not a place) is the picture; the
 * framework's own group view is a panel of six chips in the corner of a
 * frame, so the card draws a CONTACT SHEET instead: each member at summary
 * fidelity — the same card the scene stands in the district — laid out in
 * rows. Given no registry whatsoever the members are named as chips, so the
 * card is still a picture of what is there rather than a blank.
 */
function KindOnPage<S extends AnySchema>({ context, kind }: { context: PageContext<S>; kind: string }) {
  const { store, views, invariantContext } = context;
  const members = membersOf(store, kind);
  const definition = store.schema.tryDefinition(kind);
  const plural = pluralOf(store, kind);
  const group = views?.resolve(kind, { cardinality: "many", fidelity: "full" });
  const Group = group?.view as ComponentType<ViewProps<S>> | undefined;
  const flagged = [...new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds))];
  if (Group && !isDefaultView(Group)) {
    return (
      <ViewBoundary kind={kind}>
        <Group nodes={members} label={plural} fidelity="full" cardinality="many" mode="fullscreen" selected={false} {...(flagged.length > 0 ? { flagged } : {})} />
      </ViewBoundary>
    );
  }
  const Summary = views?.resolve(kind, { cardinality: "one", fidelity: "summary" })?.view as ComponentType<ViewProps<S>> | undefined;
  const SHEET = 8;
  const shown = members.slice(0, SHEET);
  return (
    <div
      data-testid="kind-sheet"
      style={
        Summary
          ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gridAutoRows: "max-content", alignContent: "center", gap: 12, padding: 24 }
          : { display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 10, padding: 24 }
      }
    >
      {shown.map((node) =>
        Summary ? (
          <Summary
            key={node.id}
            node={node}
            fidelity="summary"
            cardinality="one"
            mode="fullscreen"
            selected={false}
            {...(flagged.includes(node.id) ? { flagged: [node.id] } : {})}
          />
        ) : (
          <span
            key={node.id}
            style={{
              padding: "8px 14px",
              // A record is a card (FR-117).
              borderRadius: 8,
              border: "1px solid var(--graview-edge-bright)",
              background: "var(--graview-ground)",
              color: "var(--graview-ink)",
            }}
          >
            {labelOf(definition, node)}
          </span>
        ),
      )}
      {members.length > SHEET ? (
        <span style={{ ...quiet, alignSelf: "center", padding: "0 6px" }}>
          +{members.length - SHEET} more {plural.toLowerCase()}
        </span>
      ) : null}
    </div>
  );
}

/**
 * ONE ENTRY OF THE GALLERY: a titled place, or a kind drawn by its default
 * picture. The places come first — they are the app's own ways of looking —
 * and a kind appears only when nothing was titled over it, so naming a lens
 * replaces the kind's card rather than adding to it.
 */
export interface GalleryEntry {
  readonly key: string;
  readonly kind: string;
  readonly title: string;
  readonly to: string;
  readonly place?: Place;
}

export function galleryOf<S extends AnySchema>(context: PageContext<S>): readonly GalleryEntry[] {
  const { store } = context;
  /*
   * IN THE DECLARATION'S ORDER (FR-80): the pictures by their kind's place
   * in `pages.order`, then a card for every kind with none — less the kinds
   * `pages.hide` leaves off the home, which keep their lists and links.
   */
  const order = arrangedKinds(context);
  const all = placesOf(context);
  // Each picture once: one over several kinds is one card, under the first of them in the declaration's order. A lens kept off the lists is a link's to reach, not the gallery's.
  const places = onePerPicture([...all].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))).filter((place) => !place.hidden);
  const pictured = new Set(places.flatMap((place) => place.over ?? [place.kind]));
  return [
    ...places.map((place) => ({ key: placeKey(place), kind: place.kind, title: placeLabel(place, all, store.schema), to: pathOfPlace(context, place), place })),
    ...homeKinds(context)
      .filter((kind) => !pictured.has(kind))
      .map((kind) => ({ key: `kind:${kind}`, kind, title: pluralOf(store, kind), to: `/${pluralSlug(store.schema, kind)}` })),
  ];
}

/**
 * The scale a picture is drawn at inside its card. The frame's width is
 * measured and the lens is laid out WIDER than the card by this factor, so
 * its type lands near ten pixels whether the card is 560 wide on a desk or
 * 358 on a phone — the same legibility at every width, rather than a fixed
 * natural width that was readable in one column and mush in the other.
 */
const PICTURE_SCALE = 0.72;
/** A frame's width before anything has measured it: about half of a desk's two-across gallery. */
const PICTURE_WIDTH_UNMEASURED = 540;
const PICTURE_ASPECT = 16 / 10;

function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const measured = element.getBoundingClientRect().width;
      if (measured > 0) setWidth((was) => (Math.abs(was - measured) < 0.5 ? was : measured));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
  return { ref, width };
}

/**
 * A CARD OF THE GALLERY: the picture drawn live and inert — nothing in it is
 * a second control — with its name and how much it is over. The whole card
 * is the way to the picture's page. A picture with nothing in it says so and
 * names the act that would begin it, rather than showing a blank frame.
 */
export function GalleryCard<S extends AnySchema>({ context, entry }: { context: PageContext<S>; entry: GalleryEntry }) {
  const { store, brand, principal } = context;
  const { ref, width } = useMeasuredWidth(PICTURE_WIDTH_UNMEASURED);
  const natural = width / PICTURE_SCALE;
  const members = membersOf(store, entry.kind);
  const definition = store.schema.tryDefinition(entry.kind);
  const beginning =
    members.length === 0
      ? kindFacts(store, entry.kind, {
          ...(principal ? { principal } : {}),
          ...(context.invariantContext ? { context: context.invariantContext } : {}),
        }).actions.affordances[0]
      : undefined;
  const isPlace = entry.place !== undefined;
  return (
    <Link
      to={entry.to}
      data-testid={isPlace ? "place-card" : "kind-card"}
      className="graview-gallery-card"
      style={{ ...plain, display: "grid", gap: 10, alignContent: "start", minWidth: 0 }}
    >
      <span
        ref={ref}
        data-testid={isPlace ? "place-picture" : "kind-picture"}
        aria-hidden="true"
        inert
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          aspectRatio: `${PICTURE_ASPECT}`,
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid var(--graview-edge)",
          background: "var(--graview-panel)",
          pointerEvents: "none",
        }}
      >
        {/* A lens fills what it is given, so it is given the whole frame at natural size, stretched by a one-row grid, and scaled down to the card. */}
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: natural,
            height: natural / PICTURE_ASPECT,
            display: "grid",
            gridTemplateRows: "minmax(0, 1fr)",
            transform: `scale(${PICTURE_SCALE})`,
            transformOrigin: "0 0",
          }}
        >
          {/*
            * A PICTURE IN A LINK LINKS NOWHERE ITSELF (the ninth walk, W-200): the
            * card is the link, so the records a lens draws in it are not, or a
            * board's cards nested an <a> in this one — markup a browser's parser
            * takes apart, and React says so on every visit to the home.
            */}
          <SpecLinks.Provider value={null}>
            {entry.place ? <LensOnPage context={context} place={entry.place} /> : <KindOnPage context={context} kind={entry.kind} />}
          </SpecLinks.Provider>
        </span>
        {members.length === 0 ? (
          <span
            data-testid="picture-empty"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeContent: "center",
              justifyItems: "center",
              gap: 2,
              padding: 20,
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "grid",
                gap: 2,
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid var(--graview-edge)",
                background: "var(--graview-ground)",
                color: "var(--graview-ink)",
              }}
            >
              <span style={{ fontFamily: DISPLAY, fontWeight: "var(--graview-weight-display)" }}>No {pluralOf(store, entry.kind).toLowerCase()} yet</span>
              {beginning ? <span style={quiet}>Begin with “{beginning.label}”</span> : null}
            </span>
          </span>
        ) : null}
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {isPlace ? null : <KindMark kind={entry.kind} brand={brand} schema={store.schema} size={8} />}
          <span style={{ fontFamily: DISPLAY, fontSize: "var(--graview-text-heading)", fontWeight: "var(--graview-weight-display)", lineHeight: 1.3, overflowWrap: "anywhere", textWrap: "balance" }}>{entry.title}</span>
        </span>
        <span style={quiet}>
          {entry.place ? overOf(store, kindsOfPlace(context, entry.place), entry.place.across) : overOf(store, entry.kind)}
          {!isPlace && definition?.description ? ` · ${definition.description}` : null}
        </span>
      </span>
    </Link>
  );
}

/** A place as a card — the gallery's card, over one titled picture. */
export function PlaceCard<S extends AnySchema>({ context, place }: { context: PageContext<S>; place: Place }) {
  return <GalleryCard context={context} entry={{ key: placeKey(place), kind: place.kind, title: place.title, to: pathOfPlace(context, place), place }} />;
}

export const cards: React.CSSProperties = {
  display: "grid",
  gap: "32px 28px",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(420px, 100%), 1fr))",
};

/*
 * A card's frame answers the hand: its edge brightens under the pointer and
 * under focus. A stylesheet rather than state, because a hundred cards
 * should not each hold a hover flag, and because a focus ring drawn by the
 * browser on a whole card is the right ring.
 */
const GALLERY_CSS = `
.graview-gallery-card > span:first-child { transition: border-color 160ms ease, box-shadow 160ms ease; }
.graview-gallery-card:hover > span:first-child,
.graview-gallery-card:focus-visible > span:first-child { border-color: var(--graview-edge-bright); box-shadow: 0 1px 0 var(--graview-edge), 0 10px 30px -18px var(--graview-ink); }
`;

/**
 * THE GALLERY: every picture the app has, large and live, and a card for
 * every kind that has none — so no installation lands on an empty page,
 * and the pictures are the biggest thing on it.
 */
export function Gallery<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  useStoreTick(context.store);
  const entries = galleryOf(context);
  if (entries.length === 0) return null;
  return (
    <section style={cards} data-testid="gallery">
      <style>{GALLERY_CSS}</style>
      {entries.map((entry) => (
        <GalleryCard key={entry.key} context={context} entry={entry} />
      ))}
    </section>
  );
}

/**
 * THE INDEX OF PICTURES, at its own address: the same gallery the home
 * lands on, for a link that means "the pictures" and nothing else.
 */
export function DefaultPlacesPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store } = context;
  useStoreTick(store);
  const places = onePerPicture(placesOf(context)).filter((place) => !place.hidden);
  const entries = galleryOf(context);
  return (
    <PageMain context={context} style={wide}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{places.length === 0 ? "None of its own yet" : `${places.length} ${places.length === 1 ? "picture" : "pictures"}`}</p>
        <PageTitle context={context}>Pictures</PageTitle>
        <p style={lede}>
          {places.length === 0
            ? "Nothing here has a picture of its own yet, so each kind is drawn as the scene draws it. Title a group view and it appears here by name."
            : "The ways this installation looks at what it holds — each one the same picture the scene shows, here as a page."}
        </p>
      </header>
      {entries.length > 0 ? (
        <div style={cards} data-testid="places">
          {entries.map((entry) => (
            <GalleryCard key={entry.key} context={context} entry={entry} />
          ))}
        </div>
      ) : null}
    </PageMain>
  );
}

/**
 * ONE PICTURE, FULL WIDTH: the lens over the kind's current members, what
 * it is a picture of, the way to its kind as a list, and the acts that
 * begin the kind beneath it. The other places are the bar's (FR-138). A pick inside it travels to the record — on a page, choosing a
 * thing means going to it.
 */
export function DefaultPlacePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, principal } = context;
  useStoreTick(store);
  const params = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const asked = decodeURIComponent(params["as"] ?? "");
  /* A crossing chosen on the picture, by what it joins (FR-111): the picture lights it and draws to its ends. */
  const [chosen, choose] = useState<{ readonly at: string; readonly ids: readonly string[] } | null>(null);
  const of = search.get("of");
  // Narrowed by its address (`?filter=stage:building`), as a list is: what a link or a view's navigate asked for.
  const narrowedTo = search.get("filter");
  const places = placesOf(context);
  const place = places.find((candidate) => candidate.as === asked && (!of || pluralSlug(store.schema, candidate.kind) === of));
  if (!place) {
    return (
      <PageMain context={context}>
        <PageTitle context={context}>No picture is called that.</PageTitle>
        <p style={lede}>
          <Link to="/places" style={link}>
            The pictures there are <span aria-hidden="true">→</span>
          </Link>
        </p>
      </PageMain>
    );
  }
  const plural = pluralOf(store, place.kind);
  /*
   * A PLACE OF WORDS AND CARDS FLOWS WITH THE PAGE. A picture — a board, a
   * calendar — fills a frame most of the window tall and scrolls inside it;
   * a place drawn from blocks is a column of headings and cards, and in that
   * frame a list of cards became a box of its own to scroll, under the
   * page's own scroll. It is drawn in the page's column, as long as it is.
   */
  const drawnBy = context.views?.resolve(place.kind, { cardinality: "many", fidelity: "full" }, place.as)?.view as { flows?: boolean; creates?: boolean } | undefined;
  const flows = drawnBy?.flows === true;
  /*
   * A PLACE THAT IS READ, NOT WRITTEN. Every place ended with the forms
   * that begin its kind; on a summary or a report that is a form nobody
   * came for. A lens declared `"create": false` leaves them off — the
   * kind's list and the bar still offer them.
   */
  const creates = drawnBy?.creates !== false;
  const facts = kindFacts(store, place.kind, {
    ...(principal ? { principal } : {}),
    ...(context.invariantContext ? { context: context.invariantContext } : {}),
  });
  const creators = !creates ? [] : facts.actions.affordances
    .map((affordance) => ({ affordance, mutation: store.allMutations().find((m) => m.name === affordance.mutation) }))
    .filter((entry): entry is { affordance: typeof entry.affordance; mutation: NonNullable<typeof entry.mutation> } => entry.mutation !== undefined);
  return (
    <PageMain context={context} style={wide}>
      {/*
        * No eyebrow over the title: "A PICTURE OF TASKS" said what the title
        * and the line under it say, and linked where "All tasks as a list"
        * links two lines down.
        */}
      <header style={{ display: "grid", gap: 12 }}>
        <PageTitle context={context}>{place.title}</PageTitle>
        {/*
          * WHAT THE PICTURE IS, NOT WHAT ONE OF ITS MEMBERS IS: how much is
          * in it, and — over two kinds — what it is across. The kind's own
          * description is in the singular, about a member, and leads the
          * kind's list page where it reads correctly.
          */}
        <p style={lede} data-testid="place-lede">
          {overOf(store, kindsOfPlace(context, place), place.across)}.
        </p>
        {/* A picture drawn from blocks lists what its blocks say (their own `where`), so it is not said to be narrowed. */}
        {narrowedTo && !flows ? (
          <p style={{ ...quiet, margin: 0 }} data-testid="place-narrowed">
            {`Only those where ${narrowedTo
              .split(",")
              .map((condition) => condition.replace(":", " is "))
              .join(" and ")}. `}
            <Link to={`?${(() => {
              const rest = new URLSearchParams(search);
              rest.delete("filter");
              return rest.toString();
            })()}`} style={{ ...link, ...quiet }}>
              Show all
            </Link>
          </p>
        ) : null}
        {/* What belongs to the picture alone: its kind as a list. The other places are the bar's (FR-138). */}
        <p style={{ ...quiet, margin: 0, display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
          {kindsOfPlace(context, place).map((kind, index) => (
            <Link key={kind} to={`/${pluralSlug(store.schema, kind)}`} style={{ ...link, ...quiet }} {...(index === 0 ? { "data-testid": "place-as-list" } : {})}>
              All {(kind === place.kind ? plural : pluralOf(store, kind)).toLowerCase()} as a list <span aria-hidden="true">→</span>
            </Link>
          ))}
        </p>
      </header>
      {/*
        * The lens's own region: as wide as the column and most of the window
        * tall — a lens fills what it is given, and given nothing it is a
        * header — scrolling inside itself when the picture is bigger, never
        * the document. A one-row grid is what stretches the lens to it.
        */}
      <div
        data-testid="place-lens"
        data-flows={flows ? "" : undefined}
        style={
          flows
            ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "100%" }
            : {
                height: "min(72vh, 760px)",
                display: "grid",
                gridTemplateRows: "minmax(0, 1fr)",
                overflow: "auto",
                maxWidth: "100%",
                borderRadius: 12,
                border: "1px solid var(--graview-edge)",
                background: "var(--graview-panel)",
              }
        }
        onClick={(event) => {
          const picked = (event.target as HTMLElement | null)?.closest("[data-graview-pick]");
          const id = picked?.getAttribute("data-graview-pick");
          /*
           * A MARK OF A RELATION IS CHOSEN WHERE IT IS (FR-111). A coverage
           * cell is the crossing of two records, not a page of either: it
           * went to the column's page, so Ryan × SEO opened SEO. It stays,
           * lit with its row and its column; their names go to their pages.
           */
          const joins = picked?.getAttribute("data-graview-joins");
          if (joins) {
            try {
              const ids: unknown = JSON.parse(joins);
              if (Array.isArray(ids) && ids.every((one) => typeof one === "string")) {
                event.preventDefault();
                choose({ at: placeKey(place), ids });
                return;
              }
            } catch {
              // Not a list of ids: the mark is a plain pick.
            }
          }
          if (!id) return;
          const node = store.graph.getNode(id);
          if (!node) return;
          event.preventDefault();
          navigate(recordPath(store.schema, node.kind, id));
        }}
      >
        <LensOnPage context={context} place={place} filter={narrowedTo} {...(chosen?.at === placeKey(place) ? { chosen: chosen.ids } : {})} />
      </div>
      {/* The acts, at a reading width: a form as wide as a gallery is a form nobody can scan. */}
      {creators.length > 0 ? (
        <div style={{ maxWidth: 760, display: "grid", gap: 40 }} data-testid="place-creators">
          {creators.map(({ affordance, mutation }) => (
            <section key={affordance.id} style={{ ...rule, display: "grid", gap: 14 }}>
              <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
              {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
              <DerivedForm store={store} mutation={mutation} prefilled={affordance.args} open={affordance.open} label={affordance.label} {...(principal ? { principal } : {})} />
            </section>
          ))}
        </div>
      ) : null}
    </PageMain>
  );
}

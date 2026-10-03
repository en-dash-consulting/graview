import { counted, isCurrent, labelOf, type AnySchema, type Store, type Place } from "@graview/core";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { kindFacts } from "./facts.js";
import { isDefaultView, ViewBoundary, type ViewProps } from "@graview/react";
import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { DerivedForm } from "./form.js";
import { placeHref, placePath, pluralSlug, recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import {
  DISPLAY,
  KindMark,
  eyebrow,
  h1,
  h2,
  lede,
  link,
  liveKinds,
  plain,
  pluralOf,
  quiet,
  rule,
  wide,
} from "./page-typography.js";
import { PageMain } from "./page-shell.js";


/** The app's pictures this seat may see: registered places whose kind is live here. */
export function placesOf<S extends AnySchema>(context: PageContext<S>): readonly Place[] {
  const views = context.views;
  if (!views) return [];
  const live = new Set(liveKinds(context.store, context.principal));
  return views.places().filter((place) => live.has(place.kind));
}

/*
 * TWO KINDS, ONE PICTURE'S NAME. "The timetable" over talks and over
 * workshops are two places the scene tells apart by kind; a page address
 * by name alone would send both to the first. A name only one kind uses
 * keeps its plain address; a shared one says whose with `?of=<plural>`.
 */
/** The key a place is drawn under: its kind and its name, since a name alone can be shared. */
export const placeKey = (place: Place): string => `place:${place.kind}:${place.as}`;

/** A place's page address, saying whose it is only when another kind shares the name. */
export function pathOfPlace<S extends AnySchema>(context: PageContext<S>, place: Place): string {
  const shared = (context.views?.places() ?? []).some((other) => other.as === place.as && other.kind !== place.kind);
  return placePath(place.as, shared ? pluralSlug(context.store.schema, place.kind) : undefined);
}

function membersOf<S extends AnySchema>(store: Store<S>, kind: string) {
  const definition = store.schema.tryDefinition(kind);
  return store.graph.nodesOfKind(kind).filter((node) => isCurrent(definition, node));
}

/** "a picture of Tasks", "a picture of Skills across People". */
function pictureOf<S extends AnySchema>(store: Store<S>, place: Place): string {
  const of = pluralOf(store, place.kind);
  return place.across ? `A picture of ${of.toLowerCase()} across ${pluralOf(store, place.across).toLowerCase()}` : `A picture of ${of.toLowerCase()}`;
}

/** "2 plots", "12 plantings across 4 plots" — how much a picture is over, in the schema's plurals. */
function overOf<S extends AnySchema>(store: Store<S>, kind: string, across?: string): string {
  const count = (n: number, of: string) => counted(store.schema, of, n);
  const held = count(membersOf(store, kind).length, kind);
  return across ? `${held} across ${count(membersOf(store, across).length, across)}` : held;
}

/*
 * THE LENS ITSELF, ON A PAGE. The same component the scene descends into,
 * over the kind's current members, in fullscreen mode — the mode a view
 * must already render correctly in, since jacking out of the scene is a
 * promise every lens makes. Nothing here is a copy of a lens: it is the
 * lens.
 */
function LensOnPage<S extends AnySchema>({ context, place }: { context: PageContext<S>; place: Place }) {
  const { store, views, invariantContext } = context;
  const registration = views?.resolve(place.kind, { cardinality: "many", fidelity: "full" }, place.as);
  const View = registration?.view as ComponentType<ViewProps<S>> | undefined;
  if (!View) return null;
  const members = membersOf(store, place.kind);
  const flagged = [...new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds))];
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
        {...(flagged.length > 0 ? { flagged } : {})}
      />
    </ViewBoundary>
  );
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
              fontSize: "1.0625rem",
              padding: "8px 14px",
              borderRadius: 999,
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
  const places = placesOf(context);
  const pictured = new Set(places.map((place) => place.kind));
  return [
    ...places.map((place) => ({ key: placeKey(place), kind: place.kind, title: place.title, to: pathOfPlace(context, place), place })),
    ...liveKinds(store, context.principal)
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
          {entry.place ? <LensOnPage context={context} place={entry.place} /> : <KindOnPage context={context} kind={entry.kind} />}
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
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: "1.0625rem" }}>No {pluralOf(store, entry.kind).toLowerCase()} yet</span>
              {beginning ? <span style={quiet}>Begin with “{beginning.label}”</span> : null}
            </span>
          </span>
        ) : null}
      </span>
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {isPlace ? null : <KindMark kind={entry.kind} brand={brand} schema={store.schema} size={8} />}
          <span style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" }}>{entry.title}</span>
        </span>
        <span style={quiet}>
          {entry.place ? overOf(store, entry.place.kind, entry.place.across) : overOf(store, entry.kind)}
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
  const places = placesOf(context);
  const entries = galleryOf(context);
  return (
    <PageMain context={context} style={wide}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{places.length === 0 ? "None of its own yet" : `${places.length} ${places.length === 1 ? "picture" : "pictures"}`}</p>
        <h1 style={h1}>Pictures</h1>
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
 * it is a picture of, its sibling pictures for the hop between them, the
 * acts that begin the kind beneath it, and the way to the same picture in
 * the scene. A pick inside it travels to the record — on a page, choosing a
 * thing means going to it.
 */
export function DefaultPlacePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, principal, sceneHref = "/" } = context;
  useStoreTick(store);
  const params = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const asked = decodeURIComponent(params["as"] ?? "");
  const of = search.get("of");
  const places = placesOf(context);
  const place = places.find((candidate) => candidate.as === asked && (!of || pluralSlug(store.schema, candidate.kind) === of));
  if (!place) {
    return (
      <PageMain context={context}>
        <h1 style={h1}>No picture is called that.</h1>
        <p style={lede}>
          <Link to="/places" style={link}>
            The pictures there are →
          </Link>
        </p>
      </PageMain>
    );
  }
  const plural = pluralOf(store, place.kind);
  const siblings = places.filter((other) => placeKey(other) !== placeKey(place));
  const facts = kindFacts(store, place.kind, {
    ...(principal ? { principal } : {}),
    ...(context.invariantContext ? { context: context.invariantContext } : {}),
  });
  const creators = facts.actions.affordances
    .map((affordance) => ({ affordance, mutation: store.allMutations().find((m) => m.name === affordance.mutation) }))
    .filter((entry): entry is { affordance: typeof entry.affordance; mutation: NonNullable<typeof entry.mutation> } => entry.mutation !== undefined);
  return (
    <PageMain context={context} style={wide}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={place.kind} brand={brand} schema={store.schema} size={8} />
          <Link to={`/${pluralSlug(store.schema, place.kind)}`} style={plain}>
            {pictureOf(store, place)}
          </Link>
        </p>
        <h1 style={h1}>{place.title}</h1>
        {/*
          * WHAT THE PICTURE IS, NOT WHAT ONE OF ITS MEMBERS IS: how much is
          * in it, and — over two kinds — what it is across. The kind's own
          * description is in the singular, about a member, and leads the
          * kind's list page where it reads correctly.
          */}
        <p style={lede} data-testid="place-lede">
          {overOf(store, place.kind, place.across)}.
        </p>
        <p style={{ ...quiet, margin: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 16px" }}>
          <a href={placeHref(place.as, sceneHref)} style={{ ...link, ...quiet }} data-testid="place-stop">
            See it in the scene ↗
          </a>
          <Link to={`/${pluralSlug(store.schema, place.kind)}`} style={{ ...link, ...quiet }}>
            All {plural.toLowerCase()} as a list →
          </Link>
        </p>
        {siblings.length > 0 ? (
          /* THE OTHER PICTURES, one press away: the gallery's hop, on the picture itself. */
          <nav aria-label="Other pictures" data-testid="sibling-pictures" style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
            {siblings.map((other) => (
              <Link
                key={placeKey(other)}
                to={pathOfPlace(context, other)}
                style={{
                  ...plain,
                  fontSize: "0.9375rem",
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--graview-edge-bright)",
                  color: "var(--graview-ink-muted)",
                }}
              >
                {other.title}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      {/*
        * The lens's own region: as wide as the column and most of the window
        * tall — a lens fills what it is given, and given nothing it is a
        * header — scrolling inside itself when the picture is bigger, never
        * the document. A one-row grid is what stretches the lens to it.
        */}
      <div
        data-testid="place-lens"
        style={{
          height: "min(72vh, 760px)",
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr)",
          overflow: "auto",
          maxWidth: "100%",
          borderRadius: 12,
          border: "1px solid var(--graview-edge)",
          background: "var(--graview-panel)",
        }}
        onClick={(event) => {
          const picked = (event.target as HTMLElement | null)?.closest("[data-graview-pick]");
          const id = picked?.getAttribute("data-graview-pick");
          if (!id) return;
          const node = store.graph.getNode(id);
          if (!node) return;
          event.preventDefault();
          navigate(recordPath(store.schema, node.kind, id));
        }}
      >
        <LensOnPage context={context} place={place} />
      </div>
      {/* The acts, at a reading width: a form as wide as a gallery is a form nobody can scan. */}
      <div style={{ maxWidth: 760, display: "grid", gap: 40 }}>
        {creators.map(({ affordance, mutation }) => (
          <section key={affordance.id} style={{ ...rule, display: "grid", gap: 14 }}>
            <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
            {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
            <DerivedForm store={store} mutation={mutation} prefilled={affordance.args} open={affordance.open} label={affordance.label} {...(principal ? { principal } : {})} />
          </section>
        ))}
      </div>
    </PageMain>
  );
}

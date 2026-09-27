import { isCurrent, type AnySchema, type Store, type Place } from "@graview/core";
import { Link, useNavigate, useParams } from "react-router-dom";
import { kindFacts } from "./facts.js";
import type { ViewProps } from "@graview/react";
import type { ComponentType } from "react";
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
} from "./page-typography.js";
import { PageMain } from "./page-shell.js";


/** The app's pictures this seat may see: registered places whose kind is live here. */
export function placesOf<S extends AnySchema>(context: PageContext<S>): readonly Place[] {
  const views = context.views;
  if (!views) return [];
  const live = new Set(liveKinds(context.store, context.principal));
  return views.places().filter((place) => live.has(place.kind));
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
  return (
    <View
      nodes={members}
      label={place.title}
      fidelity="full"
      cardinality="many"
      mode="fullscreen"
      selected={false}
      {...(flagged.length > 0 ? { flagged } : {})}
    />
  );
}

/** The natural width a lens is drawn at before it is scaled into a card, and the card's own width. */
const PICTURE_NATURAL = 960;
const PICTURE_WIDTH = 288;

/**
 * A PLACE AS A CARD: the lens drawn small and live — inert, so nothing in
 * it is a second control — with its name and what it is a picture of. The
 * same idea as the drive-in's board in the scene, in the page's idiom.
 */
export function PlaceCard<S extends AnySchema>({ context, place }: { context: PageContext<S>; place: Place }) {
  const { store } = context;
  const scale = PICTURE_WIDTH / PICTURE_NATURAL;
  return (
    <Link
      to={placePath(place.as)}
      data-testid="place-card"
      style={{ ...plain, display: "grid", gap: 8, width: PICTURE_WIDTH, maxWidth: "100%" }}
    >
      <span
        data-testid="place-picture"
        aria-hidden="true"
        inert
        style={{
          display: "block",
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 10",
          overflow: "hidden",
          borderRadius: 8,
          border: "1px solid var(--graview-edge)",
          background: "var(--graview-panel)",
          pointerEvents: "none",
        }}
      >
        {/* A lens fills what it is given, so it is given the whole frame: the card's aspect at natural size, stretched by a one-row grid. */}
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: PICTURE_NATURAL,
            height: (PICTURE_NATURAL * 10) / 16,
            display: "grid",
            gridTemplateRows: "minmax(0, 1fr)",
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <LensOnPage context={context} place={place} />
        </span>
      </span>
      <span style={{ display: "grid", gap: 1 }}>
        <span style={{ fontFamily: DISPLAY, fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.3 }}>{place.title}</span>
        <span style={quiet}>{pictureOf(store, place)}</span>
      </span>
    </Link>
  );
}

export const cards: React.CSSProperties = {
  display: "grid",
  gap: 20,
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${PICTURE_WIDTH}px, 100%), max-content))`,
};

/**
 * THE INDEX OF PICTURES: where a person lands among the app's own ways of
 * looking at what is here. A kind is a pile; a picture is a question about
 * it — the week, the month, who may do what — and a face that only had the
 * piles made the reader do the asking.
 */
export function DefaultPlacesPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store } = context;
  useStoreTick(store);
  const places = placesOf(context);
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{places.length === 0 ? "None yet" : `${places.length} ${places.length === 1 ? "picture" : "pictures"}`}</p>
        <h1 style={h1}>Pictures</h1>
        <p style={lede}>
          {places.length === 0
            ? "Nothing here has a picture of its own yet; the scene shows each kind as a district."
            : "The ways this installation looks at what it holds — each one the same picture the scene shows, here as a page."}
        </p>
      </header>
      {places.length > 0 ? (
        <div style={cards} data-testid="places">
          {places.map((place) => (
            <PlaceCard key={place.as} context={context} place={place} />
          ))}
        </div>
      ) : null}
    </PageMain>
  );
}

/**
 * ONE PICTURE, FULL WIDTH: the lens over the kind's current members, what
 * it is a picture of, the acts that begin the kind beneath it, and the way
 * to the same picture in the scene. A pick inside it travels to the record
 * — on a page, choosing a thing means going to it.
 */
export function DefaultPlacePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, principal, sceneHref = "/" } = context;
  useStoreTick(store);
  const params = useParams();
  const navigate = useNavigate();
  const asked = decodeURIComponent(params["as"] ?? "");
  const place = placesOf(context).find((candidate) => candidate.as === asked);
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
  /** How much this picture is over, in the plurals the schema declares. */
  const held = membersOf(store, place.kind).length;
  const alongside = place.across ? membersOf(store, place.across).length : 0;
  const count = (n: number, kind: string) =>
    `${n} ${n === 1 ? kind : pluralOf(store, kind).toLowerCase()}`;
  const over = place.across
    ? `${count(held, place.kind)} across ${count(alongside, place.across)}.`
    : `${count(held, place.kind)}.`;
  const facts = kindFacts(store, place.kind, {
    ...(principal ? { principal } : {}),
    ...(context.invariantContext ? { context: context.invariantContext } : {}),
  });
  const creators = facts.actions.affordances
    .map((affordance) => ({ affordance, mutation: store.allMutations().find((m) => m.name === affordance.mutation) }))
    .filter((entry): entry is { affordance: typeof entry.affordance; mutation: NonNullable<typeof entry.mutation> } => entry.mutation !== undefined);
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={place.kind} brand={brand} schema={store.schema} size={8} />
          <Link to={`/${pluralSlug(store.schema, place.kind)}`} style={plain}>
            {pictureOf(store, place)}
          </Link>
        </p>
        <h1 style={h1}>{place.title}</h1>
        {/*
          * WHAT THE PICTURE IS, NOT WHAT ONE OF ITS MEMBERS IS.
          *
          * This led with the KIND's description, and a kind is described in
          * the singular because a kind describes one of its members. So a
          * burn-down over every task read "What is left / One thing to do.",
          * a training week read "The week / One training session in the
          * week.", and a formation board read "The team / A place in the
          * formation, where it sits, and what it demands." Every one of them
          * a sentence about a member, standing under the name of a picture
          * of all of them.
          *
          * What is true of the picture is how much is in it, and — when it
          * is a picture over two kinds — what it is across. The kind's own
          * description is not lost: it still leads the kind's list page and
          * its records, where it is about one of them and reads correctly.
          */}
        <p style={lede} data-testid="place-lede">
          {over}
        </p>
        <a href={placeHref(place.as, sceneHref)} style={{ ...link, ...quiet }} data-testid="place-stop">
          See it in the scene ↗
        </a>
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
          borderRadius: 8,
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
      {creators.map(({ affordance, mutation }) => (
        <section key={affordance.id} style={{ ...rule, display: "grid", gap: 14 }}>
          <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
          {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
          <DerivedForm store={store} mutation={mutation} prefilled={affordance.args} open={affordance.open} {...(principal ? { principal } : {})} />
        </section>
      ))}
      <p style={quiet}>
        <Link to={`/${pluralSlug(store.schema, place.kind)}`} style={link}>
          All {plural.toLowerCase()} as a list →
        </Link>
      </p>
    </PageMain>
  );
}

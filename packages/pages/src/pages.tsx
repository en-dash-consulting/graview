import { KindFigure, LadderSetting, RelationMark, useMarkup } from "@graview/primitives";
import {
  describeNode,
  humaniseField,
  isCurrent,
  labelOf,
  readableFields,
  violationsTouching,
  type AnyNodeDefinition,
  type AnySchema,
  type Brand,
  type Operation,
  type Principal,
  type Repair,
  type Store,
  type Place,
  type PresenceChannel,
  type SettingDeclaration,
} from "@graview/core";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { kindFacts, kindMap, rankedRepairs, recordFacts, type KindRelation } from "./facts.js";
import type { ReactViewRegistry, ViewProps } from "@graview/react";
import type { ComponentType } from "react";
import { useGraviewIfAny } from "@graview/react";
import { DerivedForm } from "./form.js";
import { kindOfSlug, placeHref, placePath, pluralSlug, recordPath, spatialHref } from "./registry.js";

/**
 * The default pages: the product's own site, derived.
 *
 * Traditional on purpose — lists, records, links, forms, the paradigms
 * people already know — but in the POSTURE of a good web page rather than a
 * back office: every route opens with the thing itself, titled in the
 * brand's display face and summarised in the app's own declared words, and
 * the controls recede beneath the content. Nothing here is a template for
 * any one app. It is all read off the declaration, which is what lets one
 * component set read as a household's week, a bid document and a team
 * sheet — and every component is a default registration an app can replace
 * cell by cell, the same move as replacing a view.
 */

export interface PageContext<S extends AnySchema> {
  readonly store: Store<S>;
  readonly principal?: Principal;
  readonly brand?: Brand;
  /** Where the spatial face lives, for the cross-links. Default "/". */
  readonly sceneHref?: string;
  readonly invariantContext?: Readonly<Record<string, unknown>>;
  /**
   * Whether this browser remembers the edits (a ship browser adapter behind
   * the store). When it does, the face says so and offers the way back to
   * the example — the `fresh=1` address `@graview/ship` reads.
   */
  readonly remembers?: boolean;
  /**
   * Whether the face is inside somebody else's page. A standalone face owns
   * its document and its pages are its <main>; embedded, the host owns the
   * landmarks and the face's pages are plain regions of it.
   */
  readonly embedded?: boolean;
  /**
   * Whether a shell of the app's own is already around these pages.
   *
   * A design's shell owns the document's landmark — `graview-pages` says so
   * in as many words — and the framework's own pages went on wrapping
   * themselves in `PageMain` underneath it, so every route the design left
   * derived had a main inside a main. Set by the router from the registry,
   * never by an app: it is the same question `embedded` asks (does somebody
   * above me own the landmark) with a different somebody.
   */
  readonly framed?: boolean;
  /**
   * THE APP'S PICTURES. The view registry the scene draws from; given, every
   * registered place is a page on this face too — an index at `/places`,
   * each lens at `/places/<as>` — the home leads with them, each kind's page
   * lists its own, and the nav mirrors the scene's bar. Absent, the face is
   * the derived site it always was. A registry means a provider under the
   * routes (the same one the embed puts there), so a lens's hooks work with
   * no scene at all.
   */
  readonly views?: ReactViewRegistry<S>;
  /** The reader's own settings, for the provider under the pages when `views` is given. */
  readonly settings?: readonly SettingDeclaration[];
  /** Who else is here, for the same provider. */
  readonly presence?: PresenceChannel;
}

/** The way back to the example, for a face whose browser remembers. */
export function StartFreshLink() {
  return (
    <a
      href="#fresh"
      data-testid="start-fresh"
      title="Forget every edit made in this browser and return to the example"
      onClick={(event) => {
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("fresh", "1");
        window.location.assign(url.toString());
      }}
      /*
       * A TARGET, not just a phrase. Inline text at 12.5px is a 15-pixel
       * target — under the 24 WCAG 2.2 asks for, and the only control on the
       * routed face that was: it sits in the footer of every page of every
       * app, so every page of the pages face had exactly one control too
       * small to hit.
       */
      style={{
        color: "inherit",
        display: "inline-flex",
        alignItems: "center",
        minHeight: 24,
        minWidth: 24,
      }}
    >
      Start fresh
    </a>
  );
}

/** Re-render on every applied diff — the page face is as live as the scene. */
export function useStoreTick<S extends AnySchema>(store: Store<S>): number {
  // The version bumps INSIDE the subscription, so the snapshot is stable
  // between diffs — a snapshot that changed on every read would re-render
  // for ever.
  const version = useRef(0);
  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(() => {
        version.current += 1;
        listener();
      }),
    [store],
  );
  return useSyncExternalStore(subscribe, () => version.current, () => 0);
}

/* ------------------------------------------------------------- the type */

/*
 * A reading column, a real scale. The scene's chrome is set at 14px because
 * it is chrome; a page is read, so it gets the size a page gets. Headings
 * take the brand's display face through the token the theme already sets —
 * as a variable, never a `font` shorthand, which would silently beat it.
 */
const DISPLAY = "var(--graview-font-display, var(--graview-font-body, system-ui))";
const column: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "40px 20px 96px",
  display: "grid",
  /*
   * A TRACK THAT MAY BE NARROWER THAN WHAT IS IN IT.
   *
   * An `auto` track is at least the min-content width of its item, and a
   * grid item's own `min-width: auto` is the same measure — so a section
   * whose min-content the engine puts above the column's width pushes the
   * whole page sideways. The engines do not agree on that measure: at a
   * 32px root on a 390 screen, WebKit and Firefox made the list page's
   * header 388 in a 350 track and the document scrolled two ways, while
   * Chromium fitted it. `minmax(0, 1fr)` says the column is the width it
   * was given, and what is inside it wraps.
   */
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 40,
};
const h1: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY,
  fontSize: "clamp(30px, 4.6vw, 40px)",
  lineHeight: 1.12,
  fontWeight: 600,
  letterSpacing: "-0.012em",
  overflowWrap: "anywhere",
};
const h2: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY,
  fontSize: "1.375rem",
  lineHeight: 1.25,
  fontWeight: 600,
  letterSpacing: "-0.006em",
};
const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: "0.75rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--graview-ink-muted)",
};
const lede: React.CSSProperties = {
  margin: 0,
  fontSize: "1.125rem",
  lineHeight: 1.5,
  color: "var(--graview-ink-muted)",
  maxWidth: "58ch",
};
const quiet: React.CSSProperties = { color: "var(--graview-ink-muted)", fontSize: "0.875rem" };
const rule: React.CSSProperties = { borderTop: "1px solid var(--graview-edge)", paddingTop: 24 };
// A link is a target: tall enough for a fingertip without leaving the line.
const link: React.CSSProperties = {
  color: "inherit",
  textDecorationColor: "var(--graview-edge-bright)",
  textUnderlineOffset: 3,
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};
/*
 * An UNDERLINED link is a target and an undecorated one is the same target.
 *
 * `link` carried the 24px minimum and `plain` — the same thing without the
 * underline, used on the record page's eyebrow, the list's rows and the
 * masthead — did not, so the framework's own record page had a 19-pixel
 * control on it. One site had already patched the minimum back in by hand,
 * which is the style telling you where it should have lived.
 */
const plain: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};
const button: React.CSSProperties = {
  font: "inherit",
  fontSize: "0.875rem",
  padding: "8px 14px",
  borderRadius: "var(--graview-radius-sm, 8px)",
  border: "1px solid var(--graview-edge-bright)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  cursor: "pointer",
};

/** The kind's own colour, as a small mark — the thread the scene wears too. */
/**
 * The mark beside a kind's name — its FIGURE where it has one, and the dot
 * it has always had where it does not.
 *
 * One component in `@graview/primitives`, so the routed face, the scene and
 * the relation key draw the same thing from the same declaration. A second
 * rendering here would be a second place for a kind's picture to be wrong.
 */
function KindMark({
  kind,
  brand,
  size = 10,
  schema,
}: {
  kind: string;
  brand?: Brand;
  size?: number;
  schema?: AnySchema;
}) {
  // A figure wants more room than a dot: the dot is the figure's own inner
  // circle, so passing the dot's size straight through would draw a stamp.
  return <KindFigure kind={kind} {...(schema ? { schema } : {})} {...(brand ? { brand } : {})} size={Math.round(size * 1.6)} />;
}

/**
 * The kinds on the far end of a connections group, in their own plurals:
 * "Owners" over an item's assignment, "Items" over the owner's.
 */
function listed<S extends AnySchema>(
  store: Store<S>,
  group: { readonly targets: readonly { readonly kind: string }[]; readonly edgeKind: string },
): string {
  const kinds = [...new Set(group.targets.map((target) => target.kind))];
  const said = kinds.map((kind) => {
    const definition = store.schema.tryDefinition(kind);
    return definition?.plural ?? humaniseField(kind);
  });
  return said.length > 0 ? said.join(" and ") : humaniseField(group.edgeKind);
}

/** Words for who did something, from the op's own author. */
/** Who did an op, as the person at the keyboard reads it: "you" only for their own work. */
function whoDid(op: Operation, principal?: Principal): string {
  if (op.author.kind === "human") {
    if (op.author.id === undefined || principal?.id === undefined || op.author.id === principal.id) return "you";
    return op.author.id;
  }
  if (op.author.kind === "agent") return op.author.id ?? "an agent";
  return op.author.id ?? op.author.kind;
}

/** A node's own one-line facts, for a list line or a front-page glance. */
function glance(
  node: Record<string, unknown>,
  definition: AnyNodeDefinition | undefined,
  said: string,
): string {
  const raw = (key: string) => node[key];
  return readableFields(node, definition, { limit: 3, said: [said] })
    .map((field) => {
      // A bare number says nothing on its own — "12 · 8" is not a sentence.
      // The label the declaration already gave it makes it one.
      const value = raw(field.key);
      if (typeof value === "number") return `${field.value} ${field.label.toLowerCase()}`;
      if (typeof value === "boolean") return `${field.label}: ${field.value.toLowerCase()}`;
      return field.value;
    })
    .join(" · ");
}

/** The plural, as declared. */
const pluralOf = <S extends AnySchema>(store: Store<S>, kind: string): string =>
  store.schema.tryDefinition(kind)?.plural ?? `${kind}s`;

/**
 * The kinds this face lists: not a disabled module's, and not an administered
 * module's unless the seat administers it — a gardener's pages never have a
 * People section, the coordinator's always do.
 */
const liveKinds = <S extends AnySchema>(store: Store<S>, principal?: Principal): readonly string[] => {
  const kept = store.kindsKeptFrom(principal);
  return (store.schema.kinds as readonly string[]).filter(
    (kind) => !store.modules.disabledKinds.has(kind) && !kept.has(kind),
  );
};

/* ------------------------------------------------------------- the shell */

/** The shell: the installation's masthead, the kinds as its sections, the way to the scene. */
export function DefaultShell<S extends AnySchema>({
  context,
  children,
}: {
  context: PageContext<S>;
  children: ReactNode;
}) {
  const { store, brand, sceneHref = "/", invariantContext } = context;
  useStoreTick(store);
  const logo = useMarkup(brand?.logo);
  const location = useLocation();
  const problems = store.violations(invariantContext).length;
  const current = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const navLink = (path: string): React.CSSProperties => ({
    ...plain,
    fontSize: "0.875rem",
    padding: "6px 0",
    color: current(path) ? "var(--graview-ink)" : "var(--graview-ink-muted)",
    borderBottom: current(path) ? "2px solid var(--graview-accent)" : "2px solid transparent",
  });
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--graview-ground)",
        color: "var(--graview-ink)",
        fontFamily: "var(--graview-font-body, system-ui)",
        fontSize: "1rem",
        lineHeight: 1.6,
      }}
    >
      <header style={{ borderBottom: "1px solid var(--graview-edge)", background: "var(--graview-bar)" }}>
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            padding: "14px 20px 0",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {/* The masthead: the installation's mark and name, the way home. */}
            <Link
              to="/"
              data-testid="masthead"
              style={{
                ...plain,
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontFamily: DISPLAY,
                fontSize: "1.25rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                minHeight: 32,
              }}
            >
              {brand?.logo ? (
                <span
                  aria-hidden="true"
                  style={{ display: "inline-flex", color: "var(--graview-accent)" }}
                  // The logo is the brand's own markup, declared by the
                  // installation — not supplied by a user.
                  dangerouslySetInnerHTML={logo}
                />
              ) : null}
              {brand?.name ?? "Graview"}
            </Link>
            <a
              href={sceneHref}
              style={{ ...plain, ...quiet, marginLeft: "auto", whiteSpace: "nowrap" }}
              title="The same thing, as a scene"
            >
              Open the scene ↗
            </a>
          </div>
          {/* THE SCENE'S BAR, MIRRORED: the app's pictures first, in its own words, then the kinds. */}
          {placesOf(context).length > 0 ? (
            <nav aria-label="Pictures" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
              {placesOf(context).map((place) => {
                const path = placePath(place.as);
                return (
                  <Link key={place.as} to={path} style={navLink(path)} {...(current(path) ? { "aria-current": "page" as const } : {})}>
                    {place.title}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <nav
            aria-label="Kinds"
            style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}
          >
            {liveKinds(store, context.principal).map((kind) => {
              const path = `/${pluralSlug(store.schema, kind)}`;
              return (
                <Link
                  key={kind}
                  to={path}
                  style={navLink(path)}
                  {...(current(path) ? { "aria-current": "page" as const } : {})}
                >
                  {pluralOf(store, kind)}
                </Link>
              );
            })}
            {kindMap(store).relations.length > 0 ? (
              <Link to="/map" style={navLink("/map")} {...(current("/map") ? { "aria-current": "page" as const } : {})}>
                Map
              </Link>
            ) : null}
            <Link
              to="/problems"
              // At the end of the row, and at the end of the last row when
              // the kinds wrap: the standing, set apart from the sections.
              style={{ ...navLink("/problems"), display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
              {...(current("/problems") ? { "aria-current": "page" as const } : {})}
            >
              Problems
              {problems > 0 ? (
                <span
                  data-testid="problems-count"
                  style={{
                    fontSize: "0.75rem",
                    lineHeight: 1,
                    padding: "3px 7px",
                    borderRadius: 999,
                    color: "var(--graview-warn)",
                    border: "1px solid var(--graview-warn)",
                  }}
                >
                  {problems}
                </span>
              ) : null}
            </Link>
          </nav>
        </div>
      </header>
      <div style={{ flex: 1 }}>{children}</div>
      <footer
        style={{
          borderTop: "1px solid var(--graview-edge)",
          padding: "18px 20px 28px",
          ...quiet,
          fontSize: "0.8125rem",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span>{brand?.name ?? "Graview"}</span>
          {/* Which rung answers, chosen here as it is in the scene's profile: the reader's own setting. */}
          {context.views ? <LadderSetting /> : null}
          {context.remembers ? (
            <span data-testid="remembered" style={{ marginLeft: "auto" }}>
              Remembered in this browser · <StartFreshLink />
            </span>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------- the map */

/** "anything" for a relation the declaration leaves open. */
function endOf<S extends AnySchema>(store: Store<S>, kind: string): { readonly label: string; readonly path: string | null } {
  if (kind === "*") return { label: "anything", path: null };
  return { label: pluralOf(store, kind), path: `/${pluralSlug(store.schema, kind)}` };
}

/**
 * ONE RELATION, AS A LINE: its mark, the two kinds it joins with the edge's
 * name between them, its own words from each end, and how many of it there
 * are — the count opening the far kind's list narrowed to the ones that
 * have it.
 */
function RelationLine<S extends AnySchema>({ context, relation }: { context: PageContext<S>; relation: KindRelation }) {
  const { store } = context;
  const from = endOf(store, relation.from);
  const to = endOf(store, relation.to);
  const end = (one: typeof from) => (one.path ? <Link to={one.path} style={{ ...plain, fontWeight: 550 }}>{one.label}</Link> : <span>{one.label}</span>);
  return (
    <li
      data-testid="relation"
      data-relation={relation.edgeKind}
      style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) auto", gap: 12, alignItems: "baseline" }}
    >
      <RelationMark edgeKind={relation.edgeKind} {...(context.brand?.kit ? { kit: context.brand.kit } : {})} />
      <span style={{ display: "grid", gap: 1 }}>
        <span>
          {end(from)} <span style={quiet}>{humaniseField(relation.edgeKind)}</span> {end(to)}
        </span>
        {relation.description || relation.inverse ? (
          <span style={{ ...quiet, fontSize: "0.875rem" }}>
            {relation.description ? capitalise(relation.description) : null}
            {relation.description && relation.inverse ? " · " : null}
            {relation.inverse ? `from the other end, ${relation.inverse}` : null}
          </span>
        ) : null}
      </span>
      {to.path ? (
        <Link
          to={`${to.path}?with=${encodeURIComponent(relation.edgeKind)}`}
          // A count is a small word and a real target: a fingertip's width at least.
          style={{ ...link, ...quiet, fontVariantNumeric: "tabular-nums", display: "inline-block", minWidth: 24, minHeight: 24, textAlign: "center" }}
          title={`The ${to.label.toLowerCase()} that have this`}
        >
          {relation.count}
        </Link>
      ) : (
        <span style={{ ...quiet, fontVariantNumeric: "tabular-nums" }}>{relation.count}</span>
      )}
    </li>
  );
}

/**
 * HOW IT FITS TOGETHER: every declared relation between the kinds, in the
 * declaration's words, with its count — the roads between the districts
 * and the key that names them, as a page can carry them. On the home page
 * as a section; at `/map` on its own.
 */
export function KindMapSection<S extends AnySchema>({ context, heading = true }: { context: PageContext<S>; heading?: boolean }) {
  const { store } = context;
  const live = new Set(liveKinds(store, context.principal));
  const relations = kindMap(store).relations.filter((relation) => live.has(relation.from) && (relation.to === "*" || live.has(relation.to)));
  if (relations.length === 0) return null;
  return (
    <section style={{ ...rule, display: "grid", gap: 12 }} data-testid="kind-map">
      {heading ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={h2}>
            <Link to="/map" style={plain}>
              How it fits together
            </Link>
          </h2>
          <span style={quiet}>{relations.length === 1 ? "1 relation" : `${relations.length} relations`}</span>
        </div>
      ) : null}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {relations.map((relation) => (
          <RelationLine key={`${relation.edgeKind}|${relation.from}|${relation.to}`} context={context} relation={relation} />
        ))}
      </ul>
    </section>
  );
}

export function DefaultMapPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store } = context;
  useStoreTick(store);
  const live = new Set(liveKinds(store, context.principal));
  const map = kindMap(store);
  const relations = map.relations.filter((relation) => live.has(relation.from));
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{relations.length === 0 ? "No relations" : `${relations.length} ${relations.length === 1 ? "relation" : "relations"}`}</p>
        <h1 style={h1}>How it fits together</h1>
        <p style={lede}>
          {relations.length === 0
            ? "Nothing here is declared to relate to anything else yet."
            : "The kinds this installation holds, and the relations declared between them — each in the declaration's own words, with how many of it there are."}
        </p>
      </header>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "6px 18px" }} data-testid="map-kinds">
        {map.kinds
          .filter((entry) => live.has(entry.kind))
          .map((entry) => (
            <li key={entry.kind} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <KindMark kind={entry.kind} brand={context.brand} schema={store.schema} size={7} />
              <Link to={`/${pluralSlug(store.schema, entry.kind)}`} style={link}>
                {entry.plural}
              </Link>
              <span style={quiet}>{entry.count}</span>
            </li>
          ))}
      </ul>
      <KindMapSection context={context} heading={false} />
    </PageMain>
  );
}

/** The questions the seat has asked and nobody has answered, each at the record it is about. */
function SeatQuestions<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const here = useGraviewIfAny<S>();
  const asked = [...(here?.robots.values() ?? [])].filter((one) => one.mode === "asking" && one.say);
  if (asked.length === 0) return null;
  const { store } = context;
  return (
    <section style={{ ...rule, display: "grid", gap: 10 }} data-testid="seat-questions">
      <h2 style={h2}>{asked.length === 1 ? "The seat asked something" : `The seat asked ${asked.length} things`}</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
        {asked.map((one) => {
          const about = one.at ? store.graph.getNode(one.at) : undefined;
          return (
            <li key={one.participant} style={{ display: "grid", gap: 2 }}>
              <span>{one.say}</span>
              {about ? (
                <Link to={recordPath(store.schema, about.kind as string, about.id)} style={{ ...link, ...quiet }}>
                  {labelOf(store.schema.tryDefinition(about.kind), about as never)} →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- the places */

/** The app's pictures this seat may see: registered places whose kind is live here. */
function placesOf<S extends AnySchema>(context: PageContext<S>): readonly Place[] {
  const views = context.views;
  if (!views) return [];
  const live = new Set(liveKinds(context.store, context.principal));
  return views.places().filter((place) => live.has(place.kind));
}

function membersOf<S extends AnySchema>(store: Store<S>, kind: string) {
  const definition = store.schema.tryDefinition(kind);
  return store.graph.nodesOfKind(kind as never).filter((node) => isCurrent(definition, node as never));
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
      nodes={members as never}
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
        <span style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.3 }}>{place.title}</span>
        <span style={quiet}>{pictureOf(store, place)}</span>
      </span>
    </Link>
  );
}

const cards: React.CSSProperties = {
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

/* --------------------------------------------------------------- the home */

/**
 * The front page opens with the thing itself: what this installation is
 * and what it holds, in a sentence made of its own plurals — then each kind
 * as a section, a few of its members with a line of their own facts, and
 * the way to the rest. The standing is a sentence, not a widget.
 */
export function DefaultHomePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { principal } = context;
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  const recent = [...store.log.all()].slice(-5).reverse();
  const kinds = liveKinds(store, context.principal);
  const counted = kinds.map((kind) => ({
    kind,
    definition: store.schema.tryDefinition(kind),
    members: store.graph
      .nodesOfKind(kind as never)
      .filter((node) => isCurrent(store.schema.tryDefinition(kind), node as never)),
  }));
  const present = counted.filter((entry) => entry.members.length > 0);
  // An empty installation says where to begin, in the act's own words.
  // The beginning it names is one THIS seat may take.
  const beginning = counted
    .map((entry) => ({
      entry,
      creator: store
        .allMutations()
        .find(
          (mutation) =>
            (mutation.creates ?? []).includes(entry.kind as never) &&
            store.permits({ name: mutation.name, args: {} }, context.principal).ok,
        ),
    }))
    .find((candidate) => candidate.creator !== undefined);
  const summary =
    present.length === 0
      ? beginning
        ? `Nothing here yet. Begin with “${beginning.creator?.title ?? beginning.creator?.name}”, under ${pluralOf(store, beginning.entry.kind)}.`
        : "Nothing here yet."
      : `${present
          .map(
            (entry) =>
              `${entry.members.length} ${
                entry.members.length === 1
                  ? entry.kind
                  : pluralOf(store, entry.kind).toLowerCase()
              }`,
          )
          .join(", ")
          .replace(/, ([^,]*)$/, " and $1")}.`;
  const flagged = new Set(violations.flatMap((violation) => violation.nodeIds));

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 14 }}>
        <h1 style={h1}>{brand?.name ?? "Graview"}</h1>
        <p style={lede}>{summary}</p>
        <p style={{ margin: 0, fontSize: "0.9375rem" }} data-testid="standing-card">
          {violations.length === 0 ? (
            <span style={quiet}>All rules hold.</span>
          ) : (
            <Link to="/problems" style={{ ...link, color: "var(--graview-warn)" }}>
              {violations.length} {violations.length === 1 ? "problem" : "problems"} — see what is
              broken, and what would fix it
            </Link>
          )}
        </p>
      </header>

      {placesOf(context).length > 0 ? (
        /* THE PICTURES FIRST: what this installation looks at, before the piles it looks at it through. */
        <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="pictures">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={h2}>
              <Link to="/places" style={plain}>
                Pictures
              </Link>
            </h2>
            <span style={quiet}>{placesOf(context).length}</span>
          </div>
          <div style={cards}>
            {placesOf(context).map((place) => (
              <PlaceCard key={place.as} context={context} place={place} />
            ))}
          </div>
        </section>
      ) : null}

      <KindMapSection context={context} />

      {counted.map(({ kind, definition, members }) => {
        const path = `/${pluralSlug(store.schema, kind)}`;
        const shown = members.slice(0, 4);
        return (
          <section key={kind} style={{ ...rule, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <KindMark kind={kind} brand={brand} schema={store.schema} />
              <h2 style={h2}>
                <Link to={path} style={plain}>
                  {pluralOf(store, kind)}
                </Link>
              </h2>
              <span style={quiet}>{members.length === 0 ? "none yet" : members.length}</span>
            </div>
            {definition?.description ? (
              <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{definition.description}</p>
            ) : null}
            {shown.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {shown.map((node) => {
                  const label = labelOf(definition, node as never);
                  const facts = glance(node as Record<string, unknown>, definition, label);
                  return (
                    <li key={node.id} style={{ display: "grid", gap: 1 }}>
                      <Link to={recordPath(store.schema, kind, node.id)} style={{ ...link, fontWeight: 550 }}>
                        {flagged.has(node.id) ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
                        {label}
                      </Link>
                      {facts ? <span style={quiet}>{facts}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {members.length > shown.length ? (
              <Link to={path} style={{ ...link, ...quiet }}>
                All {members.length} {pluralOf(store, kind).toLowerCase()} →
              </Link>
            ) : null}
          </section>
        );
      })}

      {recent.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 10 }}>
          <h2 style={h2}>Recently</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {recent.map((op) => (
              <li key={op.id} style={quiet}>
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op, principal)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}

/* --------------------------------------------------------------- the list */

/**
 * A kind's page opens with the kind: its plural, its declared description,
 * how many there are. The members read as a list of things, each with a
 * line of its own facts. Adding one is below the list, as a section with
 * the act's own title — not a form at the top of a grid.
 */
export function DefaultListPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const kind = kindOfSlug(store.schema, params["slug"] ?? "");
  if (!kind) {
    return (
      <PageMain context={context}>
        <h1 style={h1}>No such kind of thing here.</h1>
      </PageMain>
    );
  }
  const definition = store.schema.tryDefinition(kind);
  const past = search.get("past") === "1";
  const all = store.graph.nodesOfKind(kind as never);
  const current = past ? all : all.filter((node) => isCurrent(definition, node as never));
  const retired = all.length - current.length;
  /*
   * RELATIONS ARE STRUCTURE HERE TOO. A list can be NARROWED by a relation —
   * `?<edge>=<id>` keeps the members joined to that one node by that edge,
   * either way round, which is what a record's "all the tasks on this list"
   * links to; `?with=<edge>` keeps the ones that have the relation at all,
   * which is what the map's counts open — and GROUPED by one: `?by=<edge>`
   * reads the pile as piles-per-far-end, in the URL like every arrangement
   * on this face, so a list you arranged is a link you can send.
   */
  const edges = store.graph.allEdges();
  const relations = kindMap(store).relations.filter((relation) => relation.from === kind || relation.to === kind);
  const relatedTo = (memberId: string, edgeKind: string, otherId?: string) =>
    edges.some(
      (edge) =>
        edge.kind === edgeKind &&
        ((edge.from === memberId && (otherId === undefined || edge.to === otherId)) ||
          (edge.to === memberId && (otherId === undefined || edge.from === otherId))),
    );
  const narrowing = [...search.entries()].filter(([key, value]) => !["past", "by", "with", "q", "group"].includes(key) && relations.some((relation) => relation.edgeKind === key) && value.length > 0);
  const withEdge = search.get("with");
  const members = current.filter(
    (node) =>
      narrowing.every(([edgeKind, otherId]) => relatedTo(node.id, edgeKind, otherId)) &&
      (withEdge === null || relatedTo(node.id, withEdge)),
  );
  const by = search.get("by");
  const grouping = by && relations.some((relation) => relation.edgeKind === by) ? by : null;
  const farEnds = (memberId: string, edgeKind: string): string[] =>
    [...new Set(edges.filter((edge) => edge.kind === edgeKind && (edge.from === memberId || edge.to === memberId)).map((edge) => (edge.from === memberId ? edge.to : edge.from)))]
      .map((otherId) => store.graph.getNode(otherId))
      .filter((other): other is NonNullable<typeof other> => other !== undefined)
      .map((other) => labelOf(store.schema.tryDefinition(other.kind), other as never))
      .sort();
  const named = (id: string): string => {
    const node = store.graph.getNode(id);
    return node ? labelOf(store.schema.tryDefinition(node.kind), node as never) : id;
  };
  const flagged = new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds));
  /*
   * AN ACT THE SEAT MAY NOT TAKE IS STATED, NOT OFFERED. The strip and the
   * record page already withhold by the policy; the list page offered every
   * creating act to everyone, and a gardener met "Agree every plot has a
   * caretaker" as a live form that refused on submit. The verdict is the
   * store's own, asked before anything is drawn.
   */
  const { principal } = context;
  /*
   * THE ACTS THE DERIVATION OFFERS, not the ones the declaration lists.
   *
   * This scanned `allMutations()` by `creates` and checked `store.permits` —
   * which is the thing `graview-pages` tells an app's own page not to do,
   * done by the framework's own page. The two answers differ: the derivation
   * also drops an act it cannot ASK for. "Add an item for someone", with
   * nobody to hand it to yet, is withheld in the scene and was offered here
   * as a live form whose picker was empty and whose submit could only refuse.
   */
  const facts = kindFacts(store, kind as string, {
    ...(principal ? { principal } : {}),
    ...(context.invariantContext ? { context: context.invariantContext } : {}),
  });
  const creators = facts.actions.affordances
    .map((affordance) => ({
      affordance,
      mutation: store.allMutations().find((m) => m.name === affordance.mutation),
    }))
    .filter((entry): entry is { affordance: typeof entry.affordance; mutation: NonNullable<typeof entry.mutation> } =>
      entry.mutation !== undefined,
    );
  const withheld = facts.actions.withheld;
  const plural = pluralOf(store, kind);
  const row = (node: (typeof members)[number]) => {
    const label = labelOf(definition, node as never);
    const said = glance(node as Record<string, unknown>, definition, label);
    return (
      <li
        key={node.id}
        style={{
          display: "grid",
          gap: 2,
          padding: "14px 0",
          borderTop: "1px solid var(--graview-edge)",
        }}
      >
        <Link
          to={recordPath(store.schema, kind, node.id)}
          style={{ ...plain, fontFamily: DISPLAY, fontSize: "1.1875rem", fontWeight: 600, lineHeight: 1.3 }}
        >
          {flagged.has(node.id) ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
          {label}
        </Link>
        {said ? <span style={quiet}>{said}</span> : null}
      </li>
    );
  };

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={kind} brand={brand} schema={store.schema} size={8} />
          {members.length === 0
            ? "None yet"
            : `${members.length} ${members.length === 1 ? kind : plural.toLowerCase()}`}
        </p>
        <h1 style={h1}>{plural}</h1>
        {definition?.description ? <p style={lede}>{definition.description}</p> : null}
        {relations.length > 0 ? (
          /* The roads out of this district: each relation this kind takes part in, with the far end named and linked. */
          <p style={{ ...quiet, margin: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "center" }} data-testid="kind-relations">
            <span>Related:</span>
            {relations.map((relation) => {
              const far = relation.from === kind ? relation.to : relation.from;
              const words = relation.from === kind ? relation.description : (relation.inverse ?? relation.description);
              return (
                <span key={`${relation.edgeKind}|${relation.from}|${relation.to}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={words ? capitalise(words) : undefined}>
                  <RelationMark edgeKind={relation.edgeKind} width={22} {...(context.brand?.kit ? { kit: context.brand.kit } : {})} />
                  <span>{humaniseField(relation.edgeKind)}</span>
                  {far === "*" ? (
                    <span>anything</span>
                  ) : (
                    <Link to={`/${pluralSlug(store.schema, far)}`} style={link}>
                      {pluralOf(store, far)}
                    </Link>
                  )}
                </span>
              );
            })}
          </p>
        ) : null}
        {placesOf(context).some((place) => place.kind === kind) ? (
          /* A district's board, in the page's idiom: the kind's own pictures, by name. */
          <p style={{ ...quiet, margin: 0 }} data-testid="kind-pictures">
            See {plural.toLowerCase()} as:{" "}
            {placesOf(context)
              .filter((place) => place.kind === kind)
              .map((place, index) => (
                <span key={place.as}>
                  {index > 0 ? " · " : null}
                  <Link to={placePath(place.as)} style={link}>
                    {place.title}
                  </Link>
                </span>
              ))}
          </p>
        ) : null}
      </header>

      {narrowing.length > 0 || withEdge !== null ? (
        <p style={{ ...quiet, margin: 0 }} data-testid="list-filter-note">
          {[
            `Only the ${plural.toLowerCase()}`,
            ...(withEdge !== null ? [`that ${humaniseField(withEdge).toLowerCase()} anything`] : []),
            ...narrowing.map(([edgeKind, otherId]) => `${humaniseField(edgeKind).toLowerCase()} ${named(otherId)}`),
          ].join(" ")}
          {" · "}
          <Link to={past ? "?past=1" : "?"} style={link}>
            All {plural.toLowerCase()}
          </Link>
        </p>
      ) : null}
      {relations.length > 0 && current.length > 1 ? (
        <form
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
          data-testid="list-by-controls"
          onSubmit={(event) => event.preventDefault()}
        >
          <label style={{ ...quiet, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Group by
            <select
              data-testid="list-by"
              value={grouping ?? ""}
              onChange={(event) => {
                const next = new URLSearchParams(search);
                if (event.target.value) next.set("by", event.target.value);
                else next.delete("by");
                setSearch(next);
              }}
              style={{ font: "inherit", minHeight: 32, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--graview-edge)", background: "var(--graview-panel)", color: "var(--graview-ink)" }}
            >
              <option value="">nothing</option>
              {[...new Map(relations.map((relation) => [relation.edgeKind, relation])).values()].map((relation) => {
                const far = relation.from === kind ? relation.to : relation.from;
                return (
                  <option key={relation.edgeKind} value={relation.edgeKind}>
                    {humaniseField(relation.edgeKind)} — {far === "*" ? "anything" : pluralOf(store, far).toLowerCase()}
                  </option>
                );
              })}
            </select>
          </label>
        </form>
      ) : null}
      {members.length === 0 ? (
        <p style={{ ...lede, fontSize: "1rem" }} data-testid="none-yet">
          {narrowing.length > 0 || withEdge !== null ? "None of them." : "None yet"}
          {narrowing.length === 0 && withEdge === null && creators.length > 0
            ? ` — the first one starts below, with “${creators[0]?.mutation.title ?? creators[0]?.mutation.name}”.`
            : narrowing.length === 0 && withEdge === null
              ? "."
              : ""}
        </p>
      ) : grouping ? (
        (() => {
          const groups = new Map<string, typeof members>();
          for (const node of members) {
            const ends = farEnds(node.id, grouping);
            const key = ends.length > 0 ? ends.join(", ") : "";
            groups.set(key, [...(groups.get(key) ?? []), node]);
          }
          const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
          return (
            <div style={{ display: "grid", gap: 18 }} data-testid="records" data-grouped={grouping}>
              {ordered.map(([key, nodes]) => (
                <section key={key || "-"} style={{ display: "grid", gap: 0 }} data-testid="list-group">
                  <h2 style={{ ...h2, fontSize: "1rem", marginBottom: 4 }}>
                    {key || `No ${humaniseField(grouping).toLowerCase()}`} <span style={quiet}>{nodes.length}</span>
                  </h2>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}>{nodes.map(row)}</ul>
                </section>
              ))}
            </div>
          );
        })()
      ) : (
        <ul
          style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}
          data-testid="records"
        >
          {members.map(row)}
        </ul>
      )}
      {retired > 0 ? (
        <Link to={`?past=1`} style={{ ...link, ...quiet }} data-testid="past-link">
          +{retired} past
        </Link>
      ) : null}

      {creators.map(({ affordance, mutation }) => (
        <section key={affordance.id} style={{ ...rule, display: "grid", gap: 14 }}>
          <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
          {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
          {/* The candidates the derivation narrowed, not every node. */}
          <DerivedForm store={store} mutation={mutation} prefilled={affordance.args} open={affordance.open} {...(context.principal ? { principal: context.principal } : {})} />
        </section>
      ))}
      {withheld.length > 0 ? (
        <ul style={{ ...rule, margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }} data-testid="withheld">
          {withheld.map((entry) => (
            <li key={entry.id} style={quiet}>
              <s>{entry.label}</s> — {entry.refusal.message}
            </li>
          ))}
        </ul>
      ) : null}
    </PageMain>
  );
}

/* ------------------------------------------------------------- the record */

/**
 * A record opens with the thing: its kind as an eyebrow, its name in the
 * display face, and what the declaration says it is. What is wrong with it
 * comes next, because it is the one thing a reader must not miss. Then the
 * facts, the things it is related to — each captioned in the declared
 * words for that relation — and, beneath the content, what can be done and
 * what has happened.
 */
export function DefaultRecordPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, principal, invariantContext } = context;
  useStoreTick(store);
  const params = useParams();
  const id = decodeURIComponent(params["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const [open, setOpen] = useState<string | null>(null);
  if (!facts) {
    return (
      <PageMain context={context}>
        <h1 style={h1}>Nothing lives at this address.</h1>
      </PageMain>
    );
  }
  const node = store.graph.getNode(id) as (Record<string, unknown> & { id: string; kind: string }) | undefined;
  const definition = store.schema.tryDefinition(facts.kind);
  // The declaration's own sentence for this thing, when it has one and it
  // says more than the name.
  const described = definition?.describe && node ? describeNode(definition, node) : null;
  const history = [...store.log.all()]
    .filter((op) => op.writes.includes(id) || op.reads.includes(id))
    .slice(-8)
    .reverse();
  /*
   * A repair is offered ONCE, beside the rule that named it. The derived
   * set still carries it — parity with the scene is a claim about the
   * facts, not the rendering — but listing it again under "what can be
   * done" is the same button twice on one page.
   */
  const offered = facts.actions.affordances.filter((affordance) => affordance.provider !== "invariant");

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={facts.kind} brand={brand} schema={store.schema} size={8} />
          <Link to={`/${pluralSlug(store.schema, facts.kind)}`} style={plain}>
            {pluralOf(store, facts.kind)}
          </Link>
        </p>
        <h1 style={h1}>{facts.label}</h1>
        {described && described !== facts.label ? <p style={lede}>{described}</p> : null}
        <a href={spatialHref(id)} style={{ ...link, ...quiet }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
        {placesOf(context).some((place) => place.kind === facts.kind || place.across === facts.kind) ? (
          /* WHERE IT IS SEEN: the pictures this kind of thing appears in, each as a page and as a stop in the scene. */
          <p style={{ ...quiet, margin: 0 }} data-testid="seen-in">
            Seen in:{" "}
            {placesOf(context)
              .filter((place) => place.kind === facts.kind || place.across === facts.kind)
              .map((place, index) => (
                <span key={place.as}>
                  {index > 0 ? " · " : null}
                  <Link to={placePath(place.as)} style={link}>
                    {place.title}
                  </Link>{" "}
                  <a href={placeHref(place.as, context.sceneHref ?? "/")} style={{ ...link, ...quiet }} title={`${place.title}, in the scene`}>
                    ↗
                  </a>
                </span>
              ))}
          </p>
        ) : null}
      </header>

      {facts.violations.length > 0 ? (
        <section
          data-testid="record-violations"
          style={{
            display: "grid",
            gap: 12,
            padding: "16px 18px",
            borderLeft: "3px solid var(--graview-warn)",
            background: "var(--graview-panel-warning)",
            borderRadius: "0 var(--graview-radius, 12px) var(--graview-radius, 12px) 0",
          }}
        >
          {facts.violations.map((violation, index) => (
            <div key={index} style={{ display: "grid", gap: 8 }}>
              <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
              {/* Ranked by the same derivation the strip reads: this
                  record's own repair leads, whichever subject the rule
                  happened to walk first. */}
              <Repairs<S>
                store={store}
                repairs={rankedRepairs(facts.actions, violation.repairs)}
                {...(principal ? { principal } : {})}
              />
            </div>
          ))}
        </section>
      ) : null}

      {facts.fields.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="record-fields">
          <h2 style={h2}>The facts</h2>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "14px 24px",
            }}
          >
            {facts.fields.map((field) => (
              <div key={field.key} style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <dt style={{ ...eyebrow, fontSize: "0.6875rem" }}>{field.label}</dt>
                <dd style={{ margin: 0, fontSize: "1.0625rem", overflowWrap: "anywhere" }}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {facts.links.map((group) => (
        <section key={`${group.edgeKind}|${group.direction}`} style={{ ...rule, display: "grid", gap: 10 }}>
          {/*
            * THE EYEBROW SAYS WHAT IS LISTED, NOT WHICH WAY THE EDGE WAS
            * DECLARED.
            *
            * It used to be the edge kind — so an owner's record read
            * "Assigned to" over "What they are seeing to", which is the
            * reading `graview check` warns about by name
            * (`edge-without-inverse`: "from an owner it is captioned
            * 'assigned to', which is the wrong way round"). And where the
            * declaration had no words for this direction, the eyebrow and the
            * heading under it were the same string twice.
            *
            * The kinds on the far end are true from either end, and say
            * something the heading does not.
            */}
          <p style={eyebrow}>{listed(store, group)}</p>
          <h2 style={h2}>{group.description ? capitalise(group.description) : humaniseField(group.edgeKind)}</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {group.targets.map((target) => (
              <li key={target.id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <KindMark kind={target.kind} brand={brand} schema={store.schema} size={7} />
                <Link to={recordPath(store.schema, target.kind, target.id)} style={{ ...link, fontSize: "1.0625rem" }}>
                  {target.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* THE OTHER WAY ROUND: the far kind's list, narrowed to this record — the same relation read as a pile. */}
          {[...new Set(group.targets.map((target) => target.kind))].map((farKind) => (
            <Link
              key={farKind}
              to={`/${pluralSlug(store.schema, farKind)}?${encodeURIComponent(group.edgeKind)}=${encodeURIComponent(id)}`}
              style={{ ...link, ...quiet }}
              data-testid="related-all"
            >
              All {pluralOf(store, farKind).toLowerCase()} {humaniseField(group.edgeKind).toLowerCase()} {facts.label} →
            </Link>
          ))}
        </section>
      ))}

      {offered.length > 0 || facts.actions.withheld.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="record-actions">
          <h2 style={h2}>What can be done</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {offered.map((affordance) => {
              const opened = open === affordance.id;
              return (
                <button
                  key={affordance.id}
                  type="button"
                  /*
                   * The derivation's own name and place, carried onto the
                   * page. The strip and the pointer menu already marked
                   * their rows this way; this face rendered the same
                   * ranked list anonymously, so nothing could check that
                   * the three agree about what comes first.
                   */
                  data-affordance={affordance.id}
                  data-rank={affordance.rank}
                  aria-expanded={opened}
                  onClick={() => setOpen(opened ? null : affordance.id)}
                  style={{
                    ...button,
                    ...(opened
                      ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" }
                      : {}),
                  }}
                >
                  {affordance.label}
                </button>
              );
            })}
          </div>
          {offered.map((affordance) => {
            if (open !== affordance.id) return null;
            const mutation = store.allMutations().find((m) => m.name === affordance.mutation);
            if (!mutation) return null;
            return (
              <div
                key={affordance.id}
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 18,
                  border: "1px solid var(--graview-edge)",
                  borderRadius: "var(--graview-radius, 12px)",
                  background: "var(--graview-panel)",
                }}
              >
                <h3 style={{ ...h2, fontSize: "1.125rem" }}>{affordance.label}</h3>
                {mutation.description ? <p style={{ ...quiet, margin: 0 }}>{mutation.description}</p> : null}
                <DerivedForm
                  store={store}
                  mutation={mutation}
                  prefilled={affordance.args}
                  // The candidates the derivation narrowed, not every node.
                  open={affordance.open}
                  onDone={() => setOpen(null)}
                  {...(principal ? { principal } : {})}
                />
              </div>
            );
          })}
          {facts.actions.withheld.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
              {facts.actions.withheld.map((withheld) => (
                <li key={withheld.id} style={quiet}>
                  <s>{withheld.label}</s> — {withheld.refusal.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {history.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 10 }} data-testid="record-history">
          <h2 style={h2}>What has happened</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {history.map((op) => (
              <li key={op.id} style={quiet}>
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op, principal)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}

/* ----------------------------------------------------------- the problems */

/**
 * The standing, as a page: each broken rule in its own words, the thing it
 * is about as a link, and the repairs the rule itself named.
 */
export function DefaultProblemsPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, invariantContext, principal } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>{violations.length === 0 ? "The standing" : `${violations.length} ${violations.length === 1 ? "problem" : "problems"}`}</p>
        <h1 style={h1}>{violations.length === 0 ? "All rules hold" : "What is broken"}</h1>
        {violations.length === 0 ? (
          <p style={lede}>Every declared rule is satisfied by what is here.</p>
        ) : (
          <p style={lede}>Each rule says what it found, and names what would fix it.</p>
        )}
      </header>
      {/*
        * AND WHAT THE SEAT ASKED. The problems page is the face's inbox:
        * a rule that is broken and a question the seat could not answer
        * for itself are the same kind of thing to the person reading it —
        * something waiting for a decision — and putting them in two
        * places means one of them is never looked at.
        */}
      <SeatQuestions context={context} />
      {violations.map((violation, index) => {
        const first = violation.nodeIds[0];
        const node = first ? store.graph.getNode(first) : undefined;
        return (
          <section
            key={index}
            style={{
              display: "grid",
              gap: 10,
              padding: "16px 18px",
              borderLeft: "3px solid var(--graview-warn)",
              background: "var(--graview-panel-warning)",
              borderRadius: "0 var(--graview-radius, 12px) var(--graview-radius, 12px) 0",
            }}
          >
            <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>
            {node ? (
              <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <KindMark kind={node.kind as string} brand={brand} schema={store.schema} size={7} />
                <Link to={recordPath(store.schema, node.kind as string, node.id)} style={link}>
                  {labelOf(store.schema.tryDefinition(node.kind), node as never)}
                </Link>
              </p>
            ) : null}
            <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
          </section>
        );
      })}
    </PageMain>
  );
}

/**
 * A RULE'S REPAIRS, EACH IN THE SHAPE IT ACTUALLY IS.
 *
 * A repair that needs nothing is one press. A repair that still has an
 * argument to choose — the invariant said `missing: ["owner"]` — is an ASK:
 * the same derived form the record page uses, with everything the violation
 * already decided filled in.
 *
 * Both were rendered as a bare button calling `store.apply` with the
 * violation's partial args, so pressing "Hand Buy milk to somebody" on the
 * problems page threw `Invalid arguments for mutation "assign-item": owner:
 * expected string, received undefined` into the console and told the person
 * nothing at all. The actions strip has always turned this repair into an
 * ask; the two faces simply disagreed.
 */
export function Repairs<S extends AnySchema>({
  store,
  repairs,
  principal,
}: {
  readonly store: Store<S>;
  readonly repairs: readonly Repair[];
  /**
   * Who is pressing. A rule names its repairs without knowing who is
   * reading, so the page has to ask — the actions strip already does, by
   * going through `deriveAffordances`, and a repair rendered straight from
   * the violation went round it: a hand was offered "Hand Buy milk to
   * somebody", pressed it, and met the refusal on submit.
   */
  readonly principal?: Principal;
}): ReactNode {
  const [open, setOpen] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (repairs.length === 0) return null;
  const opened = open === null ? null : repairs[open];
  const asking =
    opened && (opened.missing ?? []).length > 0
      ? store.allMutations().find((mutation) => mutation.name === opened.mutation)
      : undefined;
  return (
    <div style={{ display: "grid", gap: 10 }} data-testid="repairs">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {repairs.map((repair, at) => {
          const asks = (repair.missing ?? []).length > 0;
          const verdict = store.permits({ name: repair.mutation, args: { ...repair.args } }, principal);
          if (!verdict.ok) {
            return (
              <p
                key={at}
                data-testid="withheld"
                data-withheld={verdict.refusal.wouldNeed.join(",") || "nobody"}
                style={{ margin: 0, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }}
              >
                <s>{repair.label}</s> — {verdict.refusal.message}
              </p>
            );
          }
          return (
            <button
              key={at}
              type="button"
              data-graview-repair={repair.mutation}
              data-graview-asks={asks || undefined}
              aria-expanded={asks ? open === at : undefined}
              onClick={() => {
                setFailed(null);
                if (asks) {
                  setOpen(open === at ? null : at);
                  return;
                }
                setOpen(null);
                try {
                  // As the person at the keyboard: the store judges the author, and the log names them.
                  store.apply({ name: repair.mutation, args: { ...repair.args } }, principal ? { author: principal } : {});
                } catch (error) {
                  // A refusal is a result, said where the press happened.
                  setFailed(error instanceof Error ? error.message : String(error));
                }
              }}
              style={button}
            >
              {/* The ellipsis the strip uses: a press that opens a question. */}
              {asks ? `${repair.label} …` : repair.label}
            </button>
          );
        })}
      </div>
      {asking && opened ? (
        <DerivedForm<S>
          store={store}
          mutation={asking}
          prefilled={{ ...opened.args }}
          onDone={() => setOpen(null)}
          {...(principal ? { principal } : {})}
        />
      ) : null}
      {opened && !asking && (opened.missing ?? []).length > 0 ? (
        <p data-testid="refused" role="alert" style={{ margin: 0, color: "var(--graview-warn)", fontSize: "0.8125rem" }}>
          “{opened.label}” names {opened.mutation}, which this app does not declare.
        </p>
      ) : null}
      {failed ? (
        <p data-testid="refused" role="alert" style={{ margin: 0, color: "var(--graview-warn)", fontSize: "0.8125rem" }}>
          {failed}
        </p>
      ) : null}
    </div>
  );
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A page's outer element: <main> when the face owns the document, a plain
 * section when it is embedded in a page that has its own — `main` allows no
 * other role, so the tag itself has to change.
 */
export function PageMain<S extends AnySchema>({
  context,
  style,
  children,
  ...rest
}: { context: PageContext<S>; style?: React.CSSProperties; children?: React.ReactNode } & Record<`data-${string}`, string>) {
  // Somebody above owns the landmark: the host page, or the app's own shell.
  const Tag = (context.embedded || context.framed ? "section" : "main") as "main";
  return (
    <Tag style={{ ...column, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/** Violations that implicate one node — re-exported so pages and tests share it. */
export { violationsTouching };

/**
 * The face's own type and spacing, for a page an app writes itself. A
 * custom record page that had to copy these to look like its neighbours
 * would drift from them by the second release; one object, shared, is how
 * a heavily customised face stays one face.
 */
export const pageStyles = { column, h1, h2, eyebrow, lede, quiet, rule, link, plain, button } as const;

import {
  describeNode,
  hueFor,
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
  type Store,
} from "@graview/core";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { recordFacts } from "./facts.js";
import { DerivedForm } from "./form.js";
import { kindOfSlug, pluralSlug, recordPath, spatialHref } from "./registry.js";

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
      style={{ color: "inherit" }}
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
  fontSize: 22,
  lineHeight: 1.25,
  fontWeight: 600,
  letterSpacing: "-0.006em",
};
const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--graview-ink-muted)",
};
const lede: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.5,
  color: "var(--graview-ink-muted)",
  maxWidth: "58ch",
};
const quiet: React.CSSProperties = { color: "var(--graview-ink-muted)", fontSize: 14 };
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
const plain: React.CSSProperties = { color: "inherit", textDecoration: "none" };
const button: React.CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 14px",
  borderRadius: "var(--graview-radius-sm, 8px)",
  border: "1px solid var(--graview-edge-bright)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  cursor: "pointer",
};

/** The kind's own colour, as a small mark — the thread the scene wears too. */
function KindMark({ kind, brand, size = 10 }: { kind: string; brand?: Brand; size?: number }) {
  const hue = Math.round(hueFor(kind, brand?.accents) * 360);
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "0 0 auto",
        background: `hsl(${hue} 55% 52%)`,
        boxShadow: `0 0 0 3px hsl(${hue} 55% 52% / 0.18)`,
      }}
    />
  );
}

/** Words for who did something, from the op's own author. */
function whoDid(op: Operation): string {
  if (op.author.kind === "human") return "you";
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

const liveKinds = <S extends AnySchema>(store: Store<S>): readonly string[] =>
  (store.schema.kinds as readonly string[]).filter((kind) => !store.modules.disabledKinds.has(kind));

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
  const location = useLocation();
  const problems = store.violations(invariantContext).length;
  const current = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const navLink = (path: string): React.CSSProperties => ({
    ...plain,
    fontSize: 14,
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
        fontSize: 16,
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
                fontSize: 20,
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
                  dangerouslySetInnerHTML={{ __html: brand.logo }}
                />
              ) : null}
              {brand?.name ?? "Graview"}
            </Link>
            <a
              href={sceneHref}
              style={{ ...plain, ...quiet, marginLeft: "auto", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", minHeight: 24 }}
              title="The same thing, as a scene"
            >
              Open the scene ↗
            </a>
          </div>
          <nav
            aria-label="Kinds"
            style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}
          >
            {liveKinds(store).map((kind) => {
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
                    fontSize: 12,
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
          fontSize: 13,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>{brand?.name ?? "Graview"}</span>
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

/* --------------------------------------------------------------- the home */

/**
 * The front page opens with the thing itself: what this installation is
 * and what it holds, in a sentence made of its own plurals — then each kind
 * as a section, a few of its members with a line of their own facts, and
 * the way to the rest. The standing is a sentence, not a widget.
 */
export function DefaultHomePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  const recent = [...store.log.all()].slice(-5).reverse();
  const kinds = liveKinds(store);
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
        <p style={{ margin: 0, fontSize: 15 }} data-testid="standing-card">
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

      {counted.map(({ kind, definition, members }) => {
        const path = `/${pluralSlug(store.schema, kind)}`;
        const shown = members.slice(0, 4);
        return (
          <section key={kind} style={{ ...rule, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <KindMark kind={kind} brand={brand} />
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
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op)}
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
  const [search] = useSearchParams();
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
  const members = past ? all : all.filter((node) => isCurrent(definition, node as never));
  const retired = all.length - members.length;
  const flagged = new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds));
  /*
   * AN ACT THE SEAT MAY NOT TAKE IS STATED, NOT OFFERED. The strip and the
   * record page already withhold by the policy; the list page offered every
   * creating act to everyone, and a gardener met "Agree every plot has a
   * caretaker" as a live form that refused on submit. The verdict is the
   * store's own, asked before anything is drawn.
   */
  const { principal } = context;
  const creating = store
    .allMutations()
    .filter((mutation) => (mutation.creates ?? []).includes(kind as never))
    .map((mutation) => ({ mutation, verdict: store.permits({ name: mutation.name, args: {} }, principal) }));
  const creators = creating.filter((entry) => entry.verdict.ok).map((entry) => entry.mutation);
  const withheld = creating.filter((entry) => !entry.verdict.ok);
  const plural = pluralOf(store, kind);

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={kind} brand={brand} size={8} />
          {members.length === 0
            ? "None yet"
            : `${members.length} ${members.length === 1 ? kind : plural.toLowerCase()}`}
        </p>
        <h1 style={h1}>{plural}</h1>
        {definition?.description ? <p style={lede}>{definition.description}</p> : null}
      </header>

      {members.length === 0 ? (
        <p style={{ ...lede, fontSize: 16 }} data-testid="none-yet">
          None yet
          {creators.length > 0
            ? ` — the first one starts below, with “${creators[0]?.title ?? creators[0]?.name}”.`
            : "."}
        </p>
      ) : (
        <ul
          style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}
          data-testid="records"
        >
          {members.map((node) => {
            const label = labelOf(definition, node as never);
            const facts = glance(node as Record<string, unknown>, definition, label);
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
                  style={{ ...plain, fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}
                >
                  {flagged.has(node.id) ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
                  {label}
                </Link>
                {facts ? <span style={quiet}>{facts}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {retired > 0 ? (
        <Link to={`?past=1`} style={{ ...link, ...quiet }} data-testid="past-link">
          +{retired} past
        </Link>
      ) : null}

      {creators.map((mutation) => (
        <section key={mutation.name} style={{ ...rule, display: "grid", gap: 14 }}>
          <h2 style={h2}>{mutation.title ?? mutation.name}</h2>
          {mutation.description ? <p style={{ ...quiet, margin: 0, maxWidth: "58ch" }}>{mutation.description}</p> : null}
          <DerivedForm store={store} mutation={mutation} />
        </section>
      ))}
      {withheld.length > 0 ? (
        <ul style={{ ...rule, margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }} data-testid="withheld">
          {withheld.map(({ mutation, verdict }) => (
            <li key={mutation.name} style={quiet}>
              <s>{mutation.title ?? mutation.name}</s> — {verdict.ok ? "" : verdict.refusal.message}
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
          <KindMark kind={facts.kind} brand={brand} size={8} />
          <Link to={`/${pluralSlug(store.schema, facts.kind)}`} style={plain}>
            {pluralOf(store, facts.kind)}
          </Link>
        </p>
        <h1 style={h1}>{facts.label}</h1>
        {described && described !== facts.label ? <p style={lede}>{described}</p> : null}
        <a href={spatialHref(id)} style={{ ...link, ...quiet }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
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
              {violation.repairs.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {violation.repairs.map((repair, at) => (
                    <button
                      key={at}
                      type="button"
                      onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}
                      style={button}
                    >
                      {repair.label}
                    </button>
                  ))}
                </div>
              ) : null}
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
                <dt style={{ ...eyebrow, fontSize: 11 }}>{field.label}</dt>
                <dd style={{ margin: 0, fontSize: 17, overflowWrap: "anywhere" }}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {facts.links.map((group) => (
        <section key={`${group.edgeKind}|${group.direction}`} style={{ ...rule, display: "grid", gap: 10 }}>
          <p style={eyebrow}>{humaniseField(group.edgeKind)}</p>
          <h2 style={h2}>{group.description ? capitalise(group.description) : humaniseField(group.edgeKind)}</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {group.targets.map((target) => (
              <li key={target.id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <KindMark kind={target.kind} brand={brand} size={7} />
                <Link to={recordPath(store.schema, target.kind, target.id)} style={{ ...link, fontSize: 17 }}>
                  {target.label}
                </Link>
              </li>
            ))}
          </ul>
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
                <h3 style={{ ...h2, fontSize: 18 }}>{affordance.label}</h3>
                {mutation.description ? <p style={{ ...quiet, margin: 0 }}>{mutation.description}</p> : null}
                <DerivedForm
                  store={store}
                  mutation={mutation}
                  prefilled={affordance.args}
                  onDone={() => setOpen(null)}
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
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op)}
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
  const { store, brand, invariantContext } = context;
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
                <KindMark kind={node.kind as string} brand={brand} size={7} />
                <Link to={recordPath(store.schema, node.kind as string, node.id)} style={link}>
                  {labelOf(store.schema.tryDefinition(node.kind), node as never)}
                </Link>
              </p>
            ) : null}
            {violation.repairs.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {violation.repairs.map((repair, at) => (
                  <button
                    key={at}
                    type="button"
                    onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}
                    style={button}
                  >
                    {repair.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </PageMain>
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
  const Tag = (context.embedded ? "section" : "main") as "main";
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

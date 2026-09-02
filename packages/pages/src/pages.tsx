import {
  humaniseField,
  isCurrent,
  labelOf,
  violationsTouching,
  type AnySchema,
  type Brand,
  type Principal,
  type Store,
} from "@graview/core";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { recordFacts } from "./facts.js";
import { DerivedForm } from "./form.js";
import { kindOfSlug, pluralSlug, recordPath, spatialHref } from "./registry.js";

/**
 * The default pages. Traditional on purpose: lists, records, links, forms —
 * the paradigms people already know, derived from the declaration so no app
 * writes page code. Every component here is a default registration an app
 * can replace cell by cell, the same move as replacing a view.
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

const page: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "18px 16px 64px",
  display: "grid",
  gap: 18,
};
const cardStyle: React.CSSProperties = {
  border: "1px solid var(--graview-edge)",
  borderRadius: 12,
  background: "var(--graview-panel)",
  padding: 14,
  display: "grid",
  gap: 8,
};
const mutedStyle: React.CSSProperties = { color: "var(--graview-ink-muted)", fontSize: 13 };
const headingStyle: React.CSSProperties = { margin: 0, fontSize: 15 };

/** The shell: brand, nav derived from the schema, and the way to the scene. */
export function DefaultShell<S extends AnySchema>({
  context,
  children,
}: {
  context: PageContext<S>;
  children: ReactNode;
}) {
  const { store, brand, sceneHref = "/" } = context;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--graview-bg)",
        color: "var(--graview-ink)",
        fontFamily: "var(--graview-font-body, system-ui)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          padding: "10px 16px",
          borderBottom: "1px solid var(--graview-edge)",
          background: "var(--graview-bar)",
        }}
      >
        <Link to="/" style={{ fontWeight: 650, color: "inherit", textDecoration: "none" }}>
          {brand?.name ?? "Graview"}
        </Link>
        <nav aria-label="Kinds" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(store.schema.kinds as readonly string[])
            .filter((kind) => !store.modules.disabledKinds.has(kind))
            .map((kind) => (
              <Link
                key={kind}
                to={`/${pluralSlug(store.schema, kind)}`}
                style={{ ...mutedStyle, textDecoration: "none" }}
              >
                {store.schema.tryDefinition(kind)?.plural ?? `${kind}s`}
              </Link>
            ))}
          <Link to="/problems" style={{ ...mutedStyle, textDecoration: "none" }}>
            Problems
          </Link>
        </nav>
        <a href={sceneHref} style={{ ...mutedStyle, marginLeft: "auto", textDecoration: "none" }}>
          Open the scene ↗
        </a>
      </header>
      {children}
      {context.remembers ? (
        <footer style={{ ...mutedStyle, padding: "12px 16px" }} data-testid="remembered">
          Remembered in this browser · <StartFreshLink />
        </footer>
      ) : null}
    </div>
  );
}

export function DefaultHomePage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  const recent = [...store.log.all()].slice(-6).reverse();
  return (
    <main style={page}>
      <section style={cardStyle} data-testid="standing-card">
        <h2 style={headingStyle}>{violations.length === 0 ? "All rules hold" : `${violations.length} ${violations.length === 1 ? "problem" : "problems"}`}</h2>
        {violations.length > 0 ? (
          <Link to="/problems" style={mutedStyle}>
            See what is broken, and what would fix it
          </Link>
        ) : null}
      </section>
      <section style={cardStyle}>
        <h2 style={headingStyle}>Everything here</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          {(store.schema.kinds as readonly string[])
            .filter((kind) => !store.modules.disabledKinds.has(kind))
            .map((kind) => {
              const members = store.graph.nodesOfKind(kind as never);
              return (
                <li key={kind}>
                  <Link to={`/${pluralSlug(store.schema, kind)}`} style={{ color: "inherit" }}>
                    {store.schema.tryDefinition(kind)?.plural ?? `${kind}s`}
                  </Link>{" "}
                  <span style={mutedStyle}>{members.length === 0 ? "none yet" : members.length}</span>
                </li>
              );
            })}
        </ul>
      </section>
      {recent.length > 0 ? (
        <section style={cardStyle}>
          <h2 style={headingStyle}>Recently</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {recent.map((op) => (
              <li key={op.id} style={mutedStyle}>
                {op.intent} <span aria-hidden="true">·</span> {op.author.kind}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export function DefaultListPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, invariantContext } = context;
  useStoreTick(store);
  const params = useParams();
  const [search] = useSearchParams();
  const kind = kindOfSlug(store.schema, params["slug"] ?? "");
  if (!kind) return <main style={page}>No such kind of thing here.</main>;
  const definition = store.schema.tryDefinition(kind);
  const past = search.get("past") === "1";
  const all = store.graph.nodesOfKind(kind as never);
  const members = past ? all : all.filter((node) => isCurrent(definition, node as never));
  const retired = all.length - members.length;
  const flagged = new Set(
    store
      .violations(invariantContext)
      .flatMap((violation) => violation.nodeIds),
  );
  const creators = store
    .allMutations()
    .filter((mutation) => (mutation.creates ?? []).includes(kind as never));
  return (
    <main style={page}>
      <h1 style={{ margin: 0, fontSize: 22, fontFamily: "var(--graview-font-display, inherit)" }}>
        {definition?.plural ?? `${kind}s`}
      </h1>
      {definition?.description ? <p style={{ ...mutedStyle, margin: 0 }}>{definition.description}</p> : null}
      {members.length === 0 ? (
        <p style={{ ...mutedStyle, margin: 0 }} data-testid="none-yet">
          None yet{creators.length > 0 ? " — the first one starts below." : "."}
        </p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }} data-testid="records">
          {members.map((node) => (
            <li key={node.id} style={cardStyle}>
              <Link
                to={recordPath(store.schema, kind, node.id)}
                style={{ color: "inherit", textDecoration: "none", fontWeight: 550 }}
              >
                {flagged.has(node.id) ? "⚠ " : ""}
                {labelOf(definition, node as never)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {retired > 0 ? (
        <Link to={`?past=1`} style={mutedStyle} data-testid="past-link">
          +{retired} past
        </Link>
      ) : null}
      {creators.map((mutation) => (
        <section key={mutation.name} style={cardStyle}>
          <h2 style={headingStyle}>{mutation.title ?? mutation.name}</h2>
          {mutation.description ? <p style={{ ...mutedStyle, margin: 0 }}>{mutation.description}</p> : null}
          <DerivedForm store={store} mutation={mutation} />
        </section>
      ))}
    </main>
  );
}

export function DefaultRecordPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, principal, invariantContext } = context;
  useStoreTick(store);
  const params = useParams();
  const id = decodeURIComponent(params["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const [open, setOpen] = useState<string | null>(null);
  if (!facts) return <main style={page}>Nothing lives at this address.</main>;
  const history = [...store.log.all()]
    .filter((op) => op.writes.includes(id) || op.reads.includes(id))
    .slice(-8)
    .reverse();
  return (
    <main style={page}>
      <header style={{ display: "grid", gap: 4 }}>
        <p style={{ ...mutedStyle, margin: 0 }}>{store.schema.tryDefinition(facts.kind)?.plural ?? facts.kind}</p>
        <h1 style={{ margin: 0, fontSize: 24, fontFamily: "var(--graview-font-display, inherit)" }}>
          {facts.label}
        </h1>
        <a href={spatialHref(id)} style={{ ...mutedStyle }} data-testid="spatial-link">
          See it in the scene ↗
        </a>
      </header>

      {facts.violations.length > 0 ? (
        <section style={{ ...cardStyle, borderColor: "var(--graview-warn)" }} data-testid="record-violations">
          {facts.violations.map((violation, index) => (
            <div key={index} style={{ display: "grid", gap: 6 }}>
              <p style={{ margin: 0, color: "var(--graview-warn)" }}>⚠ {violation.message}</p>
              {violation.repairs.map((repair, at) => (
                <button
                  key={at}
                  type="button"
                  onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}
                  style={{ justifySelf: "start" }}
                >
                  {repair.label}
                </button>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {facts.fields.length > 0 ? (
        <section style={cardStyle} data-testid="record-fields">
          <h2 style={headingStyle}>Details</h2>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px" }}>
            {facts.fields.map((field) => (
              <div key={field.key} style={{ display: "contents" }}>
                <dt style={mutedStyle}>{field.label}</dt>
                <dd style={{ margin: 0 }}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {facts.links.map((group) => (
        <section key={`${group.edgeKind}|${group.direction}`} style={cardStyle}>
          <h2 style={headingStyle}>
            {humaniseField(group.edgeKind)}
            {group.direction === "in" ? " (of)" : ""}
          </h2>
          {group.description ? <p style={{ ...mutedStyle, margin: 0 }}>{group.description}</p> : null}
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {group.targets.map((target) => (
              <li key={target.id}>
                <Link to={recordPath(store.schema, target.kind, target.id)} style={{ color: "inherit" }}>
                  {target.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {facts.actions.affordances.length > 0 || facts.actions.withheld.length > 0 ? (
        <section style={cardStyle} data-testid="record-actions">
          <h2 style={headingStyle}>What can be done</h2>
          {facts.actions.affordances.map((affordance) => {
            const mutation = store.allMutations().find((m) => m.name === affordance.mutation);
            if (!mutation) return null;
            const opened = open === affordance.id;
            return (
              <div key={affordance.id} style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setOpen(opened ? null : affordance.id)}
                  style={{ justifySelf: "start" }}
                >
                  {affordance.label}
                </button>
                {opened ? (
                  <DerivedForm
                    store={store}
                    mutation={mutation}
                    prefilled={affordance.args}
                    onDone={() => setOpen(null)}
                  />
                ) : null}
              </div>
            );
          })}
          {facts.actions.withheld.map((withheld) => (
            <p key={withheld.id} style={{ ...mutedStyle, margin: 0 }}>
              <s>{withheld.label}</s> — {withheld.refusal.message}
            </p>
          ))}
        </section>
      ) : null}

      {history.length > 0 ? (
        <section style={cardStyle} data-testid="record-history">
          <h2 style={headingStyle}>History</h2>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {history.map((op) => (
              <li key={op.id} style={mutedStyle}>
                {op.intent} <span aria-hidden="true">·</span> {op.author.kind}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export function DefaultProblemsPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, invariantContext } = context;
  useStoreTick(store);
  const violations = store.violations(invariantContext);
  return (
    <main style={page}>
      <h1 style={{ margin: 0, fontSize: 22, fontFamily: "var(--graview-font-display, inherit)" }}>
        {violations.length === 0 ? "All rules hold" : "What is broken"}
      </h1>
      {violations.map((violation, index) => {
        const first = violation.nodeIds[0];
        const node = first ? store.graph.getNode(first) : undefined;
        return (
          <section key={index} style={{ ...cardStyle, borderColor: "var(--graview-warn)" }}>
            <p style={{ margin: 0, color: "var(--graview-warn)" }}>⚠ {violation.message}</p>
            {node ? (
              <Link to={recordPath(store.schema, node.kind as string, node.id)} style={mutedStyle}>
                {labelOf(store.schema.tryDefinition(node.kind), node as never)}
              </Link>
            ) : null}
            {violation.repairs.map((repair, at) => (
              <button
                key={at}
                type="button"
                onClick={() => store.apply({ name: repair.mutation, args: { ...repair.args } })}
                style={{ justifySelf: "start" }}
              >
                {repair.label}
              </button>
            ))}
          </section>
        );
      })}
    </main>
  );
}

/** Violations that implicate one node — re-exported so pages and tests share it. */
export { violationsTouching };

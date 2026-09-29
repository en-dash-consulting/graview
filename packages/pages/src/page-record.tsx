import { describeNode, humaniseField, type AnySchema } from "@graview/core";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { rankedRepairs, recordFacts } from "./facts.js";
import { DerivedForm } from "./form.js";
import { placeHref, placePath, pluralSlug, recordPath, spatialHref } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { placesOf } from "./page-places.js";
import { Repairs } from "./page-problems.js";
import {
  KindMark,
  button,
  eyebrow,
  h1,
  h2,
  lede,
  link,
  listed,
  plain,
  pluralOf,
  quiet,
  rule,
  whoDid,
} from "./page-typography.js";
import { PageMain } from "./page-shell.js";
import { capitalise } from "./page-typography.js";


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
                <dt style={{ ...eyebrow, fontSize: "0.75rem" }}>{field.label}</dt>
                <dd style={{ margin: 0, fontSize: "1.125rem", overflowWrap: "anywhere" }}>{field.value}</dd>
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
                <Link to={recordPath(store.schema, target.kind, target.id)} style={{ ...link, fontSize: "1.125rem" }}>
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
              {/*
                * The relation in THIS end's words, not the edge's name: "All
                * artists by Blue Hour", "All songs tracks Blue Hour" and "All
                * eras spans Blue Hour" were the edge kind read as a verb from
                * whichever end it happened to fit.
                */}
              Sort and filter {group.description ?? `these ${pluralOf(store, farKind).toLowerCase()}`}
              {group.targets.some((target) => target.kind !== farKind) ? ` (${pluralOf(store, farKind).toLowerCase()})` : ""} →
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
                <h3 style={{ ...h2, fontSize: "1.1875rem" }}>{affordance.label}</h3>
                {mutation.description ? <p style={{ ...quiet, margin: 0 }}>{mutation.description}</p> : null}
                <DerivedForm
                  store={store}
                  mutation={mutation}
                  prefilled={affordance.args}
                  // The candidates the derivation narrowed, not every node.
                  open={affordance.open}
                  // The button says what the heading says: this end's words.
                  label={affordance.label}
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
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op, principal, { graph: store.graph as never, schema: store.schema, ...(context.seats ? { seats: context.seats } : {}) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}

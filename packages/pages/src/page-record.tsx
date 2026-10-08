import { describeNode, humanizeField, isWithheld, pageSections, type AnySchema } from "@graview/core";
import { DefaultViewElsewhere, EditableValue, LongValue, pageSays } from "@graview/primitives/pages";
import { isDefaultView, replacesPage, useGraviewIfAny, type ViewProps } from "@graview/react/provider";
import type { ComponentType } from "react";
import { Link, useParams } from "react-router-dom";
import { useRef, useState } from "react";
import { rankedRepairs, recordFacts } from "./facts.js";
import { DerivedForm } from "./form.js";
import { pluralSlug, recordPath } from "./registry.js";
import { SceneLink, type PageContext, useStoreTick } from "./page-context.js";
import { pathOfPlace, placeKey, placesOf } from "./page-places.js";
import { Repairs } from "./page-problems.js";
import {
  KindMark,
  button,
  eyebrow,
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
import { PageMain, PageTitle } from "./page-shell.js";
import { capitalize } from "./page-typography.js";


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
  // A value is changed where it stands where the face provides the store its edits run through (a face handed views).
  const inPlace = useGraviewIfAny<S>() !== null;
  const params = useParams();
  const id = decodeURIComponent(params["id"] ?? "");
  const facts = recordFacts(store, id, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { context: invariantContext } : {}),
  });
  const [open, setOpen] = useState<string | null>(null);
  const actsHeading = useRef<HTMLHeadingElement | null>(null);
  if (!facts) {
    return (
      <PageMain context={context}>
        <PageTitle context={context}>Nothing lives at this address.</PageTitle>
      </PageMain>
    );
  }
  const node = store.graph.getNode(id) as (Record<string, unknown> & { id: string; kind: string }) | undefined;
  const definition = store.schema.tryDefinition(facts.kind);
  // The declaration's own sentence for this thing, when it has one and it
  // says more than the name.
  const described = definition?.describe && node ? describeNode(definition, node) : null;
  const history = [...store.log.all()]
    // A change this seat may not see is not part of a record's history as told to it (FR-16).
    .filter((op) => !isWithheld(op) && (op.writes.includes(id) || op.reads.includes(id)))
    .slice(-8)
    .reverse();
  /*
   * A repair is offered ONCE, beside the rule that named it. The derived
   * set still carries it — parity with the scene is a claim about the
   * facts, not the rendering — but listing it again under "what can be
   * done" is the same button twice on one page.
   */
  const offered = facts.actions.affordances.filter((affordance) => affordance.provider !== "invariant");
  /*
   * THE KIND'S OWN PAGE VIEW, AT THE HEAD (FR-35). A view the app gave the
   * kind at one × full — a component, or a spec's `page` — is drawn under
   * the heading, where the scene draws it in focus. This page IS the
   * framework's own record, so a view that wraps the default
   * (`DefaultView`) draws only what it adds to it here.
   */
  const ownPage = context.views?.lookup(facts.kind, { cardinality: "one", fidelity: "full" });
  const PageView = ownPage !== undefined && !isDefaultView(ownPage) ? (ownPage as ComponentType<ViewProps<S>>) : undefined;
  /*
   * WHAT THE PAGE VIEW ALREADY SAYS IS NOT SAID AGAIN (FR-141). A kind's
   * declared page heads this record, and the facts and the related records
   * under it said its goal and its four topics a second time. The facts it
   * read and the records it listed are left out below; a relation left with
   * nothing to list has no heading.
   */
  const said = PageView && node ? pageSays(ownPage, node as never, store.graph as never) : undefined;
  const fields = said ? facts.fields.filter((field) => !said.fields.has(field.key)) : facts.fields;
  const links = said
    ? facts.links.flatMap((group) => {
        const targets = group.targets.filter((target) => !said.records.has(target.id));
        return targets.length > 0 ? [{ ...group, targets }] : [];
      })
    : facts.links;
  /*
   * A view that says it IS the record's page (FR-149: a worker view whose
   * manifest says `replaces: "page"`) is drawn alone under the heading,
   * with what is wrong and what has happened: no facts, no links, nothing
   * to be done but what it offers. Any other view sits above all of those.
   */
  const whole = PageView !== undefined && replacesPage(ownPage);

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={{ ...eyebrow, display: "flex", alignItems: "center", gap: 8 }}>
          <KindMark kind={facts.kind} brand={brand} schema={store.schema} size={8} />
          <Link to={`/${pluralSlug(store.schema, facts.kind)}`} style={plain}>
            {pluralOf(store, facts.kind)}
          </Link>
        </p>
        <PageTitle context={context}>{facts.label}</PageTitle>
        {described && described !== facts.label ? <p style={lede}>{described}</p> : null}
        <SceneLink context={context} stop={`#focus=${encodeURIComponent(id)}`} style={{ ...link, ...quiet }} data-testid="spatial-link" />
        {placesOf(context).some((place) => place.kind === facts.kind || place.across === facts.kind) ? (
          /* WHERE IT IS SEEN: the pictures this kind of thing appears in, each as a page and as a stop in the scene. */
          <p style={{ ...quiet, margin: 0 }} data-testid="seen-in">
            Seen in:{" "}
            {placesOf(context)
              .filter((place) => place.kind === facts.kind || place.across === facts.kind)
              .map((place, index) => (
                <span key={placeKey(place)}>
                  {index > 0 ? " · " : null}
                  <Link to={pathOfPlace(context, place)} style={link}>
                    {place.title}
                  </Link>{" "}
                  <SceneLink context={context} stop={`#view=${encodeURIComponent(place.as)}`} style={{ ...link, ...quiet }} title={`${place.title}, in the scene`}>
                    ↗
                  </SceneLink>
                </span>
              ))}
          </p>
        ) : null}
      </header>

      {PageView && node ? (
        <section data-testid="record-view" style={{ display: "grid", minWidth: 0 }}>
          <DefaultViewElsewhere>
            <PageView node={node as never} cardinality="one" fidelity="full" mode="fullscreen" selected={false} {...(facts.violations.length > 0 ? { flagged: [id] } : {})} />
          </DefaultViewElsewhere>
        </section>
      ) : null}

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

      {!whole && fields.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="record-fields">
          <h2 style={h2}>The facts</h2>
          {/*
            * IN THE SECTIONS THE KIND'S PAGE DECLARES (FR-148) — its first
            * fields, each group under its title, the rest under "Details" —
            * or, unsaid, in declared order. Each value is changed where it
            * stands, as the scene's record changes it; prose spans the page
            * under its label, its paragraphs kept (FR-146, FR-147).
            */}
          {pageSections(definition, fields).map((section, index) => {
            const list = (
              <dl
                style={{
                  margin: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "14px 24px",
                }}
              >
                {section.fields.map((field) =>
                  field.long ? (
                    <LongValue<S>
                      key={field.key}
                      nodeId={id}
                      field={field.key}
                      label={field.label}
                      value={field.value}
                      style={{ gridColumn: "1 / -1", gap: 4 }}
                      labelStyle={{ ...eyebrow, fontSize: "0.75rem" }}
                      valueStyle={{ fontSize: "1.0625rem", lineHeight: 1.6 }}
                    />
                  ) : (
                    <div key={field.key} style={{ display: "grid", gap: 2, minWidth: 0, alignContent: "start" }}>
                      <dt style={{ ...eyebrow, fontSize: "0.75rem" }}>{field.label}</dt>
                      <dd style={{ margin: 0, fontSize: "1.125rem", overflowWrap: "anywhere", minWidth: 0 }}>
                        {inPlace ? <EditableValue<S> nodeId={id} field={field.key} value={field.value} /> : field.value}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            );
            return section.title ? (
              <section key={index} style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <h3 data-graview-field-group={section.title} style={{ ...h2, fontSize: "1.0625rem" }}>
                  {section.title}
                </h3>
                {list}
              </section>
            ) : (
              <div key={index}>{list}</div>
            );
          })}
        </section>
      ) : null}

      {(whole ? [] : links).map((group) => (
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
          <h2 style={h2}>{group.description ? capitalize(group.description) : humanizeField(group.edgeKind)}</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {group.targets.map((target) => (
              <li key={target.id} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <KindMark kind={target.kind} brand={brand} schema={store.schema} size={7} />
                <Link to={recordPath(store.schema, target.kind, target.id)} style={{ ...link, fontSize: "1.125rem" }}>
                  {target.label}
                  {target.apart ? <span style={quiet}> · {target.apart}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          {/* THE OTHER WAY ROUND: the far kind's list, narrowed to this record — the same relation read as a pile.
              Not for a relation that holds ONE by declaration — a deal's buyer, a vehicle's lot: sorting and
              filtering a list that can only ever hold one thing is a link to the same name again. */}
          {(group.direction === "out" && store.schema.edge(group.edgeKind)?.cardinality === "one"
            ? []
            : [...new Set(group.targets.map((target) => target.kind))]
          ).map((farKind) => (
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

      {!whole && (offered.length > 0 || facts.actions.withheld.length > 0) ? (
        <section style={{ ...rule, display: "grid", gap: 14 }} data-testid="record-actions">
          <h2 style={h2} ref={actsHeading} tabIndex={-1}>What can be done</h2>
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
                  onDone={() => {
                    setOpen(null);
                    /*
                     * THE KEYBOARD GOES BACK TO THE ACT THAT ASKED. The form
                     * unmounts on done and took the keyboard to <body>; the
                     * button that opened it is where it belongs, and when the
                     * act is no longer offered, the heading of the acts.
                     */
                    const asked = affordance.id;
                    requestAnimationFrame(() => {
                      const opener = actsHeading.current?.parentElement?.querySelector<HTMLElement>(`[data-affordance="${asked.replace(/["\\]/g, "\\$&")}"]`);
                      (opener ?? actsHeading.current)?.focus();
                    });
                  }}
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
                <span style={{ color: "var(--graview-ink)" }}>{op.intent}</span> — {whoDid(op, principal, { graph: store.graph as never, schema: store.schema, ...(context.seats ? { seats: context.seats } : {}), ...(context.people ? { people: context.people } : {}) })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}

import { failureWords, labelOf, violationsTouching, type AnySchema, type Principal, type Repair, type Store } from "@graview/core";
import { Link } from "react-router-dom";
import { useRef, useState, type ReactNode } from "react";
import { DerivedForm } from "./form.js";
import { recordPath } from "./registry.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { SeatQuestions } from "./page-map.js";
import { KindMark, button, column, eyebrow, h1, h2, lede, link, plain, quiet, rule } from "./page-typography.js";
import { PageMain, PageTitle } from "./page-shell.js";


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
        <PageTitle context={context}>{violations.length === 0 ? "All rules hold" : "What is broken"}</PageTitle>
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
                  {labelOf(store.schema.tryDefinition(node.kind), node)}
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
  /* The repair buttons, so an answered ask gives the keyboard back to the one that asked. */
  const pressed = useRef<(HTMLButtonElement | null)[]>([]);
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
                style={{ margin: 0, fontSize: "0.875rem", color: "var(--graview-ink-muted)" }}
              >
                <s>{repair.label}</s> — {verdict.refusal.message}
              </p>
            );
          }
          return (
            <button
              key={at}
              ref={(element) => {
                pressed.current[at] = element;
              }}
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
                  setFailed(failureWords(store.schema, store.allMutations(), error));
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
          // What the rule left open, and only that, under the repair's own words.
          only={opened.missing ?? []}
          label={opened.label}
          onDone={() => {
            const asked = open;
            setOpen(null);
            // The form goes; the keyboard goes back to the press that opened it, if the repair is still here.
            requestAnimationFrame(() => {
              const home = asked === null ? null : pressed.current[asked];
              if (home?.isConnected) {
                home.focus();
                return;
              }
              // The problem is gone with its repairs: the page's own heading is the honest home.
              const heading = document.querySelector<HTMLElement>("[data-graview-page-title]") ?? document.querySelector<HTMLElement>("main h1, main h2");
              if (!heading) return;
              if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
              heading.focus();
            });
          }}
          {...(principal ? { principal } : {})}
        />
      ) : null}
      {opened && !asking && (opened.missing ?? []).length > 0 ? (
        <p data-testid="refused" role="alert" style={{ margin: 0, color: "var(--graview-warn)", fontSize: "0.875rem" }}>
          “{opened.label}” names {opened.mutation}, which this app does not declare.
        </p>
      ) : null}
      {failed ? (
        <p data-testid="refused" role="alert" style={{ margin: 0, color: "var(--graview-warn)", fontSize: "0.875rem" }}>
          {failed}
        </p>
      ) : null}
    </div>
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

import { brokenWords, failureWords, labelOf, violationsTouching, type AnySchema, type Brand, type Principal, type Repair, type Store, type Violation } from "@graview/core";
import { problemLine, problemTitle, RuleLineView, useLined, useRuleLines } from "@graview/primitives/pages";
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
  const rules = store.allInvariants();
  // Each problem with its rule's line, where the rule has a shape.
  const lined = useLined(store, violations);
  const ruleLines = useRuleLines(store.schema, rules);
  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        {/* The count said once, quietly under the title: no eyebrow repeating the head. */}
        <PageTitle context={context}>{violations.length === 0 ? "All rules hold" : "What is broken"}</PageTitle>
        <p style={lede} data-testid="problems-count">
          {violations.length === 0 ? "Every declared rule is satisfied by what is here." : brokenWords(violations)}
        </p>
      </header>
      {/*
        * AND WHAT THE SEAT ASKED. The problems page is the face's inbox:
        * a rule that is broken and a question the seat could not answer
        * for itself are the same kind of thing to the person reading it —
        * something waiting for a decision — and putting them in two
        * places means one of them is never looked at.
        */}
      <SeatQuestions context={context} />
      {lined.map((violation, index) => {
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
            {/* A rule with a shape names its record first, then what it found; a rule that is a function says its sentence first. */}
            {violation.line ? null : <ProblemSaid violation={violation} schema={store.schema} {...(brand ? { brand } : {})} />}
            {node ? (
              <p style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <KindMark kind={node.kind as string} brand={brand} schema={store.schema} size={7} />
                <Link to={recordPath(store.schema, node.kind as string, node.id)} style={link}>
                  {labelOf(store.schema.tryDefinition(node.kind), node)}
                </Link>
              </p>
            ) : null}
            {violation.line ? <ProblemSaid violation={violation} schema={store.schema} {...(brand ? { brand } : {})} /> : null}
            <Repairs<S> store={store} repairs={violation.repairs} {...(principal ? { principal } : {})} />
          </section>
        );
      })}
      {/*
        * EVERY RULE, AS ITS SHAPE. What the app holds itself to is worth
        * reading when nothing is broken too: the kind's mark, then what must
        * hold — "◆ Scenario  margin ≥ target margin, when plan's price > $0" —
        * and whether it holds now. A rule that is a function has its title.
        */}
      {rules.length > 0 ? (
        <section style={{ ...rule, display: "grid", gap: 12 }} data-testid="rules">
          <h2 style={h2}>The rules</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
            {rules.map((one) => {
              const broken = violations.filter((violation) => violation.invariant === one.name).length;
              const line = ruleLines.get(one.name);
              const title = one.label ?? one.name;
              return (
                <li key={one.name} data-graview-rule={one.name} style={{ display: "grid", gap: 2 }}>
                  <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 12, rowGap: 2 }}>
                    {line ? <RuleLineView line={line} schema={store.schema} {...(brand ? { brand } : {})} style={{ flex: "1 1 18rem" }} /> : <span style={{ flex: "1 1 18rem", fontWeight: 550 }}>{title}</span>}
                    <span style={{ ...quiet, fontSize: "0.875rem", color: broken > 0 ? "var(--graview-warn)" : "var(--graview-ink-faint)" }}>
                      {broken === 0 ? "holds" : `broken in ${broken} ${broken === 1 ? "place" : "places"}`}
                    </span>
                  </span>
                  {line && title.trim().length > 0 ? <span style={{ ...quiet, fontSize: "0.875rem" }}>{title}</span> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </PageMain>
  );
}

/**
 * WHAT A PROBLEM SAYS, on a page: the rule's shape with the record's values
 * (the page names the record), and under it the rule's own title; a rule
 * that is a function says its sentence, as it always has.
 */
export function ProblemSaid({ violation, schema, brand }: { readonly violation: Violation; readonly schema: AnySchema; readonly brand?: Brand }): ReactNode {
  if (!violation.line) return <p style={{ margin: 0, color: "var(--graview-warn)", fontWeight: 550 }}>{violation.message}</p>;
  const title = problemTitle(violation);
  return (
    <div style={{ display: "grid", gap: 2 }} data-testid="problem-line" title={violation.message !== problemLine(violation) ? violation.message : undefined}>
      <RuleLineView line={violation.line} schema={schema} {...(brand ? { brand } : {})} lead="none" style={{ color: "var(--graview-warn)", fontSize: "1.0625rem" }} />
      {title ? <span style={{ ...quiet, fontSize: "0.875rem" }}>{title}</span> : null}
    </div>
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
 * custom record page that had to copy these to look like its neighbors
 * would drift from them by the second release; one object, shared, is how
 * a heavily customized face stays one face.
 */
export const pageStyles = { column, h1, h2, eyebrow, lede, quiet, rule, link, plain, button } as const;

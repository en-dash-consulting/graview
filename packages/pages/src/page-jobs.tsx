import { counted, labelOf, type AnySchema, type Principal } from "@graview/core";
import { answerJob, jobsFor, jobsOf, type ResolvedJob } from "@graview/core/jobs";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { recordFacts } from "./facts.js";
import { DerivedForm } from "./form.js";
import type { PageContext } from "./page-context.js";
import { PageTitle } from "./page-shell.js";
import { button, Glance, glanceRuns, h2, lede, onward, Onward, pluralOf, quiet, ROWS_CSS } from "./page-typography.js";
import { pluralSlug, recordPath } from "./registry.js";

/*
 * THE HOME OPENS ON THE JOBS (Roadmap f-design-composer).
 *
 * An app that says what its people come to do (`purpose.jobs`, f-app-jobs)
 * and draws no home of its own opens on those questions rather than on what
 * it holds: each job its question as the heading, how many records answer
 * it as this seat sees them, the first of them, and on each the act people
 * take next — the record page's own act and form, not a new control. One
 * focal point: the first job with records waiting leads, as the page's
 * title; the others follow smaller; a job with nothing waiting is one quiet
 * line, never an empty box.
 */

/** How many records a job shows on the home: the leading one a few more. */
const LEAD_ROWS = 5;
const ROWS = 3;

/** The anybody a page is read as when the host names nobody. */
const ANYBODY: Principal = { kind: "human" };

export interface AnsweredJob {
  readonly job: ResolvedJob;
  readonly count: number;
  readonly ids: readonly string[];
}

/**
 * THE JOBS THIS SEAT COMES TO DO, ANSWERED as it sees the app: the app's
 * jobs (`jobsOf`) narrowed to its roles (`jobsFor`), each answered held to
 * its sight (`answerJob`). None when the page was not handed the app, or the
 * app says no jobs.
 */
export function answeredJobs<S extends AnySchema>(context: PageContext<S>): readonly AnsweredJob[] {
  if (!context.app) return [];
  const principal = context.principal ?? ANYBODY;
  return jobsFor(jobsOf(context.app), principal).map((job) => ({ job, ...answerJob(context.store, job, principal) }));
}

/** The jobs, as the home leads with them: the first with records waiting first and as the title, then the rest with records, then the quiet ones. */
export function JobsOnTheHome<S extends AnySchema>({ context, answered }: { context: PageContext<S>; answered: readonly AnsweredJob[] }) {
  const waiting = answered.filter((one) => one.count > 0);
  const quietOnes = answered.filter((one) => one.count === 0);
  const [lead, ...rest] = waiting;
  return (
    // A list's measure, not the page's: on a desk the act stands near the record it is for, not a screen's width away.
    <div style={{ display: "grid", gap: 40, maxWidth: "46rem", outline: "none" }} data-testid="jobs" tabIndex={-1}>
      <style>{ROWS_CSS}</style>
      {lead ? <Job context={context} answered={lead} leads /> : null}
      {rest.map((one) => (
        <Job key={one.job.name} context={context} answered={one} />
      ))}
      {quietOnes.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }} data-testid="jobs-quiet">
          {quietOnes.map(({ job }) => (
            <li key={job.name} data-testid="job-quiet" data-job={job.name} style={{ overflowWrap: "anywhere" }}>
              {job.ask} <span style={quiet}>No {pluralOf(context.store, job.kind).toLowerCase()} right now.</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * ONE JOB: its question, how many answer it, its first records — each its
 * name (the way to its page), its glance and the job's act — and the way to
 * the kind's list. That list is the whole kind: an address narrows a list by
 * a field's value (`?filter=status:open`), not by a job's rule, so the link
 * says the kind and not the job.
 */
function Job<S extends AnySchema>({ context, answered, leads = false }: { context: PageContext<S>; answered: AnsweredJob; leads?: boolean }) {
  const { store } = context;
  const { job, count, ids } = answered;
  const shown = ids.slice(0, leads ? LEAD_ROWS : ROWS);
  const plural = pluralOf(store, job.kind);
  const heading = leads ? (
    <PageTitle context={context} data-testid="job-ask">
      {job.ask}
    </PageTitle>
  ) : (
    <h2 style={h2} data-testid="job-ask">
      {job.ask}
    </h2>
  );
  return (
    <section className="graview-list" style={{ display: "grid", gap: leads ? 12 : 8, minWidth: 0 }} data-testid="job" data-job={job.name} {...(leads ? { "data-leads": "" } : {})}>
      <header style={{ display: "grid", gap: 4 }}>
        {heading}
        <p style={{ ...(leads ? lede : quiet), margin: 0 }} data-testid="job-count">
          {counted(store.schema, job.kind, count)}
        </p>
      </header>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", borderBottom: "1px solid var(--graview-edge)" }} data-testid="job-rows">
        {shown.map((id) => (
          <JobRow key={id} context={context} job={job} id={id} />
        ))}
      </ul>
      <p style={{ ...quiet, margin: 0, display: "flex", flexWrap: "wrap", gap: "0 12px", alignItems: "baseline" }}>
        {count > shown.length ? <span data-testid="job-more">{count - shown.length} more</span> : null}
        <Link to={`/${pluralSlug(store.schema, job.kind)}`} style={onward} data-testid="job-all">
          <Onward>All {plural.toLowerCase()}</Onward>
        </Link>
      </p>
    </section>
  );
}

/** A record answering a job: its name, the way to its page, its glance, and the job's act where this seat may take it. */
function JobRow<S extends AnySchema>({ context, job, id }: { context: PageContext<S>; job: ResolvedJob; id: string }) {
  const { store, principal, invariantContext } = context;
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLLIElement | null>(null);
  // What this seat is told of the record: a field its sight keeps from it is no part of the glance.
  const node = store.seenBy(principal ?? ANYBODY).graph.getNode(id) as (Record<string, unknown> & { id: string; kind: string }) | undefined;
  if (!node) return null;
  const definition = store.schema.tryDefinition(node.kind);
  const label = labelOf(definition, node);
  const runs = glanceRuns(node, definition, label);
  const affordance = job.act
    ? recordFacts(store, id, { ...(principal ? { principal } : {}), ...(invariantContext ? { context: invariantContext } : {}) })?.actions.affordances.find((one) => one.mutation === job.act && one.provider !== "invariant")
    : undefined;
  const mutation = affordance ? store.allMutations().find((one) => one.name === affordance.mutation) : undefined;
  const panel = `job-${job.name}-${id}`;
  return (
    <li
      ref={row}
      data-testid="job-row"
      data-graview-record={id}
      style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: "8px 12px", minHeight: "2.75rem", padding: "8px 0", borderTop: "1px solid var(--graview-edge)" }}
    >
      <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
        <Link to={recordPath(store.schema, node.kind, id)} className="graview-row-title" {...(label.length > 60 ? { title: label } : {})}>
          {label}
        </Link>
        {runs.length > 0 ? (
          <span className="graview-row-glance">
            <Glance runs={runs} />
          </span>
        ) : null}
      </span>
      {affordance && mutation ? (
        <button
          type="button"
          data-testid="job-act"
          data-graview-act={affordance.mutation}
          aria-expanded={open}
          aria-controls={panel}
          aria-label={`${affordance.label}: ${label}`}
          onClick={() => setOpen(!open)}
          style={{ ...button, position: "relative", ...(open ? { borderColor: "var(--graview-accent)", color: "var(--graview-accent)" } : {}) }}
        >
          {affordance.label}
        </button>
      ) : null}
      {open && affordance && mutation ? (
        <div id={panel} style={{ gridColumn: "1 / -1", position: "relative", display: "grid", gap: 10, padding: "4px 0 8px" }}>
          <DerivedForm
            store={store}
            mutation={mutation}
            prefilled={affordance.args}
            open={affordance.open}
            label={affordance.label}
            autoFocus
            onDone={() => {
              const jobs = row.current?.closest<HTMLElement>('[data-testid="jobs"]');
              setOpen(false);
              /*
               * THE KEYBOARD STAYS ON THE JOBS. Done, the record most often
               * leaves the job and its row goes with the form: the keyboard
               * goes to the act on the record that took its place, else to
               * the jobs themselves — never to <body>.
               */
              requestAnimationFrame(() => {
                const stays = row.current?.isConnected ? row.current.querySelector<HTMLElement>('[data-testid="job-act"]') : null;
                (stays ?? jobs?.querySelector<HTMLElement>('[data-testid="job-act"]') ?? jobs)?.focus();
              });
            }}
            {...(principal ? { principal } : {})}
          />
        </div>
      ) : null}
    </li>
  );
}

import {
  describeSearched,
  formFields,
  humaniseField,
  search,
  withArticle,
  type AnyMutationDefinition,
  type AnySchema,
  type Hit,
  type Principal,
  type Store,
} from "@graview/core";
import type { Affordance } from "@graview/tools";
import { Link, useSearchParams } from "react-router-dom";
import { kindFacts } from "./facts.js";
import { DerivedForm } from "./form.js";
import { type PageContext, useStoreTick } from "./page-context.js";
import { PageMain } from "./page-shell.js";
import { placesOf } from "./page-places.js";
import { DISPLAY, KindMark, eyebrow, h1, h2, lede, link, plain, pluralOf, quiet, rule } from "./page-typography.js";
import { placePath, pluralSlug, recordPath } from "./registry.js";

/**
 * `/search?q=` — WHAT THE WORDS FIND, grouped by kind.
 *
 * The scene's Find box and this page are one matcher and one address: the
 * same hits, the same why, the same `key:value` conditions. Each kind's
 * heading is a link to its list with the words carried, so "the three tasks
 * about the van" is one press from here and arranged from there. The record
 * is the destination; this page only says where things are.
 */
export function DefaultSearchPage<S extends AnySchema>({ context }: { context: PageContext<S> }) {
  const { store, brand, principal, invariantContext } = context;
  useStoreTick(store);
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const today = typeof invariantContext?.["today"] === "string" ? (invariantContext["today"] as string) : undefined;
  const found = search(store, q, {
    ...(principal ? { principal } : {}),
    places: placesOf(context),
    flagged: new Set(store.violations(invariantContext).flatMap((violation) => violation.nodeIds)),
    ...(today ? { today } : {}),
    limit: 200,
  });
  const records = found.hits.filter((hit): hit is Extract<Hit, { about: "node" }> => hit.about === "node");
  const named = found.hits.filter((hit) => hit.about === "kind" || hit.about === "place" || hit.about === "rule");
  const kinds = [...new Set(records.map((hit) => hit.kind))];
  const asked = q.trim();

  return (
    <PageMain context={context}>
      <header style={{ display: "grid", gap: 12 }}>
        <p style={eyebrow}>Search</p>
        <h1 style={h1} data-testid="search-heading">
          {asked.length === 0
            ? "Find anything by its name"
            : found.hits.length === 0
              ? <>Nothing here is called “{asked}”.</>
              : <>{countSentence(store, found.byKind)} for “{asked}”</>}
        </h1>
        {asked.length > 0 ? (
          <p style={{ ...quiet, margin: 0 }} data-testid="search-searched">
            {describeSearched(store.schema, found.searched)}
            {found.conditions
              .filter((condition) => condition.key !== "is" && condition.admittedBy.length < found.searched.kinds.length)
              .map((condition) => (
                <span key={`${condition.key}:${condition.value}`}>
                  {" "}
                  {condition.key}:{condition.value} narrows{" "}
                  {condition.admittedBy.length === 0 ? "nothing here" : condition.admittedBy.map((kind) => pluralOf(store, kind).toLowerCase()).join(" and ")}.
                </span>
              ))}
          </p>
        ) : (
          <p style={lede}>
            Type in the box above. Words find the start of words in names and in what each record says;{" "}
            <code>done:false</code> and the like narrow as a list does, and <code>is:any</code> includes what is past.
          </p>
        )}
      </header>

      {named.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }} data-testid="search-named">
          {named.map((hit) => (
            <li key={`${hit.about}:${hit.about === "rule" ? hit.name : hit.about === "place" ? hit.as : hit.kind}`} data-testid="search-hit" data-about={hit.about}>
              {hit.about === "kind" ? (
                <Link to={`/${pluralSlug(store.schema, hit.kind)}`} style={link}>
                  {hit.label}
                  {hit.count > 0 ? <span style={quiet}> · {hit.count} match</span> : null}
                </Link>
              ) : hit.about === "place" ? (
                <Link to={placePath(hit.as)} style={link}>
                  Go to {hit.title}
                </Link>
              ) : hit.about === "rule" ? (
                <Link to="/problems" style={link}>
                  The rule “{hit.label}”
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {kinds.map((kind) => (
        <section key={kind} style={{ display: "grid", gap: 0 }} data-testid="search-group" data-kind={kind}>
          <h2 style={{ ...h2, fontSize: "1.0625rem", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <KindMark kind={kind} brand={brand} schema={store.schema} size={8} />
            {/* The heading is the kind's list, narrowed by the same words. */}
            <Link to={`/${pluralSlug(store.schema, kind)}?${new URLSearchParams({ q: asked }).toString()}`} style={link} data-testid="search-kind-link">
              {pluralOf(store, kind)}
            </Link>
            <span style={quiet}>{found.byKind[kind]}</span>
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 0 }}>
            {records
              .filter((hit) => hit.kind === kind)
              .map((hit) => (
                <li
                  key={hit.id}
                  data-testid="search-hit"
                  data-about="node"
                  style={{ display: "grid", gap: 2, padding: "12px 0", borderTop: "1px solid var(--graview-edge)" }}
                >
                  <Link to={recordPath(store.schema, kind, hit.id)} style={{ ...plain, fontFamily: DISPLAY, fontSize: "1.1875rem", fontWeight: 600, lineHeight: 1.3 }}>
                    {hit.flagged ? <span style={{ color: "var(--graview-warn)" }}>⚠ </span> : null}
                    {hit.label}
                    {hit.current ? null : <span style={quiet}> · past</span>}
                  </Link>
                  <WhyLine why={hit.why} />
                </li>
              ))}
          </ul>
        </section>
      ))}

      {asked.length > 0 && found.hits.length === 0 ? (
        <SearchToCreate store={store} kinds={found.searched.kinds} words={found.words} {...(principal ? { principal } : {})} {...(invariantContext ? { invariantContext } : {})} />
      ) : null}
    </PageMain>
  );
}

/** What made a hit a hit, when it was not the name: "Notes: …the van on Friday…". */
export function WhyLine({ why }: { why: Hit["why"] }) {
  if (why.field === "label") return null;
  return (
    <span style={quiet} data-testid="search-why">
      {why.reading}: {why.fragment}
    </span>
  );
}

function countSentence<S extends AnySchema>(store: Store<S>, byKind: Readonly<Record<string, number>>): string {
  const parts = Object.entries(byKind).map(
    ([kind, count]) => `${count} ${count === 1 ? humaniseField(kind).toLowerCase() : pluralOf(store, kind).toLowerCase()}`,
  );
  if (parts.length === 0) return "Found";
  return parts.length === 1 ? capitalFirst(parts[0]!) : capitalFirst(`${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);
}

const capitalFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * THE WAY FORWARD FROM NOTHING. Every act the seat may run that begins one
 * of the searched kinds and takes a name, offered with the words already in
 * it — "A task called “zzz”", pressed with the act's own title. Every piece is derived already: the
 * beginnings, the form, the policy.
 */
export interface Beginning<S extends AnySchema> {
  readonly kind: string;
  readonly affordance: Affordance;
  readonly mutation: AnyMutationDefinition<S>;
  /** The argument the words go into. */
  readonly arg: string;
}

export function beginningsFor<S extends AnySchema>(
  store: Store<S>,
  kinds: readonly string[],
  options: { readonly principal?: Principal; readonly invariantContext?: Readonly<Record<string, unknown>> } = {},
): readonly Beginning<S>[] {
  const out: Beginning<S>[] = [];
  const seen = new Set<string>();
  for (const kind of kinds) {
    const facts = kindFacts(store, kind, {
      ...(options.principal ? { principal: options.principal } : {}),
      ...(options.invariantContext ? { context: options.invariantContext } : {}),
    });
    const named = store.schema.tryDefinition(kind)?.fieldRoles?.["label"];
    for (const affordance of facts.actions.affordances) {
      const mutation = store.allMutations().find((candidate) => candidate.name === affordance.mutation);
      if (!mutation || !(mutation.creates as readonly string[] | undefined)?.includes(kind)) continue;
      if (seen.has(mutation.name)) continue;
      const args = formFields(mutation.input).map((field) => field.name);
      const arg = args.includes("label") ? "label" : named && args.includes(named) ? named : undefined;
      if (!arg || affordance.args[arg] !== undefined) continue;
      seen.add(mutation.name);
      out.push({ kind, affordance, mutation, arg });
    }
  }
  return out;
}

export function SearchToCreate<S extends AnySchema>({
  store,
  kinds,
  words,
  principal,
  invariantContext,
}: {
  store: Store<S>;
  kinds: readonly string[];
  words: string;
  principal?: Principal;
  invariantContext?: Readonly<Record<string, unknown>>;
}) {
  const offered = beginningsFor(store, kinds, {
    ...(principal ? { principal } : {}),
    ...(invariantContext ? { invariantContext } : {}),
  });
  if (offered.length === 0 || words.trim().length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 24 }} data-testid="search-to-create">
      {offered.map(({ kind, affordance, mutation, arg }) => (
        <section key={`${affordance.id}|${words}`} style={{ ...rule, display: "grid", gap: 14 }}>
          {/* The thing, named: an act's title need not say its kind ("Welcome them in"), so the heading does and the button keeps the act's own words. */}
          <h2 style={h2}>
            {capitalFirst(withArticle(kind))} called “{words}”
          </h2>
          <DerivedForm
            store={store}
            mutation={mutation}
            prefilled={affordance.args}
            open={affordance.open}
            initial={{ [arg]: words }}
            {...(principal ? { principal } : {})}
          />
        </section>
      ))}
    </div>
  );
}

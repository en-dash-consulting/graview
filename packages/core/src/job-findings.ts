import { listFieldsOf, type ListFields } from "./arrangement.js";
import type { GraviewApp } from "./app.js";
import { documentRelationActOf } from "./document/relation-acts.js";
import type { GraviewDocument } from "./document/schema.js";
import { error, type Finding } from "./document/findings.js";
import { PurposeSpec } from "./document/purpose-spec.js";
import { documentListFields } from "./kind-list.js";
import { derivedActOf, givenWhenNeverArchived } from "./mutations/derived-names.js";
import { deriveMutations, subjectKindsOf } from "./mutations/derive-edits.js";
import { linkedEdges, localEdges } from "./schema/linked.js";
import type { AnySchema } from "./schema/schema.js";
import { analyzeExpr } from "./document/expr/analyze.js";
import { ExprSyntaxError, parseExpr } from "./document/expr/parse.js";
import { gridSortOf } from "./grid-sort.js";
import { MOST_JOBS, type AppPurpose, type JobDeclaration } from "./job-shape.js";

/*
 * A DECLARATION'S JOBS, JUDGED (Roadmap f-app-jobs), in one vocabulary for a
 * document and a TypeScript app: what each names is held to what the app
 * declares, and each way it could not be answered is a sentence before a
 * model or a design reads it as meant. Its `where` is read as a computed
 * field's expression is — parsed, every bare name one of the kind's fields,
 * relations or computed fields, every relation walked and kind swept one
 * the app has — and its `sort` as a kind's list's order is.
 *
 * Codes: `job-kind`, `job-where`, `job-sort`, `job-act`, `job-act-kind`,
 * `job-role`, `job-name-taken`, `jobs-too-many` — every one an error.
 */

/** A kind as a job is judged against it: its fields as a list sorts by them, and its relations. */
export interface JobKind extends ListFields {
  readonly edges: ReadonlySet<string>;
}

/** What a job may name, read off whichever declaration it is in. */
export interface JobWorld {
  readonly kinds: ReadonlyMap<string, JobKind>;
  /** The kinds an act of the app acts on (`[]`: on no record); undefined where the app has no act of that name. */
  actOn(name: string): readonly string[] | undefined;
  /** The roles the app knows: declared, or named by a grant or a sight. */
  readonly roles: ReadonlySet<string>;
}

export type JobFindingCode = "job-kind" | "job-where" | "job-sort" | "job-act" | "job-act-kind" | "job-role" | "job-name-taken" | "jobs-too-many";

export interface JobFinding {
  readonly code: JobFindingCode;
  /** Which job (its place in `jobs`); none for what is wrong with the list. */
  readonly index?: number;
  /** Which of its keys. */
  readonly key?: keyof JobDeclaration;
  readonly message: string;
  readonly fix: string;
}

const quotedList = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** What is wrong with one job's `where`, said in sentences, or nothing. */
function whereProblems(job: JobDeclaration, kind: JobKind, world: JobWorld): string[] {
  return job.where === undefined ? [] : conditionProblems(job.where, job.kind, kind, world);
}

/**
 * What is wrong with a rule-language condition read with a record of `kindName` as its subject, said as
 * "its where …" sentences, or nothing: what a job's `where` and a workflow's are held to alike.
 */
export function conditionProblems(where: string, kindName: string, kind: JobKind, world: JobWorld): string[] {
  const job = { kind: kindName };
  let shape: ReturnType<typeof analyzeExpr>;
  try {
    shape = analyzeExpr(parseExpr(where));
  } catch (e) {
    if (!(e instanceof ExprSyntaxError)) throw e;
    return [`its where does not read: ${e.sentence} (at character ${e.at + 1})`];
  }
  const problems: string[] = [];
  for (const fn of shape.unknownFunctions) problems.push(`its where calls "${fn}", which is not a function the rule language knows`);
  const edges = new Set([...world.kinds.values()].flatMap((k) => [...k.edges]));
  for (const name of shape.names) {
    if (name.startsWith("$") || name === "id" || name === "label" || kind.fields[name] || kind.edges.has(name) || kind.computed.includes(name)) continue;
    problems.push(`its where reads "${name}", and ${job.kind} has no field, relation or computed field called that`);
  }
  for (const edge of shape.edges) if (!edges.has(edge)) problems.push(`its where walks "${edge}", which is not a relation any kind declares`);
  for (const swept of shape.sweeps) if (!world.kinds.has(swept)) problems.push(`its where reads all('${swept}'), and "${swept}" is not a kind of this app`);
  return problems;
}

/** Every finding about an app's jobs, in the order they stand. */
export function jobFindings(purpose: AppPurpose | undefined, world: JobWorld): JobFinding[] {
  const jobs = purpose?.jobs ?? [];
  const out: JobFinding[] = [];
  if (jobs.length > MOST_JOBS) {
    out.push({ code: "jobs-too-many", message: `The app declares ${jobs.length} jobs; at most ${MOST_JOBS} say what its people come to do.`, fix: `Keep the ${MOST_JOBS} that matter most, and fold the rest into them.` });
  }
  const named = new Map<string, number>();
  jobs.forEach((job, index) => {
    const said = `The job "${job.name}"`;
    const first = named.get(job.name);
    if (first !== undefined) out.push({ code: "job-name-taken", index, key: "name", message: `${said} is declared twice (jobs ${first} and ${index}).`, fix: "Give each job a name of its own." });
    else named.set(job.name, index);

    const kind = world.kinds.get(job.kind);
    if (!kind) {
      out.push({ code: "job-kind", index, key: "kind", message: `${said} is answered by "${job.kind}", which is not a kind of this app.`, fix: `Name one of its kinds: ${quotedList(world.kinds.keys())}.` });
    } else {
      for (const problem of whereProblems(job, kind, world)) out.push({ code: "job-where", index, key: "where", message: `${said} cannot be answered: ${problem}.`, fix: `Write it in the rule language over the fields of "${job.kind}" (${quotedList(Object.keys(kind.fields))}) and relations.` });
      if (job.sort !== undefined) {
        const sortable = ["label", ...Object.entries(kind.fields).filter(([, field]) => field.type !== "other").map(([name]) => name), ...kind.computed];
        const by = gridSortOf(job.sort)?.by;
        if (by === undefined || !sortable.includes(by)) {
          const field = by === undefined ? undefined : kind.fields[by];
          out.push({
            code: "job-sort",
            index,
            key: "sort",
            message: `${said} cannot be sorted by "${by ?? ""}": ${field ? "it is a field no list sorts by (a list, a file, a picture)" : `${job.kind} has no field or computed field called that`}.`,
            fix: `Sort by ${quotedList(sortable)}.`,
          });
        }
      }
    }

    if (job.act !== undefined) {
      const on = world.actOn(job.act);
      if (on === undefined) out.push({ code: "job-act", index, key: "act", message: `${said} names "${job.act}" as what people do next, which is not an act of this app.`, fix: "Name an act whose subject is the job's kind, or leave act out." });
      else if (kind && !on.includes(job.kind)) {
        out.push({
          code: "job-act-kind",
          index,
          key: "act",
          message: `${said} names "${job.act}" as what people do next with its "${job.kind}" records, and "${job.act}" ${on.length === 0 ? "acts on no record" : `acts on ${quotedList(on)}`}.`,
          fix: `Name an act that acts on "${job.kind}" records, or leave act out.`,
        });
      }
    }

    for (const role of job.roles ?? []) {
      if (world.roles.has(role)) continue;
      out.push({ code: "job-role", index, key: "roles", message: `${said} is for "${role}", which is not one of the app's roles.`, fix: world.roles.size > 0 ? `Name one of ${quotedList(world.roles)}, or leave roles out for everybody.` : "The app declares no roles; leave roles out, and the job is everybody's." });
    }
  });
  return out;
}

/** A job finding's place in a document: `purpose.jobs.2.where`, or `purpose.jobs` for the list. */
export const documentJobPath = (finding: Pick<JobFinding, "index" | "key">): string =>
  `purpose.jobs${finding.index === undefined ? "" : `.${finding.index}${finding.key ? `.${finding.key}` : ""}`}`;

/** A document's jobs, judged with its own sentences at its own paths: what `compileDocument` and `graview check` say of one. */
export function documentJobFindings(document: GraviewDocument): Finding[] {
  if (document.purpose === undefined) return [];
  // The shape first, said as the compiler says a document's: a purpose that is not one is judged no further.
  const parsed = PurposeSpec.safeParse(document.purpose);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => {
      const path = ["purpose", ...issue.path.map(String)].join(".");
      const keys = (issue as { keys?: readonly string[] }).keys;
      return keys ? error("unknown-key", path, `${keys.map((k) => `"${k}"`).join(", ")} ${keys.length === 1 ? "is" : "are"} not part of a Graview document here`, "a purpose says for and jobs; a job says name, ask, kind, where, sort, act and roles") : error("shape", path, issue.message);
    });
  }
  if (!document.purpose.jobs) return [];
  return jobFindings(document.purpose, jobWorldOfDocument(document)).map((finding) => error(finding.code, documentJobPath(finding), finding.message, finding.fix));
}

/** The roles a policy and its sights name, beside the ones declared. */
function rolesNamed(declared: readonly string[] | undefined, parts: readonly { readonly roles: readonly string[] | "*" }[]): ReadonlySet<string> {
  return new Set([...(declared ?? []), ...parts.flatMap((part) => (part.roles === "*" ? [] : part.roles))]);
}

/** What a compiled or TypeScript app's jobs may name: its kinds, every act it has (derived ones too) and its roles. */
export function jobWorldOfApp<S extends AnySchema>(app: GraviewApp<S>): JobWorld {
  const schema = app.schema;
  const kinds = new Map<string, JobKind>();
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as { edges?: Record<string, unknown> } | undefined;
    kinds.set(kind, { ...listFieldsOf(schema, kind), edges: new Set(Object.keys(definition?.edges ?? {})) });
  }
  const declared = app.mutations ?? [];
  const acts = new Map([...declared, ...deriveMutations(schema, declared)].map((mutation) => [mutation.name, mutation]));
  const policy = app.policy;
  return {
    kinds,
    actOn: (name) => {
      const mutation = acts.get(name);
      return mutation ? subjectKindsOf(schema, mutation as never) : undefined;
    },
    roles: rolesNamed(policy?.roles, [...(policy?.grants ?? []), ...(policy?.sees ?? [])]),
  };
}

/** What a document's jobs may name, read off the document alone: what an edit judges a job by before anything is compiled. */
export function jobWorldOfDocument(document: GraviewDocument): JobWorld {
  const kinds = new Map<string, JobKind>();
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const listed = documentListFields(spec);
    // A relation to another app's kind is kept in a field of the record that links (FR-171): read like a relation, sorted by nothing.
    const linked = Object.fromEntries([...linkedEdges(spec.edges).keys()].map((name) => [name, { type: "other" as const }]));
    kinds.set(kind, { fields: { ...listed.fields, ...linked }, computed: listed.computed, edges: new Set(Object.keys(localEdges(spec.edges))) });
  }
  const acts = document.acts ?? {};
  return {
    kinds,
    actOn: (name) => {
      const act = acts[name];
      if (act) return [act.on ?? []].flat();
      const derived = derivedActOf(name);
      if (derived && document.kinds[derived.kind] && (document.kinds[derived.kind]!.archives !== false || givenWhenNeverArchived(derived.act))) return [derived.kind];
      const relation = documentRelationActOf(name, document.kinds);
      return relation ? [relation.kind] : undefined;
    },
    roles: rolesNamed(document.roles, [...(document.policy?.grants ?? []), ...(document.policy?.sees ?? [])]),
  };
}

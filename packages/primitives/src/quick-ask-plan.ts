import { nounOf, pluralOf, Store, type AnySchema, type MutationCall } from "@graview/core";
import { planEdits, type PlannedEdits } from "@graview/core/catalog";
import type { GraviewDocument } from "@graview/core/document";
import type { AnswerMissing } from "@graview/tools/inline-ai";
import type { ComposeChangeHost, ReshapeProposal } from "@graview/tools/reshape";
import type { InlineEnv } from "./inline-ai-env.js";

/**
 * A MISSING CAPABILITY, OFFERED AS ONE PLAN THAT FINISHES THE ASK (Roadmap
 * f-menu-type-anything). Nick: "I'd say 'assign these to nick' and it'd say
 * 'tasks have no assignment, but I can add that property, and add a People
 * kind and add Nick to it and assign him to them all… should I?'"
 *
 * The model names the need (`AnswerMissing.need`: a link, or a field); code
 * writes the least change that gives it (`planEdits`: the kind the link
 * points to where the app has none, the link or the field, the one act that
 * sets it — no rule, no new place), then the records that finish the ask
 * (the person the words name, found or made; each record the list shows
 * given to them). Every step is said from those edits and records, in plain
 * words, numbered, each a thing that will happen. Where the host lends its
 * composer (`composeChange`) the changed app is judged by the checker and a
 * scratch store rehearses every record first; a plan that would fail is
 * refused, never offered. Where the seat may not change the app — or the app
 * is declared in code with no host to change it — the whole plan is still
 * said, with who would add its first steps. Fetched with the first such
 * answer; no page carries it up front.
 */

/** One step of the plan, as the card numbers it. */
export interface PlanPart {
  readonly part: "app" | "record";
  readonly said: string;
}

/** The plan, as the card says it and the host is handed it. */
export interface AppPlan {
  /** What the card says above the steps: what is missing, and "Should I?" where Yes is offered — or who would make the first steps. */
  readonly question: string;
  readonly parts: readonly PlanPart[];
  /** What Yes hands the host — the change to the app as edits, and the records — where this seat may change the app. */
  readonly proposal?: ReshapeProposal;
  /** Who would make the change, where Yes is not offered. */
  readonly whoMay?: string;
}

const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const vowel = (word: string) => /^(?:[aeio]|u(?![sn]i|se|ser))/i.test(word);
const slug = (words: string) => words.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "one";
const range = (from: number, to: number) => (from === to ? `step ${from}` : `steps ${from}–${to}`);

/** The app's kinds as a document reads them, for an app declared in code with none remembered: their words, fields and links, no acts. */
function documentOfSchema(env: InlineEnv): GraviewDocument {
  const schema = env.store.schema;
  const kinds = Object.fromEntries(
    schema.definitions.map((definition) => [
      definition.kind,
      { noun: nounOf(definition, definition.kind), plural: pluralOf(schema, definition.kind), fields: Object.fromEntries(Object.keys((definition.fields as { shape?: object }).shape ?? {}).map((field) => [field, { type: "string" }])), edges: definition.edges ?? {} },
    ]),
  );
  return { name: env.app.name ?? "app", kinds, acts: {} } as unknown as GraviewDocument;
}

/** Who may change the app, in words: the roles every act is granted to ("an owner"), else whoever may. */
function whoMayChange(env: InlineEnv): string {
  const owners = (env.store.policy?.grants ?? []).filter((grant) => grant.mutations === "*" && !grant.self && grant.roles !== "*").flatMap((grant) => grant.roles as readonly string[]);
  const named = [...new Set(owners)];
  return named.length > 0 ? `${vowel(named[0]!) ? "an" : "a"} ${named.join(" or ")}` : "whoever may change this app";
}

/** The place the list is, as the steps say it: "in This week", else "here". */
function whereOf(env: InlineEnv): string {
  const place = env.place ? env.places.find((one) => one.as === env.place) : undefined;
  return place ? `in ${place.title}` : "here";
}

/** The plan for a missing capability, or a refusal in words when it could not be composed or would fail. */
export async function planFor(env: InlineEnv, options: { readonly said: string; readonly missing: AnswerMissing; readonly members: readonly string[]; readonly host: boolean; readonly compose?: ComposeChangeHost; readonly where?: string }): Promise<AppPlan | { readonly refused: string }> {
  const { missing } = options;
  if (!missing.need) return { refused: missing.said };
  const reshape = await import("@graview/tools/reshape");
  const remembered = reshape.documentOfApp(env.app);
  const document = remembered ?? documentOfSchema(env);
  const planned = planEdits(document, missing.need);
  if ("refused" in planned) return { refused: `${missing.said} ${planned.refused}` };
  const steps: PlanPart[] = planned.steps.map((said) => ({ part: "app", said }));
  const appSteps = steps.length;

  /* THE RECORDS THE PLAN ACTS ON are of the kind it changes: a list given where its tasks were meant is retargeted by code to the records it holds, never refused in words. */
  const ofKind = (ids: readonly string[]) => ids.filter((id) => env.store.graph.getNode(id)?.kind === planned.on);
  const heldOfKind = (id: string) => [...env.store.graph.in(id), ...env.store.graph.out(id)].filter((node) => node.kind === planned.on).map((node) => node.id);
  const members = ofKind(options.members).length > 0 ? ofKind(options.members) : [...new Set(options.members.flatMap(heldOfKind))];

  /* THE RECORDS THAT FINISH THE ASK, each said as it will happen. */
  const records: MutationCall[] = [];
  const count = members.length;
  const kindDoc = (kind: string) => (document.kinds[kind] as { noun?: string; plural?: string } | undefined) ?? undefined;
  const plural = (kind: string) => (kindDoc(kind)?.plural ?? `${kindDoc(kind)?.noun ?? kind}s`).toLowerCase();
  const noun = (kind: string) => (kindDoc(kind)?.noun ?? kind).toLowerCase();
  const where = options.where ? `in ${options.where}` : whereOf(env);
  if (count === 0) return { refused: `${missing.said} There is nothing here to do it to.` };
  const these = count === 1 ? `the ${noun(planned.on)} ${where}` : `the ${count} ${plural(planned.on)} ${where}`;
  const called = capital(planned.called);
  if (planned.relation && planned.to) {
    const who = missing.who;
    if (!who) return { refused: `${missing.said} Say whom to give them to.` };
    const toPlural = planned.made ? capital((planned.edits[0] as { plural?: string }).plural ?? "people") : capital(plural(planned.to));
    const found = planned.made ? undefined : env.store.graph.allNodes().find((node) => node.kind === planned.to && Object.values(node as Record<string, unknown>).some((value) => typeof value === "string" && value.toLowerCase() === who.toLowerCase()));
    let whom = found?.id;
    if (!whom) {
      whom = `${planned.to}-${slug(who)}`;
      const makes = planned.makes ?? env.store.allMutations().find((mutation) => (mutation.creates as readonly string[] | undefined)?.includes(planned.to!))?.name;
      if (!makes) {
        const some = env.store.graph.allNodes().filter((node) => node.kind === planned.to).slice(0, 3).map((node) => String((node as Record<string, unknown>)["label"] ?? (node as Record<string, unknown>)["name"] ?? "")).filter(Boolean);
        return { refused: `${missing.said} There is nobody called ${who} among the ${toPlural.toLowerCase()} here${some.length > 0 ? ` (${some.join(", ")})` : ""}, and no way to add one from here.` };
      }
      records.push({ name: makes, args: { name: who }, mintedHint: whom });
      steps.push({ part: "record", said: `Add ${who} to ${toPlural}.` });
    }
    for (const id of members) records.push({ name: planned.act, args: { id, [planned.arg]: whom } });
    // "assigned to" → "Assign Nick to the 5 tasks in This week."; any other link, said as setting it.
    const verb = /^(\w+?)ed to$/i.exec(planned.called)?.[1];
    steps.push({ part: "record", said: verb ? `${capital(verb.toLowerCase())} ${who} to ${these}.` : `Set “${called}” to ${who} on ${these}.` });
  } else if (planned.field) {
    const value = missing.value;
    if (value === undefined) return { refused: `${missing.said} Say what to set it to.` };
    for (const id of members) records.push({ name: planned.act, args: { id, [planned.arg]: value } });
    steps.push({ part: "record", said: `Set “${called}” to ${value} on ${these}.` });
  }
  const numbered = steps.length;

  /* WHO MAKES THE FIRST STEPS: this seat, through the host — or, said once, whoever may. */
  const may = Boolean(remembered) && options.host && options.compose !== undefined && reshape.mayChangeDeclaration(env.store, env.principal);
  if (!may) {
    const whoMay = !remembered ? "whoever develops this app" : !options.host || !options.compose ? "whoever hosts this app" : whoMayChange(env);
    return { question: `${missing.said} ${capital(whoMay)} would add ${range(1, appSteps)}; then I can do ${range(appSteps + 1, numbered)}.`, parts: steps, whoMay };
  }

  /* COMPOSED AND REHEARSED WHOLE before it is offered: the changed app, judged by the checker, and these records in it, as this person. */
  const composed = options.compose!({ document: remembered!, edits: planned.edits });
  // A checker's sentence is never a person's: the change could not be made, said plainly.
  if (!composed.ok) return { refused: `${missing.said} That change could not be made here.` };
  const app = composed.app as { readonly schema: AnySchema; readonly mutations?: readonly unknown[]; readonly invariants?: readonly unknown[]; readonly policy?: unknown };
  try {
    const scratch = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: env.store.graph.snapshot() as never } as never);
    scratch.previewAll(records, { author: env.principal });
  } catch {
    return { refused: `${missing.said} I could not make that work here.` };
  }
  return {
    question: `${missing.said} I can do it in ${numbered} steps. Should I?`,
    parts: steps,
    proposal: { said: options.said, add: [], drop: [], card: { said: steps.map((one) => one.said).join(" "), adds: [], keeps: [], drops: [], breaking: [] }, edits: planned.edits, records, via: `ai:${env.ai.name ?? "model"}` },
  };
}

export type { PlannedEdits };

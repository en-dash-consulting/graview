import { argumentsTaken, Store, type AnySchema, type MutationCall } from "@graview/core";
import { TRAIT_BRINGS, TRAIT_WORDS, type TraitName } from "@graview/core/traits";
import type { AnswerMissing } from "@graview/tools/inline-ai";
import type { ComposeChangeHost, ReshapeProposal } from "@graview/tools/reshape";
import type { InlineEnv } from "./inline-ai-env.js";

/**
 * A MISSING CAPABILITY, OFFERED AS ONE PLAN THAT FINISHES THE ASK (Roadmap
 * f-menu-type-anything). Nick: "I'd say 'assign these to nick' and it'd say
 * 'tasks have no assignment, but I can add that property, and add a People
 * kind and add Nick to it and assign him to them all… should I?'"
 *
 * Where the answer found the app lacks what was asked (`AnswerMissing`),
 * the plan is composed whole — never written by the model: the change to
 * the app from the reshape vocabulary (the host's `composeChange`, such as
 * `composeAppChange`: `composeReshape` and the checker, off the page), then the records that finish the ask in the changed app
 * (the person the words name, found or made; the act that gives each
 * record the list shows to them), each found among the changed app's own
 * acts. The checker judges the changed app and a scratch store rehearses
 * every call before anything is offered: a plan that would fail is refused
 * here, never offered. Fetched with the first such answer; no page carries
 * it up front, and the composer and the checker are the host's.
 */

/** One step of the plan, as the card lists it. */
export interface PlanPart {
  readonly part: "app" | "record";
  readonly said: string;
}

/** The plan, as the card says it and the host is handed it. */
export interface AppPlan {
  /** What the card says: what is missing, what it would do, and "Should I?" where Yes is offered. */
  readonly question: string;
  readonly parts: readonly PlanPart[];
  /** The proposal Yes hands the host — the change to the app and the records — where this seat may change the app. */
  readonly proposal?: ReshapeProposal;
  /** Why there is no Yes: who would have to make the change. */
  readonly whoMay?: string;
}

const listed = (words: readonly string[]): string => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`);
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const lowerFirst = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);
const humanized = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").toLowerCase();
const slug = (words: string) => words.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "one";

/** Who may change the app, in words: the roles every act is granted to ("an owner"), else whoever may. */
function whoMayChange(env: InlineEnv): string {
  const owners = (env.store.policy?.grants ?? []).filter((grant) => grant.mutations === "*" && !grant.self && grant.roles !== "*").flatMap((grant) => grant.roles as readonly string[]);
  return owners.length > 0 ? `${/^[aeiou]/i.test(owners[0]!) ? "an" : "a"} ${listed([...new Set(owners)])}` : "whoever may change this app";
}

/** The plan for a missing capability, or a refusal in words when it could not be composed or would fail. */
export async function planFor(env: InlineEnv, options: { readonly said: string; readonly missing: AnswerMissing; readonly members: readonly string[]; readonly host: boolean; readonly compose?: ComposeChangeHost }): Promise<AppPlan | { readonly refused: string }> {
  const { missing, members } = options;
  const traits = missing.add as readonly TraitName[];
  const words = traits.map((trait) => TRAIT_WORDS[trait]);
  if (traits.length === 0) return { refused: `${missing.said} Nothing this app could add would do it.` };
  const reshape = await import("@graview/tools/reshape");
  const document = reshape.documentOfApp(env.app);
  /* A code app: its declaration is its code, and no page changes it. */
  if (!document) return { question: `${missing.said} Adding ${listed(words)} would do it; this app is declared in code, so whoever develops it would add that.`, parts: traits.map((trait) => ({ part: "app" as const, said: `Add ${TRAIT_WORDS[trait]}: ${TRAIT_BRINGS[trait]}` })), whoMay: "whoever develops this app" };

  /* No composer lent by the host: what is missing, and who could add it — no plan to rehearse. */
  if (!options.compose) {
    const whoMay = whoMayChange(env);
    return { question: `${missing.said} Adding ${listed(words)} would do it; ${whoMay} could add that.`, parts: traits.map((trait) => ({ part: "app" as const, said: `Add ${TRAIT_WORDS[trait]}: ${TRAIT_BRINGS[trait]}` })), whoMay };
  }
  const composed = options.compose({ document, add: traits, drop: [] });
  if (!composed.ok) return { refused: `${missing.said} Adding ${listed(words)} is not offered: ${lowerFirst(composed.refused)}` };
  const app = composed.app as { readonly schema: AnySchema; readonly mutations?: readonly unknown[]; readonly invariants?: readonly unknown[] };
  /*
   * THE CHANGE TO THE APP IN A PERSON'S WORDS, never its names: a kind by its
   * noun and the fields it keeps, a link by what it says on each record, an
   * act by its title, and the composer's own sentence for a rule, a view
   * and who sees what — which say no name a person never sees.
   */
  const before0 = document;
  const after0 = composed.document;
  const nounOf = (kind: string) => after0.kinds[kind]?.noun ?? humanized(kind);
  const pluralOf = (kind: string) => after0.kinds[kind]?.plural ?? `${nounOf(kind)}s`;
  const parts: PlanPart[] = [];
  for (const [kind, spec] of Object.entries(after0.kinds)) {
    if (kind in before0.kinds) continue;
    const fields = Object.keys(spec.fields ?? {}).map(humanized);
    parts.push({ part: "app", said: `A new kind, ${nounOf(kind)}${fields.length > 0 ? `, with ${listed(fields)}` : ""}.` });
  }
  for (const [kind, spec] of Object.entries(after0.kinds)) {
    for (const [name, edge] of Object.entries(spec.edges ?? {})) {
      if (name in (before0.kinds[kind]?.edges ?? {})) continue;
      const to = (edge.to as readonly string[]).map((one) => `${/^[aeiou]/i.test(nounOf(one)) ? "an" : "a"} ${nounOf(one)}`).join(" or ");
      parts.push({ part: "app", said: `${capital(pluralOf(kind))} get ${/^[aeiou]/i.test(name) ? "an" : "a"} ${humanized(name)}${edge.description ? ` — ${edge.description}` : ""}: ${to}.` });
    }
  }
  for (const [name, act] of Object.entries(after0.acts ?? {})) if (!(name in (before0.acts ?? {}))) parts.push({ part: "app", said: `A new act: ${(act as { title?: string }).title ?? humanized(name)}.` });
  for (const said of composed.said) if (/^(A new rule|A lens|Everyone sees)/.test(said)) parts.push({ part: "app", said });

  /* THE RECORDS: the person the words name, found or made, and each record the list shows given to them by the changed app's own act. */
  const records: MutationCall[] = [];
  const memberKind = members.map((id) => env.store.graph.getNode(id)?.kind).find((kind): kind is string => kind !== undefined);
  const before = memberKind ? (document.kinds[memberKind]?.edges ?? {}) : {};
  const added = memberKind ? Object.entries(composed.document.kinds[memberKind]?.edges ?? {}).find(([name]) => !(name in before)) : undefined;
  const scratch = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: env.store.graph.snapshot() as never } as never);
  let doing: string | undefined;
  if (added && missing.who) {
    const [relation, edge] = added;
    const toKind = (edge.to as readonly string[])[0]!;
    const named = missing.who;
    const found = scratch.graph.allNodes().find((node: Record<string, unknown> & { readonly id: string; readonly kind: string }) => node.kind === toKind && Object.values(node).some((value) => typeof value === "string" && value.toLowerCase() === named.toLowerCase()));
    let whom = found?.id;
    if (!whom) {
      const makes = scratch.allMutations().find((mutation) => (mutation.creates as readonly string[] | undefined)?.includes(toKind));
      const field = makes ? (argumentsTaken(makes) ?? []).find((arg) => arg !== "id" && ["name", "label", "title"].includes(arg)) : undefined;
      if (!makes || !field) return { refused: `${missing.said} Adding ${listed(words)} would not leave a way to add ${named}, so it is not offered.` };
      whom = `${toKind}-${slug(named)}`;
      records.push({ name: makes.name, args: { [field]: named }, mintedHint: whom });
      const noun = composed.document.kinds[toKind]?.noun ?? toKind;
      parts.push({ part: "record", said: `Add ${named} as ${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}.` });
    }
    const gives = scratch.allMutations().find((mutation) => ((mutation as { connects?: readonly string[] }).connects ?? []).includes(relation) && mutation.subject && (mutation.subject.kinds === "*" || (mutation.subject.kinds as readonly string[]).includes(memberKind!)));
    const to = gives ? (argumentsTaken(gives) ?? []).find((arg) => arg !== gives.subject!.arg) : undefined;
    if (!gives || !to) return { refused: `${missing.said} Adding ${listed(words)} would not leave a way to give them to ${named}, so it is not offered.` };
    for (const id of members) records.push({ name: gives.name, args: { [gives.subject!.arg]: id, [to]: whom } });
    const plural = composed.document.kinds[memberKind!]?.plural ?? `${memberKind}s`;
    const these = members.length === 1 ? `the ${composed.document.kinds[memberKind!]?.noun ?? memberKind} here` : `each of the ${members.length} ${plural} here`;
    doing = `give ${these} to ${named}`;
    parts.push({ part: "record", said: `${capital(doing)} (${gives.title ?? gives.name}).` });
  }

  /* REHEARSED WHOLE before it is offered: the changed app, these records, as this person. */
  if (records.length > 0) {
    try {
      scratch.previewAll(records, { author: env.principal });
    } catch (error) {
      return { refused: `${missing.said} The plan would be refused: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /* Said as a person would: what the app gains, then what finishes the ask. */
  const newKinds = Object.keys(composed.document.kinds).filter((kind) => !(kind in document.kinds)).map((kind) => `${/^[aeiou]/i.test(composed.document.kinds[kind]?.noun ?? kind) ? "an" : "a"} ${composed.document.kinds[kind]?.noun ?? kind} kind`);
  const newLink = added && memberKind ? `${/^[aeiou]/i.test(added[0]) ? "an" : "a"} ${humanized(added[0])} on each ${composed.document.kinds[memberKind]?.noun ?? memberKind}` : undefined;
  const gains = [...newKinds, ...(newLink ? [newLink] : [])];
  const doings = [
    `add ${listed(words)}${gains.length > 0 ? ` (${listed(gains)})` : ""}`,
    ...parts.filter((one) => one.part === "record" && !(doing && one.said.startsWith(capital(doing)))).map((one) => lowerFirst(one.said.replace(/\.$/, ""))),
    ...(doing ? [doing] : []),
  ];
  const may = options.host && reshape.mayChangeDeclaration(env.store, env.principal);
  const card = reshape.reshapeCard({ said: options.said, document, add: traits, drop: [] }).card;
  if (!may) {
    const whoMay = whoMayChange(env);
    return { question: `${missing.said} ${capital(whoMay)} would need to ${listed(doings)}.`, parts, whoMay };
  }
  return {
    question: `${missing.said} I can ${listed(doings)}. Should I?`,
    parts,
    proposal: { said: options.said, add: traits, drop: [], card, ...(records.length > 0 ? { records } : {}), via: `ai:${env.ai.name ?? "model"}` },
  };
}

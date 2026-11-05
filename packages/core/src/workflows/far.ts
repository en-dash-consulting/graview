import { parseLinkedTarget } from "../schema/linked.js";
import type { WorkflowStep } from "../workflow-shape.js";
import type { WorkflowFinding } from "./steps.js";

/*
 * A STEP IN ANOTHER APP (Roadmap f-workflow-steps-in-another-app): an
 * agent step's `reads` and `acts`, and an act step's `act`, may name a kind
 * or an act of another app the way a relation to another app's kind names
 * it (`@nick/house/house`, `schema/linked.ts`): `@` + the app's address +
 * `/` + the name —
 *
 *   { "agent": "Close what HQ closed.", "reads": ["ticket", "@self/graview-public/ticket"],
 *     "acts": ["@self/graview-public/set-ticket-status"] }
 *
 * The declaration never sees the other app's, so the checker holds such a
 * reference to its shape (`workflow-far-reference`), and a host that knows
 * the app hands the checker a resolver (`FarAppResolver`) — what it knows
 * of the app at an address: its name, its kinds, its acts with their input
 * schemas — to have it say whether the app, the kind, the act and the
 * arguments a step hands the act are there. Running one is the host's
 * (`FarApps`, `@graview/tools/workflows`): the runner never writes into
 * another app's store.
 */

/** A kind or an act of another app, as a step names it: the app's address and the name there. */
export interface FarReference {
  /** The other app's address: `@owner/app`, an app id, or an http(s) address — what an app-link holds. */
  readonly address: string;
  /** The kind or act there. */
  readonly name: string;
}

/** Whether a step's name reaches out of the app at all: it begins with "@". Well formed or not is `farReferenceOf`'s. */
export const isFarReference = (value: unknown): value is string => typeof value === "string" && value.startsWith("@");

/** The app and the name a far reference names — `@self/graview-public/set-ticket-status` — or undefined for one that names none. */
export function farReferenceOf(value: string): FarReference | undefined {
  const parsed = parseLinkedTarget(value);
  return parsed ? { address: parsed.address, name: parsed.kind } : undefined;
}

/** An act of another app, as its host says it: its title, its sentence and what it takes (a JSON Schema object). */
export interface FarActShape {
  readonly title?: string;
  readonly description?: string;
  /** Its arguments, as the agent tool surface says them (`mutationToolSchema(…).inputSchema`). */
  readonly input: Readonly<Record<string, unknown>>;
}

/** What a host knows of another app a workflow names: its name, its kinds, and its acts by name. */
export interface FarAppShape {
  /** What it is called, as a run and a finding say it: "Graview Public". */
  readonly name?: string;
  readonly kinds: readonly string[];
  readonly acts: Readonly<Record<string, FarActShape>>;
}

/**
 * THE HOST'S RESOLVER, at check time: what it knows of the app at an
 * address, or undefined when it knows no such app (or will not say, to
 * this app). Synchronous — the checker never waits — so a host reads the
 * apps a workflow names before it checks.
 */
export type FarAppResolver = (address: string) => FarAppShape | undefined;

/** What a workflow reaches in one other app: the kinds it reads there and the acts it runs or proposes there. */
export interface FarReach {
  readonly address: string;
  readonly reads: readonly string[];
  readonly acts: readonly string[];
}

/** The far kinds a step reads and the far acts it runs or proposes, as written. */
export function farNamesOf(step: WorkflowStep): { readonly reads: readonly string[]; readonly acts: readonly string[] } {
  if ("agent" in step) return { reads: step.reads.filter(isFarReference), acts: step.acts.filter(isFarReference) };
  if ("act" in step) return { reads: [], acts: isFarReference(step.act) ? [step.act] : [] };
  return { reads: [], acts: [] };
}

/** Every other app a workflow's steps reach, in the order first named, with what they read and run there. */
export function farReachOf(steps: readonly WorkflowStep[]): FarReach[] {
  const apps = new Map<string, { reads: Set<string>; acts: Set<string> }>();
  const at = (address: string) => apps.get(address) ?? apps.set(address, { reads: new Set(), acts: new Set() }).get(address)!;
  for (const step of steps) {
    const names = farNamesOf(step);
    for (const read of names.reads) {
      const ref = farReferenceOf(read);
      if (ref) at(ref.address).reads.add(ref.name);
    }
    for (const act of names.acts) {
      const ref = farReferenceOf(act);
      if (ref) at(ref.address).acts.add(ref.name);
    }
  }
  return [...apps].map(([address, { reads, acts }]) => ({ address, reads: [...reads], acts: [...acts] }));
}

/** A far reference in a sentence: `“set-ticket-status” in @self/graview-public`. */
export const farWords = (value: string): string => {
  const ref = farReferenceOf(value);
  return ref ? `“${ref.name}” in ${ref.address}` : `“${value}”`;
};

const quoted = (names: Iterable<string>): string => [...names].map((name) => `"${name}"`).join(", ") || "none";

/** What the checker is told of the other apps, beside the declaration. */
export interface FarCheck {
  /** The host's resolver; without it a far reference is held to its shape alone. */
  readonly resolveFarApp?: FarAppResolver;
}

/**
 * ONE FAR REFERENCE, JUDGED: its shape (`workflow-far-reference`), and —
 * where the host's resolver is given — that the app is one it knows
 * (`workflow-far-app-unknown`) and has that kind (`workflow-kind-unknown`)
 * or act (`workflow-act-unknown`). `said` names the step; `what` says how
 * the step uses it.
 */
export function farReferenceFindings(value: string, kind: "kind" | "act", path: string, said: string, what: string, check: FarCheck): WorkflowFinding[] {
  const ref = farReferenceOf(value);
  if (!ref) {
    return [{
      code: "workflow-far-reference",
      severity: "error",
      path,
      message: `${said} ${what} "${value}", which names no ${kind} of another app.`,
      fix: `Write "@", the app's address, "/" and the ${kind} there, like "${kind === "act" ? "@self/graview-public/set-ticket-status" : "@self/graview-public/ticket"}" — or name one of this app's ${kind === "act" ? "acts" : "kinds"} without the "@".`,
    }];
  }
  const app = check.resolveFarApp?.(ref.address);
  if (!check.resolveFarApp) return [];
  if (!app) return [{ code: "workflow-far-app-unknown", severity: "error", path, message: `${said} ${what} "${value}", and this host knows no app at ${ref.address} that this app may reach.`, fix: "Name an app this host keeps, at the address it knows it by, or ask its owner to let this app reach it." }];
  const called = app.name ? `${app.name} (${ref.address})` : ref.address;
  if (kind === "kind" && !app.kinds.includes(ref.name)) return [{ code: "workflow-kind-unknown", severity: "error", path, message: `${said} ${what} "${ref.name}" records in ${called}, which has no kind called that.`, fix: `Name one of its kinds: ${quoted(app.kinds)}.` }];
  if (kind === "act" && !Object.hasOwn(app.acts, ref.name)) return [{ code: "workflow-act-unknown", severity: "error", path, message: `${said} ${what} "${ref.name}" in ${called}, which is not an act of that app.`, fix: `Name one of its acts: ${quoted(Object.keys(app.acts))}.` }];
  return [];
}

/**
 * THE ARGUMENTS AN ACT STEP HANDS A FAR ACT, held to the act's input schema
 * where the host's resolver says it (`workflow-far-args`): an argument it
 * does not take, where it takes no others, and one it requires that the
 * step leaves out. What a value must be is the far app's to judge, as the
 * run is refused there in its words.
 */
export function farArgsFindings(value: string, args: Readonly<Record<string, unknown>> | undefined, path: string, said: string, check: FarCheck): WorkflowFinding[] {
  const ref = farReferenceOf(value);
  const act = ref ? check.resolveFarApp?.(ref.address)?.acts[ref.name] : undefined;
  if (!ref || !act) return [];
  const properties = (act.input["properties"] ?? {}) as Readonly<Record<string, unknown>>;
  const required = Array.isArray(act.input["required"]) ? (act.input["required"] as readonly string[]) : [];
  const given = Object.keys(args ?? {});
  const out: WorkflowFinding[] = [];
  if (act.input["additionalProperties"] === false) {
    for (const name of given) {
      if (!Object.hasOwn(properties, name)) out.push({ code: "workflow-far-args", severity: "error", path: `${path}.${name}`, message: `${said} hands “${ref.name}” in ${ref.address} "${name}", which it does not take.`, fix: `Hand it only what it takes: ${quoted(Object.keys(properties))}.` });
    }
  }
  const missing = required.filter((name) => !given.includes(name));
  if (missing.length > 0) out.push({ code: "workflow-far-args", severity: "error", path, message: `${said} runs “${ref.name}” in ${ref.address} without ${quoted(missing)}, which it requires.`, fix: `Say ${missing.length === 1 ? "it" : "them"} in args, a value or { "expr": … } read on the record the step is over.` });
  return out;
}

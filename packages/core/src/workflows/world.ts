import type { GraviewApp } from "../app.js";
import { actsOfDocument } from "../document/act-spellings.js";
import type { GraviewDocument } from "../document/schema.js";
import { jobWorldOfApp, jobWorldOfDocument, type JobWorld } from "../job-findings.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { derivedActOf, givenWhenNeverArchived } from "../mutations/derived-names.js";
import type { AnySchema } from "../schema/schema.js";

/*
 * WHAT A WORKFLOW MAY NAME, read off whichever declaration it is in: the
 * job checker's world (kinds, their fields and relations, each act and the
 * kinds it acts on, the roles), and beside it what a workflow names that a
 * job does not — the kinds an act makes, every act by name, and the
 * connections, with whether each writes back to the other system.
 */

/** A connection as a workflow reads it: the kinds it keeps in step, and whether this app's changes go out through it. */
export interface WorkflowConnection {
  readonly kinds: readonly string[];
  readonly writes: boolean;
}

export interface WorkflowWorld extends JobWorld {
  /** Every act the app gives, declared and derived, by name. */
  readonly acts: readonly string[];
  /** The kinds an act makes records of; undefined where the app has no act of that name. */
  actMakes(name: string): readonly string[] | undefined;
  readonly connections: ReadonlyMap<string, WorkflowConnection>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** A connection's kinds and direction, read loosely: one kind, or a kind per source. */
function connectionOf(spec: unknown): WorkflowConnection {
  const given = isRecord(spec) ? spec : {};
  const kinds = [given["kind"], ...(Array.isArray(given["sources"]) ? given["sources"].map((source) => (isRecord(source) ? source["kind"] : undefined)) : [])].filter((kind): kind is string => typeof kind === "string");
  return { kinds, writes: given["direction"] !== "read" };
}

const connectionsOf = (connections: Readonly<Record<string, unknown>> | undefined): ReadonlyMap<string, WorkflowConnection> => new Map(Object.entries(connections ?? {}).map(([name, spec]) => [name, connectionOf(spec)]));

/** What a document's workflows may name, read off the document alone. */
export function workflowWorldOfDocument(document: GraviewDocument): WorkflowWorld {
  const acts = document.acts ?? {};
  return {
    ...jobWorldOfDocument(document),
    // A kind that is never set aside (`archives: false`) is given no archive, unarchive or merge: as the app's derived acts leave them out.
    acts: actsOfDocument(document).filter((act) => {
      const derived = derivedActOf(act);
      return !derived || document.kinds[derived.kind]?.archives !== false || givenWhenNeverArchived(derived.act);
    }),
    actMakes(name) {
      const act = acts[name] as { creates?: string; effects?: readonly unknown[] } | undefined;
      if (act) return [...new Set([...(act.creates ? [act.creates] : []), ...(act.effects ?? []).flatMap((effect) => (isRecord(effect) && typeof effect["create"] === "string" ? [effect["create"]] : []))])];
      return derivedActOf(name) || this.actOn(name) !== undefined ? [] : undefined;
    },
    connections: connectionsOf(document.connections),
  };
}

/** What a compiled or TypeScript app's workflows may name. */
export function workflowWorldOfApp<S extends AnySchema>(app: GraviewApp<S>): WorkflowWorld {
  const declared = app.mutations ?? [];
  const every = [...declared, ...deriveMutations(app.schema, declared)];
  const byName = new Map(every.map((mutation) => [mutation.name, mutation]));
  return {
    ...jobWorldOfApp(app),
    acts: [...byName.keys()],
    actMakes: (name) => {
      const mutation = byName.get(name);
      return mutation ? [...((mutation as { creates?: readonly string[] }).creates ?? [])] : undefined;
    },
    connections: connectionsOf(app.connections as Readonly<Record<string, unknown>> | undefined),
  };
}

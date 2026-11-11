import * as z from "../schema/zod.js";
import { MissingRecordError, NO_SUCH_RECORD } from "../graph/graph.js";
import { PERSON_SEAT, personSeatOf } from "../graph/archived.js";
import { ActRefusal } from "../refused.js";
import { labelOf, nounOf, withArticle } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyMutationDefinition } from "./types.js";

/** The name of the act that binds a seat to a person already entered (Roadmap f-invite-binds-existing-person). */
export const BIND_PERSON = "bind-person";

/** A seat as a binding names it: an account's id, or an account's id and a profile's (`profilePersonId`). */
const SEAT = /^[^~]+(~[\w-]{1,64})?$/;

/** What the act reads of the store beside the graph it is handed, which is what its author is served. */
export interface BindPersonReads {
  /** The whole graph: whose record a record is, and which a seat is bound to, never as one seat is served it. */
  readonly graph: () => {
    getNode(id: string): ({ readonly id: string; readonly kind: string } & Record<string, unknown>) | undefined;
    personBoundTo(seat: string): string | undefined;
  };
  /** Whether a seat whose own person this id is has acted here: a record that is some account's own already. */
  readonly actedAs: (id: string) => boolean;
}

/**
 * "BIND A PERSON" (Roadmap f-invite-binds-existing-person): an organizer
 * entered Bud before he joined — his household, the gift he gives — and
 * when his account joins, the host binds that account to Bud's record
 * rather than making a second Bud. Its arguments are the record and the
 * seat (`seatPersonOf`: the account's id, or its profile's person); the
 * record is marked with the seat (`PERSON_SEAT`), so from then on `$me`,
 * `own`, `self` and an act done as him read that record (`seatedIn`).
 *
 * Every store with a people kind answers to it and no list offers it: a
 * host calls it (`store.bindPerson`) as an invitation is accepted. It is
 * an op like any, blamed on whoever bound it and undone like any; who may
 * is the policy's, by the act's name or every act — never riding another
 * act — and never a seat binding itself (the store's `judged`). It is
 * refused, in a sentence, on a record of another kind, a record already
 * somebody's, and a seat already bound to another record or with a record
 * of its own; binding a seat to the record it is bound to changes nothing.
 */
export function bindPersonMutation<S extends AnySchema>(schema: S, reads: BindPersonReads): AnyMutationDefinition<S> | undefined {
  const people = schema.definitions.find((definition) => definition.people);
  if (!people) return undefined;
  const noun = nounOf(people, people.kind);
  const named = (node: { readonly kind: string } & Record<string, unknown>) => labelOf(schema.tryDefinition(node.kind), node as never);
  return {
    name: BIND_PERSON,
    title: `Bind an account to this ${noun}`,
    description: `The account that joined is this ${noun} from now on: what it does is done as them, and no second ${noun} is made.`,
    subject: { kinds: [people.kind], arg: "record" },
    idempotent: true,
    input: z.object({ record: z.string().check(z.minLength(1)), seat: z.string().check(z.regex(SEAT)) }) as never,
    describe: (args, graph) => {
      const node = graph.getNode(String((args as { record: unknown }).record)) as ({ readonly kind: string } & Record<string, unknown>) | undefined;
      return `Bind ${node ? named(node) : `the ${noun}`} to the account that joined`;
    },
    apply(ctx, args) {
      const { record, seat } = args as { record: string; seat: string };
      const full = reads.graph();
      const node = full.getNode(record);
      if (!node || !ctx.graph.getNode(record)) throw new MissingRecordError(record, NO_SUCH_RECORD.change);
      const definition = schema.tryDefinition(node.kind) as { readonly people?: boolean; readonly noun?: string } | undefined;
      if (!definition?.people) throw new ActRefusal(`${named(node)} is ${withArticle(nounOf(definition, node.kind))}, not ${withArticle(noun)}: only ${withArticle(noun)} can be someone's record here.`);
      const bound = personSeatOf(node);
      // Bound to this seat already, or this seat's own record: nothing to do.
      if (bound === seat || (bound === undefined && record === seat)) return;
      // Somebody's already: bound to another seat, a profile's own person, or an account's own that has acted here.
      if (bound !== undefined || record.includes("~") || reads.actedAs(record)) throw new ActRefusal(`${named(node)} is already someone else's record here.`);
      const other = full.personBoundTo(seat);
      const theirs = other === undefined ? undefined : full.getNode(other);
      if (theirs) throw new ActRefusal(`That account is already ${named(theirs)} here.`);
      const own = full.getNode(seat);
      if (own && (schema.tryDefinition(own.kind) as { readonly people?: boolean } | undefined)?.people) throw new ActRefusal(`That account already has its own record here, ${named(own)}: merge the two instead.`);
      ctx.patchNode(record, { [PERSON_SEAT]: seat });
    },
  } as AnyMutationDefinition<S>;
}

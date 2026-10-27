import * as z from "../schema/zod.js";
import { MissingRecordError } from "../graph/graph.js";
import { ActRefusal } from "../refused.js";
import { collaborativeFieldOf } from "../schema/collaborative-of.js";
import { nounOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import { NEVER_WRITTEN } from "../ops/revisions.js";
import { carried, textAt } from "../text/since.js";
import { typingWords } from "../text/typing-words.js";
import { TYPE_TEXT, type TypingStore } from "../text/typing-hook.js";
import { derivedVia, fieldsWrittenBy, subjectKindsOf } from "./derive-edits.js";
import type { AnyMutationDefinition } from "./types.js";

export { TYPE_TEXT };

/** What a keystroke says: at `at` in the field's text as its sender last read it (revision `rev`), `remove` characters out and `insert` in. */
export interface TypeTextArgs {
  readonly node: string;
  readonly field: string;
  /** In UTF-16 code units, as a string's index is. */
  readonly at: number;
  readonly remove: number;
  readonly insert: string;
  /**
   * Where its sender last read the field: its revision then (`FieldRevisions.of`), or any later seq the sender
   * had read the log through — `openRemote` sends the last it has; absent, the text as it is now.
   */
  readonly rev?: number;
}

/**
 * "TYPE TEXT" (Roadmap f-collab-text, phase 2): a keystroke — or a run of
 * them — into a text field typed together (`isCollaborativeField`). Every
 * store answers to it and no list of acts offers it, as `keep-link` is; a
 * face sends it as a person types.
 *
 * Its arguments say the keystroke against the text its sender last read,
 * at revision `rev`: the store reads that text back from the log and
 * carries the keystroke over every splice taken since (`textThen`), so two
 * people typing at once both keep their words. It writes one `splice-text`.
 * The first keystroke into a field that holds no text yet (absent, or
 * empty) writes the whole of it as a patch, from nothing to what was typed,
 * so its inverse is exact; the keystrokes after it splice.
 *
 * Refused as the call as sent (`invalid`): a field that is not typed
 * together (written whole, as its edit writes it), a field the kind does
 * not declare, an offset or a length the text read then does not have, and
 * a keystroke made against text the field no longer has any history of —
 * written whole since, or behind the log's horizon — which its sender reads
 * again. A field kept from the caller reads to it as holding no text, so
 * its keystroke is a whole write wherever it was, which field sight refuses
 * as an argument the act does not take, alike whatever the field holds.
 *
 * `@graview/core/typing`'s: a store registers it once that is loaded.
 */
export function typeTextMutation<S extends AnySchema>(store: TypingStore): AnyMutationDefinition<S> {
  const schema = store.schema as S;
  const refuse = (sentence: string): never => {
    throw new ActRefusal(sentence, "invalid");
  };
  return {
    name: TYPE_TEXT,
    title: "Type text",
    // Offsets are whole and never negative: judged in `apply`, so a page carries no more of zod for them.
    input: z.object({ node: z.string(), field: z.string(), at: z.number(), remove: z.number(), insert: z.string(), rev: z.optional(z.number()) }) as never,
    subject: { kinds: "*", arg: "node" },
    // It writes no field of its own: which field it types into is an argument, judged per call (`typeTextVia`).
    writes: [],
    describe: (args, graph) => {
      // Said as the change is (Roadmap f-collab-text, phase 5): "Wrote in Kitchen's notes (+5 −1)", as history and Activity say a run.
      const { node, field, insert, remove } = args as unknown as TypeTextArgs;
      return typingWords({ node, field, inserted: [...String(insert ?? "")].length, removed: Number(remove) || 0 }, schema, graph);
    },
    apply(ctx, raw) {
      const { node, field, at, remove, insert, rev } = raw as unknown as TypeTextArgs;
      if (![at, remove, rev ?? 0].every((n) => Number.isInteger(n) && n >= -1) || at < 0 || remove < 0) refuse("at and remove are whole numbers, none below 0, and rev a revision");
      const record = ctx.graph.getNode(node) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
      if (!record) throw new MissingRecordError(node, `“Type text” names a record that is not there.`);
      if (!collaborativeFieldOf(schema, record.kind, field)) {
        refuse(`${nounOf(schema.tryDefinition(record.kind), record.kind)}'s "${field}" is not text typed together: write it whole, as its edit does`);
      }
      if (remove === 0 && insert === "") return;
      const text = record[field];
      // THE FIRST KEYSTROKE into a field with no text yet writes the whole of it, from nothing to what was typed, wherever it said it was.
      if (typeof text !== "string" || text === "") {
        ctx.patchNode(node, { [field]: insert });
        return;
      }
      const current = (store.graph.getNode(node) as Record<string, unknown> | undefined)?.[field];
      const read = rev === undefined ? { then: text, since: [] } : textAt(store.log.all(), store.log.horizon, node, field, Math.max(rev, NEVER_WRITTEN), current);
      if (!read) refuse(`${field} was written whole since revision ${rev}: read it again and type over what it holds now`);
      const { then, since } = read!;
      if (at + remove > then.length) refuse(`${field} held ${then.length} characters at revision ${rev ?? "now"}, so there is nothing at ${at}${remove > 0 ? `–${at + remove}` : ""} to type over`);
      const splice = carried({ at, removed: then.slice(at, at + remove), inserted: insert }, since);
      if (splice.removed === "" && splice.inserted === "") return;
      ctx.emit({ op: "splice-text", id: node, field, ...splice });
    },
  } as AnyMutationDefinition<S>;
}

/**
 * Who may type into a field of a record: whoever may run an act that writes
 * THAT field of its kind — a declared act whose `writes` names it, or the
 * kind's own `edit-<kind>` that takes it (and so whoever that rides). Typing
 * is writing the field a keystroke at a time; there is no second list.
 *
 * And only an act that could run on THIS record now (`allows`, the store's
 * to say): one whose module is on and whose own rule holds for the record
 * (`allowedOn`, or the act itself asked: `wouldRun`). An act that may amend a ticket's notes only while it is
 * open lent its grant to typing over them once it was closed.
 */
export function typeTextVia<S extends AnySchema>(schema: S, mutations: readonly AnyMutationDefinition<S>[], kind: string | undefined, field: unknown, allows: (mutation: AnyMutationDefinition<S>) => boolean = () => true): readonly string[] {
  const definition = kind === undefined ? undefined : schema.tryDefinition(kind);
  if (!definition || typeof field !== "string") return [];
  const via = new Set<string>();
  for (const mutation of mutations) {
    if (mutation.name === TYPE_TEXT || !subjectKindsOf(schema, mutation).includes(kind!) || !fieldsWrittenBy(mutation, definition as never).includes(field)) continue;
    if (!allows(mutation)) continue;
    via.add(mutation.name);
    for (const ridden of derivedVia(schema, mutations, mutation) ?? []) via.add(ridden);
  }
  return [...via];
}

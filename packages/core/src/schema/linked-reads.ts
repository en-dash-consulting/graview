import type { LinkedRead, LinkedReader, LinkedRecord, LinkedRecordAnswer, LinkedRecordRef, LinkedRecords, LinkedViewer } from "./linked.js";

/*
 * WHAT A PAGE READS ANOTHER APP'S RECORDS THROUGH (FR-171), on the main
 * entry because the provider builds one wherever a host hands it
 * `linkedRecords`: small, and nothing of zod or of the record's words.
 */

const keyOf = (ref: LinkedRecordRef, viewer: LinkedViewer) => `${viewer.kind}\u0000${viewer.id ?? ""}\u0000${ref.address}\u0000${ref.kind}\u0000${ref.id}`;

/** A page's reading of far records, as one viewer: at once, from the answers in. */
export interface LinkedReads {
  /** What the rule language reads through: an answer in, or unread — and asked for, once. */
  readonly read: LinkedReader;
  /** The host's answer for one record, asked once; a throw is null. */
  ask(ref: LinkedRecordRef): Promise<LinkedRecordAnswer>;
  /** The answer in for one record, if any: undefined while it is asked. */
  answered(ref: LinkedRecordRef): LinkedRecordAnswer | undefined;
  /** Asked afresh: every answer forgotten, so the next read asks again (a far value changed). */
  forget(ref?: LinkedRecordRef): void;
}

/**
 * WHAT A PAGE READS FAR RECORDS THROUGH, AS ONE VIEWER (FR-171): each record
 * asked of the host once, its answer kept, and `answered` told — so the page
 * reads again, and a computed value that read "not read yet" reads the far
 * value. An expression never waits: until the answer is in, it reads unread.
 */
export function linkedReads(host: LinkedRecords, viewer: LinkedViewer, answered: (ref: LinkedRecordRef) => void = () => {}): LinkedReads {
  const asked = new Map<string, Promise<LinkedRecordAnswer>>();
  const answers = new Map<string, LinkedRecordAnswer>();
  const ask = (ref: LinkedRecordRef): Promise<LinkedRecordAnswer> => {
    const key = keyOf(ref, viewer);
    let answer = asked.get(key);
    if (!answer) {
      answer = Promise.resolve()
        .then(() => host.resolve(ref, viewer))
        .then(
          (found) => (isAnswer(found) ? found : null),
          () => null,
        )
        .then((found) => {
          if (asked.get(key) === answer) {
            answers.set(key, found);
            answered(ref);
          }
          return found;
        });
      asked.set(key, answer);
    }
    return answer;
  };
  return {
    read(ref): LinkedRead {
      const key = keyOf(ref, viewer);
      if (answers.has(key)) {
        const found = answers.get(key)!;
        return found === null ? { unread: true } : "denied" in found ? { denied: true } : { record: found };
      }
      void ask(ref);
      return { unread: true };
    },
    ask,
    answered: (ref) => answers.get(keyOf(ref, viewer)),
    forget(ref) {
      if (!ref) {
        asked.clear();
        answers.clear();
        return;
      }
      const key = keyOf(ref, viewer);
      asked.delete(key);
      answers.delete(key);
    },
  };
}

/** Whether the host's answer is one a page can read: a record with a label and fields, a refusal, or nothing. */
function isAnswer(found: unknown): found is LinkedRecordAnswer {
  if (found === null) return true;
  if (typeof found !== "object" || found === undefined) return false;
  if ((found as { denied?: unknown }).denied === true) return true;
  const record = found as Partial<LinkedRecord>;
  return typeof record.label === "string" && typeof record.id === "string" && typeof record.kind === "string" && typeof record.fields === "object" && record.fields !== null;
}

import type { Presence, PresenceCaret } from "@graview/core";
import { createContext } from "react";

/*
 * TYPING TOGETHER, AS AN EDITOR REACHES IT (Roadmap f-collab-text, phase 4).
 * A host whose store is served hands the provider its `typing` — a remote
 * store's `remote.typing(node, field)` — and an editor of a field typed
 * together finds it here, with the way to say where its caret stands and
 * who else is here. Without it, an editor writes a field whole, as before.
 */

/** Typing into one field of one record, a keystroke at a time: what `remote.typing` from `@graview/ship` answers. */
export interface FieldTyping {
  /** At `at` in the field's text as the page shows it now, `remove` characters out and `insert` in. */
  splice(at: number, remove: number, insert: string): void;
  /** Ends the run typed so far and sends it. */
  flush(): void;
  /** Runs typed and not yet answered. */
  waiting(): number;
}

export interface LiveTyping {
  /** The typing of one field: the same one each time it is asked. */
  typing(node: string, field: string): Promise<FieldTyping>;
  /** Where this tab's caret stands in a field typed together, or null once it has left it. */
  sayCaret(caret: PresenceCaret | null): void;
  /** The others here, by participant: whose carets are drawn. */
  readonly who: ReadonlyMap<string, Presence>;
}

/** Typing together, where the host gave it (`useContext(TypingContext)`); null where every field is written whole. */
export const TypingContext = createContext<LiveTyping | null>(null);

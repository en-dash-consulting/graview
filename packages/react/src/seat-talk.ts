import type { ChatReply, OfferedQuestion, ProposedCall, SeatMove, SeatOffer } from "@graview/tools";
import type { AddLensEdit, RemoveLensEdit, SeatDraft } from "@graview/tools/draft";
import { useSyncExternalStore } from "react";

/**
 * THE CONVERSATION BELONGS TO THE APP, NOT TO ONE FACE.
 *
 * The seat's turns lived in the panel that drew them, so a person who asked
 * on the scene and switched to Pages met an empty seat: the panel on the
 * other face was a second one, and the first had taken what was said with
 * it when it went. The turns, what became of each proposal, whether the
 * seat is open and which foot it stands at are held here, by the provider,
 * so every face that draws the seat draws the same one.
 *
 * A face that is a page of its own (the whole-page Shell at `/`, the routed
 * face at `/pages`) is a second provider in a second document, so the same
 * state is kept in the tab's session storage under the app's name and read
 * back when the next one starts. A provider drawn inside another (the
 * routed face inside an embed) takes the outer one's, so the two are one.
 *
 * Kept outside React's state so a turn re-renders the seat and nothing else.
 */

export interface SeatTurn {
  readonly role: "person" | "seat";
  readonly text: string;
  readonly proposals?: readonly ProposedCall[];
  /** Questions the seat is asking back, each at the node it is about. */
  readonly questions?: readonly OfferedQuestion[];
  /** The graph could not read the sentence. */
  readonly unsure?: boolean;
  /**
   * A model gave this answer (`ai:<name>`): what it proposes is logged
   * through this, and the seat sets one quiet "Answered with AI" under it.
   */
  readonly via?: string;
  /** What the words found, when that was the answer: each a way to go there. */
  readonly picks?: ChatReply["picks"];
  /** Where the answer took the app ("Went to The week."): each a link that goes there again. */
  readonly moves?: readonly SeatMove[];
  /** A picture the moves could not show, offered: "Show as a view". */
  readonly offer?: SeatOffer;
  /** A lens kept from a draft, said in the conversation, with the way to take it back. */
  readonly kept?: SeatKept;
}

/** A lens kept from a draft: the edit, whether the declaration has it now, and whether it was taken back. */
export interface SeatKept {
  readonly edit: AddLensEdit;
  /** True when the host wrote it into the declaration; false when it is the reader's own. */
  readonly written: boolean;
  readonly taken?: boolean;
}

/** A lens edit the seat hands its host: keep a drawn view (`add-lens`), or take one back (`remove-lens`). */
export type LensEdit = AddLensEdit | RemoveLensEdit;

/** What a host says it did with a lens edit: `kept` when the declaration has the change now. */
export type KeepLensAnswer = boolean | { readonly kept: boolean; readonly said?: string } | undefined | void;

/**
 * THE HOST THAT KEEPS A LENS THE SEAT DREW (`onKeepLens`). Handed the
 * check-clean edit; a host that writes the declaration (a document app's
 * server, a dev server) answers `{ kept: true }`, and the lens is in the
 * places for everybody. Any other answer, or none, and the lens is kept as
 * the reader's own.
 */
export type KeepLensHost = (edit: LensEdit) => KeepLensAnswer | Promise<KeepLensAnswer>;

/** What became of a proposal, said where it was offered. */
export type SeatOutcome =
  | { readonly state: "applied"; readonly said: string }
  | { readonly state: "declined"; readonly said: string }
  | { readonly state: "refused"; readonly error: string };

/** Which foot of the picture the seat stands at on a desk. */
export type SeatSide = "left" | "right";

export interface SeatTalkState {
  readonly turns: readonly SeatTurn[];
  readonly outcomes: ReadonlyMap<string, SeatOutcome>;
  readonly busy: boolean;
  readonly open: boolean;
  readonly side: SeatSide;
  /** A question asked from somewhere else (Find's "Ask:" row), waiting for the seat to send it. */
  readonly pending: string | null;
  /** How many seats are drawn: Find offers "Ask:" only where one is. */
  readonly drawn: number;
  /** The view the seat drew, shown in place of the picture until it is kept or put away. */
  readonly draft: SeatDraft | null;
  /** Why the last ask could not be drawn, said over the last good draft. */
  readonly draftNote: string | null;
}

export interface SeatTalk {
  get(): SeatTalkState;
  subscribe(listener: () => void): () => void;
  setTurns(next: (current: readonly SeatTurn[]) => readonly SeatTurn[]): void;
  settle(key: string, outcome: SeatOutcome): void;
  setBusy(busy: boolean): void;
  setOpen(open: boolean): void;
  setSide(side: SeatSide): void;
  /** Opens the seat with this question, to be sent by whichever seat is drawn. */
  ask(question: string): void;
  /** The waiting question, taken once. */
  takePending(): string | null;
  /** A seat is drawn; the returned function says it is gone. */
  drawn(): () => void;
  /** Shows a drawn view (or puts it away, with null), and what to say over it. */
  setDraft(draft: SeatDraft | null, note?: string | null): void;
}

const EMPTY: SeatTalkState = { turns: [], outcomes: new Map(), busy: false, open: false, side: "left", pending: null, drawn: 0, draft: null, draftNote: null };

/** The key the tab keeps an app's conversation under. */
export const seatTalkKey = (app: string): string => `graview:seat:${app}`;

function read(key: string | null): Partial<SeatTalkState> {
  if (!key) return {};
  try {
    const kept = sessionStorage.getItem(key);
    if (!kept) return {};
    const parsed = JSON.parse(kept) as { turns?: SeatTurn[]; outcomes?: [string, SeatOutcome][]; open?: boolean; side?: SeatSide; draft?: SeatDraft | null };
    return {
      ...(Array.isArray(parsed.turns) ? { turns: parsed.turns } : {}),
      ...(Array.isArray(parsed.outcomes) ? { outcomes: new Map(parsed.outcomes) } : {}),
      ...(typeof parsed.open === "boolean" ? { open: parsed.open } : {}),
      ...(parsed.side === "left" || parsed.side === "right" ? { side: parsed.side } : {}),
      ...(parsed.draft?.drawn ? { draft: parsed.draft } : {}),
    };
  } catch {
    // A private window, a sandboxed frame, a value from another version: the seat starts fresh.
    return {};
  }
}

function write(key: string | null, state: SeatTalkState): void {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ turns: state.turns.slice(-40), outcomes: [...state.outcomes], open: state.open, side: state.side, draft: state.draft }));
  } catch {
    // Kept for this page only.
  }
}

/** One app's conversation; `app` names where the tab keeps it, null to keep it in memory only. */
export function createSeatTalk(app: string | null): SeatTalk {
  const key = app === null ? null : seatTalkKey(app);
  let state: SeatTalkState = { ...EMPTY, ...read(key) };
  const listeners = new Set<() => void>();
  const set = (next: SeatTalkState, keep = true) => {
    state = next;
    if (keep) write(key, state);
    for (const listener of [...listeners]) listener();
  };
  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    setTurns: (next) => set({ ...state, turns: next(state.turns) }),
    settle: (at, outcome) => set({ ...state, outcomes: new Map(state.outcomes).set(at, outcome) }),
    setBusy: (busy) => set({ ...state, busy }, false),
    setOpen: (open) => {
      if (state.open !== open) set({ ...state, open });
    },
    setSide: (side) => {
      if (state.side !== side) set({ ...state, side });
    },
    ask: (question) => set({ ...state, open: true, pending: question.trim() || null }),
    takePending() {
      const pending = state.pending;
      if (pending !== null) set({ ...state, pending: null }, false);
      return pending;
    },
    drawn() {
      set({ ...state, drawn: state.drawn + 1 }, false);
      return () => set({ ...state, drawn: Math.max(0, state.drawn - 1) }, false);
    },
    setDraft: (draft, note = null) => set({ ...state, draft, draftNote: note }),
  };
}

/** Whether a seat is drawn, re-rendering only when that changes: the scene keeps its foot clear for it. */
export function useSeatDrawn(talk: SeatTalk): boolean {
  const drawn = () => talk.get().drawn > 0;
  return useSyncExternalStore(talk.subscribe, drawn, drawn);
}

/** The conversation as it is now, re-rendering when it changes. */
export function useSeatTalkState(talk: SeatTalk): SeatTalkState {
  return useSyncExternalStore(talk.subscribe, talk.get, talk.get);
}

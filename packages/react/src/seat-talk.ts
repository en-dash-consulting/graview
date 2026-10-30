import type { ChatReply, OfferedQuestion, ProposedCall, SeatMove, SeatOffer } from "@graview/tools";
import type { AddLensEdit, RemoveLensEdit, SeatDraft } from "@graview/tools/draft";
import type { ComposeChangeHost, ProposeChangeAnswer, ProposeChangeHost, ReshapeProposal } from "@graview/tools/reshape";
import { useSyncExternalStore } from "react";

/**
 * THE CONVERSATION BELONGS TO THE APP, NOT TO ONE FACE.
 *
 * The seat's turns lived in the panel that drew them, so a person who asked
 * on the scene and switched to Pages met an empty seat: the panel on the
 * other face was a second one, and the first had taken what was said with
 * it when it went. The turns, what became of each proposal and the view
 * it drew are held here, by the provider, so every face that draws a
 * conversation (`ChatPanel`, where a product places one) draws the same
 * one, and a panel the inline AI drew stands on both faces.
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
  /**
   * A CHANGE TO THE APP ITSELF the seat proposed (Roadmap f-seat-reshape):
   * drawn as a card of chips — added, kept, dropped — with Accept, which
   * hands it to the host's `onProposeChange`.
   */
  readonly reshape?: ReshapeProposal;
}

/**
 * THE HOST THAT APPLIES A CHANGE TO THE APP THE SEAT PROPOSED
 * (`onProposeChange`, `@graview/tools/reshape`): handed the proposal a
 * person accepted — its card and the edits that make it — it previews and
 * applies the change under its own policy, as the person, as one undoable
 * change, and answers `"applied"`; or `"declined"`. Without it the seat
 * never offers a change to the app.
 */
export type { ComposeChangeHost, ProposeChangeAnswer, ProposeChangeHost, ReshapeProposal };

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

export interface SeatTalkState {
  readonly turns: readonly SeatTurn[];
  readonly outcomes: ReadonlyMap<string, SeatOutcome>;
  readonly busy: boolean;
  /** A question asked from somewhere else (a suggestion, a conversation's own composer), waiting for it to be sent. */
  readonly pending: string | null;
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
  /** This question, to be sent by the conversation that is drawn. */
  ask(question: string): void;
  /** The waiting question, taken once. */
  takePending(): string | null;
  /** Shows a drawn view (or puts it away, with null), and what to say over it. */
  setDraft(draft: SeatDraft | null, note?: string | null): void;
}

const EMPTY: SeatTalkState = { turns: [], outcomes: new Map(), busy: false, pending: null, draft: null, draftNote: null };

/** The key the tab keeps an app's conversation under. */
export const seatTalkKey = (app: string): string => `graview:seat:${app}`;

function read(key: string | null): Partial<SeatTalkState> {
  if (!key) return {};
  try {
    const kept = sessionStorage.getItem(key);
    if (!kept) return {};
    const parsed = JSON.parse(kept) as { turns?: SeatTurn[]; outcomes?: [string, SeatOutcome][]; draft?: SeatDraft | null };
    return {
      ...(Array.isArray(parsed.turns) ? { turns: parsed.turns } : {}),
      ...(Array.isArray(parsed.outcomes) ? { outcomes: new Map(parsed.outcomes) } : {}),
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
    sessionStorage.setItem(key, JSON.stringify({ turns: state.turns.slice(-40), outcomes: [...state.outcomes], draft: state.draft }));
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
    ask: (question) => set({ ...state, pending: question.trim() || null }),
    takePending() {
      const pending = state.pending;
      if (pending !== null) set({ ...state, pending: null }, false);
      return pending;
    },
    setDraft: (draft, note = null) => set({ ...state, draft, draftNote: note }),
  };
}

/** The conversation as it is now, re-rendering when it changes. */
export function useSeatTalkState(talk: SeatTalk): SeatTalkState {
  return useSyncExternalStore(talk.subscribe, talk.get, talk.get);
}

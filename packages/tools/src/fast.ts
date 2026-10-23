import type { Question } from "./questions.js";

/**
 * THE FAST SLOT'S CONTRACT, WHOEVER ANSWERS IT: one state and a map of
 * typed questions (`Choice`, `Noul`, `Score`, `./questions.ts`) in, typed
 * answers with a confidence and the call's usage out. Jev answers it
 * (`jevDecide`, `./providers/jev.ts`); so may any model a host puts
 * behind the same shape, and nothing here names a vendor.
 */

export type ChoiceAnswer = {
  readonly type: "choice";
  readonly choice: string;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
};
export type NoulAnswer = { readonly type: "noul"; readonly noul: number };
export type ScoreAnswer = {
  readonly type: "score";
  readonly score: number;
  readonly confidence: number;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly legend: Readonly<Record<string, string>>;
};
export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Requests made, retries excluded. */
  readonly calls: number;
  readonly questions: number;
}

export interface Decided {
  readonly answers: Readonly<Record<string, Answer>>;
  /** This call's own usage. */
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}

/** The whole provider surface: one state, a map of questions, typed answers back. */
export type Decide = (state: unknown, questions: Readonly<Record<string, Question>>) => Promise<Decided>;


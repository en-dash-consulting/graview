import type { RefusalReason } from "./refusal.js";

/**
 * A REFUSAL AN ACT SAYS ITSELF, TYPED (FR-110).
 *
 * An act that cannot do what it was asked — a derived edit given nothing
 * to change, a document's act whose condition does not hold — throws one
 * of these (`@graview/core/document` exports the same class): its reason
 * from the closed set `refusalOf` speaks, and the sentence a person reads.
 * A bare `Error` from an act was a host's "went wrong on our side"; this
 * is the act saying no, and a host shows it.
 *
 * Its own module, importing nothing, so a page that compiles a document
 * carries the class and not what `refusalOf` reads.
 */
export class ActRefusal extends Error {
  constructor(
    readonly sentence: string,
    readonly reason: RefusalReason = "invalid",
  ) {
    super(sentence);
    this.name = "ActRefusal";
  }
}

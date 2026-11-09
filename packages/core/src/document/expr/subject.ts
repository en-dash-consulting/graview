/**
 * THE TWO NAMES SPELLED WITH A `$`, as an act's effects spell them; fields
 * and arguments are bare words, so neither can be either.
 *
 * - `$subject` is the record an expression is judged on — in an act's
 *   condition and refusal, the act's subject; inside a `where` or an
 *   `every`, still the outer record. `$subject.status` is its own field.
 * - `$arg` is the call's arguments, in an act's condition and refusal:
 *   `$arg.status` is the argument by that name, or nothing where the call
 *   gave none.
 *
 * A bare name is a member's field inside a `where` or an `every`; else the
 * call's argument by that name, where it gave one; else the record's field.
 * Apart from the parser, so a page that evaluates a compiled app's
 * expressions carries no parser.
 */
export const SUBJECT_NAME = "$subject";
export const ARG_NAME = "$arg";

/** Whether an expression is `$subject.<field>` or `$arg.<name>`, by which. */
export const dollarOf = (e: { readonly t: string; readonly name?: string }): "subject" | "arg" | undefined =>
  e.t === "ident" ? (e.name === SUBJECT_NAME ? "subject" : e.name === ARG_NAME ? "arg" : undefined) : undefined;

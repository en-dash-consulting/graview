import { GraphError } from "../graph/graph.js";

/*
 * A file of its own (FR-179): every act refuses its arguments with this, up
 * front, and saying the refusal in a person's words (`./words.ts`) is
 * fetched with the form or the seat that says it.
 */

/** Arguments a mutation refused, each with where it was and what was wrong. */
export class InvalidArguments extends GraphError {
  constructor(
    readonly mutation: string,
    readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
  ) {
    super(
      `Invalid arguments for mutation "${mutation}"`,
      issues.map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`).join("; "),
    );
    this.name = "InvalidArguments";
  }
}

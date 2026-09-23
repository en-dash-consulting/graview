import type { DeclarationChange } from "@graview/core";
import type { Completion } from "@graview/tools";
import type { Rewrite } from "./changes.js";

/**
 * AN ACT OR A RULE, REWRITTEN FOR THE DECLARATION IT NOW SERVES.
 *
 * The one piece of an app the studio cannot derive is a body: what an act
 * actually does, what a rule actually judges. When a change leaves one of
 * them written for a declaration that has moved on, a model is a fair
 * first draft — given the code as it is, what changed and why the code is
 * affected — and the draft is the person's to read, correct or refuse
 * before a byte is written, and the compiler's to judge after.
 */
export interface RewriteAsk extends Rewrite {
  /** The declaration object as the checkout writes it now: `{ title: …, apply(ctx, args) { … } }`. */
  readonly text: string;
  readonly changes: readonly DeclarationChange[];
  /** The kinds as they will be, when the door could say: what the new code is written against. */
  readonly schema?: string;
}

const HOW = `You are rewriting one declaration in a TypeScript app built on Graview, a typed context-graph framework.
An act is declared as defineMutation(name, { title, description, subject, creates, connects, severs, writes, input: z.object({ … }), describe(args, graph), apply(ctx, args) { … } }).
In apply, ctx.addNode, ctx.patchNode, ctx.removeNode, ctx.addEdge({ kind, from, to }) and ctx.removeEdge change the graph; ctx.graph.out(id, edgeKind) and ctx.graph.in(id, edgeKind) read it. An edge is declared on the kind at its "from" end.
A rule is declared as defineInvariant(name, { scope, label, description, repairs, evaluate({ graph, subject }) { … return violations } }).
The app's declaration has changed, and the declaration below was written for the old one.`;

export async function rewriteCode(complete: Completion, ask: RewriteAsk): Promise<string> {
  const prompt = [
    HOW,
    `The ${ask.sort} "${ask.name}" as it is written now:\n${ask.text}`,
    `What changed in the declaration:\n${ask.changes.map((change) => `- ${JSON.stringify(change)}`).join("\n")}`,
    `Why this ${ask.sort} is affected: ${ask.why}`,
    ask.schema ? `The kinds as they will be:\n${ask.schema}` : "",
    `Rewrite the object so it is true of the new declaration. Keep its name, its title, its words and everything that is still right; change only what the change requires. Keep the comments that are still true.
Answer with ONLY the object, from its opening { to its closing } — no defineMutation(…) around it, no explanation, no code fence.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return theObject(await complete(prompt));
}

/**
 * The object out of whatever a model wrapped it in: a fence, a sentence
 * before it, the call it was asked to leave off. From the first `{` to the
 * `}` that closes it, counted, so a brace in a string does not end it early.
 */
export function theObject(answer: string): string {
  const text = answer.replace(/```[a-z]*\n?/gi, "");
  const start = text.indexOf("{");
  if (start < 0) throw new Error("The model answered with no object to use.");
  let depth = 0;
  let quote: string | null = null;
  for (let at = start; at < text.length; at++) {
    const char = text[at]!;
    if (quote) {
      if (char === "\\") at++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && --depth === 0) {
      return text.slice(start, at + 1);
    }
  }
  throw new Error("The model's answer never closed the object it opened.");
}

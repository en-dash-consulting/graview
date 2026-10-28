import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * WHAT THE APP SAYS OF SUGGESTIONS AS A WHOLE, JUDGED (Roadmap
 * f-suggestion-votes). `tidying.autoAcceptAt` has the app's own actor make
 * a suggestion once so many people voted for it — and a person votes only
 * when the store would refuse them the change. An app with no policy
 * refuses nobody: everyone who sees a suggestion may accept it outright,
 * so nobody ever votes and the number is never reached. Said as a
 * warning, since the declaration still compiles and runs; the shape — a
 * whole number from 1 — is the document's own to refuse.
 */
export function checkTidying<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  const at = app.tidying?.autoAcceptAt;
  if (at === undefined || app.policy) return;
  add({
    severity: "warning",
    code: "tidying-votes-unreachable",
    where: "tidying.autoAcceptAt",
    message: `The app would make a suggestion at ${at} ${at === 1 ? "vote" : "votes"} for it, and has no policy: everyone who sees a suggestion may accept it outright, so nobody votes and no suggestion reaches ${at}.`,
    fix: `Declare a policy whose grants leave some role — a reader — unable to make the change, or leave "tidying.autoAcceptAt" out.`,
  });
}

import type { KeptViews, ViewForkKept, ViewReviseAnswer } from "../views/kept.js";

/**
 * A HOST THAT MAKES A BUILT-IN PAGE ITS OWN VIEW, CHECKED (Roadmap
 * f-make-any-page-better). Where the view spec has no word for what a
 * person asked of a built-in page, "Make “Tasks” its own view" drafts a
 * worker view seeded from the page, shows it there on this page only
 * (`KeptViews.draftFork`), and on Keep hands it to the host's view door
 * (`KeptViews.fork`), which keeps it as that page's view and answers its
 * one way back. This runs a host's door through what the page asks of it:
 * it offers forking only to whoever may change views, shows the draft as a
 * draft and puts it away, keeps the view it was handed, and one Undo takes
 * it away again.
 */

export interface ViewForkHostReport {
  readonly ok: boolean;
  readonly claims: {
    readonly offersForking: boolean;
    readonly showsTheDraftAndPutsItAway: boolean;
    readonly keepsTheView: boolean;
    readonly undoTakesItAway: boolean;
  };
  readonly said: readonly string[];
}

/** Checks `keeper` with one view made of a built-in page, as a seat that may change views. */
export async function checkViewForkHost(keeper: KeptViews, fork: ViewForkKept): Promise<ViewForkHostReport> {
  const said: string[] = [];
  const claims = { offersForking: false, showsTheDraftAndPutsItAway: false, keepsTheView: false, undoTakesItAway: false };
  const done = () => ({ ok: Object.values(claims).every(Boolean), claims, said });
  const lends = typeof keeper.fork === "function" && typeof keeper.draftFork === "function" && typeof keeper.forked === "function";
  claims.offersForking = lends && keeper.current().may.views === true;
  if (!claims.offersForking) return (said.push(!lends ? "The host's views lend no fork, draftFork and forked: no page is offered its own view." : "current().may.views is not true for this seat: no page is offered its own view."), done());
  const named = (one: ViewForkKept) => one.manifest.name === fork.manifest.name;
  try {
    keeper.draftFork!(fork);
    const shown = keeper.forked!().find(named);
    keeper.draftFork!(null);
    const gone = !keeper.forked!().some(named);
    claims.showsTheDraftAndPutsItAway = shown?.draft === true && shown.source === fork.source && gone;
    if (!claims.showsTheDraftAndPutsItAway) said.push(shown?.draft !== true ? "draftFork did not list the view as a draft in forked()." : "draftFork(null) did not put the draft away.");
  } catch (error) {
    return (said.push(`draftFork refused it: ${error instanceof Error ? error.message : String(error)}`), done());
  }
  let answer: ViewReviseAnswer;
  try {
    answer = await keeper.fork!(fork);
  } catch (error) {
    return (said.push(`fork refused it: ${error instanceof Error ? error.message : String(error)}`), done());
  }
  const kept = keeper.forked!().find(named);
  claims.keepsTheView = kept !== undefined && kept.draft !== true && kept.source === fork.source;
  if (!claims.keepsTheView) said.push("After fork, forked() does not list the view it was handed, kept.");
  if (!answer || typeof answer.undo !== "function") return (said.push("fork answered no undo: the card's one Undo has nothing to take it back with."), done());
  try {
    await answer.undo();
  } catch (error) {
    return (said.push(`Undo failed: ${error instanceof Error ? error.message : String(error)}`), done());
  }
  claims.undoTakesItAway = !keeper.forked!().some(named);
  if (!claims.undoTakesItAway) said.push("One Undo did not take the view away again.");
  return done();
}

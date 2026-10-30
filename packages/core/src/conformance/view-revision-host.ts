import type { KeptViews, ViewReviseAnswer } from "../views/kept.js";

/**
 * A HOST THAT KEEPS A SECTION'S REVISION, CHECKED (Roadmap
 * f-make-this-section-better). "Make this better" on a section of a worker
 * view composes the view whole, judges it on the page, and hands Keep to
 * the host's view door — `KeptViews.revise`, beside hide, show, remove and
 * restore — which keeps it as it keeps a view a chat replaced (Graview
 * Cloud: `propose_view` and `apply_view`), and answers its one way back.
 * This runs a host's door through what the page asks of it: it offers
 * revising only to whoever may change views, keeps the code it was handed,
 * and one Undo — its own `undo`, else the code before handed back — puts
 * the view as it was. A host reads back what it keeps with `read` (its
 * store), else `KeptViews.revised`.
 */

export interface ViewRevisionHostReport {
  readonly ok: boolean;
  readonly claims: {
    readonly offersRevising: boolean;
    readonly keepsTheRevision: boolean;
    readonly undoPutsItBack: boolean;
  };
  readonly said: readonly string[];
}

/**
 * Checks `keeper` with one revision of the view `name` from `before` to
 * `after`, as a seat that may change views; `read` answers the code the
 * host keeps for a view now.
 */
export async function checkViewRevisionHost(
  keeper: KeptViews,
  scenario: { readonly name: string; readonly title?: string; readonly before: string; readonly after: string; readonly read?: (name: string) => string | undefined | Promise<string | undefined> },
): Promise<ViewRevisionHostReport> {
  const said: string[] = [];
  const claims = { offersRevising: false, keepsTheRevision: false, undoPutsItBack: false };
  const done = () => ({ ok: Object.values(claims).every(Boolean), claims, said });
  const read = scenario.read ?? keeper.revised?.bind(keeper);
  claims.offersRevising = typeof keeper.revise === "function" && keeper.current().may.views === true;
  if (!claims.offersRevising) return (said.push(typeof keeper.revise !== "function" ? "The host's views lend no revise: no section is offered for revising." : "current().may.views is not true for this seat: no section is offered for revising."), done());
  if (!read) return (said.push("Nothing reads back what the host keeps: pass `read`, or give the views `revised`."), done());
  const base = { name: scenario.name, title: scenario.title ?? scenario.name, section: "Conformance", said: "Revised the section." };
  let answer: ViewReviseAnswer;
  try {
    answer = await keeper.revise!({ ...base, source: scenario.after, before: scenario.before });
  } catch (error) {
    return (said.push(`revise refused it: ${error instanceof Error ? error.message : String(error)}`), done());
  }
  claims.keepsTheRevision = (await read(scenario.name)) === scenario.after;
  if (!claims.keepsTheRevision) said.push("After revise, the host does not keep the code it was handed.");
  try {
    if (answer && typeof answer.undo === "function") await answer.undo();
    else await keeper.revise!({ ...base, source: scenario.before, before: scenario.after, undoes: true });
  } catch (error) {
    return (said.push(`Undo failed: ${error instanceof Error ? error.message : String(error)}`), done());
  }
  const back = await read(scenario.name);
  claims.undoPutsItBack = back === undefined || back === scenario.before;
  if (!claims.undoPutsItBack) said.push("One Undo did not put the view's code back as it was.");
  return done();
}

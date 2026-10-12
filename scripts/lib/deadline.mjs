/**
 * A harness that stops says where.
 *
 * `verify-menu` answered an ask by typing until the ask went away; when the
 * example's tasks gained a file field, the ask never went away, and the
 * harness waited forever. The nightly ran out its sixty minutes with no
 * verdict from it or from the harness queued behind it, so the only thing
 * the run said was that it was canceled.
 *
 * A deadline is reset at every claim the harness reaches. If one claim
 * takes longer than the limit, the verdict is written anyway: that claim
 * fails, `stoppedAt` names it, and the process exits 1 — a named failure in
 * minutes rather than a silence for an hour.
 *
 *   const reach = deadline({ verdict: "docs/menu.json", report, cleanup });
 *   reach("pinThenReorder");   // … drive the claim …
 *   reach.done();
 */
import { writeFileSync } from "node:fs";

/**
 * @param {{ verdict: string, report: { checks: Record<string, unknown>, [key: string]: unknown },
 *           cleanup?: () => Promise<unknown> | unknown, seconds?: number }} options
 *   `seconds` defaults to GRAVIEW_STEP_SECONDS, else 180 — three times the
 *   longest single wait a harness makes (the app's first load, 60 s).
 */
export function deadline({ verdict, report, cleanup, seconds }) {
  const limit = seconds ?? Number(process.env.GRAVIEW_STEP_SECONDS ?? 180);
  let at = "starting";
  let timer;
  const stuck = async () => {
    report.checks[at] = { ok: false, stopped: `did not finish in ${limit}s` };
    report.stoppedAt = at;
    report.error = `stopped at ${at}: it did not finish in ${limit}s`;
    report.passed = false;
    writeFileSync(verdict, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${report.error}\n\nwrote ${verdict}\n`);
    // Put the browser and the dev server away, but never wait on them for long.
    await Promise.race([Promise.resolve(cleanup?.()).catch(() => {}), new Promise((done) => setTimeout(done, 10_000))]);
    process.exit(1);
  };
  /** Says the harness has reached this claim, and gives it the whole limit. */
  const reach = (claim) => {
    at = claim;
    clearTimeout(timer);
    timer = setTimeout(stuck, limit * 1000);
  };
  reach.done = () => clearTimeout(timer);
  /** The claim last reached — for a harness's own catch to fail by name. */
  reach.at = () => at;
  reach(at);
  return reach;
}

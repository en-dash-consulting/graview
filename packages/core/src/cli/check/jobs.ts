import { documentOf } from "../../document/to-document.js";
import { jobFindings, jobWorldOfApp } from "../../job-findings.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * AN APP'S JOBS, HELD TO THE DECLARATION (Roadmap f-app-jobs):
 * `defineApp({ purpose })` is asked what a document's `purpose` is asked, in
 * the same words and codes (`job-kind`, `job-where`, `job-sort`, `job-act`,
 * `job-act-kind`, `job-role`, `job-name-taken`, `jobs-too-many`). A
 * document's are judged with its own sentences, at its own paths
 * (`compileDocument`), so an app compiled from one is not asked twice.
 */
export function checkJobs<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (!app.purpose?.jobs || documentOf(app)) return;
  for (const finding of jobFindings(app.purpose, jobWorldOfApp(app))) {
    add({
      severity: "error",
      code: finding.code,
      where: `defineApp(…).purpose.jobs${finding.index === undefined ? "" : `[${finding.index}]${finding.key ? `.${finding.key}` : ""}`}`,
      message: finding.message,
      fix: finding.fix,
    });
  }
}

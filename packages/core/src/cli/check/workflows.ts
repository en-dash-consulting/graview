import { documentOf } from "../../document/to-document.js";
import type { AnySchema } from "../../schema/schema.js";
import { workflowFindings } from "../../workflows/findings.js";
import { workflowWorldOfApp } from "../../workflows/world.js";
import type { CheckContext } from "./context.js";

/**
 * AN APP'S WORKFLOWS, HELD TO THE DECLARATION (Roadmap f-jobs-declared):
 * `defineApp({ workflows })` is asked what a document's `workflows` is
 * asked, in the same words and codes (`workflow-*`). A document's are
 * judged at its own paths (`compileDocument`), so an app compiled from one
 * is not asked twice.
 */
export function checkWorkflows<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (!app.workflows || documentOf(app)) return;
  for (const finding of workflowFindings(app.workflows, workflowWorldOfApp(app))) {
    const path = finding.path.split(".").filter(Boolean).map((part) => (/^\d+$/.test(part) ? `[${part}]` : `.${part}`)).join("");
    add({ severity: finding.severity, code: finding.code, where: `defineApp(…).workflows${finding.workflow ? `["${finding.workflow}"]` : ""}${path}`, message: finding.message, fix: finding.fix, ...(finding.edits ? { edits: finding.edits } : {}) });
  }
}

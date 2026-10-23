/*
 * THE AUDIT, AS A PAGE RUNS IT (`graview view check --audit --browser`):
 * `auditView` left on the page's global, bundled by
 * scripts/guest-view-runtime.mjs into one classic script
 * (`page.generated.ts`) that the command puts in the browser it opens. A
 * page of an app never loads it.
 */
import { auditView } from "./index.js";

(globalThis as unknown as { __graviewAudit?: typeof auditView }).__graviewAudit = auditView;

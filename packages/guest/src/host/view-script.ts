import { retryingImport } from "@graview/core";

/* The view's runtime, asked for again with a URL of its own when it did not arrive (FR-139). */
const viewRuntime = retryingImport(() => import("./view-runtime.generated.js"));

/**
 * The worker's whole script for a view's source: the runtime, then the view
 * in a strict function of its own. What the host makes a `blob:` worker of;
 * a host whose page allows no `blob:` worker serves it from its own origin
 * instead, after `checkViewSource`, and passes `worker: { url }` (FR-102).
 */
export async function viewScript(source: string): Promise<string> {
  const { VIEW_RUNTIME } = await viewRuntime();
  return `${VIEW_RUNTIME}\n;(function () {\n"use strict";\n${source}\n})();\n`;
}

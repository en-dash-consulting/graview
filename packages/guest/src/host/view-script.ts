/*
 * The view's runtime, asked for again on the next call when it did not
 * arrive (FR-139). A literal specifier and nothing more: a host may make a
 * view's script on its own server, workerd among them, which refuses an
 * `import()` whose specifier is computed at run time.
 */
let loading: Promise<typeof import("./view-runtime.generated.js")> | undefined;
const viewRuntime = () =>
  (loading ??= import("./view-runtime.generated.js").catch((error: unknown) => {
    loading = undefined;
    throw error;
  }));

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

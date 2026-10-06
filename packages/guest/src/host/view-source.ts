/*
 * A VIEW WITH NO BUILD (FR-96).
 *
 * A chat writes a worker view as one plain script against the `graview`
 * global — no imports, no bundler, no copy of the protocol — and the host
 * makes it a worker: the runtime first (view-runtime.generated.ts: Remote
 * DOM's polyfill, the hardening, the channel, the global), then the view,
 * one strict classic script. A module worker is not an option: Chromium
 * refuses one from a `blob:` URL in an opaque origin, which is where a
 * chat's widget runs (FR-71).
 *
 * The hardened worker has no `eval`, no function constructor and no
 * `importScripts`; the one way left to load code is `import()`, which is
 * syntax, so a view whose text says `import` anywhere — in code, a string or
 * a comment — is refused before it runs. A keyword cannot be spelled with
 * an escape, so the text is the whole truth. `export` makes a classic script
 * a syntax error, and is refused with a sentence rather than a failed start.
 */

/** What in a view's source keeps the host from running it, in sentences. Empty when it may run. */
export function checkViewSource(source: string): readonly string[] {
  const findings: string[] = [];
  if (typeof source !== "string") return ["A view's source is text."];
  if (/\bimport\b/.test(source)) findings.push("It says import: a view loads nothing, so the word may not appear in it at all, even in a string or a comment.");
  if (/\bimportScripts\b/.test(source)) findings.push("It names importScripts: a view loads nothing.");
  if (/^\s*export\b/m.test(source)) findings.push("It exports something: a view is a plain script that draws through the graview global, not a module.");
  if (/\brequire\s*\(/.test(source)) findings.push("It calls require(): a view has no modules to require.");
  return findings;
}

/**
 * The worker's whole script for a view's source: the runtime, then the view
 * in a strict function of its own. What the host makes a `blob:` worker of;
 * a host whose page allows no `blob:` worker serves it from its own origin
 * instead, after `checkViewSource`, and passes `worker: { url }` (FR-102).
 */
export async function viewScript(source: string): Promise<string> {
  const { VIEW_RUNTIME } = await import("./view-runtime.generated.js");
  return `${VIEW_RUNTIME}\n;(function () {\n"use strict";\n${source}\n})();\n`;
}

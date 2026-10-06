/*
 * `@graview/core/check` — the checker, and the app read out in words: what
 * `graview check`, `graview describe` and `graview docs` say of a
 * declaration, and a document or a template compiled WITH the checker.
 *
 * An entry of its own, not part of `@graview/core` or
 * `@graview/core/document`: a hosted page imports both barrels up front, and
 * a bundler places a whole module in every chunk that can reach it — so the
 * checker's reach (the city, the figures, the order things are made in)
 * rode in what every hosted page loads first, though the page compiles with
 * `compileDocumentWithoutCheck` and never asks for a verdict. A host, the
 * command line and a test import the checker from here.
 */
export { checkApp, formatFindings } from "./cli/check.js";
export type { CheckResult, Finding, Severity } from "./cli/check.js";
export { compileDocument } from "./document/compile-checked.js";
export { instantiateTemplate } from "./document/instantiate-template.js";
export { describeApp } from "./cli/describe.js";
export type { DescribeOptions } from "./cli/describe.js";
export { generateAgentsMd, generateLlmsTxt } from "./cli/docs.js";

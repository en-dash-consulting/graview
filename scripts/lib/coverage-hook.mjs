/**
 * `node --import=scripts/lib/coverage-hook.mjs`: what this process reads is
 * written to GRAVIEW_COVERAGE_FILE (coverage.mjs). The chain puts it in
 * NODE_OPTIONS for each harness it starts, so every Node process the harness
 * starts is counted too. Without GRAVIEW_COVERAGE_FILE it does nothing.
 */
import { install } from "./coverage.mjs";

await install();

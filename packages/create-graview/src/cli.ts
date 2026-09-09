#!/usr/bin/env node
import { createGraview } from "./index.js";

createGraview(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`create-graview: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });

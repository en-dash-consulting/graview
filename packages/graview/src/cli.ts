#!/usr/bin/env node
import { main } from "./index.js";

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`graview: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });

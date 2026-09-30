---
"@graview/tools": patch
---

The test of where Jev's key comes from no longer reads the machine it runs on. It asked `jevKeyFromEnvironment(undefined)` for "no environment", which falls back to `process.env`, so `pnpm test` in a fresh checkout failed for anyone who had set `TYPESAFE_API_KEY` as the docs tell them to. "No environment" is now a runtime with no `process`, which is the browser the sentence is about.

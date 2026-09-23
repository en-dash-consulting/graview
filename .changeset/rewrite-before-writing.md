---
"@graview/core": patch
"@graview/ship": patch
"@graview/studio": patch
---

The code a declaration change leaves wrong is rewritten in the studio before anything is written. The studio door reads the checkout's acts and rules (`GET …/source`, `declaredCode`), replaces, adds and removes them in place (`replace-act`, `add-rule`, …), and compiles the app with the edit laid over its files (`typecheckWith`) before a byte lands, refusing with the compiler's own words. `sourceChanges` names each act or rule whose declaration changed, `codeTouched` each one whose code mentions what moved or went, and Apply puts every one of them in front of the person — editable, with "Ask the seat to rewrite it" (`rewriteCode`, the configured model) and "It still holds as written" — writing only once each is settled.

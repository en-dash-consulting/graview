---
"@graview/core": patch
---

The bound `defineInvariant` takes `judgesPast`. The engine has always honoured it and the graview-invariant skill tells an author to write it, but the declaration `bindSchema` hands out — the one the scaffold and every skill use — refused the property at typecheck, so a rule about a sold vehicle or a closed deal could not be written the way the skill says without a cast.

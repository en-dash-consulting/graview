---
"@graview/tools": patch
"@graview/pages": patch
---

What takes a record away waits one press behind the rest on its page (FR-173). Archive and merge drawn beside a record's own acts stood between "Change the song" and its form, and renaming a song from the keyboard took 14 presses where it had taken 10. A record's page now keeps archive, merge and remove behind "Show N more" when there are two or more of them, and the first of them takes the keyboard when shown. An affordance says `setsAside: true` when it is a kind's derived archive or merge, so a design that draws its own acts (the discography's) can do the same. The pages face alone and every face are raised by what this added (`scripts/budget-raises/rename-keeps-its-presses-*.json`).

Compatibility: derived tools unchanged. An `Affordance` gains the optional `setsAside`.

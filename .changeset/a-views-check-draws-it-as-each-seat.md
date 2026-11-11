---
"@graview/core": patch
"@graview/guest": patch
"@graview/skills": patch
---

A view's headless check draws it as each seat (Roadmap f-view-check-draws-for-each-seat). The run that checks a proposed view is seated as one principal — its author, or the system — so a view that drew for its owner and fell back for a visitor passed. `runWorkerViewForEachSeat` (`@graview/guest/headless`) runs it once for each seat the app's policy names, or the seats a host hands (`seats`), and says for each whether it `drew`, `fell-back` or was `stopped`, with the reason, what it was handed of what the seat is kept from (`unseen`), and what it reads that the seat is not handed: the kinds it reads that the seat sees none of, and the hidden fields of the kinds it does see that its code names. `seatsOfPolicy` names the seats: the owner (the author, as handed, else the system), each role as a person holding it alone with an id that is no account's (`view-as:<role>`), and a visitor — signed out, a seat strangers share — where the policy names the `visitor` role or grants or shows anything to everybody. A seat that sees nothing the view reads falls back without running it, as the page does. The check passes where every seat drew, or fell back for having nothing it reads in sight. What it says of each seat is for somebody who may see as every seat — the app's owner — and never for one of the seats; the views kept for each seat it made up are let go of once its run is done (`forgetSeatView`, `@graview/core/seat`).

`graview view check --seats` runs it so, or as the seats it lists (`--seats owner,visitor`), one line a seat, or JSON with `--json`, and refuses a seat the app does not have. A single run still takes its seat from `--as` and `--roles`. The `graview-worker-view`, `graview-view-drawing` and `graview-sight` skills say so.

Tests: `a view's check draws it as each seat`, `graview view check --seats runs a view as each seat` (guest).

Compatibility: the wire — unchanged beyond `unseen`, which the run hands each seat's view as the page does. Ops and primitives — unchanged. Stored formats — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

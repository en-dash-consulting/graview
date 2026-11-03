---
"@graview/tools": patch
---

A workflow run asked to run as if at another moment finishes at that moment too. `runWorkflow({ now })` and `graview workflow --now` kept a run's `finished` at the later of `now` and the wall clock, so a run as if at a moment already past finished at the wall clock's, and listing it "as if" an hour on said "Last ran just now". The test that runs the household's next-weeks-events workflow at 6 PM on November 1 and lists it at 8 PM passed only until the real clock reached that evening. Without `now`, a run still finishes at the wall clock's.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged; a run's `finished` is `now` where the caller gave one. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

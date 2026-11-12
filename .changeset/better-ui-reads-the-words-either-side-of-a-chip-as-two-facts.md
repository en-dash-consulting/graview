---
"@graview/primitives": patch
---

Better UI reads the words either side of a chip as two facts. A glance that leads with its kind's date draws "Sep 3, 2026", then a status chip, then "Done: no"; what a draft must still say was read as one fact, "Sep 3, 2026 Done: no", so a draft that kept the date and the done apart was told it had lost both.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

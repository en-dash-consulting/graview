---
"@graview/core": patch
---

A relation you can make but never unmake is now a finding: `graview check`
warns `edge-without-severer` for any edge kind some mutation declares in
`connects` while none declares it in `severs`, naming the connecting acts and
both ways out. An edge that is genuinely a record — rationale, history —
declares `appendOnly: true` on its edge declaration, which suppresses the
warning and documents the intent in the same stroke.

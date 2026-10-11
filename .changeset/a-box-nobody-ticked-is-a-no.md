---
"@graview/core": patch
"@graview/pages": patch
---

A box nobody ticked is a no. A form that makes something with a required yes-or-no — "Induction first" on a tool — sent nothing for the box when it was left unticked, and the act refused "expected boolean, received undefined"; `formArgs` now sends it as `false`, as it sends a list nobody added to as `[]`. The derived form no longer marks a box "*", as if it had to be ticked. (W-177, the eighth walk.)

Compatibility: ops, stored formats, the wire, the document format, the compiled format and check finding codes are unchanged. Tool names and input schemas are unchanged; what a derived form sends for an untouched required box is now `false` where it was nothing.

---
"@graview/core": patch
"@graview/guest": patch
---

A worker view's style may hide a disclosure's marker (FR-221), Roadmap f-view-details-marker. A view drew "More" as a `<details class="more">` with a chevron of its own and hid the browser's triangle with `details.more summary::-webkit-details-marker { display: none }`, which is how Safari takes it; every `-webkit-` selector was refused ("Not drawn: CSS the open kit leaves out (selector -webkit-details-marker).") and took its whole rule with it, so the triangle stayed beside the chevron. The marker is the disclosure's own, in the view's tree, so `::-webkit-details-marker` is kept beside `summary::marker`, which already was (`CSS_PREFIXED_SELECTORS` in the open kit); every other prefixed selector is still refused. Guest's test keeps such a rule and still refuses `::-webkit-file-upload-button`. `capabilities().shipped` gains FR-221.

Compatibility: ops and primitives, stored formats, the declaration and derived tool names and input schemas — unchanged. The wire — additive: a view's stylesheet keeps a rule with `::-webkit-details-marker` that an earlier build dropped; `capabilities().shipped` gains FR-221. What Graview Cloud does: takes this build.

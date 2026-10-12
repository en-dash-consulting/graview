---
"@graview/guest": patch
"@graview/skills": patch
---

A worker view's link or `graview.navigate` that goes nowhere says why. A bare string was taken as a record's id and nothing else, so `graview.navigate("projections")` went nowhere without a word, and Graview Cloud's pricing app lost its bottom links that way. Now a bare string is a record the viewer may see first, then a place by that slug, so `graview.navigate("the-packages")` goes to the place. One that is neither, from code, `<a data-record>` or `<a data-place>`, says so in the view's console and to the host's new `onProblem`, on `mountWorkerView` and on a registered view's definition: '"projections" is no record this viewer may see and is no place of this app: it goes nowhere. Its places: "the-packages".' A record the viewer may not see is said the same way as one that is not there. A headless run's problems name the places too, and take a bare place slug as the host does. The worker-view skill says what a destination may be.

Compatibility: ops, stored formats, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. The guest protocol gains one message from host to view, `{ type: "notice", text }`, which a runtime from before it ignores; `GUEST_PROTOCOL` is unchanged. What a host does: pass `onProblem` to hear a worker view's links that go nowhere.

---
"@graview/guest": patch
---

A worker view's navigate takes only a string. The host handed whatever the worker sent as `to` to the links, so an object or a number reached the viewer's sight and the sentence `onProblem` hears, and a view could write a sentence of any length into a host's problems. Now a navigate whose `to` or `place` is no string is refused without a word, and one that goes nowhere quotes at most 80 characters of where it asked to go, ending "…", in the host's sentence and in a headless run's problems alike. Every navigate is still a message the flood allowance counts.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format, check finding codes and tool names and schemas are unchanged. What a host hears in `onProblem` for a destination longer than 80 characters is cut to 80.

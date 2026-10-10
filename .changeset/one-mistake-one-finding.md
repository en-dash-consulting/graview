---
"@graview/core": patch
"@graview/tools": patch
---

One mistake, one finding: a mutation without a title is reported once, as `mutation-untitled`. Graview Cloud broke a declaration on purpose and `graview check` said the same thing twice, `warn [act-without-title]` and `ERROR [mutation-untitled]`, with two fixes in two voices. The warning came with the seat (#167) and said what the error already said; the error names the path, `defineMutation("add-note").title`, and the fix. The warning is retired, with its test; the seat still speaks an untitled act's name as words, and points at `mutation-untitled`. A document's acts are checked by the same code, since they compile to mutations.

Compatibility: ops, stored formats, wire messages, the document format, the compiled format and tool schemas are unchanged. Check finding codes: `act-without-title` is retired, and nothing reports it; every declaration it fired on is reported `mutation-untitled`, as it was before. A program that matched on the retired code matches on `mutation-untitled`; `docs/stability.md` says when a code may be retired.

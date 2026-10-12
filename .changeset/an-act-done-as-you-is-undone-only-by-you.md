---
"@graview/core": patch
---

An act done as you is undone only by you. An undo is judged as the act it takes back, asked again for whoever undoes it, and "Vote for it" says `$me`, so everybody may run it: Bo could take back Ann's vote by undoing it, which the idea board's own grant ("A vote is taken back only by whoever cast it") refuses him directly. An op whose act wrote its author's own record where its call never named it — a document act's `$me`, or `ctx.me` in TypeScript — is now undone only by that person, their agent or the system; anybody else is refused with a sentence: `Not permitted to undo "Vote for it: A picnic": it was done as somebody else.`

Compatibility: an undo by another seat of an op made as its author is now refused; every other undo is judged as before. Ops, stored formats, the wire, the document and compiled formats, check finding codes and tool names and schemas are unchanged.

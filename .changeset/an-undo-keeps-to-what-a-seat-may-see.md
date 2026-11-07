---
"@graview/core": patch
---

An undo keeps to what a seat may see, and a suggestion is decided by who may make its change. An undo is now served to a seat as what it takes back is served, down the chain and on a socket's push as on a whole read, and one whose target the log no longer holds says nothing of it. A suggestion is served as the write it asks for would be. And a suggestion is taken back by its maker, by the system, or by a seat that may make every change it asks; a seat that may not still has its vote. Tests: `an-undo-keeps-to-what-a-seat-may-see` (ship) and `an-undo-is-judged-as-the-change-it-makes` (core). A hosted page carries 0.4 KB more up front, 0.3 KB more handed a compiled app. The pages face alone grows by 561 bytes.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — an undo may arrive withheld where it did not, and `undo` of a suggestion is refused for a seat that may not make it; a client already handles both. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged. A seat kept from anything loses the words of an undo whose target is behind the horizon, though not the record changes.

What Graview Cloud does: take this release. Its `undo` tool and `POST /graview/ops` now answer a refusal to a seat that may not decide a suggestion, so say it in words where it surfaces.

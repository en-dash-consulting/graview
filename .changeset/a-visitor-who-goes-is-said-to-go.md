---
"@graview/core": patch
"@graview/ship": patch
---

A visitor who goes is said to go. `announcePresence` stamps a visitor without a socket — an agent over MCP, an RPC — with an `until` and answers the new `who`, and nothing told a host when that `until` passed: a hibernating host had nothing to set an alarm by, and `createStoreHandler` dropped the visitor only when something else happened to tell the room, so "Claude, for Ada" stood on every map long after it had gone. `nextExpiry(who, now?)` now says when the next visitor still standing goes, in epoch ms — undefined when none will — for a host's alarm (a Durable Object's `setAlarm`, a timer): on it, `tell` the room and the visitor is gone. The in-memory handler keeps that timer itself, and tells every socket when a visitor's time is up.

Compatibility: presence — additive. `nextExpiry` is a new export of `@graview/core`; `announcePresence` answers as before. A socket on `createStoreHandler` is now told `presence` when an announced visitor expires, a message it was already told on any other change. The wire, ops, stored formats and check codes are unchanged.

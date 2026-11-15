---
"@graview/guest": patch
---

A view's check as each seat names the owner once. Where an app's policy has an `owner` role — Graview Cloud's default policy does — `seatsOfPolicy` of `@graview/guest/headless` returned the owner seat it was handed and a made-up `view-as:owner` beside it, so `graview view check` and a host's check drew the same seat twice. The owner seat it is handed is now that role's seat, and no other is made up for it.

Compatibility: the look — unchanged. The JavaScript API — `seatsOfPolicy` returns one seat fewer for a policy that names an `owner` role. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

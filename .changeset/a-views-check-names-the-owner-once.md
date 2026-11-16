---
"@graview/guest": patch
---

A view's check as each seat names the owner once. Where an app's policy has an `owner` role — Graview Cloud's default policy does — `seatsOfPolicy` of `@graview/guest/headless` returned the owner seat it was handed and a made-up `view-as:owner` beside it, so `graview view check` and a host's check drew the same seat twice. Where the owner seat it is handed holds that role, it is now that role's seat, and no other is made up for it; an owner handed without the role — the system, as `graview view check --seats` runs by default — is still checked beside a seat holding the `owner` role alone.

Compatibility: the look — unchanged. The JavaScript API — `seatsOfPolicy` returns one seat fewer for a policy that names an `owner` role when the owner handed holds it. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

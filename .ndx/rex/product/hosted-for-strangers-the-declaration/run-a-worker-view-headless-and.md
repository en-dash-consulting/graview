---
id: "cb40fbe6-0fd7-4f8a-a255-a56a7dedf1cb"
type: "capability"
title: "Run a worker view headless and describe it, in an isolated environment (FR-95)"
slug: "run-a-worker-view-headless-and"
statement: "Given a view module and a store seated as one principal, Cloud runs a worker view headless in an isolated JavaScript environment and describes what it drew or why it failed, so a chat's view can be checked before it is applied."
criteria: [{"id":"c1","text":"When given a view module and a store seated as one principal, the headless runner shall run the view once with no network and return what it drew or why it failed."},{"id":"c2","text":"While running a worker view, the headless runner shall execute it in an isolated JavaScript environment that a host provides and never in the host's own context."},{"id":"c3","text":"When the LifeLogics lenses are run as worker views, the headless runner shall run them and describe them correctly."},{"id":"c4","text":"If a worker view throws, breaks a limit or names an unknown act or kind, the headless runner shall return a failure that names it."}]
tags:
  - "graview-cloud"
  - "FR-95"
  - "chat-authored"
  - "security"
  - "tier-2"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

Cloud checks a chat's view before applying it.

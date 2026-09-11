---
"@graview/core": patch
"@graview/primitives": patch
---

A seat signs its own work. `AgentSeat` wrote every op with the author id "claude", hardcoded — so two seats on one embed were indistinguishable in the history, and a seat that is a rules mender or a scheduled job wore a vendor's name. `who` is now a required prop, the way the chat seat has always signed "chat".

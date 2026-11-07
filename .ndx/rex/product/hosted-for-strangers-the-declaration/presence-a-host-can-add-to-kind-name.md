---
id: "5e600ef7-20bf-4fb3-8223-ba49545c37aa"
type: "capability"
title: "Presence a host can add to: kind, name, onBehalfOf, announce for socketless visitors, and welcome.participant (FR-47)"
slug: "presence-a-host-can-add-to-kind-name"
statement: "Graview presence carries a participant's kind, name and who they act for, so a host can show a socketless visitor or an agent working over RPC, such as \"Claude, for Ada\", to everyone who may see them."
criteria: [{"id":"c1","text":"Presence shall carry a kind, a display name and onBehalfOf."},{"id":"c2","text":"When a host calls handler.announce(presence, ttlMs), the handler shall show the visitor in presence without a socket."},{"id":"c3","text":"The welcome.participant message shall tell a client its own key."},{"id":"c4","text":"When an agent makes an RPC call, the server shall show the agent in every socket's presence for the TTL, as the agent and for whom it acts, filtered by sights (presenceSeenBy)."}]
tags:
  - "graview-cloud"
  - "FR-47"
source: "Graview Cloud FR-47, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

"Claude, for Ada" appearing while it works comes over MCP/RPC, not a socket.

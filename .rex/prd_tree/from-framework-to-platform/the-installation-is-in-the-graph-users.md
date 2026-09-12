---
id: "d5fff728-2b2d-446f-a036-d47227828bfa"
level: "feature"
title: "The installation is in the graph: users, invitations and profiles as nodes, with an admin entrypoint in the app"
status: "pending"
priority: "high"
tags:
  - "admin"
  - "users"
  - "permissions"
  - "platform"
blockedBy:
  - "b04b600e-401f-49a1-97a0-a8539408dd70"
source: "Nick, 2026-09-12 (/ndx-capture): \"admin settings, like add/removing users. and inviting. that should also exist in a graview-style format, and ideally even visible alongside the rest of the app schema (because it could visualize r/w to things or whatever). so the admin entrypoint needs to be elegant and incorporated into the app. we could include a user profile construct as a part of this (maybe admins see a 'show admin nodes' or something in the popover). but even profile details could be viewed in the graview format.\""
acceptanceCriteria:
  - "a framework module declares user, invitation and role kinds and the invite/welcome/remove/grant/revoke acts, checkable by graview check like any app's declaration"
  - "an administrator's seat sees an admin entrypoint in the popover and the bar that raises the installation's districts into the scene; a non-admin seat never sees them"
  - "what a role may read and write is drawn as edges from the role to kinds and acts, from the same policy the store enforces"
  - "a profile is a node with a record page and a card, and a person may edit their own by the policy"
  - "every admin act appears in the strip, the pages, the agent tools and the op log with the same words, and is withheld with a reason where the seat may not"
description: "Administration is not a second application bolted beside the first. Users, invitations, roles and profiles are node kinds the framework declares (a module, on by default), with acts — invite, welcome, remove, grant, revoke — that are ordinary mutations with titles, descriptions and a policy, so they appear in the strip, the pages, the agent's tool list and the operation log like everything else. Because they are in the graph, what a role may read and write can be drawn: a user's district, the edges from a role to the kinds and acts it reaches, the same picture the policy declares. The admin entrypoint is elegant and inside the app: an administrator's seat sees \"Show the installation\" (or \"admin nodes\") in the popover and the bar, which raises those districts into the scene alongside the domain's; everyone else never sees them. A profile is a node too — a person's own record page in the derived face and their card in the scene, editable by the acts the policy allows. Builds on the policy and seat work (who-may-do-what) and the pages registry."
lastModified: "2026-09-12T15:02:00.926Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

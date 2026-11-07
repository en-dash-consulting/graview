---
id: "d5fff728-2b2d-446f-a036-d47227828bfa"
type: "capability"
title: "The installation is in the graph: users, invitations and profiles as nodes, with an admin entrypoint in the app"
slug: "the-installation-is-in-the-graph-users"
statement: "The installation is part of the graph: users, invitations, roles and profiles are node kinds declared by a framework module, their administrative acts are ordinary mutations, and an administrator's seat can raise them into the scene from within the app."
criteria: [{"id":"c1","text":"The framework module shall declare user, invitation and role kinds and the invite, welcome, remove, grant and revoke acts, and graview check shall check them like any app's declaration."},{"id":"c2","text":"When a seat is an administrator's, the app shall show an admin entrypoint in the popover and the bar that raises the installation's districts into the scene."},{"id":"c3","text":"While a seat is not an administrator's, the app shall not show it the admin entrypoint or the installation's districts."},{"id":"c4","text":"The app shall draw what a role may read and write as edges from the role to the kinds and acts it reaches, from the same policy the store enforces."},{"id":"c5","text":"The app shall present a profile as a node with a record page in the derived face and a card in the scene."},{"id":"c6","text":"Where the policy allows it, a person shall be able to edit their own profile."},{"id":"c7","text":"The app shall show every admin act in the strip, the pages, the agent tools and the operation log with the same words."},{"id":"c8","text":"If the seat may not perform an admin act, the app shall withhold that act and give the reason."}]
tags:
  - "admin"
  - "users"
  - "permissions"
  - "platform"
source: "Nick, 2026-09-12 (/ndx-capture): \"admin settings, like add/removing users. and inviting. that should also exist in a graview-style format, and ideally even visible alongside the rest of the app schema (because it could visualize r/w to things or whatever). so the admin entrypoint needs to be elegant and incorporated into the app. we could include a user profile construct as a part of this (maybe admins see a 'show admin nodes' or something in the popover). but even profile details could be viewed in the graview format.\""
priority: "high"
---

Administration is not a second application bolted beside the first. Users, invitations, roles and profiles are node kinds the framework declares (a module, on by default), with acts — invite, welcome, remove, grant, revoke — that are ordinary mutations with titles, descriptions and a policy, so they appear in the strip, the pages, the agent's tool list and the operation log like everything else. Because they are in the graph, what a role may read and write can be drawn: a user's district, the edges from a role to the kinds and acts it reaches, the same picture the policy declares. The admin entrypoint is elegant and inside the app: an administrator's seat sees "Show the installation" (or "admin nodes") in the popover and the bar, which raises those districts into the scene alongside the domain's; everyone else never sees them. A profile is a node too — a person's own record page in the derived face and their card in the scene, editable by the acts the policy allows. Builds on the policy and seat work (who-may-do-what) and the pages registry.

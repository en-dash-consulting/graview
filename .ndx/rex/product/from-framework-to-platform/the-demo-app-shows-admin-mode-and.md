---
id: "af069e84-aa59-4e65-9835-01b3e1ea6e8b"
type: "capability"
title: "The demo app shows admin mode and profiles: the installation in the todo app, with seats to feel it"
slug: "the-demo-app-shows-admin-mode-and"
statement: "The installation shipped in core (declareInstallation: users, invitations, roles, the admin-only module, the self grant for a profile, \"Show the installation\", the reach lens) and is demonstrated only in seedbed chapter 14."
criteria: [{"id":"c1","text":"The todo app shall declare the installation with a keeper role and a member role, seed a user for each and one pending invitation, and offer both seats on the bar."},{"id":"c2","text":"While the keeper's seat is taken, the todo app shall show \"Show the installation\" on the bar and raise People and Invitations beside the domain."},{"id":"c3","text":"While the member's seat is taken, the todo app shall omit \"Show the installation\" from the bar and omit the installation's kinds from the scene and the pages."},{"id":"c4","text":"When the keeper invites, welcomes, revokes an invitation, grants or revokes from the strip or the pages, the todo app shall carry out the act."},{"id":"c5","text":"If the member attempts to invite, welcome, revoke an invitation, grant or revoke, the todo app shall refuse the act with the policy's own sentence."},{"id":"c6","text":"The todo app shall treat a person's record as their profile, editable in place by its own seat and read-only to the other seat."},{"id":"c7","text":"The reach lens shall show the self grant for a profile."},{"id":"c8","text":"While the keeper's seat is taken, the todo app shall offer \"Who may do what\" as a place on the bar, read from the same policy the store refuses with."},{"id":"c9","text":"The pages face shall list the installation's kinds only for the keeper."}]
tags:
  - "admin"
  - "users"
  - "profile"
  - "todo"
  - "demo"
  - "platform"
source: "Nick, 2026-09-13: \"/ndx-capture demo app need to show admin mode and profiles\""
priority: "high"
---

The installation shipped in core (declareInstallation: users, invitations, roles, the admin-only module, the self grant for a profile, "Show the installation", the reach lens) and is demonstrated only in seedbed chapter 14. The todo app — the demo people open first, at localhost:5193 and in every harness — has no installation: no users, no admin mode, no profile, so the platform story is invisible where it would be looked for. This feature puts it in the todo app: declareInstallation on its declaration with roles (a keeper who administers, a member who does not), seed users for both and a pending invitation, seats on the app so a reader can sit down as either, "Show the installation" on the bar for the keeper and nowhere for the member, the people and invitations rising as districts beside lists and tasks, invite/welcome/revoke/grant/revoke as acts in the strip and on the pages, a person's own record as their profile — editable by them and read-only to the other seat — and the reach lens as a place ("Who may do what"). The pages face lists the installation's kinds only for the keeper. The same goes into the scaffold's guidance so a new app can follow it. Source: Nick, 2026-09-13: "demo app need to show admin mode and profiles".

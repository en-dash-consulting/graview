---
id: "a4b680fd-970c-4590-acba-ab085b5d0717"
type: "capability"
title: "A third demo, the product-grade one: Rota — branded, permissioned, remembered, embedded, with the installation, a profile and the studio"
slug: "a-third-demo-the-product-grade-one"
statement: "Rota is a product-grade volunteer shift roster demo in apps/rota that ships branded, permissioned with three roles, remembered in the browser, embeddable, with an installation, profiles and a studio, and is listed by the launcher."
criteria: [{"id":"c1","text":"Rota shall declare shifts, volunteers, a covered-by edge with both readings, cover and uncover acts, and an every-shift-covered invariant whose repair asks for the person, and graview check shall report the declaration clean."},{"id":"c2","text":"Rota shall carry its own kit, with a declared route and per-edge colours, and the checker shall judge the kit's colours against both grounds."},{"id":"c3","text":"Rota shall offer a seat on the bar for each of three roles: a coordinator, a volunteer and a viewer."},{"id":"c4","text":"While the coordinator seat is active, Rota shall let the coordinator administer the installation, show \"Show the installation\", and invite and grant."},{"id":"c5","text":"While the volunteer seat is active, Rota shall let the volunteer edit their own profile and nothing else's."},{"id":"c6","text":"While the viewer seat is active, Rota shall offer the viewer no act and shall say why for every act it withholds."},{"id":"c7","text":"Rota shall remember its graph in the browser at version 2."},{"id":"c8","text":"When Rota opens a graph stored at version 1, it shall migrate it to version 2 once and record the migration in the log."},{"id":"c9","text":"Rota shall draw its shell, home, problems, list and record surfaces with a custom design over the routed face."},{"id":"c10","text":"Rota shall offer the coverage lens, titled as a place, and the timeline lens as places."},{"id":"c11","text":"Rota shall provide an embed page that mounts Rota twice, at two stops beside a paragraph."},{"id":"c12","text":"When the coordinator presses the studio on Rota's bar, Rota shall open the studio over Rota's own declaration."},{"id":"c13","text":"The launcher shall list Rota with its liveness."},{"id":"c14","text":"The verification harnesses audit-ui, survey, verify-seat, verify-remember, verify-pages, verify-navigation and progression shall carry Rota states, and pnpm engines shall hold."}]
tags:
  - "demo"
  - "rota"
  - "brand"
  - "kit"
  - "installation"
  - "policy"
  - "ship"
  - "embed"
  - "studio"
source: "Nick, 2026-09-13: \"/ndx-capture changes we need to make for our demo apps (or adding another one or two or whatever) to properly illustrate all those capabilities\""
priority: "high"
---

Things is the example nobody has to be taught and Seedbed is the one that grows chapter by chapter; neither is what a person would ship. The capabilities the platform now leads with — the installation and profiles, brand and kit, policy with real roles and seats, remembering and a migration, the embed, the studio entrypoint, a custom design over the routed face — are shown only in seedbed chapters reached by ?chapter=N, or only on the marketing page. Add a third demo that is the product-grade one: Rota, a volunteer shift roster (the shape the earlier ../roster rehearsal proved: shifts, volunteers, a covered-by edge with both readings, cover and uncover, every-shift-covered with a repair that asks for the person, a coverage lens titled as a place). Rota ships branded with its own kit (a route and per-edge colours the checker has judged), a policy with three roles (a coordinator who administers, a volunteer, a viewer) and seats for each on the bar, the installation with seeded users, invitations and profiles, the profile pane with text size, remembering in the browser at version 2 with a migration from a stored version 1, a custom design over every routed surface, the timeline lens beside coverage, an embed page beside a paragraph at two stops, and the studio one press from the bar for the coordinator. It lives in apps/rota, is listed by the launcher, runs on its own port, and every harness that walks the todo app walks it too. Not in scope: a fourth demo — three is the set: taught by nobody, grown, shipped.

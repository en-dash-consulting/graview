---
id: "d6e98c63-c1ae-40dc-82bc-5eee85bab996"
type: "capability"
title: "A profile on the bar: who you are signed in as, and your settings, including your text size"
slug: "a-profile-on-the-bar-who-you-are"
statement: "The shell bar and embed strip show who is signed in and open a profile pane holding the person's own settings, such as text size, colour scheme and the source of answers, drawn from the settings the app declares."
criteria: [{"id":"c1","text":"The shell bar and the embed strip shall show who is signed in, by name and role, and open a profile pane."},{"id":"c2","text":"When no seat is signed in, the profile pane shall say so plainly."},{"id":"c3","text":"The profile pane shall offer a text size control with at least three steps, remembered per browser and applied to every surface through the root font size."},{"id":"c4","text":"The profile pane shall offer the colour scheme, and reduced motion where the app exposes it."},{"id":"c5","text":"Where the installation is declared, the profile pane shall open the person's own profile record, editable by them under the self grant."},{"id":"c6","text":"Where the app offers seats, the profile pane shall show the seat switcher."},{"id":"c7","text":"The profile pane shall draw the settings the app declares, so an app adds a setting by declaring it."},{"id":"c8","text":"The checker shall refuse a declared setting that nobody can honour."},{"id":"c9","text":"The todo, seedbed and launcher apps shall carry the profile, and the scaffold shall write it into a new project."},{"id":"c10","text":"When the profile pane is open at 390 and 1280 pixels wide in both colour schemes, the page shall have no axe violations."},{"id":"c11","text":"The chat panel shall have no settings pane and no gear."},{"id":"c12","text":"The profile pane shall hold one setting, \"Answers come from\", with four short options and the current option pressed."},{"id":"c13","text":"The profile pane shall show a key field under \"Answers come from\" only when the chosen option needs a key."},{"id":"c14","text":"The profile pane shall show no more than one sentence about the chosen source on screen and shall keep the rest in a tooltip."},{"id":"c15","text":"When a person chooses an option in \"Answers come from\", the chat shall use the provider that option names."}]
tags:
  - "profile"
  - "settings"
  - "text-size"
  - "a11y"
  - "shell"
  - "demo"
source: "Nick, 2026-09-13: \"/ndx-capture text-size modifier should be present in a profile type of area/view. representing who you're logged in as and settings. demo apps should have this present\""
priority: "high"
---

Every app needs one place that says who is at the keyboard and holds their settings. The bar (and the embed strip) gains a profile control — the seat's name and role, opening a small pane — that is the person's own place: their user record (the profile the installation already makes theirs to edit), the seat switcher where the app offers seats, and settings that are theirs rather than the app's: the text size (the framework already sizes every surface in rem, so a reader's chosen size is honoured everywhere — this gives it a control, remembered per browser), the colour scheme, and reduced motion where the app exposes it. Settings are declared, not hard-coded: the pane draws what the app declares as settings, so an app adds one the way it adds a field. The demo apps — todo, seedbed, launcher — and the scaffold carry it. Source: Nick, 2026-09-13: "text-size modifier should be present in a profile type of area/view. representing who you're logged in as and settings. demo apps should have this present".

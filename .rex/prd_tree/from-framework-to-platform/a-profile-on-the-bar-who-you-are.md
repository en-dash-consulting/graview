---
id: "d6e98c63-c1ae-40dc-82bc-5eee85bab996"
level: "feature"
title: "A profile on the bar: who you are signed in as, and your settings, including your text size"
status: "pending"
priority: "high"
tags:
  - "profile"
  - "settings"
  - "text-size"
  - "a11y"
  - "shell"
  - "demo"
blockedBy:
  - "af069e84-aa59-4e65-9835-01b3e1ea6e8b"
source: "Nick, 2026-09-13: \"/ndx-capture text-size modifier should be present in a profile type of area/view. representing who you're logged in as and settings. demo apps should have this present\""
acceptanceCriteria:
  - "the shell bar and the embed strip show who is signed in (name and role) and open a profile pane; with no seat the pane says so plainly"
  - "the pane holds the text size control (at least three steps, remembered per browser, applied to every surface via the root font size so rem sizing carries it), the colour scheme, and reduced motion where exposed"
  - "where the installation is declared, the pane opens the person's own profile record, editable by them under the self grant, and the seat switcher where seats are offered"
  - "settings are declared on the app and drawn from the declaration; the checker refuses a setting nobody can honour"
  - "todo, seedbed and launcher carry the profile; the scaffold writes it into a new project"
  - "axe is clean with the pane open at 390 and 1280 in both schemes; verify-pages readersOwnTextSize runs through the control rather than an injected style"
description: "Every app needs one place that says who is at the keyboard and holds their settings. The bar (and the embed strip) gains a profile control — the seat's name and role, opening a small pane — that is the person's own place: their user record (the profile the installation already makes theirs to edit), the seat switcher where the app offers seats, and settings that are theirs rather than the app's: the text size (the framework already sizes every surface in rem, so a reader's chosen size is honoured everywhere — this gives it a control, remembered per browser), the colour scheme, and reduced motion where the app exposes it. Settings are declared, not hard-coded: the pane draws what the app declares as settings, so an app adds one the way it adds a field. The demo apps — todo, seedbed, launcher — and the scaffold carry it. Source: Nick, 2026-09-13: \"text-size modifier should be present in a profile type of area/view. representing who you're logged in as and settings. demo apps should have this present\"."
lastModified: "2026-09-13T04:54:15.410Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

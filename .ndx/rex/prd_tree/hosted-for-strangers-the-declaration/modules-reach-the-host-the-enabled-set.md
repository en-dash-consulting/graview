---
id: "46db7c33-ba6b-41c8-8bb9-13ca2982bfcb"
level: "feature"
title: "Modules reach the host: the enabled set is passed to opened, served and remote stores, and turning one off is in history"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-12"
source: "Graview Cloud FR-12, 2026-10-02"
startedAt: "2026-10-03T06:25:07.177Z"
completedAt: "2026-10-03T06:25:07.177Z"
endedAt: "2026-10-03T06:25:07.177Z"
acceptanceCriteria:
  - "A served store with a module off refuses its acts and hides its kinds from every route and tool"
  - "Turning a module off then on is two ops in history and returns the data intact"
description: "WHAT IS THERE NOW: ModuleMap, resolveModules and StoreOptions.enabledModules exist and graview check holds the boundaries, but no caller passes enabledModules — not openStore, serveStore, openRemote nor any app. MISSING: a host binding the enabled set to an entitlement. POSITION: openStore/serveStore/openRemote accept enabledModules; served state says which are on; flipping one is an op authored system · modules so it shows in history and the horizon follows."
lastModified: "2026-10-03T06:25:07.268Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

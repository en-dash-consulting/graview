---
id: "46db7c33-ba6b-41c8-8bb9-13ca2982bfcb"
type: "capability"
title: "Modules reach the host: the enabled set is passed to opened, served and remote stores, and turning one off is in history"
slug: "modules-reach-the-host-the-enabled-set"
statement: "A host passes the set of enabled modules to the stores it opens, serves or reaches remotely, and the product honors that set, so turning a module off or on is recorded in history."
criteria: [{"id":"c1","text":"When a served store has a module off, the store shall refuse that module's acts."},{"id":"c2","text":"When a served store has a module off, the store shall hide that module's kinds from every route and tool."},{"id":"c3","text":"When a module is turned off and then on, the store shall record two ops in history and return the module's data intact."},{"id":"c4","text":"The store shall accept the enabled modules as an option from openStore, serveStore and openRemote."},{"id":"c5","text":"A served store shall report in its state which modules are on."},{"id":"c6","text":"When a module is flipped, the store shall author the change as an op by the system actor on modules, so that it shows in history and the horizon follows."}]
tags:
  - "graview-cloud"
  - "FR-12"
source: "Graview Cloud FR-12, 2026-10-02"
priority: "medium"
---

WHAT IS THERE NOW: ModuleMap, resolveModules and StoreOptions.enabledModules exist and graview check holds the boundaries, but no caller passes enabledModules — not openStore, serveStore, openRemote nor any app. MISSING: a host binding the enabled set to an entitlement. POSITION: openStore/serveStore/openRemote accept enabledModules; served state says which are on; flipping one is an op authored system · modules so it shows in history and the horizon follows.

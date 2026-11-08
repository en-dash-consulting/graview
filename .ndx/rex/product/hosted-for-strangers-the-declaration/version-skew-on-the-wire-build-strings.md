---
id: "bc9a951f-ff66-4926-83d6-fdc1f6e473f9"
type: "capability"
title: "Version skew on the wire: build strings, a reload answer, carried calls, and a codec name (FR-44)"
slug: "version-skew-on-the-wire-build-strings"
statement: "During a rolling deploy, the wire protocol carries build identifiers, lets a server tell old clients to reload without losing their unsent calls, and lets different codecs on one path be told apart."
criteria: [{"id":"c1","text":"The hello and welcome messages shall each carry a build field holding an opaque host string."},{"id":"c2","text":"When a tab is on a different build from the host, the tab shall keep working and be told of the difference once."},{"id":"c3","text":"When a client speaks a protocol the server no longer serves, the server shall answer with reload."},{"id":"c4","text":"When a reload happens, openRemote's carry hook (storage and key) shall keep the calls not yet sent across the reload and offer them on the next open."},{"id":"c5","text":"When two codecs share one path, the wire shall let them be told apart by a wire name in hello or by a documented WebSocket subprotocol."}]
tags:
  - "graview-cloud"
  - "FR-44"
source: "Graview Cloud FR-44, 2026-10-03 (brief after 0.1.2)"
priority: "medium"
---

During a rolling deploy old tabs talk to new rooms; a release must not eat someone's edit.

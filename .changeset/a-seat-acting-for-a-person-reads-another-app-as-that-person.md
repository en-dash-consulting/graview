---
"@graview/core": patch
"@graview/tools": patch
"@graview/react": patch
---

A seat acting for a person reads another app's records as that person. In its own app an agent acting for somebody sees what both may, and a system seat acting for somebody is not the system. Reading another app dropped who it acted for: `LinkedViewer` had no room to say it, `linkedRecordsOver` rebuilt the viewer without it, and `find_linked` and the page's linked reads never passed it. So the far app judged an agent by its own roles and a delegated system seat as the system, and an agent declared with finance's role, sitting with somebody in sales, read a deal only finance may see, label, card and fields. Now `LinkedViewer` carries `onBehalfOf`, `linkedRecordsOver` keeps it when it asks the far store, and `find_linked` and the provider's linked reads pass it, so the far app judges the seat as the near one does. An agent acting for nobody, and a person, are read as before. Tools' tests hold it (`a-seat-acting-for-a-person-reads-another-app-as-that-person.test.ts`). The provider's linked reads are on every page, so a hosted page carries 0.1 KB more up front (94 bytes minified, 15 gzipped; 94 / 23 handed a compiled app), under raises naming this changeset.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, and derived tool names and input schemas — unchanged. `LinkedViewer` gains an optional `onBehalfOf`. What Graview Cloud does: a host that implements `LinkedRecords` itself judges a viewer with `onBehalfOf` as the person it acts for (`actingAs`), and never as the system when its kind is `system`.

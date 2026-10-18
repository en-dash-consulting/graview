---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/tools": patch
---

No import cycle is left in any package's source, in types or otherwise. `seenBy` asks a store only for what a seat's view reads of it (`Viewed`) and hands back the store's own type, so the seat's module needs nothing of the store's; what judges a seat's sight (`Judged`) is the sight's; what `describePlace` says a place shows (`PlaceDescription`, `DescribedPart` and the rest) is a module of its own, which the coverage grid in words reads; `ListFields` is the arrangement's, beside `listFieldsOf`, and `parseArrangement` is reached from its own module; the context menu's shapes (`MenuTarget`, `MenuItem`, `MenuSection`, `MenuSectionSource`) are a module the provider names them from; `ToolDefinition` and `ToolAnnotations` are a module the subscription tools declare theirs with; and an app link's, a first look's and Notify me's props live on the side of the door that the drawn part reads them from. Every name is exported from the same entry as before.

Compatibility: ops, stored formats, the wire, the declaration and check finding codes, and tool names and input schemas are unchanged — only where a type is declared moved, and every entry exports what it did. `seenBy` is generic over the store it is handed rather than its schema, so a call that named the schema (`seenBy<S>(…)`) names the store instead. The hosted page's first load is 7 bytes smaller.

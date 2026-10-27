---
"@graview/primitives": patch
"@graview/core": patch
---

A suggestion's record chips open their record (Roadmap f-suggestion-chips-open-their-record, FR-225). The Suggested tray named each record a suggestion was about as a chip with a pick target only the scene's own pointer handler answered, so on either face and from the keyboard it looked pressable and did nothing. Each is now the button a record is in Activity (`NamedRecord`, shared by both): on the scene it focuses and chooses the record, on the routed face it opens the record's page, and the tray closes behind the reader; the record's name is its accessible name and "Go to …" its title, and nothing in the tray carries a pick target any more. Primitives' and pages' tests hold it (`a-suggestion-chip-opens-its-record.test.tsx`, pressed on the scene and on a face that says where a record opens, axe-clean; `a-suggestion-chip-opens-the-records-page.test.tsx`). FR-225 is said as shipped.

Compatibility: ops and primitives, stored formats, the declaration and check finding codes, and derived tool names and input schemas — unchanged. The wire: `capabilities().shipped` lists FR-225. The look: the tray's chips are buttons carrying `data-testid="suggestion-record"` and `data-record`, as Activity's `activity-record` do. What Graview Cloud does: nothing.

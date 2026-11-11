---
"@graview/core": patch
"@graview/react": patch
---

A district's records with no value for its kind's main choice stand in one row, so one more of them no longer moves every block in the district.

The scene stands a district's records in rows, one per value of its kind's main choice and one for the records with none. Every record with no value opened a row of its own: the plot was cut into one more row for each, and every block on it moved. They now share one row, and adding one moves no other block. The rows are `districtLanes` in `@graview/core/scene`, which the scene's plots use; chosen records still stand at the head of their rows in the order the district gives its members, and a chosen record that is not one of them is left out, as before.

Adding or removing a record still moves the blocks after it in its row, each one place along, and a district is still laid out afresh as its own grid grows (its plot taking its third cell at five records, or its fullest row outgrowing its places). Where the city lays its districts out is unchanged.

Tests: `a-districts-blocks-hold-still-as-records-come-and-go` (core).

What a hosted page loads up front is unchanged; every face grows by 0.1 KB, under a raise of its budget.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

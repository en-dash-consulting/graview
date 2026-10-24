---
"@graview/react": patch
---

A scene opened on a record measures its lines again once its cards stand. Skipping the flight from a layout to itself, which a hand letting go had set off, also skipped the one render on the next frame that a scene's first layout used to end with — and the lines measured in the first render, against cards not yet laid out, could stay where those cards had not been: on the nightly's runner, a page opened on todo's `rule-order` with its relation shown drew its waits-for line with neither end on anything (`pnpm verify lines`, `everyLineLandsOnSomething`), now and then. `useAnimatedLayout` still flies nowhere when the layout is already where it is going, and still draws it once more on the next frame unless asked not to settle (`settle: false`, a hand's pan, which was painted where it lands before it was let go). React's test holds that a scene's first layout is drawn once more on the next frame, and that turning motion back on over a hand's pan still draws once.

Compatibility: ops and primitives, stored formats, the wire, the declaration and check finding codes, derived tool names and input schemas, the JavaScript API, the theme and the embed — unchanged.

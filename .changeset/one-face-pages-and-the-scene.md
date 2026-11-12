---
"@graview/core": minor
"create-graview": minor
"@graview/embed": minor
"graview": minor
"@graview/guest": minor
"@graview/layout": minor
"@graview/pages": minor
"@graview/primitives": minor
"@graview/react": minor
"@graview/render": minor
"@graview/ship": minor
"@graview/skills": minor
"@graview/studio": minor
"@graview/tools": minor
---

Pages and the Scene are one face. A routed page stands over the Scene's own city, and the same page moves on one camera from Page to Nearby (the page beside its place in the city, with a line from each record it shows to that record's building) to City (every page and view of the app standing on its district). On that face the Scene/Pages switch is gone. So is the Scene's record "drive-in" (a record chosen in the city is its own page, with what it is linked to listed under it at Nearby), and so are Up and Down: one control at the bottom left, Page · Nearby · City, says where you are and goes to any level. Pages and lenses are becoming one thing, a defined view. `graview check` names two views that show the same thing and carries the edit that removes one (`view-duplicates-another`), and docs/pages-and-lenses-are-one.md sets out the declaration, the format upgrade that moves a stored document, and what a host changes.

Compatibility: the look is unchanged unless a routed face is given `sceneUnderPages`, which is the one face. The JavaScript API is additive (`PageContext.sceneUnderPages`, `SceneCamera`, `LayoutOptions.standing` and `plaza`). Ops and primitives are unchanged. Stored formats are unchanged in this version; the move of titled lenses into views is the format upgrade the design note describes. The wire is unchanged. The declaration and check finding codes are additive (`view-duplicates-another`). Derived tool names and input schemas are unchanged.

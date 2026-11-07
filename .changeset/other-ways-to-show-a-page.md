---
"@graview/core": patch
"@graview/react": patch
"@graview/primitives": patch
"@graview/pages": patch
"@graview/embed": patch
"@graview/skills": patch
---

An owner can flip between a few strong ways to show a kind's list or a place, and keep the one that fits. "Other ways to show this" on the page's menu draws two to four options ahead, in the page's real records, under its heading: a board where a choice has values, a calendar where a date has them this month (a list in date order where they all fall elsewhere, never an empty month), a grid where a link joins two kinds, cards, rows by a choice, and the places the kind already has. Flipping shows one and hides another, with nothing drawn or fetched at the press and the page as it stands one arrow away. Nothing is written until Keep, which is one change to the app with one Undo after it. It takes no model, so it works with AI off; a model a host lent adds one more, judged like the rest. Each option passes the host's composer before it is offered and is dropped if it shows none of the records. Only a seat that may change the app sees it, and never on a list that would not change: a product design that replaces a kind's list page is offered no other ways there, nor is `?drawn=built-in`, though a place still is, because what draws it changes. What is kept is remembered in this browser and ranks the next offer, a choice for this kind counting most; an undone one is forgotten.

Keeping one on a kind's list needs the list to open as a place, so a declaration can now say that itself: `pages.lists.<kind>.opens` names a lens over the kind, and the list's address draws that place's picture and forms under the list's own heading, with the list the app draws by itself at `?drawn=built-in`. `arrange-pages` sets it (`"opens": { "task": "Tasks by status" }`, null gives the list back), it follows its lens when the lens is retitled, and it clears when the lens is removed.

A host stands at one seam, `displayOptions` on the provider and the embed: `offers(asked)` hands in further options as lenses, now or as a promise that joins without moving what is shown, `chosen()` adds what it remembers being chosen, and `onChoice(heard)` is told what was kept, what it was kept from, and when that keeping is undone.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — added: `pages.lists.<kind>.opens`, `arrange-pages`' `opens`, and the warning `list-opens-no-place`; a declaration that compiled still compiles, and a stored app reads as it did. Derived tool names and input schemas — unchanged, beyond `arrange-pages`' new key in the edit vocabulary.

What Graview Cloud does: nothing to change for the feature to work, since it uses `composeChange` and `onProposeChange` as Better UI does. To feed it from what people building other apps kept (feature:f-learn-from-consenting-builders), pass `displayOptions` to `mount`. A product design that replaces a kind's list page is offered no other ways there, and may read `pages.lists.<kind>.opens` if it wants to honor one set elsewhere.

---
"@graview/studio": patch
"@graview/tools": patch
---

A proposal is the act's own form, filled in and yours to correct — not a sentence and a button.

One real thread with the studio's agent went wrong in six ways at once, and each one is the same underlying mistake: the seat treated a half-right answer as final.

**A proposal is now the act's own arguments**, drawn from the same `formFields` the actions strip draws — a picker for a kind, a choice for a type, a box for a name — filled with what was proposed and editable before it is kept. The checker re-runs on every edit, so the verdict is about what you are actually about to do, and a change that would add an error cannot be kept. Asked to add a field to Meal and told it would land on "user", a person's only move used to be to argue with a chat and hope. Hoping is not an interface.

**The subject is what the sentence points at.** "Add details to Meal. The name of the food and the number of people it can feed" put a field on USER — the user kind's plural is "People", "people" sits inside "number of people", and six letters beat four. The kind is read from the clause that names it, earliest match first and a kind's own name ahead of its plural; where that clause names no kind at all, the seat says which kinds there are instead of reaching into a description of something else for a subject.

**"Attach Meals to Shifts" is a tie.** The floor did not know it, so the turn fell through to a model, which proposed `add-edge` with no kind and no label and earned a validation refusal in zod's words. The floor proposes the tie now, with a reading from each end — and says out loud which end it decided declares it, because that is a real decision.

**A person never sees the plumbing.** A model that closes one brace too many produced a chat bubble containing `{"say": "Yes", "proposals": [...]}}`: the old fallback pasted the raw answer when `JSON.parse` threw. `firstJsonObject` reads the object the model meant and ignores what it typed after; an answer with no object at all is reported as a shape that could not be read.

**A name is not an id, and a model will hand you a name.** Where exactly one node of a kind an argument accepts carries the label a model used, the label means that node — a lookup, not a guess. Two matches or none, and the value stays as it came for the form to ask about.

Also: a refusal names the argument it is missing rather than quoting zod; a warning shown under a proposal is one the proposal would ADD, not one the declaration already had; and keeping something writes one line, where it used to write the same sentence twice in two voices.

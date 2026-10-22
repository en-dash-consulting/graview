---
"@graview/core": patch
"@graview/pages": patch
"@graview/skills": patch
---

A lens kept off the lists is kept off a record's "Seen in" and a kind's "Also as" too, and `add-lens` refused a taken title without saying whose it was. Threat Watch, made in Graview Cloud, was given a board per choice field and a calendar per date it never asked for; its author hid them with `set-lens-hidden` and drew their own. A record's page still said "Seen in:" every hidden board, first, ahead of the pictures the app meant to show, and the kind's list said them under "Also as:". Both now pass over a hidden place, which is still a page at its address, reached by a link or `navigate`. And `add-lens` with the title "Remediations by audience" answered only "there is already a lens called…", for a lens nobody could see on the page: it now names the lens that holds the title — what draws it and over what, and that it is kept off the lists, which does not free its title or its address — and its fix says `"replace": "<that title>"` draws the new one in its place. A lens drawn in the place of a hidden one stays hidden, as it did; the sentence `add-lens` says now says so, and that `set-lens-hidden` with `"hidden": false` shows it. `describeApp` (`graview describe`) marks a hidden lens among the lenses that draw.

`pages`' tests find a record's page saying "Seen in" the listed picture and not the hidden one, saying nothing when its only pictures are hidden, the kind's list leaving the hidden one out of "Also as", and the hidden picture still a page; `core`'s find the refusal naming the lens, its lens and kind, and its being hidden, the replace taking a hidden lens's title and saying it stays hidden until shown, and `describeApp` marking it. `graview-shipped-lens` says so.

Compatibility: a behavior change on the routed face only: a record's "Seen in" and a kind's "Also as" leave out lenses marked hidden. `add-lens`'s refusal of a taken title and its sentence for a replaced hidden lens read differently; what it refuses and applies is unchanged. The API, the declaration, the wire, the stored formats and the derived tools are unchanged.

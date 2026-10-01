---
"@graview/pages": patch
"@graview/skills": patch
---

The routed face offers Find and the way back, whichever shell draws it. Taking the last change back could not be done on the pages of any app — nothing on a page offered it — and rota's pages had no Find box, because only the derived shell drew one and every design replaces the shell. The face's root now owns both: a shell that places `<PageFind>` or the new `<PageUndo>` says where they go, a shell that places neither gets Find in a bar above it and the way back docked at the corner, and only `surface("shell", Shell, { without: ["find" | "undo"] })` goes without. The way back says what it takes back ("Take back “Rename to …”"), takes back the person's own latest change as that person — never one the policy would refuse — answers ⌘Z and Ctrl+Z anywhere on the face but inside a text field, where they stay the field's own, and lands the keyboard on the page's heading when there is nothing left to take back.

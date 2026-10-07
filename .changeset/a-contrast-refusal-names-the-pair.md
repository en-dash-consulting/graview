---
"@graview/core": patch
"@graview/skills": patch
---

A contrast refusal names the pair and the ratio, with a fix (FR-126). From Graview Cloud: an accent refused for contrast did not say which pair failed, so a chat could not fix it. A document's accent is drawn as given in the light scheme, so `set-brand` refuses one that does not read there with one sentence — "#e6c200 text on #f6f4f0 is 1.5:1; 4.5:1 is needed — #836e00 would pass." — and the edit that would (`{"op": "set-brand", "accent": "#836e00"}`) as its fix: the nearest shade of the same hue and saturation, by lightness alone, that reads as given and derives both schemes. `accentProblem` says it for any colour, and `passingShade` the shade of an ink that clears a ratio on a ground. An accent whose only trouble was that the warning colour shared its hue now derives, with the warning drawn in the bad status's red (`documentSchemes`). `graview check` says the same of a document that holds such an accent (`brand-accent`, a warning, in place of the compile's `brand`), and `theme-contrast-below-aa` names a TypeScript palette's failing pair as colours with the shade that would pass.

Compatibility: `set-brand` refuses an accent it took before when that accent did not read as given — it was drawn in a shade moved to read, which the edit now says instead. A document that already holds one compiles as it did and is warned (`brand-accent`). `theme-contrast-below-aa`'s message and fix are new words. `capabilities().shipped` gains FR-126.

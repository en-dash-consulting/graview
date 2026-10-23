---
"@graview/primitives": patch
---

Enter on a kind or one of its pictures in Find takes the keyboard out of the box in the same press. Since 0.1.47 the keyboard went to the kind's place on the first frame the place stood, but until then Enter left it on nothing, and the Shell's rule that the keyboard always lands somewhere gave it back to the box: a key pressed in that frame — the place's acts key, typed straight after Enter — still went into the words. Enter now puts the keyboard on the place at once where it already stands, and otherwise on a holder beside the box, said to a screen reader as "Opening Songs…", until the place stands; from there it goes on to the place and its arranging line as before. A place that never stands lets the keyboard go after 240 frames, and the root gives it back to the box. Primitives' tests find the keyboard off the box in the press of Enter, still off it after the root's rule has looked, on the place once it stands, and on a place that already stood without a frame between.

Compatibility: a behavior change in the scene's Find only: between Enter on a kind or a picture and its place standing, the keyboard is on a visually hidden status beside the box (`data-testid="find-landing"`) rather than on nothing. The API, the declaration, the wire, the stored formats and the derived tools are unchanged. What Graview Cloud does: nothing.

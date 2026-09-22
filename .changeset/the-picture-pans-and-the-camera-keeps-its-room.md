---
"@graview/react": patch
---

The picture pans, and a flight does not eat the room to pan back. Choosing a lens from altitude puts a billboard in the middle of the window and flies the camera to it — and a drag that started on that billboard moved the card rather than the view, so the biggest thing on screen was the one place panning did not work. A picture is the view you are in, not a thing you rearrange, so dragging it moves the view; a district's own card keeps its drag, because placing a district by hand is a real gesture with a dashed kerb to show for it. And the whole offset is clamped to the camera limit or to wherever the camera has already flown, whichever reaches further: flying closer takes the camera past that limit on purpose, and clamping to it afterwards resolved every drag to the same number, which read as the ground refusing to move at all.

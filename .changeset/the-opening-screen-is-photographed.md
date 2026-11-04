---
"@graview/pages": patch
"@graview/ship": patch
"graview": patch
---

An app's opening screen can be photographed (Roadmap f-framework-small-fixes-0-1-66): every picture of a place is taken after the screen has gone, so a host could not show the first second a reader sees. `splashPage(brand)` on `@graview/pages/splash` is the screen alone as a page of its own, held — `splashHtml`'s new `hold` keeps it up, since no place will draw under it — and its script marks the screen `data-settled` once it stops moving (`SPLASH_SETTLED`): its image loaded, the ascii field filled and its title typed, the shader's reveal done. Under reduced motion its one still frame is that settled frame, where it was the first. `graview preview` serves it at `/graview/opening-screen` (`OPENING_SCREEN_PATH`) and prints the address; `graview shots --opening-screen` photographs it light and dark, moving and under reduced motion, as `opening-screen[-reduced-motion]-<scheme>-<width>.png`, alone or beside the places `--places` names, and refuses an app with no screen by name; `shootOpeningScreen` on `@graview/ship` is the same for a host with Playwright. Tests: `an-opening-screen-is-photographed-at-its-settled-frame`; harness: `verify-preview`'s `shotsPicturesTheOpeningScreenSettledLightAndDark`.

Compatibility: ops and primitives — unchanged. Stored formats — unchanged. The wire — a preview answers `/graview/opening-screen`; nothing `graview serve` serves changes. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: call the opening-screen pictures from describe_place and set_opening_screen — load `splashPage(brand, { assetsAt })` in its browser at each width, with the reader's `colorScheme` light and dark and `reducedMotion` "reduce" and "no-preference", wait on `SPLASH_SETTLED`, and return the pictures.

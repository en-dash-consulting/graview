---
"@graview/embed": patch
"@graview/skills": patch
---

A host takes back what it handed the bar at mount. `setSchemeChoice(undefined)` left the app menu's Appearance standing when the mount had been given a `schemeChoice`, and the same held for `setAppMenu`, `setShare`, `setStatus` and `setNotifications`: what the host set later was spread over the options it mounted with, and a setting set to nothing was left out, so the mounted one showed through. Every one of the five is now said to the bar, an unset one as nothing, on the embed's `mount` and the pages' `mount` alike. A value handed again still moves at once, as before.

Graview Cloud asked for the profile pane's Scheme block on a mount (Roadmap f-scheme-choice-mount); it shipped in 0.1.66 as the app menu's Appearance: `schemeChoice: { value: "system" | "light" | "dark", onChoose, offers? }` on both mounts and on `<Embed>`, the host's value pressed, a press calling `onChoose` and nothing else, and `handle.setSchemeChoice` moving the press. The graview-embed skill now says it where it says the look. Tests: `a-hosts-scheme-choice-is-in-the-app-menu-and-moves-with-the-host` (embed) holds it on the embed's pages, its scene, the pages alone and `<Embed>`, and `a-hosts-status-is-on-the-app-bar-and-changes-without-a-reload` takes back a status given at mount. verify-chrome's new `aPersonPicksTheSchemeByKeyboardAndTheHostsChoiceMovesThePress` reaches Dark by Tab on both hosted faces, presses it with Enter, hears `onChoose`, sees System still pressed, then sees Dark pressed after `setSchemeChoice`.

Compatibility: the JavaScript API — `setAppMenu`, `setShare`, `setStatus`, `setSchemeChoice` and `setNotifications` given `undefined` now take off a value the mount was given, where they left it drawn. The look — unchanged. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud does: hand `schemeChoice: { value: <the account's Appearance>, onChoose }` to `mount` in place of the host action that stepped through the three; in `onChoose`, save the Appearance, stamp `<html data-theme>`, and call `handle.setSchemeChoice({ value, onChoose })`.

---
"@graview/primitives": patch
---

The account pane says a visitor is not signed in, and offers the host's sign-in first (Graview HQ f-profile-pane-says-signed-out). With the host's `signIn` handed, which a host does only while the reader is a visitor (FR-183), the pane still read "Signed in as" and the visitor's name ("A visitor"), then a role line, "No role in particular", and with others here it read "Seen by others as" and the seat's id: a visitor read that as being somebody anonymous with no way out, and on a home with no struck act nothing else offered a way in.

Now, with `signIn` handed, the pane says "Not signed in", and its first row is the host's own words, `signIn.label`, drawn as the menu draws its sign-in. Being the pane's first control, it is where the keyboard that opens the pane lands; pressing it closes the pane and runs `signIn.run()`. The "Signed in as" and role lines are left off, and with others here the pane says "Others here see you as a visitor". The person's button on the bar is named "Not signed in — sign in and your settings" and wears a person's outline rather than a letter. Without `signIn`, nothing changes.

The person's button saying so is drawn with the page, so a hosted page carries 0.2 KB more up front, and 0.3 KB more when handed a compiled app.

The unit test `the-account-pane-says-a-visitor-is-not-signed-in` holds each claim; the `chrome` harness holds it in a browser on both faces as `theAccountPaneSaysAVisitorIsNotSignedInAndOffersTheHostsSignInFirst`.

Compatibility: the look — for a visitor the host offers a way in, the account pane's top reads as above, its first control is `[data-testid="profile-sign-in"]`, and the person's button has the name and mark above. The JavaScript API — unchanged. Ops and primitives — unchanged. Stored formats — unchanged. The wire — unchanged. The declaration and check finding codes — unchanged. Derived tool names and input schemas — unchanged.

What Graview Cloud may do: leave out its own "Sign in" host action for a visitor, since the account pane now offers the way in it hands as `signIn`.

import { declareInstallation } from "@graview/core";

/**
 * WHO IS HERE, AND WHAT EACH OF THEM MAY DO.
 *
 * The installation is in the graph: a user and an invitation are nodes, and
 * inviting, welcoming, granting and revoking are ordinary mutations —
 * judged by the policy, offered in the strip and on the pages, written to
 * the log with an author and an inverse. Nothing here is an administration
 * screen; the administration screen is the app.
 *
 * Two roles, because two is the smallest number that can disagree:
 *
 *   keeper — keeps the list AND the installation: invites, welcomes,
 *            withdraws, grants, revokes, removes.
 *   member — keeps the list. Never sees a person or an invitation at all:
 *            the module is drawn only for a seat that may administer it,
 *            so for a member the kinds are not hidden behind a refusal —
 *            they are simply not there.
 *
 * This file declares and imports nothing of the app's own, because the
 * schema needs the kinds: anything reaching back for the mutations would
 * close a cycle through `schema.ts`. The policy lives next door.
 */
export const todoInstallation = declareInstallation({
  roles: ["keeper", "member"],
  admin: "keeper",
});


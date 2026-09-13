import { declareInstallation } from "@graview/core";

/**
 * THREE ROLES, because two cannot show the shape of a real installation.
 *
 *   coordinator — keeps the roster AND the installation: covers, uncovers,
 *                 invites, welcomes, grants, revokes.
 *   volunteer   — covers and uncovers shifts, and edits their own profile.
 *   viewer      — reads. Every act is withheld, and every refusal says who
 *                 could take it instead.
 *
 * The viewer is the role that makes the policy legible: a seat that may do
 * NOTHING is the one where "withheld, not hidden" stops being a slogan and
 * becomes a screen full of struck-through acts each carrying its own
 * sentence. Two roles can only ever show a difference; three can show a
 * gradient.
 */
export const rotaInstallation = declareInstallation({
  roles: ["coordinator", "volunteer", "viewer"],
  admin: "coordinator",
});

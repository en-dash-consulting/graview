import { rolesOf } from "../../permissions/policy.js";
import { PUBLISH } from "../../publish.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * WHEN EDITS REACH READERS, JUDGED (Roadmap f-publishing-lifecycle). An app
 * that publishes names who edits the head (`working`) and who publishes
 * (`publishers`) by role, so each way the store could not honor that is a
 * sentence before anybody meets it: a role the policy never names (nobody
 * would hold it, so nobody would edit live or could publish), an app with
 * nobody working, a publisher who is not served what they publish, and an
 * act of the app's own named `publish`, which the built-in one gives way to.
 */
export function checkPublishing<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, mutations, add } = ctx;
  const publishing = app.publishing;
  if (!publishing || publishing.mode !== "on-publish") return;
  const known = new Set(app.policy ? rolesOf(app.policy) : []);
  const unknown = (roles: readonly string[]) => roles.filter((role) => !known.has(role));
  if (publishing.working.length === 0) {
    add({ severity: "error", code: "publishing-nobody-working", where: "publishing.working", message: "The app publishes, and no role works on it: nobody would be served the head, and every edit would wait for a publish nobody may make.", fix: `Name the roles that edit live: "working": ["editor"].` });
  }
  for (const [key, roles] of [["working", publishing.working], ["publishers", publishing.publishers ?? []]] as const) {
    const missing = unknown(roles);
    if (missing.length > 0) {
      add({ severity: "error", code: "publishing-unknown-role", where: `publishing.${key}`, message: `${missing.map((role) => `"${role}"`).join(", ")} ${missing.length === 1 ? "is not a role" : "are not roles"} the policy names, so nobody holds ${missing.length === 1 ? "it" : "them"}.`, fix: known.size > 0 ? `Name the policy's roles: ${[...known].join(", ")}.` : `Declare a policy with the roles that work on the app.` });
    }
  }
  const outside = (publishing.publishers ?? []).filter((role) => !publishing.working.includes(role));
  if (outside.length > 0) {
    add({ severity: "warning", code: "publishing-publisher-not-working", where: "publishing.publishers", message: `${outside.map((role) => `"${role}"`).join(", ")} may publish and ${outside.length === 1 ? "is" : "are"} served only what was published: a publisher would publish changes they cannot see.`, fix: `Add ${outside.join(", ")} to "working", or leave "publishers" out to let the working roles publish.` });
  }
  if (mutations.has(PUBLISH)) {
    add({ severity: "error", code: "publishing-act-taken", where: `mutations.${PUBLISH}`, message: `The app declares its own "${PUBLISH}" act, so the store keeps it and readers are never moved: nothing could publish.`, fix: `Rename the app's "${PUBLISH}" act.` });
  }
}

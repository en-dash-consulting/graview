import { appRoomFindings } from "../../rooms/findings.js";
import { documentOf } from "../../document/to-document.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * AN APP'S ROOMS, HELD TO THE DECLARATION (Graview HQ feature:f-chat-rooms):
 * `defineApp({ rooms })` is asked what a document's `rooms` is asked, in the
 * same words and codes (`room-*`). A document's are judged with its own
 * paths (`compileDocument`), so an app compiled from one is not asked twice.
 */
export function checkRooms<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (!app.rooms || documentOf(app)) return;
  for (const finding of appRoomFindings(app as never)) {
    add({
      severity: finding.severity,
      code: finding.code,
      where: `defineApp(…).rooms${finding.room === undefined ? "" : `["${finding.room}"]${finding.key ? `.${finding.key}` : ""}`}`,
      message: finding.message,
      fix: finding.fix,
    });
  }
}

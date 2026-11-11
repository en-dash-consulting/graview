import { deviceFindings } from "../../device-findings.js";
import { documentOf } from "../../document/to-document.js";
import type { AnySchema } from "../../schema/schema.js";
import type { CheckContext } from "./context.js";

/**
 * AN APP'S DEVICE SCREENS, HELD TO THE DECLARATION (Roadmap
 * f-device-nav-bar): `defineApp({ devices })` is asked what a document's
 * `devices` is asked, in the same words and codes (`device-screen-place`,
 * `device-screen-label`, `device-screen-twice`, `device-screens-too-many`).
 * A document's are judged with its own sentences, at its own paths
 * (`compileDocument`), so an app compiled from one is not asked twice.
 */
export function checkDevices<S extends AnySchema>(ctx: CheckContext<S>): void {
  const { app, add } = ctx;
  if (!app.devices?.screens || documentOf(app)) return;
  for (const finding of deviceFindings(app.devices, app)) {
    add({
      severity: "error",
      code: finding.code,
      where: `defineApp(…).devices.screens${finding.index === undefined ? "" : `[${finding.index}]${finding.key ? `.${finding.key}` : ""}`}`,
      message: finding.message,
      fix: finding.fix,
    });
  }
}

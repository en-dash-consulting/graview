import * as z from "../schema/zod.js";

/*
 * A DOCUMENT'S DEVICE SCREENS, as a shape (Roadmap f-device-nav-bar): a page
 * that draws an app reads `devices` loosely and offers no strip, so this is
 * reached only by the checker (`documentDeviceFindings`), an edit
 * (`add-device-screen`) and the JSON schema an editor reads. What a screen
 * names and how long its word is are the checker's (`device-*`), in words.
 */

/* Built the first time a screen is read (each shape is `z.lazy` over it), not when the module loads. */
function build() {
  const str = (min: number, max: number) => z.string().check(z.minLength(min), z.maxLength(max));
  /** One press of the strip: the place it shows (`home`, `tasks`, `/places/the-week`, `job:<name>`) and the word under it. */
  const DeviceScreenSpec = z.strictObject({ place: str(1, 200), label: str(1, 200) });
  /** The strip's screens in order; the checker holds how many (`device-screens-too-many`). */
  const DevicesSpec = z.strictObject({ screens: z.optional(z.array(DeviceScreenSpec).check(z.maxLength(40))) });
  return { DeviceScreenSpec, DevicesSpec };
}
let built: ReturnType<typeof build> | undefined;
const shapes = () => (built ??= build());

export const DeviceScreenSpec = z.lazy(() => shapes().DeviceScreenSpec);
export const DevicesSpec = z.lazy(() => shapes().DevicesSpec);
export type DeviceScreenSpec = z.infer<typeof DeviceScreenSpec>;
export type DevicesSpec = z.infer<typeof DevicesSpec>;

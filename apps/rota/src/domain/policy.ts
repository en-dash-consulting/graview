import type { Policy } from "@graview/core";
import { rotaInstallation } from "./installation.js";

/**
 * WHO MAY DO WHAT, and the viewer is the point.
 *
 * A coordinator keeps the roster and the installation. A volunteer works the
 * roster — covers, hands back, and changes what they can take — and keeps
 * their own profile. A viewer reads.
 *
 * The third role is what makes a policy legible rather than merely present:
 * sitting in the viewer's seat, every act on every surface is struck through
 * and carrying the sentence that says who could take it instead. Two roles
 * can show a difference; three can show a gradient, and a gradient is what
 * anybody actually has.
 *
 * The acts are named rather than starred, because an act added tomorrow
 * should be refused until somebody decides who may run it. Derived edits are
 * not listed — `permits` reads them through the declared acts they ride.
 */
const theRoster: Policy = {
  roles: ["coordinator", "volunteer", "viewer"],
  grants: [
    {
      roles: ["coordinator"],
      mutations: ["add-shift", "add-volunteer", "move-shift", "drop-shift", "rename", "step-back", "step-up"],
      describe: "The coordinator keeps the roster: what is on it, who is on it, and what it is called.",
    },
    {
      roles: ["coordinator", "volunteer"],
      mutations: ["cover", "uncover", "set-limit"],
      describe: "Anybody who turns up may take a shift on, hand one back, and say what they can manage.",
    },
  ],
};

export const rotaPolicy: Policy = rotaInstallation.withPolicy(theRoster);

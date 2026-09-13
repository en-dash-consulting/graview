import type { Policy } from "@graview/core";
import { todoInstallation } from "./installation.js";
import { todoMutations } from "./mutations.js";

/**
 * The list is everybody's; the installation is the keeper's.
 *
 * Naming the acts rather than saying `*` is the point of writing a policy at
 * all: an act added tomorrow is refused until somebody decides who may run
 * it, which is the failure mode you want. Derived edits are not listed —
 * `permits` reads them through the declared acts they ride, so whoever may
 * change a task may change what was set when it was made.
 *
 * Both roles keep the list, because a permission system whose first act is
 * to stop people doing the thing the app is for teaches the wrong lesson
 * about what one is for. What the member cannot do is decide who else is
 * here.
 */
const theList: Policy = {
  roles: ["keeper", "member"],
  grants: [
    {
      roles: "*",
      mutations: todoMutations.map((mutation) => mutation.name),
      describe: "Everybody here works the list: adding, finishing, planning, moving and dropping.",
    },
  ],
};

/** The app's policy with the installation's grants and roles folded in. */
export const todoPolicy: Policy = todoInstallation.withPolicy(theList);

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
 *
 * A grant to every role is a door, not a key (the ninth walk, W-201):
 * riding it, a derived edit, archive, merge or remove reaches only the
 * records that seat made. So the list's acts are granted twice: to every
 * seat, which may work the list and change what it wrote down itself, and
 * to the two roles by name, who keep the whole list — "Change the task" on
 * a task somebody else added is the keeper's and the member's too.
 */
const LIST_ACTS = todoMutations.map((mutation) => mutation.name);
const theList: Policy = {
  roles: ["keeper", "member"],
  grants: [
    {
      roles: "*",
      mutations: LIST_ACTS,
      describe: "Everybody here works the list: adding, finishing, planning, moving and dropping.",
    },
    {
      roles: ["keeper", "member"],
      mutations: LIST_ACTS,
      describe: "The keeper and the members keep every task and list, whoever wrote it down.",
    },
  ],
};

/** The app's policy with the installation's grants and roles folded in. */
export const todoPolicy: Policy = todoInstallation.withPolicy(theList);

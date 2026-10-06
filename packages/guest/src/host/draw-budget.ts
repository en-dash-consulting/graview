/*
 * THE HOST'S OWN TIME, DRAWING A GUEST (FR-94).
 *
 * What a worker guest or view sends is drawn on the page's main thread. A
 * few messages, each holding thousands of records — a long style set again
 * and again, a subtree built, taken away and built again — would hold the
 * page for seconds under the message allowance and the node cap, and that
 * time is the page's, not the guest's, to the timers that watch the guest.
 * So the host counts its own time drawing one guest: over any one second it
 * may spend at most `drawMs`. A batch is stopped partway when the budget
 * runs out, and the caller stops the guest as slow.
 */

export interface DrawBudget {
  /**
   * Draw one batch: `run` is handed `spent`, which says the budget has run
   * out, to ask between records. Whether the guest is still within its
   * budget once the batch is drawn (false: stop it).
   */
  draw(run: (spent: () => boolean) => boolean): boolean;
}

export function createDrawBudget(drawMs: number, now: () => number): DrawBudget {
  let since = now();
  let spent = 0;
  return {
    draw(run) {
      const began = now();
      if (began - since >= 1_000) {
        since = began;
        spent = 0;
      }
      const whole = run(() => spent + (now() - began) >= drawMs);
      spent += now() - began;
      return whole && spent < drawMs;
    },
  };
}

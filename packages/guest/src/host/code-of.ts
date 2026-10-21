import type { GuestWorkerSource } from "./worker-start.js";

/** A worker view's code: its own source, which the host makes a worker of, or a whole worker script. */
export type WorkerViewCode = GuestWorkerSource | { readonly source: string };

/**
 * A worker view's code, fetched only when the view is first drawn
 * (Roadmap f-heavy-apps-fast): a host registers every view by its manifest
 * — places, menus and the catalog read manifests — and hands each one's
 * code as this, so a page fetches the code of the views it draws and no
 * other. Asked once per function; asked again after it rejected.
 */
export type WorkerViewLoad = () => Promise<WorkerViewCode>;

const loading = new WeakMap<WorkerViewLoad, Promise<WorkerViewCode>>();

/** The code a load answers, asked once however many times the view is drawn; forgotten when it rejects, so the next drawing asks again. */
export function codeOf(load: WorkerViewLoad): Promise<WorkerViewCode> {
  let asked = loading.get(load);
  if (!asked) {
    asked = Promise.resolve()
      .then(load)
      .catch((error: unknown) => {
        loading.delete(load);
        throw error;
      });
    loading.set(load, asked);
  }
  return asked;
}

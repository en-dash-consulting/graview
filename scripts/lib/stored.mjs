/**
 * WHAT A PAGE'S BROWSER ADAPTER KEPT, read as the adapter keeps it: in
 * IndexedDB (the `entries` store of the `graview` database), the log in
 * pieces, and in localStorage only where IndexedDB would not open or a
 * store has not been carried forward yet. A harness asks this rather than
 * `localStorage.getItem`, which a store has not been kept in since
 * `@graview/ship`'s browser adapter moved to IndexedDB.
 *
 *   const snapshot = await stored(page, "graview:seedbed:snapshot");
 *   const log = await stored(page, "graview:seedbed:log"); // every piece, in order
 *
 * Answers the parsed JSON, or null when nothing is kept under the key.
 */
export function stored(page, key) {
  return page.evaluate(async (wanted) => {
    const local = () => {
      const raw = localStorage.getItem(wanted);
      return raw === null ? null : JSON.parse(raw);
    };
    const db = await new Promise((resolve) => {
      try {
        const request = indexedDB.open("graview", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("entries");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (!db) return local();
    const read = (keys) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("entries", "readonly");
        const requests = keys.map((one) => tx.objectStore("entries").get(one));
        tx.oncomplete = () => resolve(requests.map((request) => (typeof request.result === "string" ? request.result : null)));
        tx.onerror = () => reject(tx.error);
      });
    try {
      const [raw] = await read([wanted]);
      if (raw === null) return local();
      if (!wanted.endsWith(":log")) return JSON.parse(raw);
      // The log's key holds how many pieces it is in.
      const pieces = await read(Array.from({ length: Number(raw) || 0 }, (_, n) => `${wanted}:${n}`));
      return pieces.flatMap((piece) => (piece === null ? [] : JSON.parse(piece)));
    } finally {
      db.close();
    }
  }, key);
}

/**
 * WHAT THE RUNTIME KEEPS FOR ITSELF, taken before anything else in the
 * worker runs: how to hear the host's hello and how to say ready. These
 * are held here, in a module's scope, where guest code has no name for
 * them; the globals they came from are removed before guest code runs
 * (harden.ts), so the guest cannot hear the hello or forge one of its own.
 */
interface WorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
}

const scope = globalThis as unknown as WorkerScope;
const add = scope.addEventListener;
const remove = scope.removeEventListener;
const post = scope.postMessage;
const microtask = globalThis.queueMicrotask;

export const natives = {
  listen: (heard: (event: MessageEvent) => void) => add.call(scope, "message", heard),
  unlisten: (heard: (event: MessageEvent) => void) => remove.call(scope, "message", heard),
  post: (message: unknown) => post.call(scope, message),
  microtask: (task: () => void) => microtask.call(globalThis, task),
};
